/**
 * # An allowed set rests only on freedoms that its law states
 *
 * This oracle owns `notAllowed`'s promise: an allowed-set comparison that a
 * check chains as it chains `differs`, and that fails its property when the
 * freedom it names is not in the law's `limits`. It owns
 * `src/oracle-property.ts#notAllowed`.
 *
 * ```ts
 * notAllowed('order', 'order', ['b', 'a'], [['a', 'b'], ['b', 'a']], 'the order of notices') // → undefined
 * notAllowed('order', 'order', ['a'], [['a', 'b'], ['b', 'a']], 'the order of notices') // → violation of 'order', values { actual, expected: allowed }
 * // in the check of a property whose limits do not contain 'the order of notices'
 * notAllowed(...) // → throws OracleFreedomError: that property's history tests fail, the file's others do not
 * ```
 *
 * Why name the freedom at all? A check that accepts "in or out" for a name
 * the law never left open looks like any other check, and a mutant that moves
 * production to the other choice survives as one more `not-judged` gap. The
 * law's limits are where a maintainer reads which choices are open, so the
 * freedom must be written there, word for word, before a check may rest on
 * it.
 *
 * Two parts make that necessary. The member test: a value is accepted when it
 * is the same data as some member, by the data domain's equality, so key
 * order and Map entry order do not count, and -0, NaN, and an undefined field
 * do; a value outside the domain, such as a Date, compares by Node's
 * `isDeepStrictEqual`, as in `differs`. The stated freedom: while a property's check runs, `notAllowed` reads
 * that property's `limits`, and a freedom that is blank, or that the limits
 * do not contain verbatim (another case is not verbatim), throws.
 *
 * Law `allowed set`: for every value and every list of up to three allowed
 * values, `notAllowed` is undefined when the value is the same data as some
 * member, and otherwise a violation of its law at its checkpoint whose values
 * are `{ actual, expected: allowed }`, the arguments themselves, and whose
 * difference names the freedom. A value deeper than the data encoding can
 * follow fails the comparison with the framework's encoding-limit error, as
 * in `differs`. Outside a property's check it reads no law, so no freedom
 * throws there.
 *
 * Law `freedom in limits`: for every property whose check calls `notAllowed`
 * with a freedom its limits do not state, each history test fails with an
 * `OracleFreedomError` that names the property, the checkpoint, and the
 * freedom, whatever its driver does; so does each calibration whose driver
 * does not throw. With a stated freedom, its tests judge the allowed set as
 * the first law says. Its determinism test runs no check and fails only when
 * the driver throws. The file's other properties keep their own outcomes, and
 * the file loads.
 *
 * For `allowed set`, a history is a value and the allowed list, drawn from
 * tokens whose classes are the data equality's distinctions; the driver calls
 * `notAllowed` itself, outside any check, and the model compares classes. For
 * `freedom in limits`, a history is a suite of twenty properties of one
 * history each; the two suites together hold every spelling of the freedom
 * in the limits (verbatim, another case, absent, empty, blank), a value inside
 * or outside a set of one or two members, and a driver that throws after it
 * observes or not. The driver runs the suite under real Vitest in a child
 * process and records each test's state and errors; the check compares them
 * with each property's owed outcomes.
 *
 * Limits: the freedom is matched as text, so a freedom stated in other words
 * than the limits' fails, and a short freedom that occurs inside an unrelated
 * sentence of the limits passes. Whether the allowed set holds only what the
 * freedom describes is the model's to state and a calibration's to pin; the
 * framework cannot see it. A check is synchronous, so no asynchronous check
 * is generated. The edits to `judge` that set and clear the running property
 * are judged by the second law and by hand-written wrong versions, not owned
 * here.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { differs, notAllowed, oracleProperty, pass } from '../src/index.js'
import type { Observation, Verdict } from '../src/index.js'

// ---------------------------------------------------------------------------
// Law `allowed set`
// ---------------------------------------------------------------------------

// Each token is a value; tokens of one class are the same data. A Date is
// outside the data domain, so two Dates compare by Node's
// `isDeepStrictEqual`, as `differs` compares them.
const tokens = {
  date: [`date 0`, () => new Date(0)],
  dateAgain: [`date 0`, () => new Date(0)],
  laterDate: [`date 1`, () => new Date(1)],
  zero: [`zero`, () => 0],
  negativeZero: [`negative zero`, () => -0],
  nan: [`nan`, () => Number.NaN],
  one: [`one`, () => 1],
  text: [`text one`, () => `1`],
  ab: [`ab`, () => ({ a: 1, b: 2 })],
  ba: [`ab`, () => ({ b: 2, a: 1 })],
  undefinedField: [`undefined field`, () => ({ a: 1, b: undefined })],
  absentField: [`absent field`, () => ({ a: 1 })],
  pair: [`pair`, () => [1, 2]],
  reversed: [`reversed`, () => [2, 1]],
  map: [
    `map`,
    () =>
      new Map([
        [1, 2],
        [3, 4],
      ]),
  ],
  mapReversed: [
    `map`,
    () =>
      new Map([
        [3, 4],
        [1, 2],
      ]),
  ],
} as const
type Token = keyof typeof tokens
const tokenNames = Object.keys(tokens) as Array<Token>
const valueOf = (token: Token): unknown => tokens[token][1]()
const classOf = (token: Token): string => tokens[token][0]

// A value nested deeper than the data encoding can follow. Comparing it
// fails with the framework's encoding-limit error, as `differs` fails; it is
// drawn only as the observed value, so every non-empty set compares it.
const deepToken = `deep`
const deepValue = () => {
  let value: unknown = 0
  for (let level = 0; level < 100_000; level += 1) value = [value]
  return value
}
type Actual = Token | typeof deepToken
const actualOf = (actual: Actual): unknown =>
  actual === deepToken ? deepValue() : valueOf(actual)

type SetHistory = {
  actual: Actual
  allowed: ReadonlyArray<Token>
  freedom: string
}

const actualArbitrary: fc.Arbitrary<Actual> = fc.oneof(
  { arbitrary: fc.constantFrom(...tokenNames), weight: 15 },
  { arbitrary: fc.constant(deepToken), weight: 1 },
)
const setHistory: fc.Arbitrary<SetHistory> = fc.record({
  actual: actualArbitrary,
  allowed: fc.array(fc.constantFrom(...tokenNames), { maxLength: 3 }),
  // A blank freedom and one stated nowhere throw only inside a check.
  freedom: fc.constantFrom(``, ` `, `the order of notices`, `unstated`),
})

// A rejection's values, as the tokens whose values they are: each one must
// be the argument itself, so a Date needs no encoding as data.
type Values = { actual: string; expected: ReadonlyArray<string> }
type SetOwed =
  | { accepted: true }
  | { accepted: false; values: Values; freedom: string }
  | { limit: true }

const setCheckpoint = `verdict`
const setLaw = `order`
const limitText = `deeper or larger than the framework's encoding limit`

function owedSetVerdict({ actual, allowed, freedom }: SetHistory): SetOwed {
  if (actual === deepToken && allowed.length > 0) return { limit: true }
  return allowed.some(
    (member) => actual !== deepToken && classOf(member) === classOf(actual),
  )
    ? { accepted: true }
    : {
        accepted: false,
        values: { actual, expected: allowed },
        freedom,
      }
}

/**
 * Calls `notAllowed` on fresh values of the history's tokens, and returns
 * what it did as data: its verdict, with a rejection's values as the tokens
 * of the arguments they are (`another value` for any other value), or the
 * error it threw, by name and message.
 */
