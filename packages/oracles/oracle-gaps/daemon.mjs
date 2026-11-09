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
      try {
        resolvePromise(JSON.parse(reply))
      } catch (error) {
        reject(error)
      }
    })
    socket.on(`error`, reject)
  })
}

/**
 * Sends a check to the package's daemon, starting the daemon if needed. A
 * daemon whose own code has changed since it started declines the check and
 * exits, and a new one, which runs the current code, takes it.
 */
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
 * Sends a check to the package's daemon, starting the daemon if none
 * listens. A daemon that is closing is waited for; one whose own code has
 * changed declines the check and exits, and a new one, which runs the
 * current code, takes it.
 */
export async function requestDaemon(pkg, argv) {
  let started = false
  for (let waited = 0; ; waited += 100) {
    try {
      const reply = await send(pkg, { argv, cwd: process.cwd() })
      if (!reply.closing && !reply.restart) return reply
      if (reply.restart) started = false
    } catch (error) {
      if (![`ENOENT`, `ECONNREFUSED`].includes(error.code)) throw error
      if (!started) startDaemon(pkg)
      started = true
      if (waited > 60_000) throw error
    }
    await sleep(100)
  }
}

/** Stops the package's daemon, if one runs, after its current check. */
export async function stopDaemon(pkg) {
  try {
    await send(pkg, { stop: true })
  } catch (error) {
    if (![`ENOENT`, `ECONNREFUSED`].includes(error.code)) throw error
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
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
  let session
  let store
  let idle
  let watch
  // Requests wait until the session is open.
  let opened
  let queue = new Promise((resolvePromise) => {
    opened = resolvePromise
  })
  const server = createServer((connection) => {
    let request = ``
    connection.on(`data`, (chunk) => {
      request += chunk
      if (!request.includes(`\n`)) return
      const message = JSON.parse(request)
      // A closing daemon serves nothing more; the caller waits for the next.
      if (closing) {
        connection.end(`${JSON.stringify({ closing: true })}\n`)
        return
      }
      if (message.stop) {
        closing = true
        queue = queue.then(() => shutdown(connection))
        return
      }
      queue = queue.then(async () => {
        clearTimeout(idle)
        if (closing) {
          connection.end(`${JSON.stringify({ closing: true })}\n`)
          return
        }
        if (codeIdentity() !== code) {
          closing = true
          await shutdown(connection, { restart: true })
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
        connection.end(
          `${JSON.stringify({ exitCode, stdout, stderr: stderr.join(``) })}\n`,
        )
        idle = setTimeout(() => {
          closing = true
          queue = queue.then(() => shutdown())
        }, idleMs)
      })
    })
  })
  // Close the contexts and flush the evidence, then release the socket and
  // the lock (when they are still this daemon's), then answer.
  async function shutdown(connection, reply = { exitCode: 0 }) {
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
      await new Promise((r) => connection.end(`${JSON.stringify(reply)}\n`, r))
    process.exit(0)
  }
  // Listening proves that this daemon holds the lock, so it listens before
  // it loads anything; checks wait for the session.
  await new Promise((resolvePromise) => server.listen(socket, resolvePromise))
  const { codeIdentity, openSession } = await import(`./check.mjs`)
  // The CLI's code as this process loaded it. A process cannot reload its
  // modules, so a daemon whose code changed must not run another check.
  const code = codeIdentity()
  const { diskStore } = await import(`./evidence.mjs`)
  const { parseArgs } = await import(`./args.mjs`)
  store = await diskStore(stateDirOf(pkg))
  session = await openSession(pkg)
  opened()
  // A daemon whose lock another daemon took serves no more.
  watch = setInterval(() => {
    if (!closing && readText(lock) !== token) {
      closing = true
      queue = queue.then(() => shutdown())
    }
  }, 2000)
  idle = setTimeout(() => {
    closing = true
    queue = queue.then(() => shutdown())
  }, idleMs)
}

if (import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const at = process.argv.indexOf(`--package`)
  await serve(realpathSync(resolve(process.argv[at + 1])))
}
