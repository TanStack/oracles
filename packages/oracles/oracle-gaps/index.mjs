#!/usr/bin/env node
// Gap report: which production behaviour do the oracles that own it leave
// unexercised or unjudged?
//
// The report does not locate bugs or judge laws. It lists gaps: evidence that
// the owning oracles cannot see some difference in production. The author
// states the law each gap reveals and re-plans the oracle (report.mjs). For
// the source files given, it:
//
// 1. Compiles every operator mutant into one instrumented copy of each file
//    (schemata.mjs) and serves that copy to Vitest through a plugin. Nothing
//    is written to the source file. State-probe code is marked and left out.
// 2. Finds every test file the package's Vitest config includes. A test file
//    that calls `oracleProperty`, or passes `{ owns }` to any call (a
//    wrapper that forwards it to `oracleProperty`), is an oracle file;
//    owning an entry
//    function owns its static call tree (owners.mjs). A declaration that
//    names nothing or is not a literal list refuses the run, because it would
//    hide gaps.
// 3. Runs every test file with no mutant active, the oracle files twice
//    (with --only, only the selected mutants' owners). Each test reports the
//    mutation sites it reached, the outcomes each `if` took, the values it
//    asserted on and observed, its registered route, and its law verdicts
//    (capture-setup.mjs). A test whose values differ between the runs is
//    nondeterministic and judges nothing. The report leads with this
//    baseline: each file's result and test counts, and a failing test's
//    error, law, counterexample, and replay command. An oracle file that
//    fails here blocks the mutants it owns: each that no passing owner kills
//    is `blocked`, the rest are judged, and the report is provisional. A
//    failing ordinary file is left out and listed.
// 4. Runs each mutant against the owner files whose tests reached it, in a
//    warm Vitest process, and classifies it (see `outcomeOf`): `killed` only
//    by a law verdict on a reproducible route; otherwise a gap. A mutant in a
//    function no oracle owns is `unowned`, a warning. Survivors are sorted
//    into `not-judged`, `indeterminate`, `dead-code`, `outside-annotation`, `branch-never-taken`,
//    `not-infected`, and `not-observed` (classify.mjs).
// 5. With --ordinary, runs a survivor against the ordinary tests that reach
//    it, for information only: an ordinary test never closes a gap. Without
//    it, ordinary test files do not run at all.
//
// Copies of the test files share one realm, so each copy must start from the
// worker's first globals. To remove the globals a copy defines, the harness
// wraps `Object.defineProperty`, `Object.defineProperties`, and
// `Reflect.defineProperty` and keeps every new global configurable. A test
// that inspects global property descriptors (a global it defined reports
// `configurable: true`) or the identity of `Object.defineProperty` can
// behave differently under the gap report; leave such a test out of the
// files that declare `owns` (maintainer decision, 2026-11-08: speed over
// this rare case).
//
// A Vitest config that defines `test.projects` refuses the run: each project
// has its own environment and setup files, which the runner's copies would
// not run under.
//
// The pipeline lives in check.mjs, as a session that keeps Vitest warm. A
// cold run opens one session for one check. With --daemon, the CLI sends the
// check to a daemon for the package (daemon.mjs), starting it if needed; the
// daemon keeps its session and an evidence store on disk, reuses every unit
// of evidence whose inputs are unchanged, and reports what a cold run would.
//
// The rules are the maintainer's gap-check decisions, recorded in the design
// notes of the project that adopted this CLI (design runs 11, 14, and 19).
// Those notes are not part of this package, and neither are the CLI's own
// oracles, which live in its repository.
//
// A run that does not complete never ends with a bare stack trace
// (ending.mjs; maintainer decision, 2026-11-10). A problem the author can
// fix (bad arguments, a broken owns declaration, no oracle file or owner,
// `test.projects`, a Vitest that does not load) refuses the run: exit 2, `refused: <cause>` and `fix:
// <directive>` on stderr, and results.json and summary.md in the output
// directory once the arguments name one. Any other error is a bug in the
// CLI: exit 3, and its stack in error.log. A check through the daemon ends
// the same way: the daemon sends the error, and this process ends with it.
//
// --seed sets `${envPrefix}_SEED` in every test run, where envPrefix is
// --env-prefix (default ORACLE), so random campaigns run the same histories
// every time and captured values stay comparable. The project's oracle
// configuration must read that prefix. The framework declares that seed
// fixed, so a random unit's failure kills a mutant. Without --seed, the
// capture seeds Math.random in each test from the test's name
// (capture-setup.mjs), so each random unit runs at a seed fixed by its test
// name, and its failure is a random-only-kill gap. No check draws a new seed.
//
// Usage:
//   oracle-gaps --package <dir> --source <src/x.ts,...>   (relative to <dir>)
//     [--env-prefix <name>]   (the framework's variable prefix; default ORACLE)
//     [--daemon]              (check through the package's daemon)
//     [--ordinary]            (also run ordinary test files, for information)
//     [--seed <n>] [--mutants <dir>] [--out <dir>] [--only <id,id>]
//     [--diff-base <rev>]
//     [--first-limit <ms>]    (a copy's first budget; default 2000)
//     [--hang-limit <ms>]     (the full limit a cut copy gets again; default 10000)
//     [--mutant-limit <ms>]   (the floor of each mutant's budget, which the
//                              runs that confirm its cut copies share; the
//                              budget is the larger of this and ten times
//                              its owner files' unmutated time; default 30000)
//     [--test-timeout <ms>]   (default 15000; also bounds hooks and teardown.
//                              Each mutant run also has a wall-clock limit of
//                              10 s plus three times its file's unmutated time.)
//     [--sample <n>]          (a fixed-seed sample of n mutants per source;
//                              the report marks the run as partial)
//     [--contexts <n>]        (warm contexts, one worker each; default
//                              the machine's parallelism minus 2, at most 16)
//     [--pool threads|forks]  (Vitest's pool; default threads, or forks when
//                              a native addon is anywhere in the package's
//                              dependency tree)
//     [--config <file>]       (the Vitest config, relative to <dir>; default
//                              the one Vitest discovers; the baseline names
//                              the config it loaded, or says it found none)
//   oracle-gaps --stop-daemon --package <dir>
//   oracle-gaps --help      (prints the usage text, args.mjs)
// Every line the CLI writes for a check starts with `oracle-gaps: ` and its
// kind (stream.mjs), and the last is `oracle-gaps: done <status>`.
// Exit codes: 0 the check completed, whatever its gaps (the last stdout
// line is `oracle-gaps: done completed, <n> gaps, report <path>`), 2
// refused, 3 an internal error, and 130 or 143 when SIGINT or SIGTERM
// stopped it.
//
// No process outlives the CLI (maintainer disposition G2, 2026-11-11). The
// CLI starts a check as a child in a process group of its own, which every
// Vitest worker joins, and every process a test starts unless it starts it
// detached (in a session of its own, as a browser driver can), and waits
// for it. Help, --stop-daemon, and arguments that refuse start no process,
// so they end in the CLI's own process, without a second Node start. On win32,
// which has no process groups, the supervisor ends the child's tree with taskkill.
// SIGINT or SIGTERM is sent on to the whole group; a process that has not
// ended 2 s later is killed, and so is any process left in the group when
// the run ends. The run kills its group itself if the CLI dies first.
// The stop handlers and the claim on the output directory come before the
// CLI's modules load (review of #57, P1): a signal during the loads is kept
// and acted on once the stream log's note is written, so a stop as the CLI starts still
// leaves the note and one done line. Only Node's own start is before them.
import { spawn, spawnSync } from 'node:child_process'
import {
  appendFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { constants } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { alive, posix, removeSession } from './paths.mjs'

let early
const keepEarly = (signal) => {
  early ??= signal
}
process.on(`SIGINT`, keepEarly)
process.on(`SIGTERM`, keepEarly)
// A test-only marker (ORACLE_GAPS_TEST_STARTED): the first statement that runs
// project code writes this file, before any project module loads, so a test can
// tell a stop that came before the CLI started from one that came during its loads.
if (process.env.ORACLE_GAPS_TEST_STARTED)
  writeFileSync(process.env.ORACLE_GAPS_TEST_STARTED, ``)
// A test-only hold after the marker (ORACLE_GAPS_TEST_PAUSE_AFTER_STARTED): the
// CLI waits there until it has kept a stop (keepEarly), or until the test stop
// file exists (win32, ORACLE_GAPS_TEST_STOP), so a stop a test sends on seeing the
// marker lands before the handlers below are installed, whatever the load. The
// stop releases the hold, never the time; a hold with no stop within 60 s fails
// loudly. Inert unless set.
if (process.env.ORACLE_GAPS_TEST_PAUSE_AFTER_STARTED !== undefined) {
  const stopFile = process.env.ORACLE_GAPS_TEST_STOP
  for (
    let waited = 0;
    early === undefined && !(stopFile !== undefined && existsSync(stopFile));
    waited += 10
  ) {
    if (waited >= 60_000)
      throw new Error(`the hold after the started marker saw no stop in 60 s`)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  // win32 has no signal to send, so the stop file stands for it: the hold ended
  // by it, so it is kept as a signal is (an early stop). Without this the
  // supervisor's poll of the file starts only after its child has been spawned,
  // and the stop lands in a running child.
  if (early === undefined && stopFile !== undefined && existsSync(stopFile))
    keepEarly(`SIGINT`)
}

const { parseArgs, usage } = await import(`./args.mjs`)
const { endRun, Refusal } = await import(`./ending.mjs`)
// ending.mjs loads stream.mjs, so this import costs no load of its own.
const { escapeControls, streamLine } = await import(`./stream.mjs`)

// How long the group has to end after a stop signal before it is killed.
const STOP_GRACE_MS = 2000

// The stream log (the maintainer's decision of 2026-11-12): a run that
// starts a check writes its stderr to `<out>/stream.log` too, line for line,
// and names that file in its first line on both streams. The supervisor opens
// it before the child starts (startLog), and is then the only writer of the
// child's stderr to it (superviseRun). Undefined until the log is open.
let streamLog
let writingEnding = false
const logPathOf = (out) => join(out, `stream.log`)
/** Appends `text` to the stream log at `path`; a failure is the refusal that ends the run. */
const appendLog = (path, text) => {
  try {
    appendFileSync(path, text)
  } catch (error) {
    throw cannotWrite(path, error)
  }
}
/** Writes `text` to stderr and, once the log is open, to the stream log. */
const writeStream = (text) => {
  process.stderr.write(text)
  if (streamLog) appendLog(streamLog, text)
}
const cannotWrite = (path, error) =>
  new Refusal(
    `the stream log ${path} cannot be written (${error.code ?? error.message})`,
    `Remove ${path}, or pass --out a directory whose stream.log can be written.`,
  )
// The output directory this process claimed (its run.pid), released when the
// process exits, on every exit but SIGKILL.
let claimed
process.on(`exit`, () => {
  if (claimed === undefined) return
  try {
    if (Number(readFileSync(claimed, `utf8`)) === process.pid)
      rmSync(claimed, { force: true })
  } catch {
    // Already gone.
  }
})
/**
 * Claims output directory `out` for this process. The claim is a temp file that
 * already holds the pid, linked to `run.pid`, which fails when `run.pid` exists,
 * so the claim is atomic. A `run.pid` that names no running process, or that
 * cannot be read, refuses as a live one does: nothing is taken over (the
 * maintainer's decision, "Stale claims refuse; no takeover"), and the user
 * removes the file.
 */
function claimOut(out) {
  const claim = join(out, `run.pid`)
  const temp = `${claim}.${process.pid}.tmp`
  try {
    mkdirSync(out, { recursive: true })
    writeFileSync(temp, `${process.pid}\n`)
  } catch (error) {
    throw claimCannotWrite(out, claim, error)
  }
  try {
    // A claim that vanishes between the link and the read was released by a run
    // that just ended: the link is tried again, a few times at most.
    for (let attempt = 1; ; attempt += 1) {
      try {
        linkSync(temp, claim)
        claimed = claim
        return
      } catch (error) {
        if (error.code !== `EEXIST`) throw claimCannotWrite(out, claim, error)
        const holder = readHolder(claim)
        if (holder === undefined && attempt < 3) continue
        // A claim that the link finds and no read does (a link to no file, or
        // one released and retaken on every try) can't be read.
        throw heldRefusal(out, claim, holder ?? UNREADABLE)
      }
    }
  } finally {
    rmSync(temp, { force: true })
  }
}
/** The refusal for a `run.pid` that cannot be written: the claim's own cause. */
function claimCannotWrite(out, claim, error) {
  return new Refusal(
    `run.pid in ${posix(out)} cannot be written (${error.code ?? error.message})`,
    `if no run uses ${posix(out)}, delete ${posix(claim)}, or pass --out a directory whose run.pid can be written`,
  )
}
/** The refusal for a `run.pid` that holds its directory or cannot be read. */
function heldRefusal(out, claim, holder) {
  const refusal =
    holder === UNREADABLE
      ? new Refusal(
          `run.pid in ${posix(out)} can't be read`,
          `if no run uses ${posix(out)}, delete ${posix(claim)}`,
        )
      : holder > 0 && alive(holder)
        ? new Refusal(
            `another run (pid ${holder}) is using ${posix(out)}`,
            `If no run is using it, delete ${posix(claim)}; otherwise pass --out a directory no run is using.`,
          )
        : holder > 0
          ? new Refusal(
              `run.pid names pid ${holder}, which is not running`,
              `if no run uses ${posix(out)}, delete ${posix(claim)}`,
            )
          : new Refusal(
              `run.pid in ${posix(out)} does not name a pid`,
              `if no run uses ${posix(out)}, delete ${posix(claim)}`,
            )
  refusal.reportless = true
  return refusal
}
/** Read a claim that cannot be read (a directory, or no permission). */
const UNREADABLE = `unreadable`
/**
 * The pid a claim names: undefined when the claim is gone, UNREADABLE when it
 * cannot be read at all, and NaN or 0 when its text names no pid.
 */
function readHolder(claim) {
  try {
    return Number(readFileSync(claim, `utf8`))
  } catch (error) {
    if (error.code === `ENOENT`) return undefined
    return UNREADABLE
  }
}
// The longest a test-only wait lasts before it fails the run loudly.
const TEST_WAIT_LIMIT_MS = 60_000
/**
 * A test-only hold at one named point (ORACLE_GAPS_TEST_PAUSE_AT): the process
 * writes its marker (ORACLE_GAPS_TEST_PAUSE_MARKER) when it reaches the point,
 * then waits until the file ORACLE_GAPS_TEST_PAUSE_UNTIL exists. A test sequences
 * other runs against it and releases it. Inert unless set (register: test hooks).
 */
function testPause(point) {
  const until = enterTestPause(point)
  if (until !== undefined) waitForFile(until, `the pause at ${point}`)
}
/**
 * The same hold for the supervised child, which must keep its event loop
 * running: its orphan watchdog is a timer, and a synchronous wait would stop it,
 * so the child could never end itself while held.
 */
async function testPauseOnTimers(point) {
  const until = enterTestPause(point)
  if (until === undefined) return
  for (let waited = 0; !existsSync(until); waited += 20) {
    if (waited >= TEST_WAIT_LIMIT_MS)
      throw new Error(
        `the pause at ${point} was not released within ${TEST_WAIT_LIMIT_MS} ms`,
      )
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}
/** Writes the marker of the hold at `point`; returns its release file, when the point is held. */
function enterTestPause(point) {
  if (process.env.ORACLE_GAPS_TEST_PAUSE_AT !== point) return undefined
  const marker = process.env.ORACLE_GAPS_TEST_PAUSE_MARKER
  if (marker !== undefined) writeFileSync(marker, ``)
  return process.env.ORACLE_GAPS_TEST_PAUSE_UNTIL
}
/** Waits for `file` for at most TEST_WAIT_LIMIT_MS, then throws. */
function waitForFile(file, what) {
  for (let waited = 0; !existsSync(file); waited += 20) {
    if (waited >= TEST_WAIT_LIMIT_MS)
      throw new Error(
        `${what} was not released within ${TEST_WAIT_LIMIT_MS} ms`,
      )
    sleepMs(20)
  }
}
function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}
/**
 * Claims the output directory and writes the run's first line, on both
 * streams, which names the log. Throws a Refusal when the directory is in use
 * or the log cannot be written; nothing is written then.
 */
function startLog(out) {
  const path = logPathOf(out)
  claimOut(out)
  try {
    writeFileSync(path, ``)
  } catch (error) {
    throw cannotWrite(path, error)
  }
  streamLog = path
  // The log is named in forward slashes on win32 (the Windows paths rule); POSIX
  // paths are unchanged.
  // A line break in the path is written as its escape: the note stays one line
  // (the register's C entry "The internal-error line").
  const note = `oracle-gaps: note log ${escapeControls(posix(path))}\n`
  process.stdout.write(note)
  writeStream(note)
  testPause(`note`)
}

/** Flushes both streams, then exits with `code` (after a test's hold). */
/**
 * A test-only hold (ORACLE_GAPS_TEST_HOLD_UNTIL, a path): after its done line the
 * process keeps its exit, and its output claim, until the file exists. A test
 * releases it once the overlapping run or the stop it sent has been observed, so
 * the outcome does not depend on wall-clock timing. Inert unless set.
 */
// A hold that never releases is a driver fault. The run keeps the exit code its
// done line already stated: the streams stay as the done line left them, and the
// failure is the driver's, through the `.unreleased` marker beside the hold file.
function holdUntil() {
  const file = process.env.ORACLE_GAPS_TEST_HOLD_UNTIL
  if (file === undefined) return
  try {
    waitForFile(file, `the hold`)
  } catch {
    writeFileSync(`${file}.unreleased`, ``)
  }
}
function exitWhenFlushed(code) {
  process.stdout.write(``, () =>
    process.stderr.write(``, () => {
      holdUntil()
      process.exit(code)
    }),
  )
}

/**
 * Runs this CLI again as a child in a process group of its own, and ends with
 * it: with its exit code, or, once a stop signal has ended its group, with 128
 * plus the signal's number. The child gets `--out` appended, the directory this
 * process resolved (review of #57, F2). The child's session directory in `pkg`
 * goes with the child, however the child ended.
 */
function superviseRun(out, pkg) {
  let child
  let stopped
  // How the run ended: its exit code, or the signal that ended it.
  let ended
  // Whether the run said that it writes its ending (a message it sends
  // before it writes): then its done line is the last on each stream, and it
  // ends with its own code, whatever stop reaches it.
  let ending = false
  // Whether the run's stderr, which the CLI passes on, said that V8 ran out
  // of memory.
  let outOfMemory = false
  let stderrTail = ``
  // Whether the run's streams and channel have closed.
  let closed = false
  // Ends the CLI once the run has ended (or the grace has passed), with what
  // is left of the group killed. A run that writes its ending wrote its done
  // line, so the CLI ends with its code and writes none. Every other end gets
  // one done line from the CLI, on both streams: a stop ended the run
  // (stopped); a run whose process ended on its own (a signal, a code, a V8
  // out-of-memory abort) is an error, exit 3, with the remedy when it ran out
  // of memory.
  let finishing = false
  const finish = () => {
    if (finishing) return
    finishing = true
    if (child) signalTree(child.pid, `SIGKILL`)
    let decided = false
    const decide = () => {
      if (decided) return
      decided = true
      // An abort or a kill of the child skips its own cleanup, and the CLI
      // outlives it, so a supervised run leaves no session directory.
      if (child) removeSession(pkg, child.pid)
      if (ending)
        return process.exit(
          ended?.code ?? 128 + constants.signals[ended?.signal ?? stopped],
        )
      const how = ended?.signal ?? (ended ? `code ${ended.code}` : `no exit`)
      const line = stopped
        ? `oracle-gaps: done stopped (${stopped})\n`
        : `oracle-gaps: done error, the run's process exited with ${how}${outOfMemory ? `: it ran out of memory; give Node more (NODE_OPTIONS=--max-old-space-size=<MB>) or run fewer --contexts` : ``}\n`
      process.stdout.write(line, () => {
        // The log was opened before the run started (startLog). A log that
        // cannot take the line does not change the ending: both streams still
        // get it, and the code is the decided one.
        try {
          appendLog(streamLog, line)
        } catch {
          // The line is still written to stderr below.
        }
        process.stderr.write(line, () =>
          process.exit(stopped ? 128 + constants.signals[stopped] : 3),
        )
      })
    }
    if (child === undefined || closed) return decide()
    child.once(`close`, decide)
    setTimeout(decide, 2000).unref()
  }
  const stop = (signal) => {
    if (stopped) return
    stopped = signal
    if (child === undefined) return finish()
    // On win32 a child that has written its ending is not stopped (taskkill
    // would cut the ending short; on POSIX the child ignores the signal itself).
    if (!ending || process.platform !== `win32`) signalTree(child.pid, signal)
    const deadline = Date.now() + STOP_GRACE_MS
    const poll = setInterval(() => {
      if (
        (ended === undefined || signalTree(child.pid, 0)) &&
        Date.now() < deadline
      )
        return
      clearInterval(poll)
      finish()
    }, 50)
  }
  // The stop handlers come first, so a signal that comes while the run starts
  // is a stop too. A stop that came during the CLI's loads ends the run before
  // it starts: its stopped line follows the note the caller already wrote.
  process.on(`SIGINT`, stop)
  process.on(`SIGTERM`, stop)
  // A test-only stop (ORACLE_GAPS_TEST_STOP, #58): once the named file exists, the
  // stop is taken as a SIGINT would be. Inert unless set.
  watchTestStop(stop)
  if (early !== undefined) return stop(early)
  // An inspector flag would bind the CLI's own port a second time.
  child = spawn(
    process.execPath,
    [
      ...process.execArgv.filter((flag) => !/^--inspect/.test(flag)),
      ...process.argv.slice(1),
      `--out`,
      out,
    ],
    {
      // win32 has no process groups: the child is not detached there, and its
      // tree is ended by signalTree.
      detached: process.platform !== `win32`,
      stdio: [`inherit`, `inherit`, `pipe`, `ipc`],
      env: {
        ...process.env,
        ORACLE_GAPS_INTERNAL_SUPERVISED: String(process.pid),
      },
    },
  )
  // A test that kills this supervisor reads the child's pid beside the started
  // marker (ORACLE_GAPS_TEST_STARTED), to see the child exit (the watchdog).
  if (process.env.ORACLE_GAPS_TEST_STARTED !== undefined)
    writeFileSync(
      `${process.env.ORACLE_GAPS_TEST_STARTED}.child`,
      `${child.pid}\n`,
    )
  child.on(`message`, (message) => {
    if (message === `ending`) ending = true
  })
  // The run's stderr, passed on as it comes, written to the stream log as it is
  // (V8's own lines included, which the run does not write itself), and read
  // for V8's out-of-memory message.
  child.stderr.on(`data`, (chunk) => {
    process.stderr.write(chunk)
    // A chunk the log cannot take is not written to it, and the relay goes on: the
    // run's own ending stays the only done line on each stream.
    try {
      appendLog(streamLog, chunk)
    } catch {
      // The stream log cannot be written; stderr above has the chunk.
    }
    stderrTail = (stderrTail + chunk).slice(-200)
    if (/heap out of memory/i.test(stderrTail)) outOfMemory = true
  })
  child.on(`close`, () => {
    closed = true
  })
  child.on(`exit`, (code, signal) => {
    ended = { code, signal }
    if (!stopped) finish()
  })
}

/**
 * Signals the process tree of `pid`: its process group on POSIX, where the
 * run's workers are members. win32 has no groups and no signal a process can
 * be sent to end its tree, so there taskkill ends it, and signal 0 asks
 * whether the process runs. False when no process is left.
 */
function signalTree(pid, signal) {
  if (process.platform !== `win32`) {
    try {
      process.kill(-pid, signal)
      return true
    } catch {
      return false
    }
  }
  if (signal === 0) return alive(pid)
  return (
    spawnSync(`taskkill`, [`/T`, `/F`, `/PID`, String(pid)], {
      stdio: `ignore`,
    }).status === 0
  )
}

/**
 * The run's side of the tree: once the CLI that started it is gone, the run
 * kills its tree, itself included.
 */
function watchSupervisor(supervisor) {
  // Only a process that leads its own group kills it: an inherited variable
  // (a test's child, say) must not name a group this process does not lead. A
  // group whose id is this process's pid exists only while this process leads
  // it, so a signal 0 to it tells, with no external command (no `ps`, which a
  // slim container lacks; review of #57, A7). win32 has no groups.
  if (process.platform !== `win32` && !signalTree(process.pid, 0)) return
  setInterval(() => {
    if (!alive(supervisor)) signalTree(process.pid, `SIGKILL`)
  }, 1000).unref()
}
/**
 * A test-only stop (ORACLE_GAPS_TEST_STOP, #58): once the named file exists, the
 * stop is taken as a SIGINT would be. Inert unless set.
 */
function watchTestStop(onStop) {
  const file = process.env.ORACLE_GAPS_TEST_STOP
  if (file === undefined) return
  setInterval(() => {
    if (existsSync(file)) onStop(`SIGINT`)
  }, 50).unref()
}

/**
 * The options of arguments `argv` when they ask for a check, the only run that
 * starts processes; undefined for help, a stop, or arguments that refuse (a
 * refusal is written by the run itself).
 */
function asksForCheck(argv) {
  try {
    const options = parseArgs(argv)
    return options.help || options.stop ? undefined : options
  } catch {
    return undefined
  }
}

/** The summary of a check run in this process. */
async function checkCold(options) {
  const { openSession } = await import(`./check.mjs`)
  const { memoryStore } = await import(`./evidence.mjs`)
  const session = await openSession(options.pkg)
  // A test-only abort (ORACLE_GAPS_TEST_ABORT_AT=check, inert unless set), after
  // the session has begun, where a V8 out-of-memory abort would strike. The
  // supervisor reports how the process ended. win32 has no signal that ends a
  // process as an abort does, so process.abort() ends it; before it ends, Node
  // writes its native backtrace to stderr, a block P10 exempts as Node's own
  // (the oracle's exemptBlocks). POSIX sends itself a SIGABRT, which ends the
  // process the same way and writes nothing.
  if (process.env.ORACLE_GAPS_TEST_ABORT_AT === `check`) {
    if (process.platform === `win32`) process.abort()
    else process.kill(process.pid, `SIGABRT`)
  }
  try {
    return await session.check(options, memoryStore(), (line) =>
      writeStream(`${line}\n`),
    )
  } finally {
    await session.close()
  }
}

/**
 * The summary of a check run by the package's daemon, or, when the daemon
 * stopped answering, of a cold check, after a note that names why (R39: a
 * cold fallback is not a failure). A cold check reports what the daemon's
 * would have (incremental equals cold).
 */
async function checkThroughDaemon(options) {
  const { codeIdentity } = await import(`./check.mjs`)
  const { received, requestDaemon } = await import(`./daemon.mjs`)
  // A run without `--out` names its directory per call (args.mjs), so the daemon
  // would name another one than this run's stream log is in. The request
  // carries the directory this run named.
  const reply = await requestDaemon(
    options.pkg,
    [...process.argv.slice(2), `--out`, options.out],
    codeIdentity(),
  )
  if (reply.silent) {
    writeStream(
      `${streamLine(`note`, `the package's daemon sent nothing for ${reply.silent} s; this check runs cold`)}\n`,
    )
    return checkCold(options)
  }
  if (reply.stderr) writeStream(reply.stderr)
  if (reply.failed) throw received(reply.failed)
  return reply.stdout
}

// The run's ending, once: its refusal or error is written to its output
// directory and stdout and stderr, and the process exits with its code.
let ended = false
const holdStops = () => {
  writingEnding = true
  process.send?.(`ending`)
}
function endWith(error, out) {
  if (ended) return
  ended = true
  const ending = endRun(error, out)
  holdStops()
  try {
    writeStream(ending.stderr)
  } catch {
    // The log cannot take the ending, which writeStream wrote to stderr first.
  }
  process.stdout.write(`${ending.done}\n`)
  exitWhenFlushed(ending.exitCode)
}

// A file URL escapes a space, `#`, and the like, so the script's own URL is
// compared with the URL of the path it was started as.
const main =
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
// A test-only hook (ORACLE_GAPS_TEST_UNSUPERVISED) runs a check unsupervised, the
// path that a run took on win32 before the supervisor covered it.
const supervised = process.env.ORACLE_GAPS_TEST_UNSUPERVISED === undefined
const supervisor = process.env.ORACLE_GAPS_INTERNAL_SUPERVISED

// Set once the note is written (the unsupervised run has started).
let runStarted = false
/** Ends an unsupervised run with its stopped line on both streams (#58). */
function stopNow(signal) {
  const line = `oracle-gaps: done stopped (${signal})\n`
  process.stdout.write(line)
  writeStream(line)
  exitWhenFlushed(128 + constants.signals[signal])
}

async function run() {
  // The run's options, once its arguments parse. The handlers come first, so an
  // error thrown by the supervisor ends the run through endWith too.
  let options
  process.on(`uncaughtException`, (error) => endWith(error, options?.out))
  process.on(`unhandledRejection`, (error) => endWith(error, options?.out))
  // The supervisor: it claims the output directory, writes the note, and runs
  // the child. A refusal of the claim or the log ends it through endWith (the
  // single path for every refusal of a check).
  if (supervised && supervisor === undefined) {
    const checking = asksForCheck(process.argv.slice(2))
    if (checking !== undefined) {
      options = checking
      try {
        startLog(checking.out)
      } catch (error) {
        return endWith(error, checking.out)
      }
      return superviseRun(checking.out, checking.pkg)
    }
  }
  if (supervisor !== undefined) {
    try {
      watchSupervisor(Number(supervisor))
    } catch (error) {
      return endWith(error, options?.out)
    }
    // A supervised child waits here, before it writes anything, so a test can
    // kill its supervisor while the child is silent (the watchdog's own case).
    await testPauseOnTimers(`child`)
  }
  // A test that runs this CLI starts a run of its own, in a group of its own.
  delete process.env.ORACLE_GAPS_INTERNAL_SUPERVISED
  // A stop ends the run at once, with no line: an error that the stop causes
  // is no refusal, and the supervisor writes the stopped line. Once the run
  // writes its ending, a stop no longer cuts it off.
  // The all-or-nothing stop law (#57 and #58): a stop after the note writes one
  // done stopped line on each stream; a supervised child's stop is the
  // supervisor's line; a stop before the note waits for it (the early stop).
  const onStop = (signal) => {
    if (writingEnding) return
    if (!supervised) return runStarted && stopNow(signal)
    process.exit(128 + constants.signals[signal])
  }
  process.on(`SIGINT`, onStop)
  process.on(`SIGTERM`, onStop)
  // A test-only stop for unsupervised runs (ORACLE_GAPS_TEST_STOP, #58).
  if (!supervised) watchTestStop(onStop)
  // A child of a supervisor that was stopped before its own handlers ran exits
  // now (the supervisor writes the line). An unsupervised run keeps the stop
  // and takes it once its note is written, below.
  if (supervisor !== undefined && early !== undefined)
    process.exit(128 + constants.signals[early])
  try {
    options = parseArgs(process.argv.slice(2))
    if (options.help) console.log(usage)
    else if (options.stop) {
      const { stopDaemon } = await import(`./daemon.mjs`)
      await stopDaemon(options.pkg)
    } else {
      // Windows has no supervisor: this process opens the log and runs the
      // check. A child of a supervisor writes its stderr alone.
      if (supervisor === undefined) startLog(options.out)
      runStarted = true
      if (early !== undefined) return stopNow(early)
      const summary = await (options.daemon ? checkThroughDaemon : checkCold)(
        options,
      )
      holdStops()
      // The summary ends with the done line (report.mjs), which ends stderr
      // too.
      console.log(summary)
      writeStream(`${summary.split(`\n`).at(-1)}\n`)
    }
    exitWhenFlushed(0)
  } catch (error) {
    endWith(error, options?.out)
  }
}

if (main) await run()