function judgedBy(
  { actual, allowed }: Omit<SetHistory, `freedom`>,
  freedom: string,
): unknown {
  const actualValue = actualOf(actual)
  const allowedValues = allowed.map(valueOf)
  let verdict: Verdict | undefined
  try {
    verdict = notAllowed(
      setCheckpoint,
      setLaw,
      actualValue,
      allowedValues,
      freedom,
    )
  } catch (error) {
    const { name, message } = error as Error
    return { thrown: name, message }
  }
  if (verdict === undefined) return { accepted: true }
  if (verdict.kind !== `violation`) return verdict
  const { values, ...rest } = verdict
  const tokenOf = (value: unknown, argument: unknown, token: string) =>
    Object.is(value, argument) ? token : `another value`
  return {
    ...rest,
    values: values && {
      actual: tokenOf(values.actual, actualValue, actual),
      expected: Array.isArray(values.expected)
        ? values.expected.map((value, i) =>
            tokenOf(value, allowedValues[i], allowed[i]!),
          )
        : `another value`,
    },
  }
}

function driveSet(
  history: SetHistory,
  observe: (checkpoint: string, value: unknown) => void,
) {
  observe(setCheckpoint, judgedBy(history, history.freedom))
}

type Judged =
  | { accepted: true }
  | { thrown: string; message: string }
  | {
      kind: string
      checkpoint: string
      law: string
      difference: string
      values: unknown
    }

