/**
 * # What does the gap report owe for TypeScript findings in oracle files?
 *
 * Vitest strips types without checking them, so an oracle file with a type
 * error, or one that the package's tsconfig.json leaves out, passes its
 * tests while `tsc` fails. The gap report checks the TypeScript oracle files
 * (typecheck.mjs) and reports what it finds. It never refuses or fails a run
 * for it. This oracle states what the report owes for one package and checks
 * the real CLI against a small model.
 *
 * Law (maintainer decision of 2026-11-23, decisions-register.md, "Type errors
 * are reported, never blocking": "type errors shouldn't block a run but we
 * can just put them in the output"):
 *
 * 1. **Reporting.** When the package has a tsconfig.json, each TypeScript
 *    oracle file that no config covers (following `projectReferences`) is
 *    named in a note line of the stream, on stdout too, and in the summary's
 *    `Typecheck notes` section, and it is listed as uncovered in results.json.
 *    Each error in a covered oracle file is named by file, line, column, and
 *    TypeScript code, in the same three places, and counted in results.json.
 *    A package with no tsconfig.json has no typecheck note, no summary
 *    section, and no `typecheck` field in results.json.
 * 2. **Exit.** The findings never change the exit status: the run completes
 *    with exit 0 and `oracle-gaps: done completed` as its last line, whether
 *    or not the oracle files are covered or type-check.
 * 3. **No refusal mode.** `--typecheck` is not an option. The CLI refuses an
 *    unknown option before any check starts, with exit 2, a refusal block
 *    naming the option, and `oracle-gaps: done refused` as its last line; no
 *    baseline line is written.
 *
 * Authority: the maintainer's decision of 2026-11-23 (law 1 and law 2), and
 * the frozen P10 (one diagnostic per failure from a run with an identity;
 * the done line last, matching the exit code) and P12 (cost is a budget).
 * The unknown-option refusal is the existing argument refusal (P10: an
 * argument refusal owes the done line alone).
 *
 * The grammar: a history is a package layout (no tsconfig.json; a tsconfig
 * that includes the tests; one that excludes them; a solution-style
 * tsconfig whose reference covers them), whether the one oracle file
 * `tests/math.oracle.test.ts` has a type error, whether the run passes the
 * removed `--typecheck` flag, and whether the run goes through the daemon.
 * The package has two oracle files, `tests/math.oracle.test.ts` (which may
 * hold the error) and `tests/other.oracle.test.ts`. The model below reads the
 * history and the law only, never the CLI. The driver runs the real CLI on
 * a fresh scratch package. The comparison checks the stream (stderr and
 * stdout), stream.log, the summary, and results.json.
 *
 * Limits: one source file, one package, and one tsconfig reference level.
 * TypeScript 7 configs (skipped with a note) and a node_modules edit between
 * two daemon checks are not drawn. The model's TypeScript positions and
 * messages are TypeScript 5's, for the fixture's one declaration
 * (`const wrong: string = add(1, 2)`: TS2322 at the name `wrong`, column 9).
 * No cost law: the typecheck's wall time is measured in the pull request, not
 * judged here.
 */
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { oracleProperty, pass, violation } from '../src/oracle-property.ts'

const here = dirname(fileURLToPath(import.meta.url))
const cliPath = join(here, `index.mjs`)

const LAYOUTS = [`none`, `include`, `excluded`, `referenced`]
const ORACLE_FILES = [`tests/math.oracle.test.ts`, `tests/other.oracle.test.ts`]
const ERROR_FILE = `tests/math.oracle.test.ts`
// `const wrong: string = add(1, 2)` on line 8: TypeScript reports TS2322 at
// the declared name, `wrong`, at column 9.
const ERROR = {
  file: ERROR_FILE,
  line: 8,
  column: 9,
  code: 2322,
  message: `Type 'number' is not assignable to type 'string'.`,
}
// The refusal block's head line for the removed flag, once it is an unknown option.
const FLAG_REFUSAL = `refused: unknown option --typecheck`

