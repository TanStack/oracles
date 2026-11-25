/**
 * # A counted probe reports how often each history entered it
 *
 * This oracle owns the `counts` line of a generated `oracleProperty` that
 * declares `counted` probes, checked on what a real child Vitest run prints
 * and reports: the line each passing campaign unit prints, and every test's
 * outcome.
 *
 * ```ts
 * probing && globalThis.__oracleProbe?.('pkg#pass', removed > 0) // in a loop
 * oracleProperty({ histories: { counted: ['pkg#pass'], ... } })
 * // → `<id> <unit> counts {"pkg#pass":{"min":0,"median":1,"max":3,"total":7,"histories":5}}`
 * // → no line for a unit that fails, or a property that counts no probe
 * // → the same test outcomes as without `counted`
 * ```
 *
 * A state probe answers whether a history entered a state; a counted probe
 * answers how many times. Which calls count, a history that never called the
 * probe, a unit of four histories whose middle counts are 1 and 2: each has
 * a plausible wrong answer (every call, only the histories that entered, the
 * upper middle).
 *
 * The law, `counted probes`: for every generated property, each campaign
 * unit that passes prints exactly one line, `<id> <unit> counts {...}`, when
 * the property declares a counted probe. It holds one entry per declared
 * probe, in name order, a duplicate once: over the histories the unit
 * judged, where a history's count is the number of its calls of that probe
 * with a truthy condition, the `min`, `median` (the lower middle), `max`,
 * `total`, and the number of `histories`; with no history, `min`, `median`,
 * and `max` are null. A unit that fails prints none, no other test prints
 * one, and no probe the property does not declare appears. Declaring
 * `counted` changes no test's outcome: a counted probe is never judged.
 * Authority: the `counted` option in `oracle-property.ts` (proposed in the
 * pull request that adds it; the law awaits approval).
 *
 * How the oracle knows: the history is one or two synthetic properties
 * (`probe-counts-oracle-fixture.ts`) and the seeds of their campaigns. The
 * child's driver calls three probes per item, `s#even` (the item is even),
 * `s#item` (the item itself, truthy unless 0), and `s#unlisted` (true), and
 * never calls `s#never`; it logs which test ran which items. The model reads
 * that log, which says which histories each unit judged, and from the items
 * alone owes each unit's outcome (it fails exactly when a history holds a
 * 5) and its counts. The check compares the load errors, every test's
 * outcome, and every line the synthetic properties print other than their
 * `reach` lines, as text.
 *
 * Limits: the model learns which histories a unit judged from the
 * synthetic driver's log, not from fast-check's stream. The constructed
 * histories fix their child seeds, so a change to fast-check's stream can
 * move them out of their states; they then fail as missing their states.
 * Constructed and fixed histories of the synthetic properties are not
 * drawn, and an enumerated source takes no `counted` (its load error is the
 * self-oracle's). The determinism test compares which probes a history
 * reached and entered, not how often; that is not judged here.
 */
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { differs, oracleProperty, pass } from '../src/index.js'
import { syntheticId, syntheticProbes } from './probe-counts-oracle-fixture.js'
import type { Observation } from '../src/index.js'
import type {
  Synthetic,
  SyntheticProbe,
} from './probe-counts-oracle-fixture.js'

type History = { seed: number; properties: ReadonlyArray<Synthetic> }
/** A test of a synthetic property, by its property's index and its own name. */
type Test = { property: number; name: string; state: string }
type Logged = { property: number; test: string; items: ReadonlyArray<number> }

const synthetic: fc.Arbitrary<Synthetic> = fc.record({
  counted: fc.option(
    fc.array(fc.constantFrom(...syntheticProbes), { maxLength: 4 }),
    { nil: undefined },
  ),
  runs: fc.integer({ min: 0, max: 4 }),
  fixedSeed: fc.boolean(),
  low: fc.integer({ min: 0, max: 5 }),
  high: fc.integer({ min: 0, max: 5 }),
  minLength: fc.integer({ min: 0, max: 2 }),
  extra: fc.integer({ min: 0, max: 2 }),
})
const history: fc.Arbitrary<History> = fc.record({
  seed: fc.integer({ min: 1, max: 1000 }),
  properties: fc.array(synthetic, { minLength: 1, maxLength: 2 }),
})

// The child's probe conditions, as a count of the items that satisfy them.
const countOf = (probe: SyntheticProbe, items: ReadonlyArray<number>) =>
  probe === `s#never`
    ? 0
    : items.filter((item) =>
        probe === `s#even` ? item % 2 === 0 : probe === `s#item` ? item : true,
      ).length

