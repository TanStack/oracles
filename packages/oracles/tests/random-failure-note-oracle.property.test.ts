/**
 * Oracle: a failing random-seed unit says to replay its seed before a rerun.
 *
 * Law (proposed): for every campaign unit of a generated source that fails
 * with a `Replay:` line, the message Vitest reports for it holds the line
 * `A random-seed failure: replay this seed before rerunning; a passing rerun
 * draws other histories and proves nothing.` right before that `Replay:`
 * line, once, when the unit is a random-seed unit (`random seed: <name>`). No
 * other test's message holds that line: not a fixed-seed unit's, whose
 * histories a rerun draws again, and not a determinism test's. Authority: a
 * downstream project's finding (a random-seed run found a real regression
 * that the fixed-seed gap check had passed, and a rerun that passed made it
 * look flaky; measured afterwards, 8 of 40 full runs failed), and the
 * coordinator's assignment of this note, 2026-11-25.
 *
 * History: one child Vitest run of a fixture with one generated property
 * whose every history fails, by a law violation or by a driver error. It has
 * a constructed history and two fixed seeds, so six campaign units fail:
 * `built` and `generated` at fixed seeds 1 and 2 and at the random seed. The
 * driver reads each failing test's message from Vitest's JSON report, up to
 * its first stack frame.
 *
 * Limits: a fixed-seed unit whose failing example is a drawn base
 * (`drawnBases`) is not generated; its `Drawn base:` line already says to
 * replay before a rerun. A unit run as a path replay is not generated. A
 * failure by a model error or a data error is not generated.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { differs, oracleProperty, pass } from '../src/index.js'
import type { Observation } from '../src/index.js'

const NOTE = `A random-seed failure: replay this seed before rerunning; a passing rerun draws other histories and proves nothing.`

type History = { name: string; failure: `violation` | `driver error` }

// The campaign units of the fixture's property, which all fail.
const units = [
  `fixed seed 1: built`,
  `fixed seed 1: generated`,
  `fixed seed 2: built`,
  `fixed seed 2: generated`,
  `random seed: built`,
  `random seed: generated`,
] as const

// What a message shows of the note: whether its test failed, how many of
// its lines are the note, and whether the line before its `Replay:` line is.
type Shown = { failed: boolean; notes: number; beforeReplay: boolean }

// The model: a random-seed unit's message holds the note once, right before
// its replay line; a fixed-seed unit's holds none. No other failing test of
// the property holds the note.
const model = () => ({
  units: units.map((unit): Shown =>
    unit.startsWith(`random seed: `)
      ? { failed: true, notes: 1, beforeReplay: true }
      : { failed: true, notes: 0, beforeReplay: false },
  ),
  others: 0,
})

const here = dirname(fileURLToPath(import.meta.url))
const packageDirectory = join(here, `..`)
const vitest = join(
  dirname(createRequire(import.meta.url).resolve(`vitest/package.json`)),
  `vitest.mjs`,
)
let runs = 0

type Reported = {
  ancestorTitles: Array<string>
  title: string
  status: string
  failureMessages: Array<string>
}

// One child Vitest run of the fixture; every test's result is read from
// Vitest's JSON report.
function reportOf(history: History): Array<Reported> {
  const directory = join(
    packageDirectory,
    `.random-failure-note-${process.pid}-${(runs += 1)}`,
  )
  mkdirSync(directory, { recursive: true })
  try {
    const index = JSON.stringify(join(packageDirectory, `src/index.ts`))
    writeFileSync(
      join(directory, `note.test.ts`),
      [
        `import fc from 'fast-check'`,
        `import { oracleProperty, violation } from ${index}`,
        `oracleProperty({`,
        `  id: 'note',`,
        `  law: { statement: 'For every history, it fails.', authority: 'this fixture', limits: 'none' },`,
        `  histories: { arbitrary: fc.integer({ min: 0, max: 3 }), runs: 1, fixedSeeds: [1, 2], constructed: [{ name: 'built', enters: [], build: () => 3 }] },`,
        `  model: () => 0,`,
        history.failure === `violation`
          ? `  driver: (_history, observe) => observe('v', 1),`
          : `  driver: () => { throw new Error('the fixture driver fails') },`,
        `  check: (history) => violation('v', 'at ' + history, 'fails'),`,
        `})`,
        ``,
      ].join(`\n`),
    )
    writeFileSync(
      join(directory, `vitest.config.mjs`),
      `export default { test: { include: ['note.test.ts'] } }\n`,
    )
    const report = join(directory, `report.json`)
    const run = spawnSync(
      process.execPath,
      [
        vitest,
        `run`,
        `--root=${directory}`,
        `--config=${join(directory, `vitest.config.mjs`)}`,
        `--reporter=json`,
        `--outputFile=${report}`,
      ],
      {
        cwd: directory,
        env: Object.fromEntries(
          Object.entries(process.env).filter(
            ([key]) => !key.startsWith(`ORACLE_`) && !key.startsWith(`VITEST`),
          ),
        ),
        encoding: `utf8`,
        timeout: 120_000,
      },
    )
    if (run.error) throw run.error
    return (
      JSON.parse(readFileSync(report, `utf8`)) as {
        testResults: Array<{ assertionResults: Array<Reported> }>
      }
    ).testResults.flatMap((file) => file.assertionResults)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

// A message's lines, up to its first stack frame.
const linesOf = (stack: string) => stack.split(/\n {4}at /)[0]!.split(`\n`)

function shown(test: Reported | undefined): Shown {
  const lines = linesOf(test?.failureMessages[0] ?? ``)
  const replay = lines.findIndex((line) => line.startsWith(`Replay: `))
  return {
    failed: test?.status === `failed`,
    notes: lines.filter((line) => line === NOTE).length,
    beforeReplay: replay > 0 && lines[replay - 1] === NOTE,
  }
}

function driver(history: History, observe: (c: string, v: unknown) => void) {
  const results = reportOf(history)
  for (const unit of units)
    observe(`unit ${unit}`, shown(results.find((test) => test.title === unit)))
  observe(
    `others`,
    results
      .filter(
        (test) =>
          test.status === `failed` &&
          !(units as ReadonlyArray<string>).includes(test.title),
      )
      .reduce((sum, test) => sum + shown(test).notes, 0),
  )
}

function check(
  _history: History,
  trace: ReadonlyArray<Observation>,
  owed: ReturnType<typeof model>,
) {
  const seen = (checkpoint: string) =>
    trace.find((o) => o.checkpoint === checkpoint)?.value
  for (const [at, unit] of units.entries()) {
    const verdict = differs(
      `unit ${unit}`,
      `the replay-first note`,
      seen(`unit ${unit}`),
      owed.units[at],
    )
    if (verdict) return verdict
  }
  return (
    differs(`others`, `the replay-first note`, seen(`others`), owed.others) ??
    pass
  )
}

// A wrong message: `change` applied to the first observation it changes.
const corrupt =
  (change: (o: Observation) => unknown) =>
  (trace: ReadonlyArray<Observation>) => {
    const at = trace.findIndex((o) => change(o) !== undefined)
    if (at < 0) return undefined
    return trace.map((o, i) => (i === at ? { ...o, value: change(o) } : o))
  }
const onUnit =
  (prefix: string, change: (value: Shown) => Shown) => (o: Observation) =>
    o.checkpoint.startsWith(`unit ${prefix}`)
      ? change(o.value as Shown)
      : undefined

oracleProperty({
  id: `self-oracle.random-failure-note`,
  owns: [`src/oracle-property.ts#generatedTests`],
  law: {
    statement: `For every campaign unit of a generated source that fails with a Replay: line, the message Vitest reports holds, once and right before that line, "${NOTE}" when the unit is a random-seed unit; no other failing test's message holds it.`,
    authority: `A downstream project's finding (a random-seed run found a real regression that the fixed-seed gap check had passed, and a passing rerun made it look flaky; 8 of 40 full runs failed), and the coordinator's assignment of this note, 2026-11-25.`,
    limits: `A fixed-seed unit whose failing example is a drawn base, a unit run as a path replay, and failures by a model or data error are not generated. Each history is one child Vitest run.`,
  },
  histories: [
    { name: `a law violation`, failure: `violation` },
    { name: `a driver error`, failure: `driver error` },
  ] satisfies Array<History>,
  label: (history) => history.name,
  timeout: 240_000,
  model,
  driver,
  check,
  calibrations: [
    {
      name: `a random unit without the note`,
      law: `the replay-first note`,
      corrupt: corrupt(
        onUnit(`random seed: `, (value) => ({
          ...value,
          notes: 0,
          beforeReplay: false,
        })),
      ),
    },
    {
      name: `a fixed-seed unit with the note`,
      law: `the replay-first note`,
      corrupt: corrupt(
        onUnit(`fixed seed `, (value) => ({
          ...value,
          notes: 1,
          beforeReplay: true,
        })),
      ),
    },
    {
      name: `the note after the replay line`,
      law: `the replay-first note`,
      corrupt: corrupt(
        onUnit(`random seed: generated`, (value) => ({
          ...value,
          beforeReplay: false,
        })),
      ),
    },
    {
      name: `the note twice`,
      law: `the replay-first note`,
      corrupt: corrupt(
        onUnit(`random seed: built`, (value) => ({ ...value, notes: 2 })),
      ),
    },
    {
      name: `a determinism test with the note`,
      law: `the replay-first note`,
      corrupt: corrupt((o) => (o.checkpoint === `others` ? 1 : undefined)),
    },
  ],
})
