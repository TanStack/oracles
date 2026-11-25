// One rule for paths inside the gap CLI. A path is written with forward
// slashes as it enters the CLI (its argv, the paths Vite and Vitest report,
// and the results of realpath), so every comparison and every key is a
// comparison of one spelling. Node's file system calls accept forward slashes
// on Windows too, so a path goes back to the file system as it is. The one
// real path, `realpathSync.native`, is taken on both sides of a comparison:
// the JavaScript `realpathSync` keeps an 8.3 short name (RUNNER~1), which the
// native call expands, so the two never agree on Windows.
import {
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative } from 'node:path'

/**
 * The forward-slash spelling of `path`, with a drive letter in capitals: a
 * Windows drive's letter is one letter whatever its case. Only Windows has a
 * `\` separator: on POSIX a backslash is a name's character (a directory
 * named `a\b` is one name), so the path is left as it is (review F5).
 */
export const posix = (path) =>
  process.platform !== `win32`
    ? path
    : path
        .replaceAll(`\\`, `/`)
        .replace(/^[a-z]:/, (drive) => drive.toUpperCase())

/**
 * Writes `file` whole: a temporary file, then a rename, so a reader sees the
 * old text or the new, never a part (evidence.mjs writes its store the same
 * way). Both the CLI and the harness copy write their markers with it.
 */
export function writeWhole(file, text) {
  const temporary = `${file}.${process.pid}.tmp`
  writeFileSync(temporary, text)
  renameSync(temporary, file)
}

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

/**
 * The session directory of process `pid` in package `pkg`: its capture setup
 * and Vitest configs while it checks (check.mjs).
 */
export const sessionDirOf = (pkg, pid) => join(pkg, `.oracle-gaps-${pid}`)

/** Whether process `pid` runs. */
export function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === `EPERM`
  }
}

/**
 * Removes the session directory of process `pid` in package `pkg`: this
 * process's own, or a process's that has ended. A pid that another process
 * runs under now names that process's directory, which stays. A removal that
 * fails (a file another process holds open on win32) leaves the directory for
 * the next run: a throw here, after a run's done line, would end the run a
 * second time (review of #164, F2).
 */
export function removeSession(pkg, pid) {
  if (pid !== process.pid && alive(pid)) return
  try {
    rmSync(sessionDirOf(pkg, pid), { recursive: true, force: true })
  } catch {
    // The next run removes it.
  }
}

// The name args.mjs gives a run's default output directory: its start time,
// then 8 hex digits.
const RUN_NAME = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f]{8}$/

/** Whether a running process holds run directory `dir`: its run.pid names one, or cannot be read. */
const held = (dir) => {
  try {
    const pid = Number(readFileSync(join(dir, `run.pid`), `utf8`))
    // A pid of 0 would name this process's own group.
    return pid > 0 && alive(pid)
  } catch (error) {
    return error?.code !== `ENOENT`
  }
}

/**
 * Removes the oldest of the run directories beside `out`, a run's default
 * output directory that this process has claimed, so that `keep` of them are
 * left, `out` among them. It never removes a directory that a running process
 * holds (`out` is one), or an entry whose name is no run's. A removal that
 * fails leaves the directory for the next run.
 */
export function pruneRuns(out, keep) {
  const runs = dirname(out)
  try {
    const older = readdirSync(runs)
      .filter((name) => RUN_NAME.test(name) && !held(join(runs, name)))
      .sort()
    for (const name of older.slice(0, Math.max(0, older.length - keep + 1)))
      try {
        rmSync(join(runs, name), { recursive: true, force: true })
      } catch {
        // A file another process holds open on win32: the next run removes it.
      }
  } catch {
    // No directory to read: nothing to remove.
  }
}

/** The last segment of `path`, in forward slashes. */
export const baseOf = (path) => posix(path).split(`/`).at(-1)