// ## Model
//
// Expected findings from the history alone. A `none` package owes nothing.
// `include` and `referenced` cover both oracle files, so their error (when
// drawn) is checked; `excluded` covers none, so tsc would not check the error
// and the report names both files as uncovered instead.
function model(plan) {
  if (plan.flag) return { refused: true, notes: [] }
  if (plan.layout === `none`)
    return {
      refused: false,
      found: false,
      notes: [],
      checked: [],
      uncovered: [],
      diagnostics: [],
    }
  const covered = plan.layout !== `excluded`
  const uncovered = covered ? [] : ORACLE_FILES
  const diagnostics = covered && plan.error ? [ERROR] : []
  const notes = [
    ...uncovered.map((file) => ({ kind: `uncovered`, file })),
    ...diagnostics.map((d) => ({ kind: `diagnostic`, ...d })),
  ]
  return {
    refused: false,
    found: true,
    notes,
    checked: covered ? [...ORACLE_FILES] : [],
    uncovered: [...uncovered],
    diagnostics,
  }
}

// ## Production driver
//
// Writes the fixture's package, runs the real CLI on it, and observes what it
// wrote. The package sits in this directory so Vitest resolves its own
// dependencies here, as the other gap oracles' fixtures do.
function fixture(plan) {
  const pkg = realpathSync.native(
    mkdtempSync(join(here, `.scratch-typecheck-`)),
  )
  const oracle = (body) =>
    `import { expect, test } from 'vitest'\nimport { add } from '../src/math'\n\ndeclare function oracleProperty(spec: { owns: Array<string> }): void\nif (false) oracleProperty({ owns: ['src/math.ts#add'] })\n\ntest('adds numbers', () => {\n${body}\n})\n`
  const compilerOptions = {
    target: `ES2022`,
    module: `ESNext`,
    moduleResolution: `Bundler`,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
  }
  const files = {
    'package.json': JSON.stringify({
      name: `typecheck-fixture`,
      private: true,
      type: `module`,
    }),
    'vitest.config.mjs': `export default { test: { include: ['tests/**/*.test.ts'] } }\n`,
    'src/math.ts': `export function add(a: number, b: number): number {\n  return a + b\n}\n`,
    // Vitest strips the annotation, so the test passes; tsc rejects the file.
    'tests/math.oracle.test.ts': oracle(
      plan.error
        ? `  const wrong: string = add(1, 2)\n  expect(wrong).toBe(3)`
        : `  expect(add(1, 2)).toBe(3)`,
    ),
    'tests/other.oracle.test.ts': oracle(`  expect(add(2, 2)).toBe(4)`),
  }
  if (plan.layout === `include`)
    files[`tsconfig.json`] = JSON.stringify({
      compilerOptions,
      include: [`src`, `tests`],
    })
  if (plan.layout === `excluded`)
    files[`tsconfig.json`] = JSON.stringify({
      compilerOptions,
      include: [`src`],
    })
  if (plan.layout === `referenced`) {
    files[`tsconfig.json`] = JSON.stringify({
      files: [],
      references: [{ path: `./tests` }],
    })
    files[`tests/tsconfig.json`] = JSON.stringify({
      compilerOptions,
      include: [`*.ts`],
    })
  }
  for (const [rel, text] of Object.entries(files)) {
    const full = join(pkg, rel)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, text)
  }
  return pkg
}

const cleanEnv = () =>
  Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) =>
        !name.startsWith(`VITEST`) &&
        !name.startsWith(`ORACLE_`) &&
        name !== `NODE_ENV` &&
        name !== `TEST`,
    ),
  )

const linesOf = (text) => (text ? text.replace(/\n$/, ``).split(`\n`) : [])
// The lines the trace keeps: the protocol's fixed lines and the typecheck notes.
const fixedLine = (line) =>
  /^oracle-gaps: (?:note log |config |baseline |note typecheck: |done )|^refused: |^fix: /.test(
    line,
  )

function readIf(path) {
  return existsSync(path) ? readFileSync(path, `utf8`) : undefined
}

// The states a history enters, from the history alone.
function statesOf(plan) {
  const states = []
  if (plan.flag) states.push(`--typecheck refused as an unknown option`)
  if (plan.layout === `none`) states.push(`no tsconfig.json`)
  if (plan.layout === `excluded`) states.push(`uncovered oracle files`)
  if (plan.layout === `referenced`)
    states.push(`a referenced tsconfig covers the oracle files`)
  if (plan.layout !== `none` && plan.layout !== `excluded` && plan.error)
    states.push(`type error in a covered oracle file`)
  if (plan.daemon && plan.layout !== `none` && plan.error)
    states.push(`daemon run with type errors`)
  return states
}