function checkSet(
  _history: SetHistory,
  trace: ReadonlyArray<Observation>,
  owed: SetOwed,
): Verdict {
  const seen = trace.find(({ checkpoint }) => checkpoint === setCheckpoint)
    ?.value as Judged | undefined
  if (`limit` in owed)
    return seen !== undefined &&
      `thrown` in seen &&
      seen.thrown === `Error` &&
      seen.message.includes(limitText)
      ? pass
      : differs(
          setCheckpoint,
          `encoding limit`,
          seen,
          `an Error that says the value is ${limitText}`,
        )!
  if (
    owed.accepted ||
    seen === undefined ||
    `accepted` in seen ||
    `thrown` in seen
  )
    return (
      differs(
        setCheckpoint,
        `membership`,
        seen,
        owed.accepted ? owed : { kind: `violation` },
      ) ?? pass
    )
  return (
    differs(setCheckpoint, `membership`, seen.kind, `violation`) ??
    differs(setCheckpoint, `rejection`, seen.checkpoint, setCheckpoint) ??
    differs(setCheckpoint, `rejection`, seen.law, setLaw) ??
    differs(setCheckpoint, `rejection`, seen.values, owed.values) ??
    (seen.difference.includes(`(freedom: ${owed.freedom})`)
      ? pass
      : differs(
          setCheckpoint,
          `rejection`,
          seen.difference,
          `a difference that names the freedom "${owed.freedom}"`,
        )!)
  )
}

const acceptedState = `accepted`
const rejectedState = `rejected`
const otherSpelling = `same data, other spelling`
const emptySet = `empty allowed set`
const limitState = `a value too deep to encode`
const stateOf = (owed: SetOwed) =>
  `limit` in owed ? limitState : owed.accepted ? acceptedState : rejectedState
const outsideDomain = `equal values outside the data domain`

const sameDataHistory = `a member of the same data, spelled otherwise`
const noMemberHistory = `no member, only near ones`

