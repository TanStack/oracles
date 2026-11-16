// What a run reads, as the daemon keys it. Every read is a daemon input
// (maintainer decision, 2026-11-16, "All of them"): a file read through fs
// on any path, node_modules included, an environment variable, and what
// the config's own plugins read. So when one changes between two checks,
// the next check through the daemon reports what a cold run reports (the
// CLI oracle's law 9).
//
// An input's key is `fs:<path>` for a file, hashed by its text (or as
// `not a file`, or `missing`), `env:<name>` for a variable, hashed by its
// value, or `env:*` for the set of names, which code reads when it lists
// the environment. The harness (capture-setup.mjs) watches a test's reads in
// its worker, and the session (check.mjs) watches what the config and its
// plugins read in the CLI's process. Both files are copied beside the
// harness with this one.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { posix } from './paths.mjs'

// The calls that read a file, and those that test whether it exists and
// what it is. Each is taken once per process, before a wrapper replaces it,
// so hashing a file is not itself a read.
const reads = [
  [fs, [`readFileSync`, `readFile`, `existsSync`, `statSync`]],
  [fs.promises, [`readFile`, `stat`]],
]
const original = (globalThis.__oracleGapsOriginalFs ??= {
  readFileSync: fs.readFileSync,
  statSync: fs.statSync,
})
const sha1 = (data) => createHash(`sha1`).update(data).digest(`hex`)

/**
 * A file's input hash now, never from a cache: the hash of its text, or
 * `not a file` (a test can stat a directory, whose input is that a
 * directory is there), or `missing`.
 */
export function fileHash(path) {
  try {
    return original.statSync(path).isFile()
      ? sha1(original.readFileSync(path))
      : `not a file`
  } catch {
    return `missing`
  }
}

/** A variable's input hash under `env`, or for `*`, that of its names. */
export const envHash = (name, env = process.env) =>
  sha1(
    name === `*`
      ? Object.keys(env).sort().join(`\0`)
      : `${env[name] === undefined ? `unset` : `=${env[name]}`}`,
  )

// The runner's own files: a session directory (`.oracle-gaps-<pid>/`, which
// holds this file) and the copies of test files
// (`.oracle-gaps-<pid>-<n>-<name>`). A user's path that only contains
// `.oracle-gaps` is an input like any other.
const isRunnerFile = (path) => /\/\.oracle-gaps-\d+[-/]/.test(path)

/**
 * A wrapper keeps every own property of the function it wraps (its name
 * and length, which code that dispatches on arity reads, or
 * `util.promisify.custom`), so a test that passes alone passes under the
 * capture (law 3; review of #55).
 */
export function keepProperties(from, to) {
  for (const key of Reflect.ownKeys(from))
    if (key !== `prototype`)
      Object.defineProperty(to, key, Object.getOwnPropertyDescriptor(from, key))
  return to
}

/**
 * Watches this process's reads from now on: each read calls `record(key)`
 * with the input's key, the `record` of the latest call. The wrappers are
 * installed once per process. A file's path is the path rule's (paths.mjs),
 * and the runner's own files are left out. An ES module's
 * `import { readFileSync } from 'node:fs'` reads the wrappers too.
 */
export function watchReads(record) {
  globalThis.__oracleGapsRecord = record
  if (globalThis.__oracleGapsWatching) return
  globalThis.__oracleGapsWatching = true
  record = (key) => globalThis.__oracleGapsRecord(key)
  const watched = (target) => {
    let path
    try {
      if (target instanceof URL) path = fileURLToPath(target)
      else if (typeof target === `string`) path = resolve(target)
      else if (Buffer.isBuffer(target)) path = resolve(target.toString())
    } catch {
      return
    }
    if (path !== undefined && !isRunnerFile(posix(path)))
      record(`fs:${posix(path)}`)
  }
  for (const [owner, names] of reads)
    for (const name of names) {
      const read = owner[name]
      owner[name] = keepProperties(read, function (target, ...rest) {
        watched(target)
        return read.call(this, target, ...rest)
      })
    }
  syncBuiltinESMExports()
  // A variable read by name, a test of whether it is set, and a listing of
  // the names, which reads the set of names.
  process.env = new Proxy(process.env, {
    get(env, name) {
      if (typeof name === `string`) record(`env:${name}`)
      return Reflect.get(env, name)
    },
    has(env, name) {
      if (typeof name === `string`) record(`env:${name}`)
      return Reflect.has(env, name)
    },
    ownKeys(env) {
      record(`env:*`)
      return Reflect.ownKeys(env)
    },
    // A write goes to the environment itself, which keeps its own rules
    // (a value is a string).
    set: (env, name, value) => Reflect.set(env, name, value),
  })
}