function driver(plan, observe) {
  for (const state of statesOf(plan)) observe(`reach`, state)
  const pkg = fixture(plan)
  const out = join(pkg, `out`)
  const args = [
    `--package`,
    pkg,
    `--source`,
    `src/math.ts`,
    `--contexts`,
    `1`,
    `--out`,
    out,
  ]
  if (plan.daemon) args.push(`--daemon`)
  if (plan.flag) args.push(`--typecheck`)
  try {
    const run = spawnSync(process.execPath, [cliPath, ...args], {
      cwd: pkg,
      encoding: `utf8`,
      env: cleanEnv(),
      timeout: 300_000,
    })
    // Observations name the random scratch directory as `<pkg>`, and keep only
    // the fixed lines of the protocol (note log, config, baseline, done, and
    // refusal blocks) and the typecheck notes: progress and timing lines are
    // not outcomes (P10, I18). stream.log is compared to stderr here, whole.
    const scrub = (text) => text.split(pkg).join(`<pkg>`)
    const file = (name) => {
      const text = readIf(join(out, name))
      return text === undefined ? undefined : scrub(text)
    }
    const stderr = linesOf(scrub(run.stderr))
    const summary = file(`summary.md`)
    const section = summary?.split(`## Typecheck notes`)[1]?.split(`\n## `)[0]
    observe(`run`, {
      status: run.status,
      stdout: linesOf(scrub(run.stdout)).filter(fixedLine),
      stderr: stderr.filter(fixedLine),
      streamLogIsStderr:
        JSON.stringify(linesOf(file(`stream.log`))) === JSON.stringify(stderr),
      hasSection: summary?.includes(`## Typecheck notes`) === true,
      section,
      typecheck:
        file(`results.json`) && JSON.parse(file(`results.json`)).typecheck,
    })
  } finally {
    if (plan.daemon)
      spawnSync(
        process.execPath,
        [cliPath, `--stop-daemon`, `--package`, pkg],
        {
          cwd: pkg,
          encoding: `utf8`,
          env: cleanEnv(),
          timeout: 120_000,
        },
      )
    rmSync(pkg, { recursive: true, force: true })
  }
}

// ## Comparison
//
// The typecheck lines of one stream: each prefixed `oracle-gaps: note
// typecheck:`, or the refusal's named option.
const typecheckLines = (lines) =>
  lines.filter((line) => line.startsWith(`oracle-gaps: note typecheck: `))

function notesBreach(lines, expected, streamName) {
  const found = typecheckLines(lines)
  // One note per finding, and one count note for the errors.
  const owed =
    expected.notes.length +
    (expected.notes.some((n) => n.kind === `diagnostic`) ? 1 : 0)
  if (found.length !== owed)
    return `${streamName} has ${found.length} typecheck notes, owed ${owed}: ${JSON.stringify(found)}`
  for (const note of expected.notes) {
    if (note.kind === `uncovered`) {
      if (
        !found.some((line) =>
          line.includes(`${note.file} is not included in tsconfig.json`),
        )
      )
        return `${streamName} does not name ${note.file} as uncovered`
    } else if (
      !found.some((line) =>
        line.includes(
          `${note.file}:${note.line}:${note.column} TS${note.code}: ${note.message}`,
        ),
      )
    )
      return `${streamName} does not name the error ${note.file}:${note.line}:${note.column} TS${note.code}`
  }
  if (
    expected.notes.some((n) => n.kind === `diagnostic`) &&
    !found.some((line) => /1 TypeScript error in 1 oracle file$/.test(line))
  )
    return `${streamName} does not count the one error`
  return undefined
}

