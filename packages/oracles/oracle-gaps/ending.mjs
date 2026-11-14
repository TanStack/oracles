// How a run of the CLI ends when it does not complete, for a cold run and a
// check through the daemon alike (index.mjs): never with a bare stack trace
// (maintainer decision, 2026-11-10).
//
// A refusal is a problem the author can fix. It exits 2 and prints one block,
// `refused: <cause>` and `fix: <one directive>`, and, when the run knows its
// output directory, writes the refusal there as results.json and summary.md
// and names its report there in its last line, `oracle-gaps: done refused`.
// Any other error is a bug in the CLI. It exits 3,
// says so, and keeps its stack in error.log, in the output directory when
// the run knows one. Each ending replaces the files of another ending that
// an earlier run left in the directory (check.mjs removes error.log when a
// check completes).
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { posix, realPathOf } from './paths.mjs'

/** A problem the author can fix: its cause, and the one step that fixes it. */
export class Refusal extends Error {
  constructor(cause, fix) {
    super(cause)
    this.fix = fix
  }
}

/**
 * The exit code and the stderr text of a run that threw `error`, with its
 * output directory `out` if the run knows one, where it writes the ending.
 * A refusal of arguments that do not parse knows only the `--out` they name
 * (`error.out`, args.mjs).
 */
export function endRun(error, out = error?.out) {
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
      ? `oracle-gaps: done refused, report ${posix(join(out, `summary.md`))}`
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
  const done = `oracle-gaps: done error, log ${posix(log)}`
  return {
    exitCode: 3,
    stderr: `oracle-gaps internal error: ${message}\nThis is a bug in oracle-gaps, not in your oracle. Its stack is in ${posix(log)}.\n${done}\n`,
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