/** A wrong answer that a calibration prints in place of the law's. */
type Wrong =
  | `every call`
  | `histories entered`
  | `upper middle`
  | `undeclared`
  | `per history`
  | `failing too`

/** A campaign unit: what it judged and whether it passes. */
type Unit = {
  property: number
  name: string
  declared: ReadonlyArray<SyntheticProbe>
  judged: ReadonlyArray<ReadonlyArray<number>>
  passes: boolean
}

const unitsOf = (plan: History, log: ReadonlyArray<Logged>) =>
  plan.properties.flatMap((spec, property) =>
    [
      ...(spec.fixedSeed ? [`fixed seed ${plan.seed}: generated`] : []),
      `random seed: generated`,
    ].map((name): Unit => {
      const judged = log
        .filter((entry) => entry.property === property && entry.test === name)
        .map(({ items }) => items)
      return {
        property,
        name,
        declared: [...new Set(spec.counted ?? [])].sort(),
        judged,
        passes: !judged.some((items) => items.includes(5)),
      }
    }),
  )

// The summary of one probe's counts over a unit's histories.
function summary(counts: ReadonlyArray<number>, wrong?: Wrong) {
  const sorted = [...counts].sort((a, b) => a - b)
  const n = sorted.length
  const at = (index: number) => (n === 0 ? null : sorted[index]!)
  return {
    min: at(0),
    median: at(
      wrong === `upper middle` ? Math.floor(n / 2) : Math.ceil(n / 2) - 1,
    ),
    max: at(n - 1),
    total: sorted.reduce((sum, count) => sum + count, 0),
    histories:
      wrong === `histories entered`
        ? sorted.filter((count) => count > 0).length
        : n,
  }
}

function linesOf(units: ReadonlyArray<Unit>, wrong?: Wrong) {
  return units
    .filter(
      (unit) =>
        unit.declared.length > 0 && (unit.passes || wrong === `failing too`),
    )
    .flatMap(({ property, name, declared, judged }) => {
      const probes: ReadonlyArray<SyntheticProbe> =
        wrong === `undeclared`
          ? [...new Set([...declared, `s#unlisted` as const])].sort()
          : declared
      const line = `${syntheticId(property)} ${name} counts ${JSON.stringify(
        Object.fromEntries(
          probes.map((probe) => [
            probe,
            summary(
              judged.map((items) =>
                wrong === `every call` ? items.length : countOf(probe, items),
              ),
              wrong,
            ),
          ]),
        ),
      )}`
      return wrong === `per history` ? judged.map(() => line) : [line]
    })
    .sort()
}

type Owed = {
  units: ReadonlyArray<Unit>
  tests: ReadonlyArray<Test>
  lines: ReadonlyArray<string>
}

const logOf = (trace: ReadonlyArray<Observation>) =>
  (trace.find(({ checkpoint }) => checkpoint === `log`)?.value ??
    []) as ReadonlyArray<Logged>

function model(plan: History, trace: ReadonlyArray<Observation>): Owed {
  const units = unitsOf(plan, logOf(trace))
  const tests = plan.properties.flatMap((_, property) => [
    ...units
      .filter((unit) => unit.property === property)
      .map(({ name, passes }) => ({
        property,
        name,
        state: passes ? `passed` : `failed`,
      })),
    ...[0, 1, 2].map((index) => ({
      property,
      name: `determinism: generated ${index}`,
      state: `passed`,
    })),
  ])
  return { units, tests: sortTests(tests), lines: linesOf(units) }
}

const sortTests = (tests: ReadonlyArray<Test>) =>
  [...tests].sort((a, b) =>
    a.property !== b.property
      ? a.property - b.property
      : a.name < b.name
        ? -1
        : a.name > b.name
          ? 1
          : 0,
  )

const here = dirname(fileURLToPath(import.meta.url))
const packageDirectory = dirname(here)
const vitest = join(packageDirectory, `node_modules`, `vitest`, `vitest.mjs`)
let childRuns = 0

/**
 * Runs the synthetic properties in a child Vitest process, and records its
 * load errors, its driver log, every test's outcome, and every line the
 * synthetic properties print that is not a reach line.
 */