oracleProperty({
  id: `self-oracle.allowed-set`,
  law: {
    statement: `notAllowed is undefined when the value is the same data as some allowed member, and otherwise a violation of its law at its checkpoint with values { actual, expected: allowed } and a difference that names the freedom; outside a property's check it reads no law.`,
    authority: `the notAllowed comment in packages/oracles/src/oracle-property.ts`,
    limits: `Values from a small domain that tells the data equality's distinctions apart (key and Map entry order, -0, NaN, an undefined field); up to three allowed members.`,
  },
  histories: {
    arbitrary: setHistory,
    runs: 200,
    fixedSeeds: [20261125],
    states: [otherSpelling, emptySet, outsideDomain, limitState],
    measured: [acceptedState, rejectedState],
    constructed: [
      {
        name: sameDataHistory,
        enters: [otherSpelling],
        build: (generated) => ({
          ...generated,
          actual: `ba`,
          allowed: [`pair`, `ab`],
        }),
      },
      {
        name: noMemberHistory,
        enters: [],
        build: (generated) => ({
          ...generated,
          actual: `negativeZero`,
          allowed: [`zero`, `absentField`],
        }),
      },
      {
        name: emptySet,
        enters: [emptySet],
        build: (generated) => ({ ...generated, allowed: [] }),
      },
      {
        name: limitState,
        enters: [limitState],
        build: (generated) => ({
          ...generated,
          actual: deepToken,
          allowed: [`zero`],
        }),
      },
      {
        name: `two Dates of one time`,
        enters: [otherSpelling, outsideDomain],
        build: (generated) => ({
          ...generated,
          actual: `dateAgain`,
          allowed: [`laterDate`, `date`],
        }),
      },
    ],
  },
  model: owedSetVerdict,
  reached: ({ actual, allowed }, _trace, owed) => {
    const spelledOtherwise =
      actual !== deepToken &&
      allowed.some(
        (member) => member !== actual && classOf(member) === classOf(actual),
      )
    return [
      stateOf(owed),
      ...(allowed.length === 0 ? [emptySet] : []),
      ...(spelledOtherwise ? [otherSpelling] : []),
      ...(spelledOtherwise && actualOf(actual) instanceof Date
        ? [outsideDomain]
        : []),
    ]
  },
  driver: driveSet,
  check: checkSet,
  calibrations: [
    {
      name: `accept a value that is no member`,
      law: `membership`,
      history: { constructed: noMemberHistory },
      corrupt: (trace) =>
        trace.map((entry) => ({ ...entry, value: { accepted: true } })),
    },
    {
      name: `reject a member spelled otherwise`,
      law: `membership`,
      history: { constructed: sameDataHistory },
      corrupt: (trace, plan) =>
        trace.map((entry) => ({
          ...entry,
          value: {
            kind: `violation`,
            checkpoint: setCheckpoint,
            law: setLaw,
            difference: `(freedom: ${plan.freedom})`,
            values: { actual: plan.actual, expected: [] },
          },
        })),
    },
    {
      name: `drop the last allowed member from the values`,
      law: `rejection`,
      history: { constructed: noMemberHistory },
      corrupt: (trace) =>
        trace.map((entry) => {
          const seen = entry.value as { values: Values }
          return {
            ...entry,
            value: {
              ...seen,
              values: {
                ...seen.values,
                expected: seen.values.expected.slice(0, -1),
              },
            },
          }
        }),
    },
    {
      name: `a difference that does not name the freedom`,
      law: `rejection`,
      history: { constructed: noMemberHistory },
      corrupt: (trace) =>
        trace.map((entry) => ({
          ...entry,
          value: {
            ...(entry.value as object),
            difference: `the observed value differs from the owed value`,
          },
        })),
    },
  ],
  owns: [`src/oracle-property.ts#notAllowed`],
})

// ---------------------------------------------------------------------------
// Law `freedom in limits`, inside this process's own check
// ---------------------------------------------------------------------------

// `notAllowed` reads the limits only while a property's check runs, so this
// property's check makes the call itself, under its own limits, and the
// driver records only the arguments. Each spelling below is stated or not in
// `inCheckLimits`: a substring of a stated sentence is contained verbatim, a
// change of case is not.
const inCheckId = `self-oracle.allowed-set-in-check`
const inCheckLimits = `Values from the token domain of the allowed-set property; it leaves the order of notices open, and states no other freedom.`
const spellings = {
  stated: `the order of notices`,
  'part of a stated sentence': `order of notices`,
  'another case': `The order of notices`,
  absent: `the order of events`,
  empty: ``,
  blank: ` `,
} as const
type Spelling = keyof typeof spellings
const statedSpellings: ReadonlyArray<Spelling> = [
  `stated`,
  `part of a stated sentence`,
]

type InCheckHistory = Omit<SetHistory, `freedom`> & { spelling: Spelling }
type InCheckOwed = { throws: true } | ({ throws: false } & SetOwed)

const inCheckHistory: fc.Arbitrary<InCheckHistory> = fc.record({
  actual: actualArbitrary,
  allowed: fc.array(fc.constantFrom(...tokenNames), { maxLength: 3 }),
  spelling: fc.constantFrom(...(Object.keys(spellings) as Array<Spelling>)),
})

