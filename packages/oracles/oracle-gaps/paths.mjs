// One rule for paths inside the gap CLI. A path is written with forward
// slashes as it enters the CLI (its argv, the paths Vite and Vitest report,
// and the results of realpath), so every comparison and every key is a
// comparison of one spelling. Node's file system calls accept forward slashes
// on Windows too, so a path goes back to the file system as it is. The one
// real path, `realpathSync.native`, is taken on both sides of a comparison:
// the JavaScript `realpathSync` keeps an 8.3 short name (RUNNER~1), which the
// native call expands, so the two never agree on Windows.
import { realpathSync } from 'node:fs'
import { relative } from 'node:path'

/**
 * The forward-slash spelling of `path`, with a drive letter in capitals: a
 * Windows drive's letter is one letter whatever its case.
 */
export const posix = (path) =>
  path.replaceAll(`\\`, `/`).replace(/^[a-z]:/, (drive) => drive.toUpperCase())

/** The real path of `path`, in forward slashes. */
export const realPathOf = (path) => posix(realpathSync.native(path))

/**
 * The forward-slash path of `file` relative to `dir` when `file` is `dir` or
 * inside it, and undefined otherwise. Both are compared in one spelling, so a
 * drive letter's case, or a `\` from a join, does not decide it.
 */
export function relativeWithin(dir, file) {
  const base = posix(dir).replace(/\/+$/, ``)
  const path = posix(file)
  if (path === base) return `.`
  if (!path.startsWith(`${base}/`)) return undefined
  return path.slice(base.length + 1)
}

/** Whether `file` is `dir` or lies inside it. */
export const isWithin = (dir, file) => relativeWithin(dir, file) !== undefined

/**
 * An ES module specifier for `to` from the directory `from`: forward slashes,
 * and starting with `./` or `../`, as an import needs. The one the generated
 * config wrapper uses; a backslash in it is a character, not a separator.
 */
export function specifierOf(from, to) {
  const rel = posix(relative(from, to))
  return /^\.\.?\//.test(rel) ? rel : `./${rel}`
}

/** The last segment of `path`, in forward slashes. */
export const baseOf = (path) => posix(path).split(`/`).at(-1)
