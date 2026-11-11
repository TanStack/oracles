/**
 * # An oracle file registers its tests only through `oracleProperty`
 *
 * Law (oracle/no-unit-test): in a file whose name contains `oracle`, and
 * whose name does not start with `oracle-`, every test registration is
 * reported, except a complete `oracleProperty` call. The forms are:
 *
 * - **A complete `oracleProperty` call.** The framework's `oracleProperty`,
 *   imported from `@tanstack/oracles` by name, by alias, or through a
 *   namespace, receives an object literal that has a `check`. It is the
 *   file's oracle, and it gets no report.
 * - **An incomplete `oracleProperty` call.** Its options are not an object
 *   literal with a `check`. It gets `incompleteProperty`, because the rule
 *   cannot see the property's check.
 * - **A plain registration** (`it`, `test`, `.each`, `.for`, `.skipIf`, a
 *   `.todo` with a body, options before the body, a body passed by name, or
 *   a `.prop` property of `@fast-check/vitest`), a registration inside a
 *   local helper, or a call to an imported helper that registers the body
 *   that its caller passes (curried or not). Each gets `unitTest`, whatever
 *   its body reaches. A fixed history, case, calibration, or reach census
 *   belongs in the property's histories, calibrations, and states. Any
 *   other test belongs in an ordinary test file.
 * - **An empty body.** A registration whose body is a function with an empty
 *   block checks nothing. It gets `emptyTest`, or `emptyTodo` for `.todo`.
 *   A bare `it.todo(name)` is no registration, and gets no report.
 * - **An imported helper that registers a test of its own**, from an
 *   ordinary module or an `oracle-` machinery module, by name or through a
 *   namespace, including a function named `oracleProperty` from a module
 *   that is not the framework. It gets `importedRegistration`.
 * - **A helper from an oracle-named module** is linted on its own, so its
 *   call gets no report here. Neither does a call that registers nothing.
 *
 * Authority: AGENTS.md, "Keep Unit Tests Out of Oracles" (TanStack DB, the
 * project that this plugin came from); the `oracle-property-only` decisions
 * of 2026-11-09 and 2026-11-10 ("the only property campaign in an oracle file
 * is `oracleProperty`"); and the maintainer decision of 2026-11-11 that
 * deletes `declareOracle` and makes `oracleProperty` the only registration
 * in an oracle file (design option D2). Before that decision, a plain test
 * passed when it reached a part that `declareOracle` named, or a generated
 * fast-check property. Now no reach makes a plain registration legal.
 * The empty-body rule is maintainer decision F21, 2026-11-10.
 *
 * The model is a table from each statement form to the report it gets. It
 * reads only the history's own fields: the forms, the file's name and
 * language. It never reads the rule.
 *
 * Production paths: a long-lived ESLint instance configured with the
 * plugin's `recommended` config, and a single-file `Linter` call, as a
 * RuleTester caller makes one. The JavaScript language is linted with
 * ESLint's default espree, and TypeScript with typescript-eslint. Each
 * observation is the list of `line:messageId` keys of this rule's reports
 * in the oracle file, sorted.
 *
 * Limits: one oracle file per history, with a fixed set of helper modules
 * beside it. Each statement takes one line, and a nested `describe` holds
 * exactly one statement. A helper module that does not parse, re-exports,
 * default exports, and a body passed through a wrapper that the helper
 * writes are not generated. A rule throw is observed as a `threw:` key,
 * which the model never predicts.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import tsParser from '@typescript-eslint/parser'
import { ESLint, Linter } from 'eslint'
import fc from 'fast-check'
import { afterAll, beforeAll } from 'vitest'
import { differs, oracleProperty, pass } from '@tanstack/oracles'
import oraclePlugin from '../src/index.js'
import { lintCharged, lintChargedAsync } from './lint-observation.js'

const RULE = `oracle/no-unit-test`
const LAW = `registration-only reports`

// -- Grammar ------------------------------------------------------------------
//
// Each statement form renders as one line of the oracle file, so the model
// can name the line of each report. `report` is the model's rule for it.

const FORMS = {
  'it-arrow': [`it('n', () => { compute() })`, `unitTest`],
  'test-function': [`test('n', function () { compute() })`, `unitTest`],
  'it-expression-body': [`it('n', () => compute())`, `unitTest`],
  each: [`it.each([1, 2])('n %s', (v) => { compute(v) })`, `unitTest`],
  for: [`it.for([1, 2])('n %s', (v) => { compute(v) })`, `unitTest`],
  'skip-if': [`it.skipIf(false)('n', () => { compute() })`, `unitTest`],
  'options-first': [`it('n', { timeout: 5 }, () => { compute() })`, `unitTest`],
  'named-body': [`it('n', namedBody)`, `unitTest`],
  'todo-with-body': [`it.todo('n', () => { compute() })`, `unitTest`],
  // The forms that a declared part or a generated property used to make
  // legal: a test that calls a function the oracleProperty uses, a
  // fast-check `.prop` property, and a test that runs a generated property
  // in a helper module.
  'calls-property-check': [`it('n', () => { checkHistory() })`, `unitTest`],
  'fast-check-prop': [
    `fcTest.prop([fc.integer()])('n', (v) => { compute(v) })`,
    `unitTest`,
  ],
  'generated-in-helper': [`it('n', () => { runGenerated() })`, `unitTest`],
  'body-helper': [`check('n', () => { compute() })`, `unitTest`],
  'body-helper-empty': [`check('n', () => {})`, `unitTest`],
  'curried-body-helper': [`prop('id')('n', () => { compute() })`, `unitTest`],
  'empty-it': [`it('n', () => {})`, `emptyTest`],
  'empty-test-function': [`test('n', function () {})`, `emptyTest`],
  'empty-skip': [`it.skip('n', () => {})`, `emptyTest`],
  'empty-todo': [`it.todo('n', () => {})`, `emptyTodo`],
  'bare-todo': [`it.todo('n')`, undefined],
  'property-complete': [
    `oracleProperty({ id: 'p', check: checkHistory })`,
    undefined,
  ],
  'property-aliased': [
    `aliasedProperty({ id: 'p', check: checkHistory })`,
    undefined,
  ],
  'property-namespace': [
    `oracles.oracleProperty({ id: 'p', check: checkHistory })`,
    undefined,
  ],
  'property-without-check': [
    `oracleProperty({ id: 'p' })`,
    `incompleteProperty`,
  ],
  'property-named-options': [
    `oracleProperty(propertyOptions)`,
    `incompleteProperty`,
  ],
  'property-lookalike': [
    `lookalikeProperty({ id: 'p', check: checkHistory })`,
    `importedRegistration`,
  ],
  'own-helper': [`registerUnits()`, `importedRegistration`],
  'namespace-helper': [`helpers.registerUnits()`, `importedRegistration`],
  'machinery-helper': [`registerMachinery()`, `importedRegistration`],
  'oracle-named-helper': [`registerShared('n')`, undefined],
  'plain-call': [`compute()`, undefined],
}
const KINDS = Object.keys(FORMS)

const statement = fc.record({
  kind: fc.constantFrom(...KINDS),
  nested: fc.boolean(),
})

/** A history: the oracle file's language, its name, and its statements. */
const historyArbitrary = fc.record({
  language: fc.constantFrom(`ts`, `js`),
  machinery: fc.oneof(
    { weight: 6, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
  localRegistrar: fc.boolean(),
  statements: fc.array(statement, { maxLength: 8 }),
})

// The modules beside the oracle file. Their names decide how the rule
// judges a call to their helpers: an ordinary module and an `oracle-`
// machinery module are judged here, an oracle-named module on its own.
const HELPERS = {
  'own-helper.js': `import { it } from 'vitest'\nexport function registerUnits() {\n  it('inner', () => { void 0 })\n}\n`,
  'body-helper.js': `import { it } from 'vitest'\nexport function check(name, body) {\n  it(name, body)\n}\n`,
  'curried-helper.js': `import { it } from 'vitest'\nexport const prop = (id) => (name, body) => {\n  void id\n  it(name, body)\n}\n`,
  'oracle-machinery.js': `import { it } from 'vitest'\nexport function registerMachinery() {\n  it('machinery', () => { void 0 })\n}\n`,
  'shared-oracle.js': `import { it } from 'vitest'\nexport function registerShared(name) {\n  it(name, () => { void 0 })\n}\n`,
  'fake-framework.js': `import { it } from 'vitest'\nexport function oracleProperty(options) {\n  it(options.id, () => { void options })\n}\n`,
  'plain.js': `import fc from 'fast-check'\nexport function compute() {\n  return 1\n}\nexport function checkHistory() {\n  return 1\n}\nexport function runGenerated() {\n  fc.assert(fc.property(fc.integer(), (value) => { void value }))\n}\n`,
}

const HEADER = [
  `import { describe, it, test } from 'vitest'`,
  `import { fc, test as fcTest } from '@fast-check/vitest'`,
  `import { oracleProperty } from '@tanstack/oracles'`,
  `import { oracleProperty as aliasedProperty } from '@tanstack/oracles'`,
  `import * as oracles from '@tanstack/oracles'`,
  `import { oracleProperty as lookalikeProperty } from './fake-framework.js'`,
  `import { registerUnits } from './own-helper.js'`,
  `import * as helpers from './own-helper.js'`,
  `import { check } from './body-helper.js'`,
  `import { prop } from './curried-helper.js'`,
  `import { registerMachinery } from './oracle-machinery.js'`,
  `import { registerShared } from './shared-oracle.js'`,
  `import { checkHistory, compute, runGenerated } from './plain.js'`,
  `const propertyOptions = { id: 'p', check: checkHistory }`,
  `function namedBody() { compute() }`,
]
const LOCAL_REGISTRAR = `function localCheck(name, body) { it(name, body) }`

const oracleName = (history) =>
  `${history.machinery ? `oracle-case` : `case-oracle`}.test.${history.language}`

/** The files of one history: the helper modules and the oracle file. */
function render(history) {
  const lines = [...HEADER]
  if (history.localRegistrar) lines.push(LOCAL_REGISTRAR)
  for (const { kind, nested } of history.statements) {
    const [text] = FORMS[kind]
    lines.push(nested ? `describe('d', () => { ${text} })` : text)
  }
  if (history.localRegistrar) lines.push(`localCheck('n', () => { compute() })`)
  return new Map([
    ...Object.entries(HELPERS),
    [oracleName(history), `${lines.join(`\n`)}\n`],
  ])
}

// -- Model --------------------------------------------------------------------

/** The sorted `line:messageId` keys that the law predicts. */
function model(history) {
  // A file named `oracle-*` is the shared oracle machinery, which the rule
  // skips.
  if (history.machinery) return []
  const keys = []
  let line = HEADER.length
  if (history.localRegistrar) {
    line++
    // The local helper's registration is a plain test; its callers are not
    // registrations of their own.
    keys.push(`${line}:unitTest`)
  }
  for (const { kind } of history.statements) {
    line++
    const report = FORMS[kind][1]
    if (report !== undefined) keys.push(`${line}:${report}`)
  }
  return keys.sort()
}

// -- Production paths ---------------------------------------------------------

let root
let eslint
const linter = new Linter({ configType: `flat`, cwd: `/` })
const linterConfig = [
  { files: [`**/*.ts`], languageOptions: { parser: tsParser } },
  {
    files: [`**/*.ts`, `**/*.js`],
    plugins: { oracle: oraclePlugin },
    rules: { [RULE]: `error` },
  },
]
let sequence = 0

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), `registration-only-oracle-`))
  writeFileSync(join(root, `package.json`), JSON.stringify({ name: `scratch` }))
  eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
      { files: [`**/*.ts`], languageOptions: { parser: tsParser } },
      oraclePlugin.configs.recommended,
    ],
  })
}, 60_000)
afterAll(() => rmSync(root, { recursive: true, force: true }), 60_000)

