/**
 * # An owns entry that no mutant tests is named
 *
 * The law: for every run, the gap report names, in one note each, every
 * owns entry of every oracle file that holds none of the run's mutants:
 * no operator mutant of a `--source` file lands in what it owns (its whole
 * file, or a unit of its tree), and no authored mutant's edit does. The note
 * names the entry, its oracle file, and the reason: its file is not a
 * `--source`; its file is a declaration file, which has no mutation site; or
 * nothing it owns has a mutation site. An entry that holds a mutant is not
 * named. Such an entry gets no evidence from the gap check, and before this
 * note nothing said so: an oracle that owned only a declaration file, or a
 * file left out of `--source`, ran green with no word about it.
 *
 * Authority: a downstream user's findings "Type declaration files get no
 * mutation evidence" and "`owns` has no way to name types" (2026-11), which
 * asked for a warning when an owned file yields no mutants; the gap report's
 * contract that a gap is evidence and that what the run does not judge is
 * reported, not silent (the `unowned` warning of
 * gap-report-oracle.property.test.mjs law 3). Pending the maintainers'
 * approval as a law (listed in the pull request that adds it).
 *
 * Law: for every generated package, set of oracle files and their entries,
 * `--source` selection, and optional authored mutant, the run refuses exactly
 * when no selected source is owned, and otherwise its notes are exactly the
 * model's, one per entry that holds no mutant, with the model's reason.
 *
 * History: a package of four files: `src/a.ts` (`run`, with sites; `empty`,
 * with none; `relay`, with sites, which calls `helper`), `src/b.ts`
 * (`helper`, with sites), `src/shapes.ts` (types only), and
 * `src/types.d.ts` (a declaration). One or two oracle files, each with one
 * to three entries drawn from the four whole files and the four functions
 * (an entry may repeat in one file, and is named once);
 * a non-empty `--source` selection of the four files; and an optional
 * authored mutant whose edit lands in `empty`, in `src/shapes.ts`, or in
 * `src/types.d.ts`.
 *
 * Model: an independent table of what each entry owns (a whole file, or the
 * units of a function's tree: `relay` reaches `helper`) and which units have
 * sites (`run`, `relay`, `helper`), not read from owners.mjs. An entry holds
 * a mutant when a selected file holds a unit with sites that it owns, or the
 * authored edit lands in what it owns. The reason is read from the entry's
 * file: not selected, a declaration file, or neither.
 *
 * Driver: writes the package, runs the production `analyze` with the
 * selection and the authored mutant, as the CLI does, and renders each
 * unevidenced entry with the report's own note line (`unevidencedLine`, the
 * line the CLI prints after its static analysis and again in its summary).
 *
 * Limits: the note is judged as `analyze` and the report's line render it,
 * in-process; that the CLI prints it on stdout, in the stream log, and in
 * summary.md is shown by a probe in the pull request, not by an oracle (no
 * end-to-end history owns an entry that holds no mutant). Selection by
 * `--only` or `--sample` is not generated: the note counts the run's mutants
 * before any selection. Probe-only code is not generated. One authored
 * mutant at most, whose source is spelled as the entry spells it.
 */
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { differs, oracleProperty, pass } from '../src/oracle-property.ts'
import { analyze } from './analysis.mjs'
import { Refusal } from './ending.mjs'
import * as report from './report.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ts = createRequire(join(here, `../package.json`))(
  `typescript-for-tanstack-oracles`,
)

