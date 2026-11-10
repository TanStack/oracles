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
 *   5. Two oracleProperty parts: the census lints every combination once, and
 *      the generated campaign runs a fixed and a random seed, where each
 *      declared state has a constructed history that enters it.
 */
import tsParser from '@typescript-eslint/parser'
import { Linter } from 'eslint'
import fc from 'fast-check'
import { differs, oracleProperty, pass } from '@tanstack/oracles'
import noDisabled from '../src/rules/no-disabled.js'
import replayableSeed from '../src/rules/replayable-seed.js'

const PROPERTY = `lint.fixed-seed`
const PROPERTY_CENSUS = `lint.fixed-seed.census`
const LAW = {
  statement: `A fixed-seed declaration is linted as the model predicts: a seed that a replay reproduces is a witness, and each rule reports exactly the sites that the model names.`,
  authority: `The rules' documented witness and ambient-seed laws in src/rules/no-disabled.js and src/rules/replayable-seed.js, and oracleFixedSeed's declaration in packages/oracles/src/oracle-route.ts.`,
  limits: `Seeds and run counts are literals, constants, mutable bindings, parameters, or clocks; helpers and re-exported declarations are not generated.`,
  owner: `eslint-plugin-oracles lint rules`,
}
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

// -- 5. Reach, campaigns, and calibrations ----------------------------------

const STATES = [
  ...FORMS.flatMap((form) => [`${form}: witness`, `${form}: reported`]),
  ...BINDINGS.map((binding) => `binding ${binding}`),
  `a clock seed in a declaration`,
  `a let holder spread`,
  `a single run in a witness`,
]

/** The states a program enters, from the grammar and the model alone. */
function statesOf(program) {
  const states = [`binding ${program.binding}`]
  for (const site of program.sites) {
    const witness = isWitness(site, program.binding)
    states.push(`${site.form}: ${witness ? `witness` : `reported`}`)
    if (site.seed === `clock` && declaresWithCall(site.form))
      states.push(`a clock seed in a declaration`)
    if (site.form === `spreadHeld` && site.holder === `let`)
      states.push(`a let holder spread`)
    if (witness && site.runs !== `many`)
      states.push(`a single run in a witness`)
  }
  return states
}

/** A history whose first site is `site` and whose binding is `binding`. */
const withFirstSite = (site, binding) => (generated) => ({
  binding: binding ?? generated.binding,
  sites: [site, ...generated.sites.slice(1)],
})

// Each state gets a constructed history: its first site or binding forces it.
const constructed = [
  ...FORMS.flatMap((form) => [
    {
      name: `${form}: witness`,
      enters: [`${form}: witness`],
      build: withFirstSite(
        { form, seed: `literal`, runs: `many`, holder: `const` },
        `imported`,
      ),
    },
    {
      name: `${form}: reported`,
      enters: [`${form}: reported`],
      build: withFirstSite(
        { form, seed: `mutable`, runs: `many`, holder: `const` },
        `imported`,
      ),
    },
  ]),
  ...BINDINGS.map((binding) => ({
    name: `binding ${binding}`,
    enters: [`binding ${binding}`],
    build: (generated) => ({ ...generated, binding }),
  })),
  {
    name: `a clock seed in a declaration`,
    enters: [`a clock seed in a declaration`],
    build: withFirstSite(
      { form: `call`, seed: `clock`, runs: `many`, holder: `const` },
      `imported`,
    ),
  },
  {
    name: `a let holder spread`,
    enters: [`a let holder spread`],
    build: withFirstSite(
      { form: `spreadHeld`, seed: `literal`, runs: `many`, holder: `let` },
      `imported`,
    ),
  },
  {
    name: `a single run in a witness`,
    enters: [`a single run in a witness`],
    build: withFirstSite(
      { form: `object`, seed: `literal`, runs: `one`, holder: `const` },
      `imported`,
    ),
  },
]

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

const reportsCheck = (plan, observations, expected) => {
  const observed = observations.find((o) => o.checkpoint === `reports`)
  return (
    differs(
      `reports`,
      `reports`,
      reportKeys(observed.value),
      reportKeys(expected),
    ) ?? pass
  )
}

const driver = (program, observe) => {
  observe(`reports`, lintProgram(renderProgram(program)))
}

// The census lints every combination once; it is a fixed list, not generated.
oracleProperty({
  id: PROPERTY_CENSUS,
  law: LAW,
  histories: censusPrograms(),
  label: (program) => `census: binding ${program.binding}`,
  model: predictReports,
  driver,
  check: reportsCheck,
})

oracleProperty({
  id: PROPERTY,
  law: LAW,
  histories: {
    arbitrary: programArbitrary,
    runs: BASE_RUNS,
    fixedSeeds: [FIXED_SEED],
    states: STATES,
    constructed,
  },
  reached: (program) => statesOf(program),
  model: predictReports,
  driver,
  check: reportsCheck,
  // The comparison must reject a wrong observation: a missing report, and a
  // report under the other rule. Both feed the same check that the campaigns use.
  calibrations: [
    {
      name: `a report dropped from the rule's output`,
      law: `reports`,
      corrupt: (trace) => {
        const observed = trace.find((o) => o.checkpoint === `reports`)
        if (observed.value.length === 0) return undefined
        return trace.map((o) =>
          o.checkpoint === `reports` ? { ...o, value: o.value.slice(1) } : o,
        )
      },
    },
    {
      name: `a report under the other rule`,
      law: `reports`,
      corrupt: (trace) => {
        const observed = trace.find((o) => o.checkpoint === `reports`)
        if (observed.value.length === 0) return undefined
        return trace.map((o) =>
          o.checkpoint === `reports`
            ? {
                ...o,
                value: o.value.map((r) => ({
                  ...r,
                  rule:
                    r.rule === `oracle/no-disabled`
                      ? `oracle/replayable-seed`
                      : `oracle/no-disabled`,
                })),
              }
            : o,
        )
      },
    },
  ],
})
