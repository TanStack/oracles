/**
 * Law (lint rules `oracle/no-disabled` and `oracle/replayable-seed`): a
 * campaign's parameters declare a fixed seed in one of these forms, and each
 * form is judged alike:
 *
 *   { seed, numRuns }                                  the object form
 *   oracleFixedSeed(seed, { numRuns })                 the declaration
 *   const parameters = oracleFixedSeed(seed, { … })    held in a constant
 *   { ...oracleFixedSeed(seed), numRuns }              spread
 *   { ...parameters, numRuns }                         a constant spread
 *
 * `oracleFixedSeed` is the framework's, imported from `@tanstack/oracles`
 * (or its `declaration` entry, or a project's `oracle-config`) under its own
 * name or another. When the declared seed is a number literal or a constant
 * bound to one, the parameters are a witness: their `numRuns` is not
 * reported, whatever its value. Any other seed (a `let`, a parameter, a
 * clock) leaves a literal `numRuns` reported by `no-disabled`: one run or
 * none as `singleRun`, more as `literalRuns`, and `oracleRuns(1)` as
 * `singleRun`. A function of the file's own that is named `oracleFixedSeed`
 * declares nothing, and neither does a spread of a `let`. A seed from a
 * clock is reported by `replayable-seed` as `ambientSeed` in the object form
 * and in every form of the framework's declaration.
 *
 * Authority: `oracleFixedSeed` is the framework's declaration of a fixed
 * seed (packages/oracles/src/oracle-route.ts): only a declared seed routes
 * as `fixed seed`, so it is how an oracle writes a fixed-seed witness, and a
 * clock seed declared fixed would count kills on a route that no replay
 * reaches. `no-disabled`'s documented witness rule (a one-run or literal
 * count needs a fixed history: a seed that is a literal or a constant) and
 * `replayable-seed`'s ambient-seed rule apply to the seed, not to the
 * syntax that carries it.
 *
 * Limits: a seed or parameters passed through a helper's parameter, an
 * `oracleFixedSeed` re-exported under another module name, and parameters
 * built by a function other than `oracleFixedSeed` are not generated; the
 * rules do not follow them.
 *
 * Structure, following ORC-003:
 *   1. The grammar draws a program of sites. A site has a form, a seed, a
 *      run count, how `oracleFixedSeed` is bound, and, for a spread of a
 *      held declaration, whether the holder is `const` or `let`.
 *   2. The model predicts each rule's reports from those choices alone.
 *   3. The driver renders one function per site, one site per line, and
 *      lints the program with both rules.
 *   4. The comparison checks the sorted (line, rule, message) reports.
 *   5. A census lints every combination once; campaigns draw programs.
 */
import tsParser from '@typescript-eslint/parser'
import { Linter } from 'eslint'
import fc from 'fast-check'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createOracleReach,
  declareOracle,
  oracleFixedSeed,
  oraclePropertyOptions,
  oracleRuns,
} from '@tanstack/oracles'
import noDisabled from '../src/rules/no-disabled.js'
import replayableSeed from '../src/rules/replayable-seed.js'

const PROPERTY = `lint.fixed-seed`
const FIXED_SEED = 3117
const BASE_RUNS = 30

// -- 1. Grammar ---------------------------------------------------------------

const FORMS = [`object`, `call`, `heldCall`, `spreadCall`, `spreadHeld`]
const SEEDS = [
  `literal`,
  `negative`,
  `constant`,
  `mutable`,
  `parameter`,
  `clock`,
]
const RUNS = [`one`, `many`, `helperOne`]
const BINDINGS = [`imported`, `renamed`, `local`]
const HOLDERS = [`const`, `let`]

const siteArbitrary = fc.record({
  form: fc.constantFrom(...FORMS),
  seed: fc.constantFrom(...SEEDS),
  runs: fc.constantFrom(...RUNS),
  holder: fc.constantFrom(...HOLDERS),
})
const programArbitrary = fc.record({
  binding: fc.constantFrom(...BINDINGS),
  sites: fc.array(siteArbitrary, { minLength: 1, maxLength: 6 }),
})

// -- 2. Model -----------------------------------------------------------------

const declaresWithCall = (form) => form !== `object`

/** Whether the site's parameters declare a seed that a replay reproduces. */
function isWitness(site, binding) {
  if (![`literal`, `negative`, `constant`].includes(site.seed)) return false
  if (!declaresWithCall(site.form)) return true
  if (binding === `local`) return false
  return !(site.form === `spreadHeld` && site.holder === `let`)
}

function predictReports(program) {
  return program.sites.flatMap((site, index) => {
    const line = index + LINE_OFFSET
    const reports = []
    if (!isWitness(site, program.binding))
      reports.push({
        line,
        rule: `oracle/no-disabled`,
        messageId: site.runs === `many` ? `literalRuns` : `singleRun`,
      })
    const framework =
      !declaresWithCall(site.form) || program.binding !== `local`
    if (site.seed === `clock` && framework)
      reports.push({
        line,
        rule: `oracle/replayable-seed`,
        messageId: `ambientSeed`,
      })
    return reports
  })
}

// -- 3. Driver ----------------------------------------------------------------

const HEADER = {
  imported: `import { oracleFixedSeed, oracleRuns } from '@tanstack/oracles'`,
  renamed: `import { oracleFixedSeed as fixedSeed, oracleRuns } from '@tanstack/oracles'`,
  local: `import { oracleRuns } from '@tanstack/oracles'; function oracleFixedSeed(seed: number, parameters: object = {}) { return { ...parameters, seed } }`,
}
const PRELUDE = [`const SEED = 2118`, `let mutableSeed = 2118`]
// The first site's line: the header, then the prelude.
const LINE_OFFSET = 2 + PRELUDE.length

