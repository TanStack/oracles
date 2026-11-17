// What a run reads, as the daemon keys it. Every read is a daemon input
// (maintainer decision, 2026-11-16, "All of them"): a file read through fs
// on any path, node_modules included, an environment variable, and what
// the config's own plugins read. So when one changes between two checks,
// the next check through the daemon reports what a cold run reports (the
// CLI oracle's law 9).
//
// An input's key is `fs:<path>` for a file, hashed by its text (or as
// `not a file`, or `missing`), `dir:<path>` for a directory's listing,
// hashed by its entries' names and kinds, or `dirs:<path>` for a recursive
// one, `stat:<path>` for a test of whether a path exists and what it is,
// hashed by that, `env:<name>` for a variable, hashed by its value, or `env:*` for the
// set of names, which code reads when it lists the environment. The harness (capture-setup.mjs) watches a test's reads in
// its worker, and the session (check.mjs) watches what the config and its
// plugins read in the CLI's process. Both files are copied beside the
// harness with this one.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { posix } from './paths.mjs'

// The calls that read a file (a stream's too, by the whole file). Each is
// taken once per process, before a wrapper replaces it, so hashing a file is
// not itself a read.
const reads = [
  [fs, [`readFileSync`, `readFile`, `createReadStream`]],
  [fs.promises, [`readFile`]],
]
// The calls that test whether a file exists and what it is: an input by its
// existence and kind (G42's stat family), not by its text, so that Vite's
// resolution, which stats each module it imports, does not make every
// module's text an input of every run.
const stats = [
  [fs, [`existsSync`, `statSync`]],
  [fs.promises, [`stat`]],
]
// The calls that list a directory.
const listings = [
  [fs, [`readdirSync`, `readdir`, `opendirSync`, `opendir`]],
  [fs.promises, [`readdir`, `opendir`]],
]
// The calls that write a file's text. A file that a reader wrote before it
// reads it holds the reader's own output, which follows from the reader's
// other inputs, so that read is no input: a test's temporary file, or the
// config that Vite bundles into a temporary file and then imports.
const writes = [
  [fs, [`writeFileSync`, `writeFile`, `appendFileSync`, `appendFile`]],
  [fs.promises, [`writeFile`, `appendFile`]],
]
const original = (globalThis.__oracleGapsOriginalFs ??= {
  readFileSync: fs.readFileSync,
  statSync: fs.statSync,
  readdirSync: fs.readdirSync,
  realpathSync: fs.realpathSync.native,
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

/**
 * A directory's input hash now: that of its entries' names and kinds, every
 * level's for a recursive listing, or `not a directory`, or `missing`.
 */
function listingHash(path, recursive) {
  try {
    return sha1(
      original
        .readdirSync(path, { withFileTypes: true, recursive })
        .map(
          (entry) =>
            `${posix(entry.parentPath ?? path)}/${entry.name}\0${entry.isDirectory() ? `d` : entry.isSymbolicLink() ? `l` : `f`}`,
        )
        .sort()
        .join(`\0`),
    )
  } catch (error) {
    return error?.code === `ENOTDIR` ? `not a directory` : `missing`
  }
}

/** A file's or a directory's input hash now, by its key. */
export const inputHash = (key) =>
  key.startsWith(`fs:`)
    ? fileHash(key.slice(3))
    : key.startsWith(`stat:`)
      ? kindOf(key.slice(5))
      : key.startsWith(`dirs:`)
        ? listingHash(key.slice(5), true)
        : listingHash(key.slice(4), false)

/** A path's existence and kind now. */
function kindOf(path) {
  try {
    const stat = original.statSync(path)
    return stat.isFile() ? `file` : stat.isDirectory() ? `directory` : `other`
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
 * with the input's key, and each write of a file or a variable
 * `record(key, true)`, the
 * `record` of the latest call. The wrappers are
 * installed once per process. A file's path is the path rule's (paths.mjs),
 * and the runner's own files are left out. An ES module's
 * `import { readFileSync } from 'node:fs'` reads the wrappers too.
 */
export function watchReads(record) {
  globalThis.__oracleGapsRecord = record
  if (globalThis.__oracleGapsWatching) return
  globalThis.__oracleGapsWatching = true
  record = (key, write) => globalThis.__oracleGapsRecord(key, write)
  const watched = (target, kind, options) => {
    const write = kind === `write`
    let path
    try {
      if (target instanceof URL) path = resolve(fileURLToPath(target))
      else if (typeof target === `string`) path = resolve(target)
      else if (Buffer.isBuffer(target)) path = resolve(target.toString())
    } catch {
      return
    }
    if (path === undefined || isRunnerFile(posix(path))) return
    const prefix =
      kind === `stat`
        ? `stat`
        : kind !== `list`
          ? `fs`
          : options?.recursive
            ? `dirs`
            : `dir`
    record(`${prefix}:${posix(path)}`, write)
    // A written file is also known by its directory's real path, which a
    // later read through a link, or an import by its real URL, names.
    if (write)
      try {
        record(
          `fs:${posix(join(original.realpathSync(dirname(path)), basename(path)))}`,
          write,
        )
      } catch {
        // No directory to write in: the write fails as it would.
      }
  }
  for (const [calls, kind] of [
    [reads, `read`],
    [stats, `stat`],
    [listings, `list`],
    [writes, `write`],
  ])
    for (const [owner, names] of calls)
      for (const name of names) {
        const call = owner[name]
        owner[name] = keepProperties(call, function (target, ...rest) {
          watched(target, kind, rest[0])
          return call.call(this, target, ...rest)
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
    // (a value is a string). A variable the reader set is its own output.
    set(env, name, value) {
      if (typeof name === `string`) record(`env:${name}`, true)
      return Reflect.set(env, name, value)
    },
  })
}