const inCheckCheckpoint = `arguments`

function owedInCheck(history: InCheckHistory): InCheckOwed {
  if (!statedSpellings.includes(history.spelling)) return { throws: true }
  return {
    throws: false,
    ...owedSetVerdict({ ...history, freedom: spellings[history.spelling] }),
  }
}

function checkInCheck(
  history: InCheckHistory,
  trace: ReadonlyArray<Observation>,
  owed: InCheckOwed,
): Verdict {
  const seen = trace.find(({ checkpoint }) => checkpoint === inCheckCheckpoint)
    ?.value as
    { actual: Actual; allowed: Array<Token>; freedom: string } | undefined
  if (seen === undefined)
    return differs(inCheckCheckpoint, `freedom in limits`, seen, owed)!
  const outcome = judgedBy(seen, seen.freedom)
  if (owed.throws) {
    const names = [
      `${inCheckId}: `,
      `checkpoint ${JSON.stringify(setCheckpoint)}`,
      `freedom ${JSON.stringify(seen.freedom)}`,
    ]
    const thrown = outcome as { thrown?: string; message?: string }
    return thrown.thrown === `OracleFreedomError` &&
      names.every((name) => thrown.message?.includes(name))
      ? pass
      : differs(
          inCheckCheckpoint,
          `freedom in limits`,
          outcome,
          `an OracleFreedomError that names ${names.join(`, `)}`,
        )!
  }
  const { throws: _throws, ...setOwed } = owed
  return checkSet(
    { ...history, freedom: seen.freedom },
    [{ checkpoint: setCheckpoint, value: outcome }],
    setOwed,
  )
}

const unstatedState = `an unstated freedom`
const containedState = `a freedom inside a stated sentence`

oracleProperty({
  id: inCheckId,
  law: {
    statement: `In a property's check, notAllowed throws an OracleFreedomError that names the property, the checkpoint, and the freedom when the freedom is blank or the law's limits do not contain it verbatim, and judges the allowed set otherwise.`,
    authority: `the notAllowed comment in packages/oracles/src/oracle-property.ts`,
    limits: inCheckLimits,
  },
  histories: {
    arbitrary: inCheckHistory,
    runs: 200,
    fixedSeeds: [20261125],
    states: [unstatedState, containedState],
    measured: [acceptedState, rejectedState, limitState],
    constructed: [
      {
        name: `another case, inside a set`,
        enters: [unstatedState],
        build: (generated): InCheckHistory => ({
          ...generated,
          spelling: `another case`,
          actual: `ab`,
          allowed: [`ab`],
        }),
      },
      {
        name: `part of a stated sentence, outside a set`,
        enters: [containedState],
        build: (generated): InCheckHistory => ({
          ...generated,
          spelling: `part of a stated sentence`,
          actual: `negativeZero`,
          allowed: [`zero`],
        }),
      },
    ],
  },
  model: owedInCheck,
  reached: ({ spelling }, _trace, owed) => [
    ...(owed.throws ? [unstatedState] : [stateOf(owed)]),
    ...(spelling === `part of a stated sentence` ? [containedState] : []),
  ],
  // The arguments as tokens: the check builds their values and calls
  // `notAllowed` itself.
  driver: ({ actual, allowed, spelling }, observe) =>
    observe(inCheckCheckpoint, {
      actual,
      allowed,
      freedom: spellings[spelling],
    }),
  check: checkInCheck,
  calibrations: [
    {
      name: `a freedom in another case`,
      law: `freedom in limits`,
      history: { constructed: `another case, inside a set` },
      corrupt: (trace) =>
        trace.map((entry) => ({
          ...entry,
          value: {
            ...(entry.value as object),
            freedom: spellings.stated,
          },
        })),
    },
    {
      name: `a stated freedom spelled in another case`,
      law: `membership`,
      history: { constructed: `part of a stated sentence, outside a set` },
      corrupt: (trace) =>
        trace.map((entry) => ({
          ...entry,
          value: {
            ...(entry.value as object),
            freedom: spellings[`another case`],
          },
        })),
    },
  ],
  owns: [`src/oracle-property.ts#notAllowed`],
})

