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
// configuration must read that prefix.
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
// so they end in the CLI's own process, without a second Node start. Windows has no process groups, so there the run is not supervised.
// SIGINT or SIGTERM is sent on to the whole group; a process that has not
// ended 2 s later is killed, and so is any process left in the group when
// the run ends. The run kills its group itself if the CLI dies first.
import { spawn } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { constants } from 'node:os'
import { pathToFileURL } from 'node:url'
import { parseArgs, usage } from './args.mjs'
import { codeIdentity, openSession } from './check.mjs'
import { received, requestDaemon, stopDaemon } from './daemon.mjs'
import { endRun } from './ending.mjs'
import { memoryStore } from './evidence.mjs'

// How long the group has to end after a stop signal before it is killed.
const STOP_GRACE_MS = 2000

/** Signals every process of group `group`; false when none is left. */
function signalGroup(group, signal) {
  try {
    process.kill(-group, signal)
    return true
  } catch {
    return false
  }
}

/**
 * Runs this CLI again as a child in a process group of its own, and ends
 * with it: with its exit code, or, once a stop signal has ended its group,
 * with 128 plus the signal's number.
 */
function superviseRun() {
  // An inspector flag would bind the CLI's own port a second time.
  const child = spawn(
    process.execPath,
    [
      ...process.execArgv.filter((flag) => !/^--inspect/.test(flag)),
      ...process.argv.slice(1),
    ],
    {
      detached: true,
      stdio: `inherit`,
      env: { ...process.env, ORACLE_GAPS_GROUP: String(process.pid) },
    },
  )
  let stopped
  // How the run ended: its exit code, or the signal that ended it.
  let ended
  // Ends the CLI once the run has ended (or the grace has passed), with
  // what is left of the group killed. A run that ended with its own code
  // (0 completed, 2 refused, 3 an error) wrote its done line, the last on
  // each stream, so the CLI ends with that code and writes none. A run that
  // a stop ended wrote none, so the CLI writes the stopped line on both
  // streams. A write to a pipe is asynchronous on macOS, so the process
  // exits once it is written.
  const finish = () => {
    signalGroup(child.pid, `SIGKILL`)
    if (stopped && ![0, 2, 3].includes(ended?.code)) {
      const line = `oracle-gaps: done stopped (${stopped})\n`
      process.stdout.write(line, () =>
        process.stderr.write(line, () =>
          process.exit(128 + constants.signals[stopped]),
        ),
      )
      return
    }
    process.exit(ended.code ?? 128 + constants.signals[ended.signal])
  }
  const stop = (signal) => {
    if (stopped) return
    stopped = signal
    signalGroup(child.pid, signal)
    const deadline = Date.now() + STOP_GRACE_MS
    const poll = setInterval(() => {
      if (
        (ended === undefined || signalGroup(child.pid, 0)) &&
        Date.now() < deadline
      )
        return
      clearInterval(poll)
      finish()
    }, 50)
  }
  process.on(`SIGINT`, stop)
  process.on(`SIGTERM`, stop)
  child.on(`exit`, (code, signal) => {
    ended = { code, signal }
    if (!stopped) finish()
  })
}

/**
 * The run's side of the group: once the CLI that started it is gone, the
 * run kills its group, itself included.
 */
function watchSupervisor(supervisor) {
  setInterval(() => {
    if (process.ppid !== supervisor) process.kill(-process.pid, `SIGKILL`)
  }, 1000).unref()
}

/**
 * Whether arguments `argv` ask for a check, the only run that starts
 * processes; a refusal of them is written by the run itself.
 */
function asksForCheck(argv) {
  try {
    const options = parseArgs(argv)
    return !options.help && !options.stop
  } catch {
    return false
  }
}

/** The summary of a check run in this process. */
async function checkCold(options) {
  const session = await openSession(options.pkg)
  try {
    return await session.check(options, memoryStore())
  } finally {
    await session.close()
  }
}

/** The summary of a check run by the package's daemon. */
async function checkThroughDaemon(options) {
  const reply = await requestDaemon(
    options.pkg,
    process.argv.slice(2),
    codeIdentity(),
  )
  if (reply.stderr) process.stderr.write(reply.stderr)
  if (reply.failed) throw received(reply.failed)
  return reply.stdout
}

// A file URL escapes a space, `#`, and the like, so the script's own URL is
// compared with the URL of the path it was started as.
const main =
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
// Windows has no process groups: there the run is the CLI's own process.
const supervised = process.platform !== `win32`
const supervisor = process.env.ORACLE_GAPS_GROUP
if (
  main &&
  supervised &&
  supervisor === undefined &&
  asksForCheck(process.argv.slice(2))
)
  superviseRun()
else if (main) {
  if (supervisor !== undefined) watchSupervisor(Number(supervisor))
  // A test that runs this CLI starts a run of its own, in a group of its own.
  delete process.env.ORACLE_GAPS_GROUP
  // The run's options, once its arguments parse; a refusal or an error is
  // written to their output directory.
  let options
  let ended = false
  // Ends the run once. A write to a pipe is asynchronous on macOS, and
  // exiting at once cuts it off at the pipe's buffer, so the process exits
  // once both streams have written everything before it.
  // ORACLE_GAPS_HOLD_EXIT_MS holds the exit after the done line, so the
  // CLI's oracle can send a signal in that window.
  const end = (exitCode) => {
    if (ended) return
    ended = true
    const hold = Number(process.env.ORACLE_GAPS_HOLD_EXIT_MS ?? 0)
    process.stdout.write(``, () =>
      process.stderr.write(``, () =>
        setTimeout(() => process.exit(exitCode), hold),
      ),
    )
  }
  // Once the run writes its ending, a stop signal no longer cuts it off:
  // its done line is then the last line of each stream, and the
  // supervisor adds none (review of #46, F3).
  const holdStops = () => {
    process.on(`SIGINT`, () => {})
    process.on(`SIGTERM`, () => {})
  }
  const fail = (error) => {
    if (ended) return
    const ending = endRun(error, options?.out)
    holdStops()
    process.stderr.write(ending.stderr)
    process.stdout.write(`${ending.done}\n`)
    end(ending.exitCode)
  }
  // An error thrown outside the awaited check, by a timer or a promise no
  // one awaits, ends the run the same way.
  process.on(`uncaughtException`, fail)
  process.on(`unhandledRejection`, fail)
  try {
    options = parseArgs(process.argv.slice(2))
    if (options.help) console.log(usage)
    else if (options.stop) await stopDaemon(options.pkg)
    else {
      const summary = await (options.daemon ? checkThroughDaemon : checkCold)(
        options,
      )
      holdStops()
      // The summary ends with the done line (report.mjs), which ends stderr
      // too.
      console.log(summary)
      process.stderr.write(`${summary.split(`\n`).at(-1)}\n`)
    }
    end(0)
  } catch (error) {
    fail(error)
  }
}
