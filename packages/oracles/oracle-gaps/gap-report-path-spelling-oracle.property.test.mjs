/**
 * # A path's separators do not change what the gap CLI decides
 *
 * The law (the path rule of paths.mjs, Windows support, 2026-11-13): a file
 * is one file however its separators are spelled. A path enters the CLI with
 * either separator, and the CLI compares, keys, and enumerates it in one
 * spelling, the forward-slash one. TypeScript compares a file's name as it was
 * given, so a name with backslashes is a different file to it: the scope and
 * binding questions of the mutant instrumenter then answer differently, and
 * CommonJS sites (`exports`, `module`) lose their mutants. Within a package, a
 * path lies inside another exactly when its segments start with the other's,
 * whichever separator spells them, and a drive letter's case does not decide
 * it.
 *
 * Law 1 (enumeration): for every source text and every spelling of its path,
 * the instrumenter yields the same mutant ids as for the forward-slash
 * spelling. Law 2 (relation): `relativeWithin(dir, file)` is the forward-slash
 * path of `file` after `dir`'s segments when `dir`'s segments start `file`'s
 * (compared with a drive letter in any case), and undefined otherwise.
 *
 * History: a source text from a short fixed list (the module forms the
 * instrumenter treats apart: an ES module, a CommonJS `module.exports`
 * assignment, `exports.x =`, and a `require`), a drive, one to three
 * directory names, one to two file names (names that a Windows
 * spelling exercises: a short name such as `RUNNER~1`, a name with a space),
 * and a separator for each joint, drawn independently.
 *
 * Model: Law 2 is answered from the segments alone: split both paths on either
 * separator, compare the directory's segments with the file's (the drive
 * case-insensitively), and the file's rest is the answer. Law 1 has no model
 * of its own: the forward-slash spelling is the reference, and the check
 * compares each spelling with it. That reference is production's answer on
 * the one spelling the rule names as the reference, so the law claims only
 * that spelling changes nothing; it does not claim the forward-slash answer is
 * right, which the static oracle judges.
 *
 * Driver: runs the instrumenter on the forward-slash spelling and on the
 * history's spelling, and runs `relativeWithin` on the history's directory and
 * file.
 *
 * Limits: the instrumenter runs on the source's text only (no package, so no
 * owners or imports), and the file names are not on disk, so a case that
 * needs a real file (realpath, a short name that the OS expands) belongs to the
 * end-to-end oracle, which runs on Windows in CI.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import fc from 'fast-check'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { differs, oracleProperty, pass } from '../src/oracle-property.ts'
import { posix, realPathOf, relativeWithin } from './paths.mjs'
import { instrument } from './schemata.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ts = createRequire(join(here, `../package.json`))(
  `typescript-for-tanstack-oracles`,
)

// The module forms the instrumenter treats apart. Each parses on its own.
const TEXTS = [
  `export function run(x: number): number {\n  return x < 0 ? 0 : x\n}\n`,
  `module.exports = exports = function (x, out) {\n  if (x) out.push(x)\n  return x ? 1 : 2\n}\n`,
  `exports.default = (x, out) => {\n  if (x) out.push(x)\n}\n`,
  `const other = require('./b')\nexports.run = () => other.help() || 2\n`,
]

const NAMES = [`src`, `RUNNER~1`, `my dir`, `pkg`, `lib`, `a.js`, `b.ts`]

const historyArbitrary = fc.record({
  text: fc.integer({ min: 0, max: TEXTS.length - 1 }),
  // The directory's drive letter may differ in case from the file's.
  drive: fc.constantFrom(
    ...(process.platform === `win32` ? [`C`, `c`, `D`] : [`C`]),
  ),
  dirDrive: fc.constantFrom(
    ...(process.platform === `win32` ? [`C`, `c`] : [`C`]),
  ),
  root: fc.array(fc.constantFrom(...NAMES), { minLength: 1, maxLength: 3 }),
  rest: fc.array(fc.constantFrom(...NAMES), { minLength: 1, maxLength: 2 }),
  // One separator for each joint: the drive to the first name, and each name.
  // On win32 a backslash separates; on POSIX it is a name's character, so only
  // `/` joins there (a narrowing: the POSIX law is the forward-slash spelling).
  joints: fc.array(
    fc.constantFrom(...(process.platform === `win32` ? [`/`, `\\`] : [`/`])),
    { minLength: 8, maxLength: 8 },
  ),
  // Appended last, so the fields above keep their draws: the drives and
  // separators a POSIX spelling uses (a backslash name and an `x:` drive).
  wide: fc.record({
    drive: fc.constantFrom(`C`, `c`, `D`, `x`),
    dirDrive: fc.constantFrom(`C`, `c`, `x`),
    joints: fc.array(fc.constantFrom(`/`, `\\`), {
      minLength: 8,
      maxLength: 8,
    }),
  }),
})

/** The spelling a platform uses: win32 the fields above, POSIX the wide ones. */
const effective = (history) =>
  process.platform === `win32` ? history : { ...history, ...history.wide }

