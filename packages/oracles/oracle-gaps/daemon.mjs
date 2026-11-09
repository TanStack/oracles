// The gap report's daemon: one process per package that keeps a check
// session warm (check.mjs) and its evidence store on disk (evidence.mjs), so
// an author who checks hundreds of times pays Vitest's startup once and reruns
// only the units whose inputs changed. A check through the daemon reports
// what a cold run reports (the CLI oracle's law 9).
//
// One daemon serves a package, across crashes, reboots, and concurrent
// starts. A daemon creates the package's lock file exclusively, with a token
// no other process can have, and listens on the socket at once: listening
// is how a holder proves it lives, so a reused process id proves nothing. A
// daemon that finds the lock waits for a listener; a lock that no daemon
// listens for within the grace period was left by one that died, and the
// first daemon to rename it away claims it. A daemon whose lock another has
// since taken stops serving. A stopping daemon answers `closing` while it
// closes its contexts and flushes its evidence, and releases the socket and
// the lock only after that, so the next daemon reads what it wrote.
//
// The CLI talks to it over a Unix socket named by the package's path. Each
// request is one line of JSON, the CLI's arguments; the reply is one line of
// JSON with the exit code and the output a cold run would have printed. One
// check runs at a time. The daemon exits when asked, or after 30 idle
// minutes.
//
// The CLI starts it: node daemon.mjs --package <dir>. Each check's evidence is
// flushed to disk before the reply, so a daemon that is killed keeps what it
// ran.
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { randomUUID } from 'node:crypto'
import {
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { connect, createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const idleMs = 30 * 60_000

/** The socket of a package's daemon. A socket path must stay short. */
export const socketOf = (pkg) =>
  join(
    tmpdir(),
    `oracle-gaps-${createHash(`sha1`).update(pkg).digest(`hex`).slice(0, 12)}.sock`,
  )
/** Where a package's daemon keeps its evidence and its log. */
export const stateDirOf = (pkg) => join(pkg, `.oracle-gaps`)

function send(pkg, message) {
  return new Promise((resolvePromise, reject) => {
    const socket = connect(socketOf(pkg))
    let reply = ``
    socket.on(`connect`, () => socket.write(`${JSON.stringify(message)}\n`))
    socket.on(`data`, (chunk) => {
      reply += chunk
    })
    socket.on(`end`, () => {
      // A daemon that ends a connection unanswered has died, or is exiting.
      if (reply === ``) return resolvePromise({ died: true })
      try {
        resolvePromise(JSON.parse(reply))
      } catch (error) {
        reject(error)
      }
    })
    socket.on(`error`, (error) =>
      // A daemon that exits under a request resets its connection.
      [`ECONNRESET`, `EPIPE`].includes(error.code)
        ? resolvePromise({ died: true })
        : reject(error),
    )
  })
}

// No daemon listens on the socket.
const absent = (error) => [`ENOENT`, `ECONNREFUSED`].includes(error.code)
const errorFileOf = (pkg) => join(stateDirOf(pkg), `daemon.error`)

/** Starts a daemon for the package, detached from this process. */
function startDaemon(pkg) {
  mkdirSync(stateDirOf(pkg), { recursive: true })
  const log = openSync(join(stateDirOf(pkg), `daemon.log`), `a`)
  spawn(process.execPath, [join(here, `daemon.mjs`), `--package`, pkg], {
    detached: true,
    stdio: [`ignore`, log, log],
  }).unref()
}

/**
 * Sends a check to the package's daemon, starting one when none listens.
 * The CLI gets the daemon's reply, or the error of a daemon it started that
 * could not load or open its session, or a fresh daemon in place of one
 * that died; a closing daemon is waited for. Never longer than 60 s.
 */
export async function requestDaemon(pkg, argv) {
  const began = Date.now()
  // When this CLI last started a daemon; a daemon that answered since then
  // (closing, restarting, or dying) makes it start the next one itself.
  let startedAt
  let deaths = 0
  for (;;) {
    let reply
    try {
      reply = await send(pkg, { argv, cwd: process.cwd() })
    } catch (error) {
      if (!absent(error)) throw error
      // The daemon this CLI started could not load or open its session.
      const failed = startedAt !== undefined && readText(errorFileOf(pkg))
      if (failed && statSync(errorFileOf(pkg)).mtimeMs >= startedAt) {
        rmSync(errorFileOf(pkg), { force: true })
        return { exitCode: 1, stdout: ``, stderr: failed }
      }
      // A daemon this CLI started has the grace period to listen.
      if (startedAt === undefined || Date.now() - startedAt > GRACE_MS * 2) {
        startDaemon(pkg)
        startedAt = Date.now()
      }
    }
    if (reply?.died) {
      deaths += 1
      if (deaths > 2)
        throw new Error(
          `the package's daemon exited during the check ${deaths} times; its log is ${join(stateDirOf(pkg), `daemon.log`)}`,
        )
    }
    if (reply && !reply.closing && !reply.restart && !reply.died) return reply
    if (reply) startedAt = undefined
    if (Date.now() - began > WAIT_MS)
      throw new Error(`the package's daemon did not answer within 60 s`)
    await sleep(100)
  }
}

/**
 * Stops the package's daemon, if one runs, after its current check, and
 * returns once it has closed: its socket answers no more.
 */
export async function stopDaemon(pkg) {
  for (let waited = 0; waited <= WAIT_MS; waited += 100) {
    try {
      const reply = await send(pkg, { stop: true })
      if (!reply.closing && !reply.died) return
    } catch (error) {
      if (!absent(error)) throw error
      return
    }
    await sleep(100)
  }
  throw new Error(`the package's daemon did not finish closing within 60 s`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// How long a CLI waits for a daemon to start or to finish closing.
const WAIT_MS = 60_000
// This daemon's lock token, which no other process can hold.
const token = `${process.pid}:${randomUUID()}`
// How long a lock's holder has to listen before the lock counts as left by
// a daemon that died. A holder listens right after it takes the lock.
const GRACE_MS = 2000
const readText = (path) => {
  try {
    return readFileSync(path, `utf8`)
  } catch {
    return undefined
  }
}
/** Whether a daemon listens on `socket`: a connection is accepted. */
const listening = (socket) =>
  new Promise((resolvePromise) => {
    const connection = connect(socket)
    connection.on(`connect`, () => {
      connection.destroy()
      resolvePromise(true)
    })
    connection.on(`error`, () => resolvePromise(false))
  })

/**
 * Takes the package's lock, or returns false when a live daemon holds it.
 */
async function takeLock(lock, socket) {
  for (;;) {
    try {
      writeFileSync(lock, token, { flag: `wx` })
      return true
    } catch (error) {
      if (error.code !== `EEXIST`) throw error
    }
    const seen = readText(lock)
    for (let waited = 0; waited < GRACE_MS; waited += 100) {
      if (await listening(socket)) return false
      await sleep(100)
    }
    // A new holder took the lock meanwhile: look again.
    if (readText(lock) !== seen) continue
    // Rename is atomic, so one claimant moves the stale file. One that
    // moved a newer holder's lock instead gives it back.
    const claim = `${lock}.${process.pid}`
    try {
      renameSync(lock, claim)
    } catch {
      continue
    }
    if (readText(claim) !== seen)
      try {
        linkSync(claim, lock)
      } catch {
        // A third daemon took the lock; the one whose lock this was stops
        // serving when it sees that (`serve`).
      }
    rmSync(claim, { force: true })
  }
}

async function serve(pkg) {
  mkdirSync(stateDirOf(pkg), { recursive: true })
  const lock = join(stateDirOf(pkg), `daemon.lock`)
  const socket = socketOf(pkg)
  if (!(await takeLock(lock, socket))) process.exit(0)
  // A dead daemon's socket; this daemon holds the lock.
  rmSync(socket, { force: true })
  let closing = false
  // Why the daemon could not load or open its session.
  let failure
  let session
  let store
  let code
  let codeIdentity
  let parseArgs
  let idle
  let watch
  // Requests wait until the session is open.
  let opened
  let queue = new Promise((resolvePromise) => {
    opened = resolvePromise
  })
  // Stops serving: the requests already queued run first, each hearing
  // `closing`, then the daemon shuts down.
  const close = () => {
    closing = true
    queue = queue.then(() => shutdown())
  }
  const closeAfter = (ms) => {
    clearTimeout(idle)
    idle = setTimeout(close, ms)
  }
  const reply = (connection, value) =>
    connection.end(`${JSON.stringify(value)}\n`)
  const server = createServer((connection) => {
    let request = ``
    connection.on(`data`, (chunk) => {
      request += chunk
      if (!request.includes(`\n`)) return
      const message = JSON.parse(request)
      // A closing daemon serves nothing more; the caller waits for the next.
      if (closing) return reply(connection, { closing: true })
      if (message.stop) {
        closing = true
        queue = queue.then(() => shutdown(connection))
        return
      }
      queue = queue.then(async () => {
        clearTimeout(idle)
        // A request queued before the session failed hears why.
        if (failure)
          return reply(connection, {
            exitCode: 1,
            stdout: ``,
            stderr: `${failure.stack ?? failure}\n`,
          })
        if (closing) return reply(connection, { closing: true })
        // A daemon whose code changed declines this check and closes after
        // the requests already queued, each of which hears `closing`.
        if (codeIdentity() !== code) {
          closing = true
          queue = queue.then(() => shutdown(connection, { restart: true }))
          return
        }
        const stderr = []
        let stdout = ``
        let exitCode = 0
        try {
          // Paths are the caller's, so they resolve against its directory.
          const options = parseArgs(message.argv, message.cwd)
          if (options.pkg !== pkg)
            throw new Error(`this daemon serves ${pkg}, not ${options.pkg}`)
          stdout = `${await session.check(options, store, (line) => stderr.push(`${line}\n`))}\n`
          await store.flush()
        } catch (error) {
          stderr.push(`${error?.stack ?? error}\n`)
          exitCode = 1
        }
        reply(connection, { exitCode, stdout, stderr: stderr.join(``) })
        closeAfter(idleMs)
      })
    })
  })
  // Close the contexts and flush the evidence, then release the socket and
  // the lock (when they are still this daemon's), then answer.
  async function shutdown(connection, value = { exitCode: 0 }) {
    closing = true
    clearInterval(watch)
    await session?.close()
    await store?.close()
    if (readText(lock) === token) {
      rmSync(socket, { force: true })
      rmSync(lock, { force: true })
    }
    server.close()
    if (connection)
      await new Promise((r) => connection.end(`${JSON.stringify(value)}\n`, r))
    process.exit(0)
  }
  // Listening proves that this daemon holds the lock, so it listens before
  // it loads anything; checks wait for the session.
  await new Promise((resolvePromise) => server.listen(socket, resolvePromise))
  try {
    const check = await import(`./check.mjs`)
    // The CLI's code as this process loaded it. A process cannot reload its
    // modules, so a daemon whose code changed must not run another check.
    codeIdentity = check.codeIdentity
    code = codeIdentity()
    ;({ parseArgs } = await import(`./args.mjs`))
    const { diskStore } = await import(`./evidence.mjs`)
    store = await diskStore(stateDirOf(pkg))
    session = await check.openSession(pkg)
  } catch (error) {
    // The requests already queued hear why, and the CLI that started this
    // daemon reads it from the error file, written before the lock is
    // released; then the daemon closes, so the next request starts a fresh
    // one rather than hearing this error again.
    failure = error
    writeFileSync(errorFileOf(pkg), `${error?.stack ?? error}\n`)
    opened()
    close()
    return
  }
  rmSync(errorFileOf(pkg), { force: true })
  opened()
  // A daemon whose lock another daemon took serves no more.
  watch = setInterval(() => {
    if (!closing && readText(lock) !== token) close()
  }, 2000)
  closeAfter(idleMs)
}

if (import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const at = process.argv.indexOf(`--package`)
  await serve(realpathSync.native(resolve(process.argv[at + 1])))
}