function driver(
  plan: History,
  observe: (checkpoint: string, value: unknown) => void,
) {
  const directory = join(
    packageDirectory,
    `.self-oracle-probe-counts-${process.pid}-${childRuns++}`,
  )
  mkdirSync(directory, { recursive: true })
  try {
    const log = join(directory, `log.jsonl`)
    const report = join(directory, `report.json`)
    writeFileSync(log, ``)
    writeFileSync(
      join(directory, `synthetic.test.ts`),
      `import { syntheticProperty } from '../tests/probe-counts-oracle-fixture.ts'\n${plan.properties
        .map(
          (spec, index) =>
            `syntheticProperty(${JSON.stringify(spec)}, ${index}, ${plan.seed})\n`,
        )
        .join(``)}`,
    )
    const run = spawnSync(
      process.execPath,
      [
        vitest,
        `run`,
        `--coverage.enabled=false`,
        `--typecheck.enabled=false`,
        `--reporter=${join(here, `oracle-property-self-oracle-reporter.mjs`)}`,
        `--dir=${directory}`,
      ],
      {
        cwd: packageDirectory,
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(
              ([key]) =>
                !key.startsWith(`ORACLE_`) && !key.startsWith(`SELF_ORACLE_`),
            ),
          ),
          // The random units' seed, another than the fixed-seed units'.
          ORACLE_SEED: String(plan.seed + 1),
          PROBE_COUNTS_LOG: log,
          SELF_ORACLE_REPORT: report,
        },
        encoding: `utf8`,
        timeout: 100_000,
      },
    )
    if (run.error) throw run.error
    if (!existsSync(report))
      throw new Error(`the child Vitest run wrote no report:\n${run.stderr}`)
    const { files, unhandled } = JSON.parse(readFileSync(report, `utf8`)) as {
      files: Array<{
        errors: Array<{ message?: string }>
        tests: Array<{ name: string; state: string }>
      }>
      unhandled: Array<{ message?: string }>
    }
    // A test or log name, as its property's index and its own name.
    const split = (name: string) => {
      const property = plan.properties.findIndex((_, index) =>
        name.startsWith(`${syntheticId(index)} `),
      )
      return {
        property,
        name: name.slice(syntheticId(property).length).replace(/^ (?:> )?/, ``),
      }
    }
    observe(`load`, [
      ...files.flatMap(({ errors }) =>
        errors.map(({ message }) => message ?? ``),
      ),
      ...unhandled.map(({ message }) => message ?? ``),
    ])
    observe(
      `log`,
      readFileSync(log, `utf8`)
        .split(`\n`)
        .filter((line) => line !== ``)
        .map((line) => {
          const { test, items } = JSON.parse(line) as {
            test: string
            items: Array<number>
          }
          const { property, name } = split(test)
          return { property, test: name, items }
        }),
    )
    observe(
      `tests`,
      sortTests(
        files.flatMap(({ tests }) =>
          tests.map(({ name, state }) => ({ ...split(name), state })),
        ),
      ),
    )
    observe(
      `lines`,
      run.stdout
        .split(`\n`)
        .filter(
          (line) =>
            line.startsWith(`probe-counts.synthetic-`) &&
            !/^\S+ .+ reach \{.*\}$/.test(line),
        )
        .sort(),
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

const valueAt = (trace: ReadonlyArray<Observation>, checkpoint: string) =>
  trace.find((entry) => entry.checkpoint === checkpoint)?.value

const law = `counted probes`
function check(_plan: History, trace: ReadonlyArray<Observation>, owed: Owed) {
  return (
    differs(
      `load`,
      law,
      valueAt(trace, `load`),
      [],
      `the child run had errors`,
    ) ??
    differs(
      `tests`,
      law,
      valueAt(trace, `tests`),
      owed.tests,
      `a test's outcome differs from the one it has without counted probes`,
    ) ??
    differs(
      `lines`,
      law,
      valueAt(trace, `lines`),
      owed.lines,
      `the counts lines differ from the owed lines`,
    ) ??
    pass
  )
}

// The states the law needs, from the units the model built.
const middlesDiffer = ({ declared, judged }: Unit) =>
  judged.length >= 2 &&
  judged.length % 2 === 0 &&
  declared.some((probe) => {
    const sorted = judged
      .map((items) => countOf(probe, items))
      .sort((a, b) => a - b)
    return sorted[judged.length / 2 - 1] !== sorted[judged.length / 2]
  })
const states = {
  line: `a counts line`,
  middles: `an even unit whose middle counts differ`,
  falsy: `a counted call with a falsy condition`,
  undeclared: `a called probe the property does not count`,
  failing: `a failing unit that counts`,
  empty: `a unit that judged no history`,
}
function reached(
  plan: History,
  _trace: ReadonlyArray<Observation>,
  owed: Owed,
) {
  const counting = owed.units.filter((unit) => unit.declared.length > 0)
  const passing = counting.filter((unit) => unit.passes)
  const holds = (state: string, predicate: boolean) =>
    predicate ? [state] : []
  return [
    ...holds(states.line, owed.lines.length > 0),
    ...holds(states.middles, passing.some(middlesDiffer)),
    ...holds(
      states.falsy,
      passing.some(({ declared, judged }) =>
        judged.some((items) =>
          items.some(
            (item) =>
              (declared.includes(`s#even`) && item % 2 !== 0) ||
              (declared.includes(`s#item`) && item === 0),
          ),
        ),
      ),
    ),
    ...holds(
      states.undeclared,
      passing.some(
        ({ declared, judged }) =>
          !declared.includes(`s#unlisted`) &&
          judged.some((items) => items.length > 0),
      ),
    ),
    ...holds(
      states.failing,
      counting.some((unit) => !unit.passes),
    ),
    ...holds(
      states.empty,
      passing.some((unit) => unit.judged.length === 0),
    ),
    ...holds(
      `a property that counts no probe`,
      plan.properties.some((spec) => (spec.counted ?? []).length === 0),
    ),
  ]
}

// A corrupted trace: the lines a wrong rule prints, from the trace's own log.
const printing =
  (wrong: Wrong) => (trace: ReadonlyArray<Observation>, plan: History) =>
    trace.map((entry) =>
      entry.checkpoint === `lines`
        ? { ...entry, value: linesOf(unitsOf(plan, logOf(trace)), wrong) }
        : entry,
    )

const counting = `the counts of a passing unit`
oracleProperty({
  id: `self-oracle.probe-counts`,
  law: {
    statement: `Each campaign unit that passes prints one counts line when its property declares a counted probe: per declared probe in name order, the min, lower median, max and total of the histories' counts of truthy calls, and how many histories it judged; a failing unit and every other test print none, and declaring counted probes changes no test's outcome.`,
    authority: `the \`counted\` option in packages/oracles/src/oracle-property.ts (proposed; the law awaits maintainer approval)`,
    limits: `Generated synthetic properties of up to two campaigns, with histories of up to four items; the population of a unit comes from the synthetic driver's log; constructed histories fix their child seeds.`,
  },
  histories: {
    arbitrary: history,
    runs: 4,
    fixedSeeds: [1],
    bases: 1,
    states: Object.values(states),
    measured: [`a property that counts no probe`],
    constructed: [
      {
        name: counting,
        enters: [states.line, states.middles, states.falsy, states.undeclared],
        build: (): History => ({
          seed: 3,
          properties: [
            {
              counted: [`s#item`, `s#never`, `s#even`, `s#item`],
              runs: 4,
              fixedSeed: true,
              low: 0,
              high: 4,
              minLength: 0,
              extra: 2,
            },
          ],
        }),
      },
      {
        name: `a failing unit`,
        enters: [states.failing],
        build: (): History => ({
          seed: 1,
          properties: [
            {
              counted: [`s#even`],
              runs: 2,
              fixedSeed: false,
              low: 5,
              high: 5,
              minLength: 1,
              extra: 0,
            },
          ],
        }),
      },
      {
        name: `an empty unit`,
        enters: [states.empty],
        build: (): History => ({
          seed: 1,
          properties: [
            {
              counted: [`s#never`],
              runs: 0,
              fixedSeed: false,
              low: 0,
              high: 0,
              minLength: 0,
              extra: 0,
            },
            {
              counted: undefined,
              runs: 1,
              fixedSeed: false,
              low: 0,
              high: 0,
              minLength: 0,
              extra: 0,
            },
          ],
        }),
      },
    ],
  },
  model,
  reached,
  driver,
  check,
  calibrations: [
    ...(
      [
        [`every call`, counting],
        [`histories entered`, counting],
        [`upper middle`, counting],
        [`undeclared`, counting],
        [`per history`, counting],
        [`failing too`, `a failing unit`],
      ] as const
    ).map(([wrong, constructed]) => ({
      name: `prints the counts of ${wrong}`,
      law,
      difference: `counts lines`,
      history: { constructed },
      corrupt: printing(wrong),
    })),
    {
      name: `prints zeros for a unit that judged no history`,
      law,
      difference: `counts lines`,
      history: { constructed: `an empty unit` },
      corrupt: (trace) =>
        trace.map((entry) =>
          entry.checkpoint === `lines`
            ? {
                ...entry,
                value: (entry.value as Array<string>).map((line) =>
                  line.replaceAll(`null`, `0`),
                ),
              }
            : entry,
        ),
    },
    {
      name: `fails a passing unit that counts`,
      law,
      difference: `outcome`,
      history: { constructed: counting },
      corrupt: (trace) =>
        trace.map((entry) =>
          entry.checkpoint === `tests`
            ? {
                ...entry,
                value: (entry.value as Array<Test>).map((test) =>
                  test.name === `random seed: generated`
                    ? { ...test, state: `failed` }
                    : test,
                ),
              }
            : entry,
        ),
    },
  ],
})