function check(plan, observations, expected) {
  const run = observations.find((o) => o.checkpoint === `run`)?.value
  if (!run)
    return violation(`run`, `no CLI run was observed`, `typecheck report`)
  if (expected.refused) {
    // The removed mode: `--typecheck` is an unknown option, refused before any
    // check, with the done line last and no baseline line.
    if (run.status !== 2)
      return violation(
        `run`,
        `the removed --typecheck flag gave exit ${run.status}, owed 2`,
        `typecheck refusal`,
      )
    if (!run.stderr.some((line) => line.startsWith(FLAG_REFUSAL)))
      return violation(
        `run`,
        `the stderr does not refuse --typecheck as an unknown option`,
        `typecheck refusal`,
      )
    if (!run.stderr.at(-1)?.startsWith(`oracle-gaps: done refused`))
      return violation(
        `run`,
        `the last stderr line is ${JSON.stringify(run.stderr.at(-1))}, owed the refused done line`,
        `typecheck refusal`,
      )
    if (run.stderr.some((line) => line.startsWith(`oracle-gaps: baseline `)))
      return violation(
        `run`,
        `a refused argument started a check (a baseline line)`,
        `typecheck refusal`,
      )
    return pass
  }
  // Reporting never changes the exit status (law 2).
  if (run.status !== 0)
    return violation(
      `run`,
      `exit ${run.status}, owed 0: the typecheck findings changed the exit status`,
      `typecheck exit`,
    )
  if (!run.stderr.at(-1)?.startsWith(`oracle-gaps: done completed`))
    return violation(
      `run`,
      `the last stderr line is ${JSON.stringify(run.stderr.at(-1))}, owed the completed done line`,
      `typecheck exit`,
    )
  const err = notesBreach(run.stderr, expected, `stderr`)
  if (err) return violation(`run`, err, `typecheck report`)
  const out = notesBreach(run.stdout, expected, `stdout`)
  // The baseline is the first result line on each stream, so every typecheck
  // note comes after it (P10: one decisive baseline line is the first result
  // line; a note is not a result kind that precedes it).
  const ordered = (lines) => {
    const first = lines.findIndex((line) =>
      line.startsWith(`oracle-gaps: baseline `),
    )
    const note = lines.findIndex((line) =>
      line.startsWith(`oracle-gaps: note typecheck: `),
    )
    return note < 0 || (first >= 0 && first < note)
  }
  if (!ordered(run.stderr))
    return violation(
      `run`,
      `a typecheck note precedes the baseline line on stderr`,
      `typecheck order`,
    )
  if (!ordered(run.stdout))
    return violation(
      `run`,
      `a typecheck note precedes the baseline line on stdout`,
      `typecheck order`,
    )
  if (out) return violation(`run`, out, `typecheck report`)
  if (!run.streamLogIsStderr)
    return violation(
      `run`,
      `stream.log is not the stderr stream`,
      `typecheck report`,
    )
  // The summary's section and results.json's field: a package with a tsconfig
  // owes the field, with or without findings; one with no tsconfig owes neither.
  if (!expected.found) {
    if (run.hasSection || run.typecheck !== undefined)
      return violation(
        `run`,
        `a package with no tsconfig.json has a typecheck summary or field`,
        `typecheck report`,
      )
    return pass
  }
  if (expected.notes.length === 0 && run.hasSection)
    return violation(
      `run`,
      `the summary has a Typecheck notes section with no findings`,
      `typecheck report`,
    )
  for (const note of expected.notes) {
    const named =
      note.kind === `uncovered`
        ? note.file
        : `${note.file}:${note.line}:${note.column}`
    if (run.section === undefined || !run.section.includes(named))
      return violation(
        `run`,
        `the summary's Typecheck notes do not name ${named}`,
        `typecheck report`,
      )
  }
  const typecheck = run.typecheck
  if (typecheck === undefined)
    return violation(
      `run`,
      `results.json has no typecheck field for a package with a tsconfig.json`,
      `typecheck report`,
    )
  if (typecheck.config !== `tsconfig.json`)
    return violation(
      `run`,
      `results.json names config ${typecheck.config}, owed tsconfig.json`,
      `typecheck report`,
    )
  const sorted = (xs) => [...xs].sort()
  if (
    JSON.stringify(sorted(typecheck.checked)) !==
    JSON.stringify(sorted(expected.checked))
  )
    return violation(
      `run`,
      `results.json checked ${JSON.stringify(typecheck.checked)}, owed ${JSON.stringify(expected.checked)}`,
      `typecheck report`,
    )
  if (
    JSON.stringify(sorted(typecheck.uncovered)) !==
    JSON.stringify(sorted(expected.uncovered))
  )
    return violation(
      `run`,
      `results.json uncovered ${JSON.stringify(typecheck.uncovered)}, owed ${JSON.stringify(expected.uncovered)}`,
      `typecheck report`,
    )
  const diagnostics = (typecheck.diagnostics ?? []).map(
    ({ file, line, column, code, message }) => ({
      file,
      line,
      column,
      code,
      message,
    }),
  )
  if (JSON.stringify(diagnostics) !== JSON.stringify(expected.diagnostics))
    return violation(
      `run`,
      `results.json diagnostics ${JSON.stringify(diagnostics)}, owed ${JSON.stringify(expected.diagnostics)}`,
      `typecheck report`,
    )
  return pass
}