// ---------------------------------------------------------------------------
// Law `freedom in limits`, across a file
// ---------------------------------------------------------------------------

/** How the law's limits spell the freedom that the check names. */
const forms = [`verbatim`, `other case`, `absent`, `empty`, `blank`] as const
type Form = (typeof forms)[number]
type Spec = {
  form: Form
  accepts: boolean
  members: 1 | 2
  throws: boolean
}
type Suite = { name: string; specs: ReadonlyArray<Spec> }

// Every spec once, two suites of twenty, each suite mixing the forms.
const allSpecs: Array<Spec> = forms.flatMap((form) =>
  [false, true].flatMap((accepts) =>
    ([1, 2] as const).flatMap((members) =>
      [false, true].map((throws) => ({ form, accepts, members, throws })),
    ),
  ),
)
const suites: Array<Suite> = Array.from({ length: 2 }, (_, s) => ({
  name: `suite ${s}`,
  specs: allSpecs.filter((_spec, index) => (index >> 1) % 2 === s),
}))

const propertyId = (s: number, i: number) => `allowed.s${s}p${i}`
const checkpointOf = (i: number) => `order ${i}`
const statedFreedom = (i: number) => `the order of notices ${i}`
const freedomOf = (form: Form, i: number) =>
  form === `empty` ? `` : form === `blank` ? ` ` : statedFreedom(i)
const limitsOf = (form: Form, i: number) =>
  form === `other case`
    ? `It leaves The Order Of Notices ${i} open.`
    : form === `absent`
      ? `It leaves nothing open.`
      : `It leaves ${statedFreedom(i)} open.`
const membersOf = (members: 1 | 2) => (members === 1 ? [`ab`] : [`ab`, `ba`])
const seenOf = ({ accepts, members }: Spec) =>
  accepts ? membersOf(members).at(-1)! : `zz`
const driverMessage = (i: number) => `driver ${i} failed`

const here = dirname(fileURLToPath(import.meta.url))
const packageDirectory = dirname(here)
const vitest = join(
  dirname(createRequire(import.meta.url).resolve(`vitest/package.json`)),
  `vitest.mjs`,
)

function suiteSource(s: number, specs: ReadonlyArray<Spec>): string {
  const properties = specs.map((spec, i) => {
    const text = JSON.stringify
    return `oracleProperty({
  id: ${text(propertyId(s, i))},
  law: { statement: 's', authority: 'a', limits: ${text(limitsOf(spec.form, i))} },
  histories: ['run'],
  label: (history) => history,
  model: () => ${text(membersOf(spec.members))},
  driver: (_plan, observe) => {
    observe(${text(checkpointOf(i))}, ${text(seenOf(spec))})
    ${spec.throws ? `throw new Error(${text(driverMessage(i))})` : ``}
  },
  check: (_plan, trace, allowed) =>
    notAllowed(${text(checkpointOf(i))}, 'order', trace[0]?.value, allowed, ${text(freedomOf(spec.form, i))}) ?? pass,
  calibrations: [
    {
      name: 'outside',
      law: 'order',
      history: { enumerated: 0 },
      corrupt: (trace) => trace.map((entry) => ({ ...entry, value: 'zz' })),
    },
  ],
})`
  })
  return `import { notAllowed, oracleProperty, pass } from '../src/index.js'\n\n${properties.join(`\n\n`)}\n`
}

type ReportedError = {
  name?: string
  message?: string
  cause?: ReportedError
}
type ReportedTest = {
  test: string
  state: string
  errors: Array<ReportedError>
}
type SuiteRun = { loadErrors: number; tests: Array<ReportedTest> }