const LAW = `an owns entry that no mutant tests is named`
const A = `src/a.ts`
const B = `src/b.ts`
const SHAPES = `src/shapes.ts`
const TYPES = `src/types.d.ts`
const FILES = [A, B, SHAPES, TYPES]
const TEXT = {
  [A]: [
    `import { helper } from './b'`,
    `export function run(n: number): number {`,
    `  return n + 1`,
    `}`,
    `export function empty(): void {}`,
    `export function relay(n: number): number {`,
    `  return helper(n)`,
    `}`,
    ``,
  ].join(`\n`),
  [B]: `export function helper(n: number): number {\n  return n * 2\n}\n`,
  [SHAPES]: `export interface Shape {\n  size: number\n}\nexport type Size = Shape['size']\n`,
  [TYPES]: `export declare function run(n: number): number\n`,
}
// Each function entry's tree, by unit and its file, and the units with
// mutation sites.
const TREES = {
  [`${A}#run`]: [[A, `run`]],
  [`${A}#empty`]: [[A, `empty`]],
  [`${A}#relay`]: [
    [A, `relay`],
    [B, `helper`],
  ],
  [`${B}#helper`]: [[B, `helper`]],
}
const SITED = new Set([`${A}#run`, `${A}#relay`, `${B}#helper`])
const UNITS = {
  [A]: [`run`, `empty`, `relay`],
  [B]: [`helper`],
  [SHAPES]: [],
  [TYPES]: [],
}
const ENTRIES = [...FILES, ...Object.keys(TREES)]
// Authored edits, each by the unit it lands in (`<module>` for none).
const AUTHORED = {
  empty: {
    source: A,
    unit: `empty`,
    find: `export function empty(): void {}`,
    replace: `export function empty(): void { throw new Error('x') }`,
  },
  shapes: {
    source: SHAPES,
    unit: `<module>`,
    find: `size: number`,
    replace: `size: string`,
  },
  types: {
    source: TYPES,
    unit: `<module>`,
    find: `(n: number)`,
    replace: `(n: string)`,
  },
}

const historyArbitrary = fc.record({
  // An entry may repeat in one file, as two calls of one file may name it.
  oracles: fc.array(
    fc.array(fc.constantFrom(...ENTRIES), {
      minLength: 1,
      maxLength: 3,
    }),
    { minLength: 1, maxLength: 2 },
  ),
  sources: fc.uniqueArray(fc.constantFrom(...FILES), {
    minLength: 1,
    maxLength: 4,
  }),
  authored: fc.constantFrom(undefined, undefined, `empty`, `shapes`, `types`),
})

/** The units an entry owns, each as `file#unit`, or its whole file. */
const owns = (entry) =>
  TREES[entry]?.map(([file, unit]) => `${file}#${unit}`) ??
  UNITS[entry].map((unit) => `${entry}#${unit}`)

/** Whether an entry holds a mutant of the history's run. */
function holds(history, entry) {
  const whole = TREES[entry] === undefined
  const sited = owns(entry).some(
    (unit) => SITED.has(unit) && history.sources.includes(unit.split(`#`)[0]),
  )
  const edit = AUTHORED[history.authored]
  const authored =
    edit !== undefined &&
    (whole
      ? entry === edit.source
      : owns(entry).includes(`${edit.source}#${edit.unit}`))
  return sited || authored
}

const fileOf = (index) => `tests/o${index}.test.ts`

function model(history) {
  // A selected source is owned when an entry names it whole or owns a unit
  // of it; a run in which none is refuses.
  const owned = history.sources.some((source) =>
    history.oracles.some((entries) =>
      entries.some((entry) =>
        TREES[entry] === undefined
          ? entry === source
          : TREES[entry].some(([file]) => file === source),
      ),
    ),
  )
  if (!owned) return { refused: true, notes: [] }
  const notes = []
  history.oracles.forEach((entries, index) => {
    for (const entry of new Set(entries)) {
      if (holds(history, entry)) continue
      const file = entry.split(`#`)[0]
      const reason = !history.sources.includes(file)
        ? `${file} is not a --source`
        : file.endsWith(`.d.ts`)
          ? `${file} is a declaration file, which has no mutation site`
          : `nothing it owns has a mutation site`
      notes.push(
        `oracle-gaps: note no mutant for owns entry ${entry} of ${fileOf(index)}: ${reason}, so the gap check gives it no evidence`,
      )
    }
  })
  return { refused: false, notes: notes.sort() }
}

