// How a run of the CLI ends when it does not complete, for a cold run and a
// check through the daemon alike (index.mjs): never with a bare stack trace
// (maintainer decision, 2026-11-10).
//
// A refusal is a problem the author can fix. It exits 2 and prints one block,
// `refused: <cause>` and `fix: <one directive>`, and, when the run knows its
// output directory, writes the refusal there as results.json and summary.md
// and names the directory. Any other error is a bug in the CLI. It exits 3,
// says so, and keeps its stack in error.log, in the output directory when
// the run knows one.
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
 */
export function endRun(error, out) {
  const message = String(error?.message ?? error)
  if (error instanceof Refusal) {
    const block = [`refused: ${message}`, `fix: ${error.fix}`]
    const results = { status: `refused`, cause: message, directive: error.fix }
    if (write(out, results, `Refused: ${message}\n\nFix: ${error.fix}\n`))
      block.push(`output: ${out}`)
    return { exitCode: 2, stderr: `${block.join(`\n`)}\n` }
  }
  const results = { status: `internal-error`, message }
  const log = write(out, results, `Internal error: ${message}\n`)
    ? join(out, `error.log`)
    : join(tmpdir(), `oracle-gaps-error-${process.pid}.log`)
  writeFileSync(log, `${error?.stack ?? message}\n`)
  return {
    exitCode: 3,
    stderr: `oracle-gaps internal error: ${message}\nThis is a bug in oracle-gaps, not in your oracle. Its stack is in ${log}.\n`,
  }
}

/** Writes an ending into `out`; false when there is no `out` or it fails. */
function write(out, results, summary) {
  if (out === undefined) return false
  try {
    mkdirSync(out, { recursive: true })
    writeFileSync(join(out, `results.json`), JSON.stringify(results, null, 1))
    writeFileSync(join(out, `summary.md`), summary)
    return true
  } catch {
    return false
  }
}