function runSuite(suite: Suite): SuiteRun {
  const s = Number(suite.name.split(` `)[1])
  const directory = mkdtempSync(join(packageDirectory, `.self-oracle-allowed-`))
  try {
    writeFileSync(join(directory, `suite.test.ts`), suiteSource(s, suite.specs))
    const report = join(directory, `report.json`)
    const childEnv = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith(`ORACLE_`)),
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
        env: { ...childEnv, SELF_ORACLE_REPORT: report },
        encoding: `utf8`,
        timeout: 120_000,
      },
    )
    if (run.error) throw run.error
    const { files } = JSON.parse(readFileSync(report, `utf8`)) as {
      files: Array<{
        errors: Array<unknown>
        tests: Array<{
          name: string
          state: string
          errors: Array<ReportedError>
        }>
      }>
    }
    const strip = (error: ReportedError): ReportedError => ({
      ...(error.name === undefined ? {} : { name: error.name }),
      ...(error.message === undefined ? {} : { message: error.message }),
      ...(error.cause === undefined ? {} : { cause: strip(error.cause) }),
    })
    return {
      loadErrors: files.reduce((sum, file) => sum + file.errors.length, 0),
      tests: files.flatMap((file) =>
        file.tests.map(({ name, state, errors }) => ({
          // Vitest 4 and 5 join a suite and its test as ` > `.
          test: name,
          state,
          errors: errors.map(strip),
        })),
      ),
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

/** What a test owes: its state and, for a failure, what its first error is. */
type TestOwed =
  | { state: `passed` }
  | {
      state: `failed`
      error:
        | { kind: `freedom`; id: string; checkpoint: string; freedom: string }
        | { kind: `violation`; cause?: string }
        | { kind: `driver`; message: string }
        | { kind: `any` }
    }

function owedSuite({ name, specs }: Suite): Record<string, TestOwed> {
  const s = Number(name.split(` `)[1])
  const owed: Record<string, TestOwed> = {}
  specs.forEach((spec, i) => {
    const id = propertyId(s, i)
    const stated = spec.form === `verbatim`
    const freedom = {
      kind: `freedom` as const,
      id,
      checkpoint: checkpointOf(i),
      freedom: freedomOf(spec.form, i),
    }
    const driver = { kind: `driver` as const, message: driverMessage(i) }
    owed[`${id} > run`] = !stated
      ? { state: `failed`, error: freedom }
      : spec.accepts
        ? spec.throws
          ? { state: `failed`, error: driver }
          : { state: `passed` }
        : {
            state: `failed`,
            error: {
              kind: `violation`,
              ...(spec.throws ? { cause: driverMessage(i) } : {}),
            },
          }
    owed[`${id} > calibration: outside`] = !stated
      ? { state: `failed`, error: spec.throws ? { kind: `any` } : freedom }
      : spec.accepts && !spec.throws
        ? { state: `passed` }
        : { state: `failed`, error: { kind: `any` } }
    owed[`${id} > determinism`] = spec.throws
      ? { state: `failed`, error: driver }
      : { state: `passed` }
  })
  return owed
}

const limitsLaw = `freedom in limits`

function judgeTest(test: string, seen: ReportedTest, owed: TestOwed) {
  if (seen.state !== owed.state)
    return differs(test, limitsLaw, seen.state, owed.state)
  if (owed.state === `passed`) return undefined
  const first = seen.errors[0]
  const { error } = owed
  if (error.kind === `any`)
    return first === undefined
      ? differs(test, limitsLaw, seen.errors, `an error`)
      : undefined
  if (error.kind === `driver`)
    return differs(test, limitsLaw, first?.message, error.message)
  if (error.kind === `violation`)
    return (
      differs(test, limitsLaw, first?.name, `OracleViolation`) ??
      (first?.message?.includes(`(law: order)`)
        ? undefined
        : differs(
            test,
            limitsLaw,
            first?.message,
            `a violation of law order`,
          )) ??
      differs(test, limitsLaw, first?.cause?.message, error.cause)
    )
  const freedomError = [first, first?.cause].find(
    (e) => e?.name === `OracleFreedomError`,
  )
  const message = freedomError?.message ?? ``
  const names = [
    `${error.id}: `,
    `checkpoint ${JSON.stringify(error.checkpoint)}`,
    `freedom ${JSON.stringify(error.freedom)}`,
  ]
  return names.every((name) => message.includes(name))
    ? undefined
    : differs(
        test,
        limitsLaw,
        first,
        `an OracleFreedomError that names ${names.join(`, `)}`,
      )
}

function checkSuite(
  _suite: Suite,
  trace: ReadonlyArray<Observation>,
  owed: Record<string, TestOwed>,
): Verdict {
  const run = trace.find(({ checkpoint }) => checkpoint === `suite`)?.value as
    SuiteRun | undefined
  if (run === undefined) return differs(`suite`, limitsLaw, run, owed)!
  const seen = new Map(run.tests.map((test) => [test.test, test]))
  return (
    differs(`suite`, `file loads`, run.loadErrors, 0) ??
    differs(
      `suite`,
      limitsLaw,
      [...seen.keys()].sort(),
      Object.keys(owed).sort(),
    ) ??
    Object.entries(owed).reduce<Verdict | undefined>(
      (verdict, [test, testOwed]) =>
        verdict ?? judgeTest(test, seen.get(test)!, testOwed),
      undefined,
    ) ??
    pass
  )
}

const mapTest = (
  trace: ReadonlyArray<Observation>,
  test: string,
  change: (seen: ReportedTest) => ReportedTest,
) =>
  trace.map((entry) => {
    const run = entry.value as SuiteRun
    return {
      ...entry,
      value: {
        ...run,
        tests: run.tests.map((seen) =>
          seen.test === test ? change(seen) : seen,
        ),
      },
    }
  })

oracleProperty({
  id: `self-oracle.allowed-set-limits`,
  law: {
    statement: `A property whose check calls notAllowed with a blank freedom, or one its law's limits does not contain verbatim, fails each history test, and each calibration whose driver does not throw, with an OracleFreedomError that names the property, the checkpoint, and the freedom; with a stated freedom its tests judge the allowed set; its determinism test and the file's other properties keep their own outcomes, and the file loads.`,
    authority: `the notAllowed comment in packages/oracles/src/oracle-property.ts`,
    limits: `Two suites of twenty enumerated properties of one history each, covering every spelling of the freedom (verbatim, another case, absent, empty, blank), a value inside or outside a set of one or two members, and a driver that throws after it observes or not; under the package's default Vitest config.`,
  },
  histories: suites,
  label: ({ name }) => name,
  model: owedSuite,
  driver: (suite, observe) => observe(`suite`, runSuite(suite)),
  check: checkSuite,
  calibrations: [
    {
      name: `an unstated freedom that passes`,
      law: limitsLaw,
      history: { enumerated: `suite 0` },
      corrupt: (trace) =>
        mapTest(trace, `${propertyId(0, 4)} > run`, (seen) => ({
          ...seen,
          state: `passed`,
          errors: [],
        })),
    },
    {
      name: `a freedom error that names another property`,
      law: limitsLaw,
      history: { enumerated: `suite 0` },
      corrupt: (trace) =>
        mapTest(trace, `${propertyId(0, 4)} > run`, (seen) => ({
          ...seen,
          errors: seen.errors.map((error) => ({
            ...error,
            message: error.message?.replace(propertyId(0, 4), propertyId(0, 5)),
          })),
        })),
    },
    {
      name: `a stated freedom that fails`,
      law: limitsLaw,
      history: { enumerated: `suite 0` },
      corrupt: (trace) =>
        mapTest(trace, `${propertyId(0, 2)} > run`, (seen) => ({
          ...seen,
          state: `failed`,
          errors: [{ name: `OracleFreedomError`, message: `` }],
        })),
    },
    {
      name: `a file that fails to load`,
      law: `file loads`,
      history: { enumerated: `suite 0` },
      corrupt: (trace) =>
        trace.map((entry) => ({
          ...entry,
          value: { ...(entry.value as SuiteRun), loadErrors: 1 },
        })),
    },
  ],
  owns: [`src/oracle-property.ts#notAllowed`],
  // Each history runs one child Vitest process.
  timeout: 240_000,
})