/** The states a history enters, for the reach counts. */
function statesOf(history) {
  const { refused } = model(history)
  if (refused) return [STATES[7]]
  const states = []
  const entries = history.oracles.flat()
  const idle = entries.filter((entry) => !holds(history, entry))
  const fileOfEntry = (entry) => entry.split(`#`)[0]
  if (idle.some((e) => !history.sources.includes(fileOfEntry(e))))
    states.push(STATES[0])
  if (idle.some((e) => e === TYPES && history.sources.includes(TYPES)))
    states.push(STATES[1])
  if (idle.some((e) => e !== TYPES && history.sources.includes(fileOfEntry(e))))
    states.push(STATES[2])
  if (
    entries.some(
      (e) =>
        TREES[e] !== undefined &&
        !history.sources.includes(fileOfEntry(e)) &&
        holds(history, e),
    )
  )
    states.push(STATES[3])
  if (
    history.authored !== undefined &&
    entries.some(
      (e) =>
        holds(history, e) &&
        !owns(e).some(
          (unit) =>
            SITED.has(unit) && history.sources.includes(unit.split(`#`)[0]),
        ),
    )
  )
    states.push(STATES[4])
  if (idle.length === 0) states.push(STATES[5])
  if (history.oracles.length > 1 && idle.length > 0) states.push(STATES[6])
  return states
}

const STATES = [
  `an entry whose file is not a --source is named`,
  `a declaration file in --source is named`,
  `an entry with no mutation site is named`,
  `a tree that reaches a --source from another file holds mutants`,
  `an authored edit counts as a mutant of its entry`,
  `every entry holds a mutant`,
  `two oracle files, each named`,
  `a run that owns no selected source refuses`,
]

const constructed = [
  {
    name: `a declaration file left out`,
    enters: [STATES[0]],
    build: (g) => ({
      ...g,
      oracles: [[`${A}#run`, TYPES]],
      sources: [A],
      authored: undefined,
    }),
  },
  {
    name: `a declaration file selected`,
    enters: [STATES[1]],
    build: (g) => ({
      ...g,
      oracles: [[`${A}#run`], [TYPES]],
      sources: [A, TYPES],
      authored: undefined,
    }),
  },
  {
    name: `nothing to mutate`,
    enters: [STATES[2]],
    build: (g) => ({
      ...g,
      oracles: [[`${A}#run`, `${A}#empty`, SHAPES]],
      sources: [A, SHAPES],
      authored: undefined,
    }),
  },
  {
    name: `a tree into another file`,
    enters: [STATES[3], STATES[5]],
    build: (g) => ({
      ...g,
      oracles: [[`${A}#relay`]],
      sources: [B],
      authored: undefined,
    }),
  },
  {
    name: `an authored edit in a declaration file`,
    enters: [STATES[4], STATES[5]],
    build: (g) => ({
      ...g,
      oracles: [[`${A}#run`, TYPES]],
      sources: [A, TYPES],
      authored: `types`,
    }),
  },
  {
    name: `an authored edit in an empty function`,
    enters: [STATES[4], STATES[5]],
    build: (g) => ({
      ...g,
      oracles: [[`${A}#run`, `${A}#empty`]],
      sources: [A],
      authored: `empty`,
    }),
  },
  {
    name: `two oracle files`,
    enters: [STATES[0], STATES[2], STATES[6]],
    build: (g) => ({
      ...g,
      oracles: [
        [`${A}#run`, `${B}#helper`],
        [`${A}#empty`, SHAPES],
      ],
      sources: [A, SHAPES],
      authored: undefined,
    }),
  },
  {
    name: `no owner`,
    enters: [STATES[7]],
    build: (g) => ({ ...g, oracles: [[`${B}#helper`]], sources: [SHAPES] }),
  },
]

