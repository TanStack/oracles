// The evidence store: units of evidence by identity (check.mjs).
//
// A cold run keeps its units in memory and drops them. The daemon keeps them
// in a file of JSON rows on disk, so a daemon that restarts reuses what an earlier one
// ran. The store is a cache over the evidence a check reports, never the
// record: a stored unit is used only while every input it recorded is
// unchanged.
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { realPathOf } from './paths.mjs'
import { join } from 'node:path'

// A package's key: its real path, which names the repository checkout too.
const keyOf = (pkg) => createHash(`sha1`).update(pkg).digest(`hex`).slice(0, 12)
/**
 * The socket of a package's daemon. A Unix socket path must stay short, and
 * on Windows a socket is a named pipe, which has no file to remove.
 */
/** The OS temporary directory, by its real path (paths.mjs): a short name is expanded. */
const temporaryDirectory = () => realPathOf(tmpdir())
export const socketOf = (pkg) =>
  process.platform === `win32`
    ? `\\\\.\\pipe\\oracle-gaps-${keyOf(pkg)}`
    : join(temporaryDirectory(), `oracle-gaps-${keyOf(pkg)}.sock`)
/** Removes a daemon's socket file; a named pipe has none. */
export const removeSocket = (socket) => {
  if (process.platform !== `win32`) rmSync(socket, { force: true })
}
/**
 * A package's state: the daemon's lock, log, and evidence, the workspace
 * dependencies' one-file bundles, and the default output directories. It is
 * in the OS temp directory, which the OS cleans, keyed by the package, never
 * in the repository (maintainer decision, 2026-11-11) and never a shared
 * directory (the v20 freeze's namespacing decision). A state the OS removed
 * is a cold start.
 */
export const stateDirOf = (pkg) =>
  join(temporaryDirectory(), `oracle-gaps-${keyOf(pkg)}`)

// A run keeps a few versions, newest first, each under the inputs it read,
// as a build system keeps several verifying traces: an edit and its undo
// both find their evidence.
const VERSIONS = 4
const withVersion = (row, variant) =>
  [
    variant,
    ...(row?.variants ?? []).filter(
      (old) => JSON.stringify(old.inputs) !== JSON.stringify(variant.inputs),
    ),
  ].slice(0, VERSIONS)

/**
 * The store of a cold check. It keeps no unit: a cold run serves no lookup
 * (its evidence reports `reused` 0 on every klona run measured), so a unit
 * kept for reuse would only be retained, per mutant copy, for the whole run.
 * The retention law observes this through the entries' reachability
 * (retention-hook.mjs), not through anything the store reports.
 */
export function memoryStore() {
  return { get: () => undefined, put: () => {} }
}

// The longest string V8 makes (about 512 MB on 64-bit), which a test lowers
// (ORACLE_GAPS_TEST_STRING_LIMIT, a test-only knob) so that a small store
// meets the limit that a suite's store meets: past it, V8 throws a
// RangeError where the store makes or reads a string.
const STRING_LIMIT = Number(process.env.ORACLE_GAPS_TEST_STRING_LIMIT) || 0
/** `text`, a string the store made or read, past the test limit a throw. */
function storeString(text) {
  if (STRING_LIMIT > 0 && text.length > STRING_LIMIT)
    throw new RangeError(`Invalid string length`)
  return text
}

/**
 * The rows of the store file `file`, one JSON row per line. The file is read
 * as bytes and each line parsed alone, so no string holds the whole store,
 * which can pass V8's string limit on a large suite (#179). JSON escapes
 * every line break inside a row.
 */
function readRows(file) {
  const bytes = readFileSync(file)
  const rows = []
  for (let start = 0; start < bytes.length;) {
    const end = bytes.indexOf(0x0a, start)
    const stop = end === -1 ? bytes.length : end
    if (stop > start)
      rows.push(JSON.parse(storeString(bytes.toString(`utf8`, start, stop))))
    start = stop + 1
  }
  return rows
}

/**
 * A store in `<dir>/evidence.jsonl`, one row per line. It reads the file
 * once, when it opens. `put` changes the rows in memory, and `flush` writes
 * each row to a temporary file and renames it over the store, so a crash
 * during a write leaves the previous version whole. The daemon flushes after
 * each check and on close.
 */
export async function diskStore(dir) {
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `evidence.jsonl`)
  const rows = new Map(
    existsSync(file) ? readRows(file).map((row) => [row.id, row]) : [],
  )
  let dirty = false
  return {
    get: (id) => rows.get(id),
    put(id, variant) {
      rows.set(id, { id, variants: withVersion(rows.get(id), variant) })
      dirty = true
    },
    async flush() {
      if (!dirty) return
      // The OS may have cleaned the temp directory that holds the store.
      mkdirSync(dir, { recursive: true })
      const temporary = `${file}.${process.pid}.tmp`
      const fd = openSync(temporary, `w`)
      try {
        for (const row of rows.values())
          writeSync(fd, `${storeString(JSON.stringify(row))}\n`)
      } finally {
        closeSync(fd)
      }
      renameSync(temporary, file)
      dirty = false
    },
    async close() {
      await this.flush()
    },
  }
}