const keysOf = (messages) =>
  messages
    .filter((message) => message.ruleId === RULE)
    .map((message) => `${message.line}:${message.messageId}`)
    .sort()

/** Writes the history's files into a fresh directory and lints its oracle file on both paths. */
async function driver(history, observe) {
  const directory = join(root, `h${sequence++}`)
  mkdirSync(directory)
  const files = render(history)
  for (const [name, text] of files) writeFileSync(join(directory, name), text)
  const file = join(directory, oracleName(history))
  const instance = await lintChargedAsync(async () => {
    const [result] = await eslint.lintFiles([file])
    return result.messages
  })
  observe(
    `eslint`,
    instance.threw === undefined
      ? keysOf(instance.messages)
      : [`threw:${instance.threw}`],
  )
  const single = lintCharged(() =>
    linter.verify(files.get(oracleName(history)), linterConfig, {
      filename: file,
    }),
  )
  observe(
    `linter`,
    single.threw === undefined
      ? keysOf(single.messages)
      : [`threw:${single.threw}`],
  )
}

// -- Check ----------------------------------------------------------------------

/** Every receiving path's keys equal the model's, exactly. */
function check(_history, observations, expected) {
  for (const observation of observations) {
    const verdict = differs(
      observation.checkpoint,
      LAW,
      observation.value,
      expected,
    )
    if (verdict !== undefined) return verdict
  }
  return pass
}