const seedText = {
  literal: `2118`,
  negative: `-7`,
  constant: `SEED`,
  mutable: `mutableSeed`,
  parameter: `seedParameter`,
  clock: `Date.now()`,
}
const runsText = { one: `1`, many: `100`, helperOne: `oracleRuns(1)` }

function renderSite(site, binding, index) {
  const declare = binding === `renamed` ? `fixedSeed` : `oracleFixedSeed`
  const seed = seedText[site.seed]
  const runs = runsText[site.runs]
  const body = {
    object: `return { seed: ${seed}, numRuns: ${runs} }`,
    call: `return ${declare}(${seed}, { numRuns: ${runs} })`,
    heldCall: `const parameters = ${declare}(${seed}, { numRuns: ${runs}, endOnFailure: true }); return parameters`,
    spreadCall: `return { ...${declare}(${seed}), numRuns: ${runs} }`,
    spreadHeld: `${site.holder} parameters = ${declare}(${seed}); return { ...parameters, numRuns: ${runs} }`,
  }[site.form]
  return `export function site${index}(seedParameter: number) { ${body} }`
}

function renderProgram(program) {
  return [
    HEADER[program.binding],
    ...PRELUDE,
    ...program.sites.map((site, index) =>
      renderSite(site, program.binding, index),
    ),
    ``,
  ].join(`\n`)
}

const linter = new Linter({ configType: `flat` })

function lintProgram(code) {
  const messages = linter.verify(
    code,
    [
      {
        files: [`**/*.ts`],
        languageOptions: { parser: tsParser },
        plugins: {
          oracle: {
            rules: {
              'no-disabled': noDisabled,
              'replayable-seed': replayableSeed,
            },
          },
        },
        rules: {
          'oracle/no-disabled': `error`,
          'oracle/replayable-seed': `error`,
        },
        settings: { oracles: { envPrefix: `TANSTACK_DB_ORACLE` } },
      },
    ],
    { filename: `packages/example/tests/fixed-seed-scratch.test.ts` },
  )
  const fatal = messages.find((message) => message.fatal)
  if (fatal)
    throw new Error(`the rendered program does not parse: ${fatal.message}`)
  return messages
    .filter((message) => message.ruleId?.startsWith(`oracle/`))
    .map(({ line, ruleId, messageId }) => ({ line, rule: ruleId, messageId }))
}

// -- 4. Comparison ------------------------------------------------------------

const reportKeys = (reports) =>
  reports.map((r) => `${r.line}:${r.rule}:${r.messageId}`).sort()

function compareReports(actual, expected, code) {
  expect(reportKeys(actual), code).toEqual(reportKeys(expected))
}

// -- 5. Reach and campaigns ---------------------------------------------------

const STATES = [
  ...FORMS.flatMap((form) => [`${form}: witness`, `${form}: reported`]),
  ...BINDINGS.map((binding) => `binding ${binding}`),
  `a clock seed in a declaration`,
  `a let holder spread`,
  `a single run in a witness`,
]
const reach = createOracleReach(PROPERTY, STATES, { minimum: 1 })

function check(program) {
  reach.beginHistory()
  reach.reach(`binding ${program.binding}`)
  for (const site of program.sites) {
    const witness = isWitness(site, program.binding)
    reach.reach(`${site.form}: ${witness ? `witness` : `reported`}`)
    if (site.seed === `clock` && declaresWithCall(site.form))
      reach.reach(`a clock seed in a declaration`)
    if (site.form === `spreadHeld` && site.holder === `let`)
      reach.reach(`a let holder spread`)
    if (witness && site.runs !== `many`)
      reach.reach(`a single run in a witness`)
  }
  const code = renderProgram(program)
  compareReports(lintProgram(code), predictReports(program), code)
}

/** Every combination of a site's choices, under each binding. */
function censusPrograms() {
  const sites = FORMS.flatMap((form) =>
    SEEDS.flatMap((seed) =>
      RUNS.flatMap((runs) =>
        HOLDERS.map((holder) => ({ form, seed, runs, holder })),
      ),
    ),
  )
  return BINDINGS.map((binding) => ({ binding, sites }))
}

describe(`fixed-seed declarations`, () => {
  it(`census: every form, seed, run count, and binding is linted as predicted`, () => {
    for (const program of censusPrograms()) check(program)
  })
  it(`fixed-seed campaign`, () => {
    fc.assert(
      fc.property(programArbitrary, check),
      oracleFixedSeed(FIXED_SEED, { numRuns: oracleRuns(BASE_RUNS) }),
    )
  })
  it(`random-seed campaign`, () => {
    fc.assert(
      fc.property(programArbitrary, check),
      oraclePropertyOptions(BASE_RUNS, PROPERTY),
    )
  })
  afterAll(() => reach.assertReached())
})

// The comparison must reject a wrong observation: a missing report and a
// report under the other rule. Both feed the same check that the campaigns
// use.
describe(`the comparison rejects wrong reports`, () => {
  const expected = [
    { line: 4, rule: `oracle/no-disabled`, messageId: `singleRun` },
  ]
  it(`rejects a missing report`, () => {
    expect(() => compareReports([], expected, `calibration`)).toThrow()
  })
  it(`rejects a report under the other rule`, () => {
    expect(() =>
      compareReports(
        [{ line: 4, rule: `oracle/replayable-seed`, messageId: `singleRun` }],
        expected,
        `calibration`,
      ),
    ).toThrow()
  })
})

declareOracle({
  model: [predictReports],
  check: [compareReports],
  grammar: [programArbitrary],
})