function driver(history, observe) {
  const pkg = realpathSync.native(mkdtempSync(join(tmpdir(), `owns-evidence-`)))
  try {
    mkdirSync(join(pkg, `src`), { recursive: true })
    mkdirSync(join(pkg, `tests`), { recursive: true })
    for (const file of FILES) writeFileSync(join(pkg, file), TEXT[file])
    const testFiles = history.oracles.map((entries, index) => {
      const path = join(pkg, fileOf(index))
      writeFileSync(
        path,
        `oracleProperty({ owns: [${entries.map((e) => `'${e}'`).join(`, `)}] })\n`,
      )
      return path
    })
    const edit = AUTHORED[history.authored]
    const authored = edit
      ? [
          {
            id: `edit`,
            source: edit.source,
            find: edit.find,
            replace: edit.replace,
            intent: `a wrong version`,
            author: `oracle`,
          },
        ]
      : []
    let result
    try {
      result = analyze(ts, pkg, history.sources, testFiles, authored)
    } catch (error) {
      if (!(error instanceof Refusal)) throw error
      observe(`notes`, { refused: true, notes: [] })
      for (const state of statesOf(history)) observe(`reach`, state)
      return
    }
    const line =
      report.unevidencedLine ?? (() => `(no note line in report.mjs)`)
    observe(`notes`, {
      refused: false,
      notes: (result.unevidenced ?? []).map(line).sort(),
    })
    for (const state of statesOf(history)) observe(`reach`, state)
  } finally {
    rmSync(pkg, { recursive: true, force: true })
  }
}

const check = (history, trace, expected) =>
  differs(
    `notes`,
    LAW,
    trace.find((row) => row.checkpoint === `notes`)?.value,
    expected,
  ) ?? pass

// Wrong answers the check must reject: a note left out, a wrong reason, and
// a note for an entry that an authored edit tests.
const corruptNotes = (trace, change) => {
  const index = trace.findIndex((row) => row.checkpoint === `notes`)
  if (index < 0) return undefined
  const value = structuredClone(trace[index].value)
  if (!change(value)) return undefined
  return trace.map((row, i) => (i === index ? { ...row, value } : row))
}
const calibrations = [
  {
    name: `an entry with no mutant goes unnamed`,
    law: LAW,
    history: { constructed: `a declaration file left out` },
    corrupt: (trace) =>
      corruptNotes(trace, (value) => value.notes.splice(0).length > 0),
  },
  {
    name: `a selected declaration file is called not a --source`,
    law: LAW,
    history: { constructed: `a declaration file selected` },
    corrupt: (trace) =>
      corruptNotes(trace, (value) => {
        const at = value.notes.findIndex((n) => n.includes(`declaration file`))
        if (at < 0) return false
        value.notes[at] = value.notes[at].replace(
          `is a declaration file, which has no mutation site`,
          `is not a --source`,
        )
        return true
      }),
  },
  {
    name: `an entry an authored edit tests is named`,
    law: LAW,
    history: { constructed: `an authored edit in a declaration file` },
    corrupt: (trace) =>
      corruptNotes(trace, (value) => {
        value.notes.push(
          `oracle-gaps: note no mutant for owns entry ${TYPES} of ${fileOf(0)}: ${TYPES} is a declaration file, which has no mutation site, so the gap check gives it no evidence`,
        )
        return true
      }),
  },
]

oracleProperty({
  id: `oracle-gaps.report-static-evidence`,
  law: {
    statement: `The gap report names, in one note each, every owns entry that holds none of the run's mutants, operator or authored, with its oracle file and the reason: its file is not a --source, its file is a declaration file, or nothing it owns has a mutation site. An entry that holds a mutant is not named.`,
    authority: `A downstream user's findings that a declaration file and a type-only entry get no mutation evidence, silently (2026-11), and the gap report's practice of warning about what it does not judge (the unowned warning of gap-report-oracle.property.test.mjs law 3). Pending the maintainers' approval.`,
    limits: `Judged in-process through analyze and the report's note line, not through the CLI's stdout, stream log, or summary.md. Not generated: --only and --sample (the note counts mutants before selection), probe-only code, more than one authored mutant, and an authored source spelled other than its entry.`,
  },
  histories: {
    arbitrary: historyArbitrary,
    runs: 60,
    fixedSeeds: [20261124],
    states: STATES,
    measured: [],
    constructed,
  },
  timeout: 120_000,
  model,
  driver,
  check,
  calibrations,
})
