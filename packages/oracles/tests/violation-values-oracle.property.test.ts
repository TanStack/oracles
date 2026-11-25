/**
 * # A violation's message names its observed and owed values
 *
 * A check that compares an observed value with an owed one (`differs`, or
 * `violation` given `values`) attaches both to its error, and Vitest shows
 * them as a diff. Vitest prints a value with its own formatter, which shows a
 * string without its quotes, so the diff of `"0"` against `0` shows `0`
 * twice; and a runner that reads only the message, such as the gap report's
 * baseline, sees neither value.
 *
 * The law: for every violation that carries values, its message holds, after
 * its `Difference:` line, the line `Observed: <text>` and the line
 * `Owed: <text>`, each the value's data encoding as the `History:` line
 * spells a history (`reportText`): JSON data as its JSON text, and -0, NaN,
 * the infinities, undefined, bigints (with `n`), Maps (`Map{k=>v}`), and
 * Sets (`Set{v}`) spelled as the encoding spells them, so two values that
 * `differs` tells apart print apart, each on one line, at most 2,000
 * characters. A violation without values has neither line. Authority: the
 * finding of a downstream project (the gap check printed a failing law with
 * no observed or owed value, so the author ran Vitest alone with a reporter
 * of their own to read them), and the coordinator's assignment of these
 * lines to the gap-report work (2026-11-24).
 *
 * The second law is about where those lines land. A campaign unit fails
 * through fast-check, whose error has a message of its own (`Property failed
 * after 1 tests`, the seed and path, the counterexample) and holds the
 * violation only as its `cause`, which Vitest's JSON reporter drops. So for
 * every test that fails by a law violation, an enumerated or fixed history,
 * or a fixed-seed or random campaign unit of a constructed or generated
 * history, the message Vitest reports holds the lines of the violation of
 * the counterexample it reports, one after another: `<id> violated at checkpoint "<checkpoint>"`, with
 * ` (law: <law>)` when the violation names one, then `Law: <statement>`,
 * `Difference: <difference>`, and the `Observed:` and `Owed:` lines when it
 * carries values. Authority: the finding of a downstream project (a failing
 * campaign unit's `failureMessages` held only fast-check's report and replay
 * lines, so the author reproduced each counterexample by hand to see why it
 * failed), and the coordinator's assignment of this fix (2026-11-25).
 *
 * History: one child Vitest run of a fixture that registers one property per
 * pair, each failing its one case with the pair's values, or without values.
 * The model spells each value by the encoding's rules; the driver reads the
 * two lines from each failing case's message in Vitest's JSON report. For
 * the second law the fixture registers, per pair, an enumerated property and
 * a generated one with a constructed and a fixed history, so one run fails
 * on every route, and each campaign unit shrinks its first failure to a
 * smaller history whose difference names it; the driver reads, from each
 * failing test's message before its stack, the line that names the
 * violation and the labeled lines after it.
 *
 * Limits: values that are not data (a function, a class instance) print by
 * Node's inspection and are not generated. Errors as values are not
 * generated. Only the first 2,000 characters of a long value are printed.
 * The second law covers failures by a law violation: a driver, model, or
 * data error, or a constructed history that missed its state, reaches a
 * campaign unit's message only as its cause. A shrink changes only the
 * difference here, never the checkpoint or the values.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { differs, oracleProperty, pass } from '../src/index.js'
import type { Observation } from '../src/index.js'

// A value of the data domain, as a tree: the model spells it, and the driver
// writes it as JavaScript source.
type Value =
  | readonly [`number`, number]
  | readonly [`-0`]
  | readonly [`NaN`]
  | readonly [`Infinity`, 1 | -1]
  | readonly [`string`, string]
  | readonly [`bigint`, string]
  | readonly [`boolean`, boolean]
  | readonly [`undefined`]
  | readonly [`null`]
  | readonly [`array`, ReadonlyArray<Value>]
  | readonly [`object`, ReadonlyArray<readonly [string, Value]>]
  | readonly [`Map`, ReadonlyArray<readonly [Value, Value]>]
  | readonly [`Set`, ReadonlyArray<Value>]

type Pair = { valued: true; actual: Value; expected: Value } | { valued: false }
type History = { name: string; pairs: ReadonlyArray<Pair> }

// A value as JavaScript source, for the fixture.
function sourceOf(value: Value): string {
  switch (value[0]) {
    case `number`:
      return String(value[1])
    case `-0`:
      return `-0`
    case `NaN`:
      return `NaN`
    case `Infinity`:
      return value[1] === 1 ? `Infinity` : `-Infinity`
    case `string`:
      return JSON.stringify(value[1])
    case `bigint`:
      return `${value[1]}n`
    case `boolean`:
      return String(value[1])
    case `undefined`:
      return `undefined`
    case `null`:
      return `null`
    case `array`:
      return `[${value[1].map(sourceOf).join(`, `)}]`
    case `object`:
      return `({ ${value[1].map(([key, item]) => `${JSON.stringify(key)}: ${sourceOf(item)}`).join(`, `)} })`
    case `Map`:
      return `new Map([${value[1].map(([key, item]) => `[${sourceOf(key)}, ${sourceOf(item)}]`).join(`, `)}])`
    case `Set`:
      return `new Set([${value[1].map(sourceOf).join(`, `)}])`
  }
}

// The model: a value as the data encoding spells it.
function spelled(value: Value): string {
  switch (value[0]) {
    case `number`:
      return JSON.stringify(value[1])
    case `-0`:
      return `-0`
    case `NaN`:
      return `NaN`
    case `Infinity`:
      return value[1] === 1 ? `Infinity` : `-Infinity`
    case `string`:
      return JSON.stringify(value[1])
    case `bigint`:
      return `${value[1]}n`
    case `boolean`:
      return JSON.stringify(value[1])
    case `undefined`:
      return `undefined`
    case `null`:
      return `null`
    case `array`:
      return `[${value[1].map(spelled).join(`,`)}]`
    case `object`:
      return `{${value[1].map(([key, item]) => `${JSON.stringify(key)}:${spelled(item)}`).join(`,`)}}`
    case `Map`:
      return `Map{${value[1].map(([key, item]) => `${spelled(key)}=>${spelled(item)}`).join(`,`)}}`
    case `Set`:
      return `Set{${value[1].map(spelled).join(`,`)}}`
  }
}

const MOST = 2000
type Printed = { observed?: string; owed?: string }
const model = (history: History): Array<Printed> =>
  history.pairs.map((pair) =>
    pair.valued
      ? {
          observed: spelled(pair.actual).slice(0, MOST),
          owed: spelled(pair.expected).slice(0, MOST),
        }
      : { observed: undefined, owed: undefined },
  )

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
  fullName: string
  status: string
  failureMessages: Array<string>
}

// One child Vitest run of a fixture whose properties are `properties`, each
// a statement that registers one; every test's result is read from Vitest's
// JSON report.
function reportOf(properties: ReadonlyArray<string>): Array<Reported> {
  const directory = join(
    packageDirectory,
    `.violation-values-${process.pid}-${(runs += 1)}`,
  )
  mkdirSync(directory, { recursive: true })
  try {
    const index = JSON.stringify(join(packageDirectory, `src/index.ts`))
    writeFileSync(
      join(directory, `values.test.ts`),
      [
        `import fc from 'fast-check'`,
        `import { differs, oracleProperty, pass, violation } from ${index}`,
        ...properties,
        ``,
      ].join(`\n`),
    )
    writeFileSync(
      join(directory, `vitest.config.mjs`),
      `export default { test: { include: ['values.test.ts'] } }\n`,
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

// One child Vitest run of a fixture with one property per pair, each failing
// its one case; each case's message is read from Vitest's JSON report.
function driver(history: History, observe: (c: string, v: unknown) => void) {
  const results = reportOf(
    history.pairs.map((pair, at) =>
      [
        `oracleProperty({`,
        `  id: 'values.${at}',`,
        `  law: { statement: 'For every case, the values differ.', authority: 'this fixture', limits: 'none' },`,
        `  histories: [0],`,
        `  model: () => ${pair.valued ? sourceOf(pair.expected) : `0`},`,
        `  driver: (_history, observe) => observe('v', ${pair.valued ? sourceOf(pair.actual) : `1`}),`,
        pair.valued
          ? `  check: (_history, trace, owed) => differs('v', 'values', trace[0]?.value, owed) ?? pass,`
          : `  check: () => violation('v', 'a difference without values', 'values'),`,
        `})`,
      ].join(`\n`),
    ),
  )
  history.pairs.forEach((_, at) => {
    const failed = results.find(
      (test) =>
        test.status === `failed` &&
        test.fullName.startsWith(`values.${at} `) &&
        !/determinism/.test(test.fullName),
    )
    const lines = (failed?.failureMessages[0] ?? ``).split(`\n`)
    const read = (label: string) =>
      lines
        .find((line) => line.startsWith(`${label}: `))
        ?.slice(label.length + 2)
    observe(`printed ${at}`, {
      failed: failed !== undefined,
      observed: read(`Observed`),
      owed: read(`Owed`),
    })
  })
}

// A wrong printing of the first pair it applies to, or undefined when it
// applies to none.
const corruptPrinted =
  (change: (value: Seen) => Seen | undefined) =>
  (trace: ReadonlyArray<Observation>) => {
    const at = trace.findIndex(
      (o) =>
        o.checkpoint.startsWith(`printed `) &&
        change(o.value as Seen) !== undefined,
    )
    if (at < 0) return undefined
    return trace.map((o, i) =>
      i === at ? { ...o, value: change(o.value as Seen) } : o,
    )
  }
type Seen = { failed: boolean; observed?: string; owed?: string }

function check(
  history: History,
  trace: ReadonlyArray<Observation>,
  owed: Array<Printed>,
) {
  for (const [at, pair] of history.pairs.entries()) {
    const seen = trace.find((o) => o.checkpoint === `printed ${at}`)?.value as
      { failed: boolean; observed?: string; owed?: string } | undefined
    const verdict =
      differs(
        `printed ${at}`,
        `a violation fails its case`,
        seen?.failed,
        true,
      ) ??
      differs(
        `printed ${at}`,
        pair.valued ? `observed and owed lines` : `no value lines`,
        { observed: seen?.observed, owed: seen?.owed },
        owed[at],
      )
    if (verdict) return verdict
  }
  return pass
}

// Values `differs` tells apart that a formatter can print alike, and the
// encoding's other spellings.
const str = (text: string): Value => [`string`, text]
const num = (n: number): Value => [`number`, n]
const histories: Array<History> = [
  {
    name: `zeros, quotes, and a violation without values`,
    pairs: [
      { valued: true, actual: [`-0`], expected: num(0) },
      { valued: true, actual: str(`0`), expected: num(0) },
      { valued: true, actual: [`undefined`], expected: [`null`] },
      { valued: false },
    ],
  },
  {
    name: `containers`,
    pairs: [
      {
        valued: true,
        actual: [
          `object`,
          [
            [`v`, [`-0`]],
            [`u`, [`undefined`]],
          ],
        ],
        expected: [`object`, [[`v`, num(0)]]],
      },
      {
        valued: true,
        actual: [`Map`, [[str(`k`), [`bigint`, `12`]]]],
        expected: [`Set`, [[`NaN`], [`Infinity`, -1]]],
      },
      {
        valued: true,
        actual: [`array`, [str(`a\nb`), [`boolean`, true], str('`')]],
        expected: [`array`, [str(`a b`), [`Infinity`, 1]]],
      },
    ],
  },
  {
    name: `a value past 2,000 characters`,
    pairs: [
      { valued: true, actual: str(`x`.repeat(2100)), expected: str(`x`) },
      { valued: false },
    ],
  },
]

oracleProperty({
  id: `self-oracle.violation-values`,
  owns: [`src/oracle-property.ts#violationError`],
  law: {
    statement: `For every violation that carries observed and owed values, its message holds the lines Observed: and Owed:, each the value's data encoding on one line, at most 2,000 characters, so two values that differs tells apart print apart; a violation without values holds neither line.`,
    authority: `A downstream project's finding (the gap check showed a failing law with no observed or owed value), and the coordinator's assignment of these lines to the gap-report work, 2026-11-24.`,
    limits: `Values outside the data domain and Errors are not generated. Each history is one child Vitest run.`,
  },
  histories,
  label: (history) => history.name,
  timeout: 240_000,
  model,
  driver,
  check,
  calibrations: [
    {
      name: `a value printed as Vitest prints it, without a string's quotes`,
      law: `observed and owed lines`,
      corrupt: corruptPrinted((value) => {
        if (!value.observed?.startsWith(`"`)) return undefined
        try {
          return { ...value, observed: JSON.parse(value.observed) as string }
        } catch {
          return undefined
        }
      }),
    },
    {
      name: `-0 printed as 0`,
      law: `observed and owed lines`,
      corrupt: corruptPrinted((value) =>
        value.observed === `-0` ? { ...value, observed: `0` } : undefined,
      ),
    },
    {
      name: `a violation without values prints an Observed line`,
      law: `no value lines`,
      corrupt: corruptPrinted((value) =>
        value.observed === undefined
          ? { ...value, observed: `undefined` }
          : undefined,
      ),
    },
  ],
})

// The second law. The routes a test fails on, each by its test's name within
// its property: the enumerated property's one case, then the generated
// property's fixed history and its campaign units, constructed and
// generated, at the fixed seed and at the run's random seed.
const routes = [
  `case`,
  `fixed history: kept`,
  `fixed seed 1: built`,
  `fixed seed 1: generated`,
  `random seed: built`,
  `random seed: generated`,
] as const
type Route = (typeof routes)[number]

// The property whose test a route is: the enumerated or the generated one.
const propertyOf = (route: Route, at: number) =>
  route === `case` ? `case.${at}` : `campaign.${at}`
const statementOf = (at: number) => `For every case ${at}, the values differ.`
// The history each route's message names. Each fixture history is a number,
// and its violation's difference names it. The enumerated case runs 1 and
// the fixed history 2. A campaign unit's first failure is not its
// counterexample: the constructed history is 3, and the generated one a draw
// of `fc.integer({ min: 0, max: 3 })`. Every history fails under the one law,
// so fast-check's shrink of that integer ends at its smallest value, 0, and
// the message's lines name the counterexample's violation.
const historyOf = (route: Route) =>
  route === `case` ? 1 : route === `fixed history: kept` ? 2 : 0

// The model: on every route, in the order of `routes`, the violation's
// lines as its message spells them: the property, the checkpoint, and the
// law when the violation names one, then the law's statement, the
// difference, and the values as the first law spells them. A violation
// without values names no law.
const linesOwed = (history: History) =>
  history.pairs.map((pair, at) =>
    routes.map((route) => [
      `${propertyOf(route, at)} violated at checkpoint "v"${pair.valued ? ` (law: values)` : ``}.`,
      `Law: ${statementOf(at)}`,
      `Difference: at ${historyOf(route)}`,
      ...(pair.valued
        ? [
            `Observed: ${spelled(pair.actual).slice(0, MOST)}`,
            `Owed: ${spelled(pair.expected).slice(0, MOST)}`,
          ]
        : []),
    ]),
  )

// The labels of the lines that follow the line naming the violation.
const LABELS = [`Law: `, `Difference: `, `Observed: `, `Owed: `]

// A test's violation lines, read from the message its JSON report holds,
// which is its stack before the first frame: the line that names property
// `id`'s violation, from the property's id on, then each line after it that
// starts with one of the labels. None when no line names the violation.
function violationLinesIn(stack: string, id: string): Array<string> {
  const lines = stack.split(/\n {4}at /)[0]!.split(`\n`)
  const head = `${id} violated at checkpoint `
  const at = lines.findIndex((line) => line.includes(head))
  if (at < 0) return []
  const read = [lines[at]!.slice(lines[at]!.indexOf(head))]
  for (const line of lines.slice(at + 1)) {
    if (!LABELS.some((label) => line.startsWith(label))) break
    read.push(line)
  }
  return read
}

// One child Vitest run of a fixture with two properties per pair, an
// enumerated one and a generated one, each failing on every route with the
// pair's values, or without values; each failing test's violation lines are
// read from Vitest's JSON report, or null when the test did not fail.
function messageDriver(
  history: History,
  observe: (c: string, v: unknown) => void,
) {
  const results = reportOf(
    history.pairs.flatMap((pair, at) => {
      const shared = [
        `  law: { statement: ${JSON.stringify(statementOf(at))}, authority: 'this fixture', limits: 'none' },`,
        `  model: () => ${pair.valued ? sourceOf(pair.expected) : `0`},`,
        `  driver: (_history, observe) => observe('v', ${pair.valued ? sourceOf(pair.actual) : `1`}),`,
        pair.valued
          ? `  check: (history, trace, owed) => differs('v', 'values', trace[0]?.value, owed, 'at ' + history) ?? pass,`
          : `  check: (history) => violation('v', 'at ' + history),`,
      ]
      return [
        [
          `oracleProperty({`,
          `  id: 'case.${at}',`,
          `  histories: [1],`,
          ...shared,
          `})`,
        ].join(`\n`),
        [
          `oracleProperty({`,
          `  id: 'campaign.${at}',`,
          `  histories: { arbitrary: fc.integer({ min: 0, max: 3 }), runs: 1, fixedSeeds: [1], constructed: [{ name: 'built', enters: [], build: () => 3 }], fixed: [{ name: 'kept', history: 2 }] },`,
          ...shared,
          `})`,
        ].join(`\n`),
      ]
    }),
  )
  history.pairs.forEach((_, at) => {
    for (const route of routes) {
      const id = propertyOf(route, at)
      const failed = results.find(
        (test) =>
          test.status === `failed` &&
          test.ancestorTitles[0] === id &&
          (route === `case`
            ? !test.title.startsWith(`determinism`)
            : test.title === route),
      )
      observe(
        `message ${at}: ${route}`,
        failed ? violationLinesIn(failed.failureMessages[0] ?? ``, id) : null,
      )
    }
  })
}

function messageCheck(
  history: History,
  trace: ReadonlyArray<Observation>,
  owed: ReturnType<typeof linesOwed>,
) {
  for (const at of history.pairs.keys())
    for (const [index, route] of routes.entries()) {
      const checkpoint = `message ${at}: ${route}`
      const verdict = differs(
        checkpoint,
        `the violation's lines`,
        trace.find((o) => o.checkpoint === checkpoint)?.value,
        owed[at]![index],
      )
      if (verdict) return verdict
    }
  return pass
}

// A wrong message on the first route it applies to, or undefined when it
// applies to none.
const corruptMessage =
  (route: Route, change: (lines: Array<string>) => Array<string> | undefined) =>
  (trace: ReadonlyArray<Observation>) => {
    const at = trace.findIndex(
      (o) =>
        o.checkpoint.endsWith(`: ${route}`) &&
        Array.isArray(o.value) &&
        change(o.value as Array<string>) !== undefined,
    )
    if (at < 0) return undefined
    return trace.map((o, i) =>
      i === at ? { ...o, value: change(o.value as Array<string>) } : o,
    )
  }

oracleProperty({
  id: `self-oracle.failure-message`,
  owns: [`src/oracle-property.ts#violationError`],
  law: {
    statement: `For every test of an oracleProperty that fails by a law violation, on every route (an enumerated or fixed history, or a fixed-seed or random campaign unit of a constructed or generated history), the message Vitest reports for it holds the lines of the violation of the counterexample it reports, one after another: the property and checkpoint, with the law when the violation names one, then Law: with the law's statement, Difference:, and the Observed: and Owed: lines when the violation carries values.`,
    authority: `A downstream project's finding (a failing campaign unit's failureMessages in Vitest's JSON report held only fast-check's report and replay lines, so each counterexample had to be reproduced by hand), and the coordinator's assignment of this fix, 2026-11-25.`,
    limits: `Failures by a law violation only: a driver, model, or data error, or a constructed history that missed its state, reaches a campaign unit's message only as its cause. A shrink changes only the difference, never the checkpoint or the values. Values outside the data domain and Errors are not generated. Each history is one child Vitest run.`,
  },
  histories,
  label: (history) => history.name,
  timeout: 240_000,
  model: linesOwed,
  driver: messageDriver,
  check: messageCheck,
  calibrations: [
    {
      name: `a campaign unit's message holds only fast-check's report`,
      law: `the violation's lines`,
      history: { enumerated: 0 },
      corrupt: corruptMessage(`fixed seed 1: generated`, () => []),
    },
    {
      name: `a random unit's message without the Observed and Owed lines`,
      law: `the violation's lines`,
      history: { enumerated: 0 },
      corrupt: corruptMessage(`random seed: built`, (lines) =>
        lines.some((line) => line.startsWith(`Observed: `))
          ? lines.filter(
              (line) =>
                !line.startsWith(`Observed: `) && !line.startsWith(`Owed: `),
            )
          : undefined,
      ),
    },
    {
      name: `a campaign unit names its first failure, not its counterexample`,
      law: `the violation's lines`,
      history: { enumerated: 0 },
      corrupt: corruptMessage(`fixed seed 1: built`, (lines) =>
        lines.map((line) =>
          line === `Difference: at 0` ? `Difference: at 3` : line,
        ),
      ),
    },
    {
      name: `a campaign unit's message without the law's statement`,
      law: `the violation's lines`,
      history: { enumerated: 0 },
      corrupt: corruptMessage(`fixed seed 1: built`, (lines) =>
        lines.filter((line) => !line.startsWith(`Law: `)),
      ),
    },
  ],
})