/** The segments of a history's spelling: the drive, then the names. */
const segmentsOf = ({ drive, dirDrive, root, rest }) => ({
  directory: [`${dirDrive}:`, ...root],
  file: [`${drive}:`, ...root, ...rest],
})

/** The path with each joint's separator, as a Windows or POSIX spelling makes it. */
function spell(segments, joints) {
  let path = segments[0]
  for (let i = 1; i < segments.length; i += 1)
    path += joints[i - 1] + segments[i]
  return path
}

/** The forward-slash spelling: the reference the enumeration is compared with. */
const posixOf = (segments) => segments.join(`/`)

/** The mutant ids the instrumenter gives a text at `path`, sorted. */
function idsAt(path, text) {
  const { mutants } = instrument(ts, path, text, `src/a.js`)
  return mutants.map((m) => m.id).sort()
}

// Law 2's answer, from the spelled strings alone. On win32 both separators
// split and a drive's case is ignored; on POSIX only `/` splits, a backslash is
// a name's character, and `x:` is an ordinary name. The rest is the answer.
function relationModel(raw) {
  const history = effective(raw)
  const win = process.platform === `win32`
  const { directory, file } = segmentsOf(history)
  const dirPath = spell(
    directory,
    history.joints.slice(0, directory.length - 1),
  )
  const filePath = spell(file, history.joints.slice(0, file.length - 1))
  const split = (text) => text.split(win ? /[\\/]/ : /\//)
  const same = (a, b) => (win ? a.toUpperCase() === b.toUpperCase() : a === b)
  const dir = split(dirPath)
  const all = split(filePath)
  const starts = dir.every((segment, i) => same(segment, all[i] ?? ``))
  return starts ? all.slice(dir.length).join(`/`) : undefined
}

const model = (history) => ({
  relation: relationModel(history),
  // On POSIX a backslash spelling is a name the OS keeps: its real path exists.
  disk: process.platform === `win32` ? undefined : true,
})

const check = (history, trace, expected) => {
  const find = (checkpoint) =>
    trace.find((row) => row.checkpoint === checkpoint)?.value
  const reference = find(`reference`)
  const spelled = find(`spelled`)
  return (
    differs(`enumeration`, `the forward-slash spelling`, spelled, reference) ??
    differs(`relation`, `segments`, find(`relation`), expected.relation) ??
    (expected.disk === undefined
      ? undefined
      : differs(
          `disk`,
          `a backslash name is kept native`,
          find(`disk`),
          true,
        )) ??
    pass
  )
}

oracleProperty({
  id: `oracle-gaps.report-path-spelling`,
  law: {
    statement: `A path's separators change nothing the gap CLI decides: the mutants of a source are the same under any spelling of its path, and a path lies inside a directory exactly when its segments start with the directory's, a drive letter's case aside.`,
    authority: `The path rule of packages/oracles/oracle-gaps/paths.mjs (Windows support, 2026-11-13): paths are forward-slash at entry, and TypeScript and Vite compare them in that one spelling.`,
    limits: `A source that runs through owners and imports, a real file (realpath, an OS short name), and the enumeration of the whole package are not generated here: the static oracle and the Windows end-to-end run judge them.`,
  },
  histories: {
    arbitrary: historyArbitrary,
    runs: 200,
    fixedSeeds: [20261113],
    states: [],
    measured: [],
  },
  timeout: 10_000,
  model,
  driver: (raw, observe) => {
    const history = effective(raw)
    const { directory, file } = segmentsOf(history)
    const text = TEXTS[history.text]
    observe(`reference`, idsAt(posixOf(file), text))
    observe(
      `spelled`,
      idsAt(spell(file, history.joints.slice(0, file.length - 1)), text),
    )
    const dirPath = spell(
      directory,
      history.joints.slice(0, directory.length - 1),
    )
    const filePath = spell(file, history.joints.slice(0, file.length - 1))
    observe(`relation`, relativeWithin(dirPath, filePath))
    // The F5 witness on POSIX: the name is created with its backslashes, and
    // its real path is that name, not a rewritten one.
    if (process.platform !== `win32`) {
      const base = realpathSync.native(
        mkdtempSync(join(tmpdir(), `path-spelling-`)),
      )
      try {
        const made = join(base, filePath)
        mkdirSync(made, { recursive: true })
        observe(
          `disk`,
          existsSync(made) &&
            realPathOf(made) === realpathSync.native(made) &&
            posix(made) === made,
        )
      } finally {
        rmSync(base, { recursive: true, force: true })
      }
    }
  },
  check,
})
