// The evidence store: units of evidence by identity (check.mjs).
//
// A cold run keeps its units in memory and drops them. The daemon keeps them
// in a JSON file on disk, so a daemon that restarts reuses what an earlier one
// ran. The store is a cache over the evidence a check reports, never the
// record: a stored unit is used only while every input it recorded is
// unchanged.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

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

/** A store that lives for one check. */
export function memoryStore() {
  const rows = new Map()
  return {
    get: (id) => rows.get(id),
    put: (id, variant) =>
      rows.set(id, { id, variants: withVersion(rows.get(id), variant) }),
  }
}

/**
 * A store in `<dir>/evidence.json`. It reads the file once, when it opens.
 * `put` changes the rows in memory, and `flush` writes every row to a
 * temporary file and renames it over the store, so a crash during a write
 * leaves the previous version whole. The daemon flushes after each check and
 * on close.
 */
export async function diskStore(dir) {
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `evidence.json`)
  const rows = new Map(
    existsSync(file)
      ? JSON.parse(readFileSync(file, `utf8`)).map((row) => [row.id, row])
      : [],
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
      writeFileSync(temporary, JSON.stringify([...rows.values()]))
      renameSync(temporary, file)
      dirty = false
    },
    async close() {
      await this.flush()
    },
  }
}
