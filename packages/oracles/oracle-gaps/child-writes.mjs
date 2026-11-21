// What a test's own child processes write, at any depth. The harness
// (capture-setup.mjs) preloads this file into every Node process that a test
// starts (`--import` in NODE_OPTIONS, which each child passes on to its own
// children) and names a log per copy (ORACLE_GAPS_CHILD_WRITES). Each file
// that such a process writes goes into the log as its input key, before the
// write, so the copy knows that a later read of it reads its own process
// tree's output, which is no input (maintainer decisions "Own writes aren't
// inputs", 2026-11-17, and "Optimize #133 before merging", 2026-11-19).
// The log is written through a file descriptor, which no wrapper watches.
import { openSync, writeSync } from 'node:fs'
import { watchReads } from './inputs.mjs'

const log = process.env.ORACLE_GAPS_CHILD_WRITES
if (log) {
  const fd = openSync(log, `a`)
  watchReads((key, write) => {
    if (write && key.startsWith(`fs:`)) writeSync(fd, `${key}\n`)
  })
}
