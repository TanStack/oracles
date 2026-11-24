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
 * History: one child Vitest run of a fixture that registers one property per
 * pair, each failing its one case with the pair's values, or without values.
 * The model spells each value by the encoding's rules; the driver reads the
 * two lines from each failing case's message in Vitest's JSON report.
 *
 * Limits: values that are not data (a function, a class instance) print by
 * Node's inspection and are not generated. Errors as values are not
 * generated. Only the first 2,000 characters of a long value are printed.
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

// One child Vitest run of a fixture with one property per pair, each failing
// its one case; each case's message is read from Vitest's JSON report.
function driver(history: History, observe: (c: string, v: unknown) => void) {
  const directory = join(
    packageDirectory,
    `.violation-values-${process.pid}-${(runs += 1)}`,
  )
  mkdirSync(directory, { recursive: true })
  try {
    const index = JSON.stringify(join(packageDirectory, `src/index.ts`))
    const properties = history.pairs.map((pair, at) =>
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
    )
    writeFileSync(
      join(directory, `values.test.ts`),
      [
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
    const results = (
      JSON.parse(readFileSync(report, `utf8`)) as {
        testResults: Array<{
          assertionResults: Array<{
            fullName: string
            status: string
            failureMessages: Array<string>
          }>
        }>
      }
    ).testResults.flatMap((file) => file.assertionResults)
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
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
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