// -- Reach ----------------------------------------------------------------------
//
// Each form is a declared state, and so are the file-level dimensions. A
// constructed history appends one statement of the form, so every campaign
// reaches each one.

const formState = (kind) => `form ${kind}`
const STATES = [
  ...KINDS.map(formState),
  `nested in describe`,
  `local registrar`,
  `javascript under espree`,
  `machinery file skipped`,
]

function reached(history) {
  const states = new Set(history.statements.map(({ kind }) => formState(kind)))
  if (history.statements.some(({ nested }) => nested))
    states.add(`nested in describe`)
  if (history.localRegistrar) states.add(`local registrar`)
  if (history.language === `js`) states.add(`javascript under espree`)
  if (history.machinery) states.add(`machinery file skipped`)
  return states
}

const withStatement = (generated, item) => ({
  ...generated,
  statements: [...generated.statements.slice(0, 7), item],
})

const constructed = [
  ...KINDS.map((kind) => ({
    name: formState(kind),
    enters: [formState(kind)],
    build: (generated) => withStatement(generated, { kind, nested: false }),
  })),
  {
    name: `nested in describe`,
    enters: [`nested in describe`],
    build: (generated) =>
      withStatement(generated, { kind: `it-arrow`, nested: true }),
  },
  {
    name: `local registrar`,
    enters: [`local registrar`],
    build: (generated) => ({ ...generated, localRegistrar: true }),
  },
  {
    name: `javascript under espree`,
    enters: [`javascript under espree`],
    build: (generated) => ({ ...generated, language: `js` }),
  },
  {
    name: `machinery file skipped`,
    enters: [`machinery file skipped`],
    build: (generated) =>
      withStatement(
        { ...generated, machinery: true },
        { kind: `it-arrow`, nested: false },
      ),
  },
]

