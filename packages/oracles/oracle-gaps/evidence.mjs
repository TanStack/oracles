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
  rmSync,
  writeFileSync,
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
