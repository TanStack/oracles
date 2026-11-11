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
 * - **A plain registration**, a registration inside a local helper, or a
 *   call to an imported helper that registers the body that its caller
 *   passes (curried or not). Each gets `unitTest`, whatever its body
 *   reaches. A fixed history, case, calibration, or reach census belongs
 *   in the property's histories, calibrations, and states. Any other test
 *   belongs in an ordinary test file.
 * - **What a registration is.** Its root is a test function: `it`, `test`,
 *   `bench`, or `@fast-check/vitest`'s `test`, imported by name or alias or
 *   read as a member of a namespace import (`vitest.it`). A variable of any
 *   kind bound to a test function is one (`let t = it`), and so is a
 *   fixture, `test.extend(fixtures)`, called directly or bound to a name.
 *   An import from a test module is one when the module exports a test
 *   function: a fixture, a constant bound to a test root, a re-export from
 *   the framework, or a relay of an imported one. An oracle-named module's
 *   test function counts too, because the registration is made where it is
 *   called. Between the root and the call, the members are `.each`, `.for`,
 *   `.skipIf`, `.concurrent`, `.only`, `.fails`, `.sequential`, `.skip`,
 *   `.todo` with a body, `.prop`, and the other members that keep a call a
 *   registration. The body may follow options or be passed by name.
 * - **An empty body.** A registration whose body is a function with an empty
 *   block checks nothing. It gets `emptyTest`, or `emptyTodo` for `.todo`.
 *   A bare `it.todo(name)` is no registration, and gets no report.
 * - **An imported helper that registers a test of its own**, from an
 *   ordinary module or an `oracle-` machinery module, by name or through a
 *   namespace, including a function named `oracleProperty` from a module
 *   that is not the framework. It gets `importedRegistration`. The rule
 *   follows the helper through the module's exports: a re-export, a star
 *   export, a relay of an imported helper, a cycle of star exports (which
 *   ends, and finds what any module of the cycle exports), and a default
 *   export of an anonymous function, a
 *   named function, a binding, or an arrow that registers its caller's
 *   body. A helper that registers through an imported fixture registers a
 *   test of its own.
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
 * exactly one statement. A helper module that does not parse, a body passed
 * through a wrapper that the helper writes, a fixture from a package (the
 * rule reads only relative test modules), and a test function passed
 * through a call other than a selection helper or `.extend` are not
 * generated. An aliased `describe` is not generated. A rule throw is
 * observed as a `threw:` key, which the model never predicts.
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
  // The members that keep a call a registration, and an aliased named
  // import of a test root.
  concurrent: [`it.concurrent('n', () => { compute() })`, `unitTest`],
  only: [`it.only('n', () => { compute() })`, `unitTest`],
  fails: [`it.fails('n', () => { compute() })`, `unitTest`],
  sequential: [`test.sequential('n', () => { compute() })`, `unitTest`],
  'aliased-import': [`vitestIt('n', () => { compute() })`, `unitTest`],
  'aliased-import-empty': [`vitestIt('n', () => {})`, `emptyTest`],
  // A benchmark registers as a test does.
  bench: [`bench('n', () => { compute() })`, `unitTest`],
  // A member of a namespace import of the test framework.
  'namespace-it': [`vitest.it('n', () => { compute() })`, `unitTest`],
  'namespace-member': [`vitest.test.skip('n', () => {})`, `emptyTest`],
  // A Vitest fixture: `test.extend(fixtures)` returns a test function, in
  // this file, called directly, or exported by a fixtures module.
  'fixture-local': [`localTest('n', () => { compute() })`, `unitTest`],
  'fixture-direct': [`test.extend({})('n', () => { compute() })`, `unitTest`],
  'fixture-imported': [`myTest('n', () => { compute() })`, `unitTest`],
  'fixture-imported-each': [
    `myTest.each([1])('n %s', (v) => { compute(v) })`,
    `unitTest`,
  ],
  'fixture-imported-empty': [`myTest('n', () => {})`, `emptyTest`],
  'fixture-namespace': [
    `fixtures.myTest('n', () => { compute() })`,
    `unitTest`,
  ],
  'fixture-default': [`defaultTest('n', () => { compute() })`, `unitTest`],
  'fixture-relayed': [`relayedTest('n', () => { compute() })`, `unitTest`],
  // An oracle-named module is linted on its own, but a test function that it
  // exports registers here, where it is called.
  'fixture-oracle-module': [`sharedTest('n', () => { compute() })`, `unitTest`],
  // Aliases of a test root: a module's constant, a module's re-export from
  // the framework, and a local `let`.
  'alias-export': [`aliasCheck('n', () => { compute() })`, `unitTest`],
  'alias-reexport': [`again('n', () => { compute() })`, `unitTest`],
  'alias-let': [`letTest('n', () => { compute() })`, `unitTest`],
  // Helpers reached through a module's exports: a re-export, a star export,
  // a cycle of star exports, and each form of default export.
  'reexported-helper': [`relayed()`, `importedRegistration`],
  'relayed-import-helper': [`relayedUnits()`, `importedRegistration`],
  'star-own-helper': [`hubUnits()`, `importedRegistration`],
  'star-body-helper': [`hubCheck('n', () => { compute() })`, `unitTest`],
  'star-plain': [`hubCompute()`, undefined],
  'cycle-helper': [`cycledUnits()`, `importedRegistration`],
  'cycle-missing': [`cycleMissing()`, undefined],
  'default-anonymous-helper': [`anonymousDefault()`, `importedRegistration`],
  'default-named-helper': [`namedDefault()`, `importedRegistration`],
  'default-binding-helper': [`bindingDefault()`, `importedRegistration`],
  'default-body-helper': [`arrowDefault('n', () => { compute() })`, `unitTest`],
  'helper-through-fixture': [`registerFixture()`, `importedRegistration`],
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
  // A fixtures module, and a module that relays its fixture by name.
  'fixtures.js': `import { test } from 'vitest'\nexport const myTest = test.extend({})\n`,
  'default-fixture.js': `import { test } from 'vitest'\nexport default test.extend({})\n`,
  'relay-fixture.js': `import { myTest } from './fixtures.js'\nexport { myTest as relayedTest }\n`,
  'relay-helper.js': `import { registerUnits } from './own-helper.js'\nexport { registerUnits as relayedUnits }\n`,
  'fixture-oracle.js': `import { test } from 'vitest'\nexport const sharedTest = test.extend({})\n`,
  'fixture-helper.js': `import { myTest } from './fixtures.js'\nexport function registerFixture() {\n  myTest('inner', () => { void 0 })\n}\n`,
  'alias.js': `import { it } from 'vitest'\nexport const aliasCheck = it\nexport { it as again } from 'vitest'\n`,
  // A hub that re-exports and star-exports the helper modules.
  'hub.js': `export * from './own-helper.js'\nexport * from './body-helper.js'\nexport * from './plain.js'\nexport { registerUnits as relayed } from './own-helper.js'\n`,
  // Two modules that star-export each other.
  'cycle-a.js': `export * from './cycle-b.js'\n`,
  'cycle-b.js': `export * from './cycle-a.js'\nexport * from './own-helper.js'\n`,
  'default-anonymous.js': `import { it } from 'vitest'\nexport default function () {\n  it('inner', () => { void 0 })\n}\n`,
  'default-named.js': `import { it } from 'vitest'\nexport default function registerNamed() {\n  it('inner', () => { void 0 })\n}\n`,
  'default-binding.js': `import { it } from 'vitest'\nfunction registerBound() {\n  it('inner', () => { void 0 })\n}\nexport default registerBound\n`,
  'default-arrow.js': `import { it } from 'vitest'\nexport default (name, body) => {\n  it(name, body)\n}\n`,
}