/** Applies a change to the first observation it affects, or none applies. */
function corruptFirst(trace, change) {
  const index = trace.findIndex(
    (observation) => change(observation.value) !== undefined,
  )
  if (index < 0) return undefined
  return trace.map((observation, at) =>
    at === index
      ? { ...observation, value: change(observation.value) }
      : observation,
  )
}

oracleProperty({
  id: `lint.registration-only`,
  law: {
    statement: `In an oracle file, every test registration is reported except a complete oracleProperty call: a plain registration or a caller-passed body is a unit test whatever it reaches, an empty body is an empty test (or an empty todo), an incomplete oracleProperty is reported as such, an imported helper that registers its own test is an imported registration, and a helper from an oracle-named module or a call that registers nothing is not reported. A file named oracle-* gets no report.`,
    authority: `AGENTS.md "Keep Unit Tests Out of Oracles"; the oracle-property-only decisions of 2026-11-09 and 2026-11-10; the maintainer decision of 2026-11-11 that deletes declareOracle and makes oracleProperty the only registration in an oracle file (D2); maintainer decision F21 of 2026-11-10 for empty bodies.`,
    limits: `One oracle file per history with fixed helper modules; one statement per line; a describe holds one statement. Unparsable helpers, re-exports, default exports, and helper-written wrappers around a caller's body are not generated.`,
  },
  histories: {
    arbitrary: historyArbitrary,
    runs: 40,
    fixedSeeds: [2261111],
    states: STATES,
    constructed,
  },
  reached,
  model,
  driver,
  check,
  calibrations: [
    {
      name: `a report dropped from a receiving path`,
      law: LAW,
      corrupt: (trace) =>
        corruptFirst(trace, (keys) =>
          keys.length > 0 ? keys.slice(1) : undefined,
        ),
    },
    {
      name: `a spurious report on a receiving path`,
      law: LAW,
      corrupt: (trace) =>
        corruptFirst(trace, (keys) => [...keys, `0:spurious`]),
    },
  ],
  timeout: 600_000,
})
