// How a run of the CLI ends when it does not complete, for a cold run and a
// check through the daemon alike (index.mjs): never with a bare stack trace
// (maintainer decision, 2026-11-10).
//
// A refusal is a problem the author can fix. It exits 2 and prints one block,
// `refused: <cause>` and `fix: <one directive>`, and, when the run knows its
// output directory, writes the refusal there as results.json and summary.md
// and names its report there in its last line, `oracle-gaps: done refused`.
// A write that found no room on its disk (ENOSPC, or EDQUOT for a used-up
// quota) is the machine's, not the CLI's: it exits 3, as a run that ran out
// of memory does, with one done line that names the directory the write
// failed in and the step to take, the earlier runs to delete among them,
// and writes no stack. Any other error is a bug in the CLI. It exits 3, says
// so in one `oracle-gaps: error` line, and keeps its stack in error.log, in
// the output directory when the run knows one. Every line an ending prints is
// a line of the stream (stream.mjs) or of the refusal block. Each ending
// replaces the files of another ending that an earlier run left in the
// directory (check.mjs removes error.log when a check completes).
import {
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { runsDirOf } from './evidence.mjs'
import { posix, realPathOf } from './paths.mjs'
import { escapeControls, streamLine } from './stream.mjs'

// A path as a line of the stream shows it: in forward slashes, with a line
// break or another control character as its escape, so that a path cannot
// end its line or forge another (the register's C entry "The internal-error
// line", 2026-11-16).
const shown = (path) => escapeControls(posix(path))

/** A problem the author can fix: its cause, and the one step that fixes it. */
export class Refusal extends Error {
  constructor(cause, fix) {
    super(cause)
    this.fix = fix
  }
}

/** The codes of a write that found no room: a full disk, a used-up quota. */
export const noRoomCodes = new Set([`ENOSPC`, `EDQUOT`])

/** The total size of the files under `path`, by their own sizes. */
const sizeOf = (path) => {
  const stats = lstatSync(path)
  return stats.isDirectory()
    ? readdirSync(path).reduce((sum, name) => sum + sizeOf(join(path, name)), 0)
    : stats.size
}

/**
 * The ending of a write that found no room, `full`, in a run with output
 * directory `out` of package `pkg`: the directory of the path it failed on
 * (a copy's target, else its path), and, when the package's default run
 * directories hold runs other than this one, how many and their size, the
 * step that frees the most.
 */
function noRoom(full, out, pkg) {
  const path = full.dest ?? full.path
  const cause = `out of disk space${path === undefined ? `` : ` in ${shown(dirname(resolve(path)))}`} (${full.code})`
  let earlier = ``
  try {
    const runs = runsDirOf(pkg)
    const others = readdirSync(runs)
      .map((name) => join(runs, name))
      .filter((run) => run !== out)
    if (others.length > 0)
      earlier = `, or delete the ${others.length} earlier run${others.length === 1 ? `` : `s`} in ${shown(runs)} (${(others.reduce((sum, run) => sum + sizeOf(run), 0) / 1e6).toFixed(1)} MB)`
  } catch {
    // No package, no earlier run, or none that can be read.
  }
  const directive = `free space ${path === undefined ? `on the disk` : `there`}${earlier}`
  write(
    out,
    { status: `out-of-space`, cause, directive },
    `Out of disk space: ${cause}\n\nFix: ${directive}\n`,
  )
  const done = `oracle-gaps: done error, ${cause}: ${directive}`
  return { exitCode: 3, stderr: `${done}\n`, done }
}

/**
 * The exit code and the stderr text of a run that threw `error`, with its
 * output directory `out` if the run knows one, where it writes the ending,
 * and its package `pkg` if it knows that, whose earlier runs an ending out
 * of disk space names. A refusal of arguments that do not parse knows only
 * the `--out` they name (`error.out`, args.mjs).
 */
export function endRun(error, out = error?.out, pkg = undefined) {
  if (noRoomCodes.has(error?.code)) return noRoom(error, out, pkg)
  const message = String(error?.message ?? error)
  if (error instanceof Refusal) {
    const block = [`refused: ${message}`, `fix: ${error.fix}`]
    const results = { status: `refused`, cause: message, directive: error.fix }
    // The last line says the run refused, and where its report is once the
    // run knows its output directory (the stream's done line, stream.mjs);
    // it ends stdout too (index.mjs).
    // A reportless refusal (another run uses the directory) writes nothing
    // there: the directory's files are the other run's.
    const done = write(
      error.reportless ? undefined : out,
      results,
      `Refused: ${message}\n\nFix: ${error.fix}\n`,
    )
      ? `oracle-gaps: done refused, report ${shown(join(out, `summary.md`))}`
      : `oracle-gaps: done refused`
    return { exitCode: 2, stderr: `${[...block, done].join(`\n`)}\n`, done }
  }
  const results = { status: `internal-error`, message }
  const stack = `${error?.stack ?? message}\n`
  let log = join(out ?? ``, `error.log`)
  if (!write(out, results, `Internal error: ${message}\n`, stack)) {
    log = join(realPathOf(tmpdir()), `oracle-gaps-error-${process.pid}.log`)
    writeFileSync(log, stack)
  }
  const done = `oracle-gaps: done error, log ${shown(log)}`
  // The message stays one line: its own line breaks print as escapes. A
  // message that already names the CLI does not name it twice.
  const said = escapeControls(message.replace(/^oracle-gaps: /, ``))
  return {
    exitCode: 3,
    stderr: `${streamLine(`error`, `${said}: a bug in oracle-gaps, not in your oracle; its stack is in ${shown(log)}`)}\n${done}\n`,
    done,
  }
}

/**
 * Writes an ending into `out`, with its error log or none; false when there
 * is no `out` or it fails.
 */
function write(out, results, summary, log) {
  if (out === undefined) return false
  try {
    mkdirSync(out, { recursive: true })
    writeFileSync(join(out, `results.json`), JSON.stringify(results, null, 1))
    writeFileSync(join(out, `summary.md`), summary)
    if (log === undefined) rmSync(join(out, `error.log`), { force: true })
    else writeFileSync(join(out, `error.log`), log)
    return true
  } catch {
    return false
  }
}