const HEADER = [
  `import { bench, describe, it, test } from 'vitest'`,
  `import { it as vitestIt } from 'vitest'`,
  `import * as vitest from 'vitest'`,
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
  `import { myTest } from './fixtures.js'`,
  `import * as fixtures from './fixtures.js'`,
  `import defaultTest from './default-fixture.js'`,
  `import { relayedTest } from './relay-fixture.js'`,
  `import { relayedUnits } from './relay-helper.js'`,
  `import { sharedTest } from './fixture-oracle.js'`,
  `import { registerFixture } from './fixture-helper.js'`,
  `import { again, aliasCheck } from './alias.js'`,
  `import { check as hubCheck, compute as hubCompute, registerUnits as hubUnits, relayed } from './hub.js'`,
  `import { cycleMissing, registerUnits as cycledUnits } from './cycle-a.js'`,
  `import anonymousDefault from './default-anonymous.js'`,
  `import namedDefault from './default-named.js'`,
  `import bindingDefault from './default-binding.js'`,
  `import arrowDefault from './default-arrow.js'`,
  `const propertyOptions = { id: 'p', check: checkHistory }`,
  `const localTest = test.extend({})`,
  `let letTest = it`,
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
    statement: `In an oracle file, every test registration is reported except a complete oracleProperty call: a plain registration or a caller-passed body is a unit test whatever it reaches, an empty body is an empty test (or an empty todo), an incomplete oracleProperty is reported as such, an imported helper that registers its own test is an imported registration, and a helper from an oracle-named module or a call that registers nothing is not reported. A registration's root is a test function (it, test, bench, fast-check's test) by name, alias, namespace member, a variable of any kind, a fixture, or an import from a test module that exports one, re-exported, relayed, or default-exported. Helpers are followed through re-exports, star exports, cycles, and default exports. A file named oracle-* gets no report.`,
    authority: `AGENTS.md "Keep Unit Tests Out of Oracles"; the oracle-property-only decisions of 2026-11-09 and 2026-11-10; the maintainer decision of 2026-11-11 that deletes declareOracle and makes oracleProperty the only registration in an oracle file (D2); maintainer decision F21 of 2026-11-10 for empty bodies.`,
    limits: `One oracle file per history with fixed helper modules; one statement per line; a describe holds one statement. Unparsable helpers, helper-written wrappers around a caller's body, fixtures from a package, a test function passed through other calls, and an aliased describe are not generated.`,
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