// Each calibration takes one constructed history and corrupts its run, so the
// check must reject the wrong answer under the law it names.
const withRun = (corrupt) => (trace) => {
  const index = trace.findIndex((o) => o.checkpoint === `run`)
  if (index < 0) return undefined
  const value = structuredClone(trace[index].value)
  corrupt(value)
  return trace.map((o, i) => (i === index ? { ...o, value } : o))
}

const calibrations = [
  {
    name: `a typecheck note printed before the baseline line`,
    law: `typecheck order`,
    history: { constructed: `type error in a covered oracle file` },
    corrupt: withRun((run) => {
      const notes = run.stderr.filter((line) =>
        line.startsWith(`oracle-gaps: note typecheck: `),
      )
      const rest = run.stderr.filter(
        (line) => !line.startsWith(`oracle-gaps: note typecheck: `),
      )
      const at = rest.findIndex((line) =>
        line.startsWith(`oracle-gaps: baseline `),
      )
      run.stderr = [...rest.slice(0, at), ...notes, ...rest.slice(at)]
    }),
  },
  {
    name: `a covered type error is dropped from the stream`,
    law: `typecheck report`,
    history: { constructed: `type error in a covered oracle file` },
    corrupt: withRun((run) => {
      run.stderr = run.stderr.filter(
        (line) => !line.startsWith(`oracle-gaps: note typecheck: `),
      )
    }),
  },
  {
    name: `a covered type error changes the exit status`,
    law: `typecheck exit`,
    history: { constructed: `type error in a covered oracle file` },
    corrupt: withRun((run) => {
      run.status = 2
      run.stderr[run.stderr.length - 1] =
        `oracle-gaps: done refused, report out/summary.md`
    }),
  },
  {
    name: `the removed --typecheck flag still refuses a clean package`,
    law: `typecheck refusal`,
    history: { constructed: `--typecheck refused as an unknown option` },
    corrupt: withRun((run) => {
      run.status = 0
      run.stderr = run.stderr.filter((line) => !line.startsWith(FLAG_REFUSAL))
      run.stderr[run.stderr.length - 1] =
        `oracle-gaps: done completed, 0 gaps, report out/summary.md`
    }),
  },
]

// ## Histories
//
// Generated: each layout, with and without an error, with and without the
// removed flag, through the daemon or cold. Constructed: one history per
// declared state, so every state is named by a history of its own.
const construct = (state, layout, error, flag = false, daemon = false) => ({
  name: state,
  enters: [state],
  build: (generated) => ({ ...generated, layout, error, flag, daemon }),
})

oracleProperty({
  id: `oracle-gaps.report-typecheck`,
  law: {
    statement: `The gap report names each uncovered TypeScript oracle file and each TypeScript error in a covered oracle file, on both streams, in its summary, and in results.json. Such findings never change the exit status, and --typecheck is not an option.`,
    authority: `The maintainer's decision of 2026-11-23 ("Type errors are reported, never blocking", decisions-register.md), and the frozen P10 (one diagnostic per failure, the done line last, matching the exit code) and P12.`,
    limits: `One source file and one package per history; one reference level for projectReferences; no TypeScript 7 config and no node_modules edit between daemon checks. The typecheck's cost is measured in the pull request, not judged here.`,
  },
  histories: {
    arbitrary: fc.record({
      layout: fc.constantFrom(...LAYOUTS),
      error: fc.boolean(),
      flag: fc.constantFrom(false, false, false, true),
      daemon: fc.constantFrom(false, false, true),
    }),
    states: [
      `--typecheck refused as an unknown option`,
      `no tsconfig.json`,
      `uncovered oracle files`,
      `a referenced tsconfig covers the oracle files`,
      `type error in a covered oracle file`,
      `daemon run with type errors`,
    ],
    runs: 16,
    bases: 1,
    fixedSeeds: [20261123],
    constructed: [
      construct(
        `--typecheck refused as an unknown option`,
        `include`,
        false,
        true,
      ),
      construct(`no tsconfig.json`, `none`, false),
      construct(`uncovered oracle files`, `excluded`, true),
      construct(
        `a referenced tsconfig covers the oracle files`,
        `referenced`,
        false,
      ),
      construct(`type error in a covered oracle file`, `include`, true),
      construct(`daemon run with type errors`, `include`, true, false, true),
    ],
  },
  model,
  driver,
  check,
  calibrations,
  timeout: 300_000,
})
