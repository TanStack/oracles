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
 * - **What a registration is.** Its root is a test function, as the three
 *   rules resolve it together (the second property of this file,
 *   `lint.test-function-agreement`, owns that account). An import from a
 *   test module is one when the module exports a test function: a fixture,
 *   a constant bound to a test root, a re-export from the framework, or a
 *   relay of an imported one. An oracle-named module's test function counts
 *   too, because the registration is made where it is called. Between the
 *   root and the call, the members are `.each`, `.for`, `.skipIf`,
 *   `.concurrent`, `.only`, `.fails`, `.sequential`, `.skip`, `.todo` with
 *   a body, `.prop`, `.extend`, and the other members that keep a call a
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
 * - **Helper modules with any call graph.** Helpers whose modules import
 *   each other (by name or as defaults), a module that imports its own
 *   namespace, and a chain of modules whose helpers each call three helpers
 *   of the next module register nothing. The rule asks of a helper's body
 *   only which callees are test functions, and it resolves each export once
 *   per lint, so every lint ends within the budget, `BUDGET_MS` (the review
 *   of 2026-11-11, P0, measured 16.5 s for such a chain where the parent
 *   took 4 ms).
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
 * path's observation is the list of `line:messageId` keys of this rule's
 * reports in the oracle file, sorted. A third observation compares the
 * slower path's time with the budget.
 *
 * Limits: one oracle file per history, with a fixed set of helper modules
 * beside it. Each statement takes one line, and a nested `describe` holds
 * exactly one statement. A helper module that does not parse, a body passed
 * through a wrapper that the helper writes, a fixture from a package (the
 * rule reads only relative test modules), and a test function passed
 * through a call other than a selection helper or `.extend` are not
 * generated. A rule throw is observed as a `threw:` key, which the model
 * never predicts. The budget is wall-clock time, so a machine far slower
 * than a laptop could exceed it without a defect.
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
  // Empty bodies through an aliased import, a namespace member, and an
  // imported fixture, and the fixture forms that only a module export
  // reaches. The agreement property below owns the other bindings of a
  // test function.
  'aliased-import-empty': [`vitestIt('n', () => {})`, `emptyTest`],
  'namespace-member': [`vitest.test.skip('n', () => {})`, `emptyTest`],
  'fixture-imported-empty': [`myTest('n', () => {})`, `emptyTest`],
  'fixture-default': [`defaultTest('n', () => { compute() })`, `unitTest`],
  'fixture-relayed': [`relayedTest('n', () => { compute() })`, `unitTest`],
  // An oracle-named module is linted on its own, but a test function that it
  // exports registers here, where it is called.
  'fixture-oracle-module': [`sharedTest('n', () => { compute() })`, `unitTest`],
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
  // Helpers whose modules import each other, or themselves, and a deep
  // chain of helpers that each call three helpers of the next module. None
  // registers a test, and each lint ends within the budget.
  'mutual-named': [`mutualF()`, undefined],
  'mutual-default': [`mutualDefault()`, undefined],
  'self-namespace': [`selfF()`, undefined],
  'mutual-oracle-named': [`mutualOracleF()`, undefined],
  'fan-out-chain': [`chainF()`, undefined],
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

// A chain of `depth` modules. Each module's three helpers call the three
// helpers of the next module, so a walk that revisits a helper for each of
// its callers costs 3^depth.
const CHAIN_DEPTH = 10
function fanOutChain(depth) {
  const modules = {}
  for (let at = 0; at < depth; at++) {
    const body =
      at === depth - 1 ? `return 1` : `return nextF() + nextG() + nextH()`
    modules[`chain-${at}.js`] = [
      ...(at === depth - 1
        ? []
        : [
            `import { f as nextF, g as nextG, h as nextH } from './chain-${at + 1}.js'`,
          ]),
      ...[`f`, `g`, `h`].map((name) => `export function ${name}() { ${body} }`),
      ``,
    ].join(`\n`)
  }
  return modules
}

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
  // A hub that re-exports and star-exports the helper modules.
  'hub.js': `export * from './own-helper.js'\nexport * from './body-helper.js'\nexport * from './plain.js'\nexport { registerUnits as relayed } from './own-helper.js'\n`,
  // Two modules that star-export each other.
  'cycle-a.js': `export * from './cycle-b.js'\n`,
  'cycle-b.js': `export * from './cycle-a.js'\nexport * from './own-helper.js'\n`,
  'default-anonymous.js': `import { it } from 'vitest'\nexport default function () {\n  it('inner', () => { void 0 })\n}\n`,
  'default-named.js': `import { it } from 'vitest'\nexport default function registerNamed() {\n  it('inner', () => { void 0 })\n}\n`,
  'default-binding.js': `import { it } from 'vitest'\nfunction registerBound() {\n  it('inner', () => { void 0 })\n}\nexport default registerBound\n`,
  'default-arrow.js': `import { it } from 'vitest'\nexport default (name, body) => {\n  it(name, body)\n}\n`,
  'mutual-a.js': `import { g } from './mutual-b.js'\nexport function f() {\n  return g()\n}\n`,
  'mutual-b.js': `import { f } from './mutual-a.js'\nexport function g() {\n  return f()\n}\n`,
  'mutual-default-a.js': `import g from './mutual-default-b.js'\nexport default function () {\n  return g()\n}\n`,
  'mutual-default-b.js': `import f from './mutual-default-a.js'\nexport default function g() {\n  return f()\n}\n`,
  'self.js': `import * as self from './self.js'\nexport function f() {\n  return self.f()\n}\n`,
  'mutual-oracle.js': `import { g } from './mutual-c.js'\nexport function f() {\n  return g()\n}\n`,
  'mutual-c.js': `import { f } from './mutual-oracle.js'\nexport function g() {\n  return f()\n}\n`,
  ...fanOutChain(CHAIN_DEPTH),
}

const HEADER = [
  `import { describe, it, test } from 'vitest'`,
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
  `import defaultTest from './default-fixture.js'`,
  `import { relayedTest } from './relay-fixture.js'`,
  `import { relayedUnits } from './relay-helper.js'`,
  `import { sharedTest } from './fixture-oracle.js'`,
  `import { registerFixture } from './fixture-helper.js'`,
  `import { check as hubCheck, compute as hubCompute, registerUnits as hubUnits, relayed } from './hub.js'`,
  `import { cycleMissing, registerUnits as cycledUnits } from './cycle-a.js'`,
  `import anonymousDefault from './default-anonymous.js'`,
  `import namedDefault from './default-named.js'`,
  `import bindingDefault from './default-binding.js'`,
  `import arrowDefault from './default-arrow.js'`,
  `import { f as mutualF } from './mutual-a.js'`,
  `import mutualDefault from './mutual-default-a.js'`,
  `import { f as selfF } from './self.js'`,
  `import { f as mutualOracleF } from './mutual-oracle.js'`,
  `import { f as chainF } from './chain-0.js'`,
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

/**
 * What the law predicts: the sorted `line:messageId` keys on each receiving
 * path, and a lint that ends within the budget.
 */
function model(history) {
  return { keys: reportKeys(history), budget: `within ${BUDGET_MS} ms` }
}

/** The sorted `line:messageId` keys that the law predicts. */
function reportKeys(history) {
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

let scratch
let eslint
const linter = new Linter({ configType: `flat`, cwd: `/` })
/** A single-file config that enables only `rules`, as a RuleTester caller does. */
const linterConfigFor = (rules) => [
  { files: [`**/*.ts`], languageOptions: { parser: tsParser } },
  {
    files: [`**/*.ts`, `**/*.js`],
    plugins: { oracle: oraclePlugin },
    rules: Object.fromEntries(rules.map((rule) => [rule, `error`])),
  },
]
let sequence = 0

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), `registration-only-oracle-`))
  writeFileSync(
    join(scratch, `package.json`),
    JSON.stringify({ name: `scratch` }),
  )
  eslint = new ESLint({
    cwd: scratch,
    overrideConfigFile: true,
    overrideConfig: [
      { files: [`**/*.ts`], languageOptions: { parser: tsParser } },
      oraclePlugin.configs.recommended,
    ],
  })
}, 60_000)
afterAll(() => rmSync(scratch, { recursive: true, force: true }), 60_000)

// The time that one lint of a history may take on one path. A lint at the
// parent of the module walk took a few milliseconds on the deepest chain, so
// the budget leaves room for a loaded machine and still rejects a walk that
// grows with the number of call paths (review of 2026-11-11, P0).
const BUDGET_MS = 2000

/**
 * Writes the history's files into a fresh directory and lints its oracle
 * file on both paths. Each path's keys are one observation, and the slower
 * path's time against the budget is another.
 */
async function driver(history, observe) {
  const directory = join(scratch, `h${sequence++}`)
  mkdirSync(directory)
  const files = render(history)
  for (const [name, text] of files) writeFileSync(join(directory, name), text)
  const file = join(directory, oracleName(history))
  const keys = await lintBothPaths(file, files.get(oracleName(history)), [RULE])
  observe(`eslint`, keys.eslint)
  observe(`linter`, keys.linter)
  observe(`budget`, keys.budget)
}

/**
 * Lints `file` on the ESLint instance and through a single `Linter` call.
 * Each path gives the sorted `line:messageId` keys of the `rules`, prefixed
 * with the rule's name when more than one rule is read, or its throw. The
 * budget observation names the slower path's time when it is over.
 */
async function lintBothPaths(file, text, rules) {
  const keysOf = (messages) =>
    messages
      .filter((message) => rules.includes(message.ruleId))
      .map(
        (message) =>
          `${message.line}:${rules.length > 1 ? `${message.ruleId.slice(`oracle/`.length)}:` : ``}${message.messageId}`,
      )
      .sort()
  let started = performance.now()
  const instance = await lintChargedAsync(async () => {
    const [result] = await eslint.lintFiles([file])
    return result.messages
  })
  const instanceMs = performance.now() - started
  started = performance.now()
  const single = lintCharged(() =>
    linter.verify(text, linterConfigFor(rules), { filename: file }),
  )
  const slowest = Math.max(instanceMs, performance.now() - started)
  return {
    eslint:
      instance.threw === undefined
        ? keysOf(instance.messages)
        : [`threw:${instance.threw}`],
    linter:
      single.threw === undefined
        ? keysOf(single.messages)
        : [`threw:${single.threw}`],
    budget:
      slowest <= BUDGET_MS
        ? `within ${BUDGET_MS} ms`
        : `over ${BUDGET_MS} ms: ${Math.round(slowest)} ms`,
  }
}

// -- Check ----------------------------------------------------------------------

/**
 * Every receiving path's keys equal the model's, exactly, and the lint ends
 * within the budget.
 */
function check(_history, observations, expected) {
  for (const observation of observations) {
    const verdict = differs(
      observation.checkpoint,
      LAW,
      observation.value,
      observation.checkpoint === `budget` ? expected.budget : expected.keys,
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

/**
 * Applies a change to the first list of keys that it affects, or none
 * applies. The budget observation is not a list of keys.
 */
function corruptFirst(trace, change) {
  const index = trace.findIndex(
    (observation) =>
      Array.isArray(observation.value) &&
      change(observation.value) !== undefined,
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
    statement: `In an oracle file, every test registration is reported except a complete oracleProperty call: a plain registration or a caller-passed body is a unit test whatever it reaches, an empty body is an empty test (or an empty todo), an incomplete oracleProperty is reported as such, an imported helper that registers its own test is an imported registration, and a helper from an oracle-named module or a call that registers nothing is not reported. A registration's root is a test function (it, test, bench, fast-check's test) by name, alias, namespace member, a variable of any kind, a fixture, or an import from a test module that exports one, re-exported, relayed, or default-exported. Helpers are followed through re-exports, star exports, cycles, and default exports. Helper modules that import each other or themselves end the walk, and every lint ends within ${BUDGET_MS} ms, whatever the call graph of the helper modules. A file named oracle-* gets no report.`,
    authority: `AGENTS.md "Keep Unit Tests Out of Oracles"; the oracle-property-only decisions of 2026-11-09 and 2026-11-10; the maintainer decision of 2026-11-11 that deletes declareOracle and makes oracleProperty the only registration in an oracle file (D2); maintainer decision F21 of 2026-11-10 for empty bodies.`,
    limits: `One oracle file per history with fixed helper modules; one statement per line; a describe holds one statement. Unparsable helpers, helper-written wrappers around a caller's body, fixtures from a package, and a test function passed through other calls are not generated. The budget is wall-clock time.`,
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
    {
      name: `a lint over the budget`,
      law: LAW,
      corrupt: (trace) =>
        trace.map((observation) =>
          observation.checkpoint === `budget`
            ? { ...observation, value: `over ${BUDGET_MS} ms: 16500 ms` }
            : observation,
        ),
    },
  ],
  timeout: 600_000,
})

// =============================================================================
// # The three rules agree on what a test function is
//
// Law (oracle/no-unit-test, oracle/no-disabled, oracle/oracle-property-only):
// the three rules share one account of a test function, so a registration
// that one rule sees, every rule sees. The account: the root of a callee is a
// test function when its binding resolves to `it`, `test`, `describe`,
// `suite`, or `bench` of the test framework (`vitest`, `@fast-check/vitest`,
// `@playwright/test`), or to a fixture (`.extend(...)`) of one. A binding
// resolves through an alias, a namespace member, a variable of any kind
// (its initializer and every assignment), a destructuring, a cast, either
// branch of a conditional or logical expression, and the exports of a test
// module: a constant, a re-export, `export * as`, and a default export. A
// binding that resolves to anything else, such as a local function of the
// same name, a namespace of another package, an ordinary module's function,
// or a cycle of variables, is no test function, whatever its name.
//
// What each rule owes for a statement `<callee><modifier>('n', body)`:
//
// - `oracle/no-unit-test` reports `unitTest` for a test (not a suite) root.
// - `oracle/no-disabled` reports `only` for `.only`, `skip` for `.skip` and
//   `.todo` with a body, and `conditional` for `.skipIf(true)`, once per
//   call, counting a modifier that a module's binding carries. It also
//   reports `aliasTest` where a bare test function is passed as a value (a
//   variable's initializer or assignment, through a cast or a branch), and
//   `alias` where a modifier or a modifier call is.
// - `oracle/oracle-property-only` reports `rawProperty` for `.prop(...)`.
//
// Authority: the D2 law above, the no-disabled rule's contract (its header:
// `.only`, a skipped body, a switch-off condition, a test function passed as
// a value), oracle-property-only's contract (a `.prop` registration of a
// test root is a raw campaign), and the review of 2026-11-11 (P1), which asks
// that the three rules cannot disagree on a root. That every branch of a
// conditional counts follows the review's rule that an unknown callee that
// may resolve to a test root is reported, not passed.
//
// The model reads only the statement's binding, root, and modifier. The
// production path is the same ESLint instance and single `Linter` call,
// with the three rules, and the observation is the sorted
// `line:rule:messageId` keys of their reports.
//
// Limits: one oracle file per history, with fixed helper modules. A test
// function passed as a parameter to a local helper, a global test function
// (Vitest's `globals`), a modifier call relayed from another module (only
// `.skip` is), and a fixture exported by a package are not generated. A relative module that
// the parser cannot read is not generated.
// =============================================================================

const AGREE_LAW = `the rules agree`
const AGREE_RULES = [
  `oracle/no-unit-test`,
  `oracle/no-disabled`,
  `oracle/oracle-property-only`,
]
const ROOTS = [`it`, `test`, `describe`, `suite`, `bench`]
const SUITES = new Set([`describe`, `suite`])
const capital = (name) => `${name[0].toUpperCase()}${name.slice(1)}`

// -- Grammar ------------------------------------------------------------------
//
// A binding renders the callee for a root, with any setup lines before the
// call. `declares` names the report that no-disabled owes on the last setup
// line: `aliasTest` where it passes a bare test function as a value, and
// `alias` where it passes a modifier. `carries` is a modifier that a
// module's binding brings, and `test` says that the binding resolves to a
// test function at all.
// `roots` limits a fixture to the roots that have one.

const castOf = (expression, type, language, k) =>
  language === `js`
    ? `(${expression})`
    : [
        `${expression} as ${type}`,
        `${expression}!`,
        `${expression} satisfies unknown`,
      ][k % 3]

const BINDINGS = {
  plain: { test: true, render: (r) => ({ callee: r }) },
  aliased: { test: true, render: (r) => ({ callee: `a${capital(r)}` }) },
  namespace: { test: true, render: (r) => ({ callee: `vitest.${r}` }) },
  const: {
    test: true,
    declares: `aliasTest`,
    render: (r, k) => ({ setup: [`const c${k} = ${r}`], callee: `c${k}` }),
  },
  'const-namespace': {
    test: true,
    declares: `aliasTest`,
    render: (r, k) => ({
      setup: [`const n${k} = vitest.${r}`],
      callee: `n${k}`,
    }),
  },
  assigned: {
    test: true,
    declares: `aliasTest`,
    render: (r, k) => ({
      setup: [`let s${k}`, `s${k} = ${r}`],
      callee: `s${k}`,
    }),
  },
  cast: {
    test: true,
    declares: `aliasTest`,
    render: (r, k, language) => ({
      setup: [
        `const k${k} = ${castOf(`vitest.${r}`, `typeof vitest.${r}`, language, k)}`,
      ],
      callee: `k${k}`,
    }),
  },
  'cast-plain': {
    test: true,
    declares: `aliasTest`,
    render: (r, k, language) => ({
      setup: [`const kp${k} = ${castOf(r, `typeof ${r}`, language, k)}`],
      callee: `kp${k}`,
    }),
  },
  conditional: {
    test: true,
    declares: `aliasTest`,
    render: (r, k) => ({
      setup: [`const q${k} = globalThis.flag ? vitest.${r} : compute`],
      callee: `q${k}`,
    }),
  },
  logical: {
    test: true,
    declares: `aliasTest`,
    render: (r, k) => ({
      setup: [`const o${k} = globalThis.other || vitest.${r}`],
      callee: `o${k}`,
    }),
  },
  destructured: {
    test: true,
    render: (r, k) => ({
      setup: [`const { ${r}: d${k} } = vitest`],
      callee: `d${k}`,
    }),
  },
  'fixture-local': {
    test: true,
    roots: [`it`, `test`, `describe`],
    render: (r, k) => ({
      setup: [`const f${k} = ${r === `describe` ? `test` : r}.extend({})`],
      callee: r === `describe` ? `f${k}.describe` : `f${k}`,
    }),
  },
  'fixture-direct': {
    test: true,
    roots: [`it`, `test`, `describe`],
    render: (r) => ({
      callee: r === `describe` ? `test.extend({}).describe` : `${r}.extend({})`,
    }),
  },
  'fixture-imported': {
    test: true,
    roots: [`it`, `test`, `describe`],
    render: (r) => ({
      callee: r === `describe` ? `fxTest.describe` : `fx${capital(r)}`,
    }),
  },
  'fixture-cast': {
    test: true,
    roots: [`it`, `test`, `describe`],
    render: (r, k, language) => {
      const base = r === `describe` ? `test` : r
      return {
        setup: [
          `const fc${k} = ${castOf(`${base}.extend({})`, `typeof ${base}`, language, 0)}`,
        ],
        callee: r === `describe` ? `fc${k}.describe` : `fc${k}`,
      }
    },
  },
  relayed: { test: true, render: (r) => ({ callee: `r${capital(r)}` }) },
  'relayed-namespace': {
    test: true,
    render: (r) => ({ callee: `roots.r${capital(r)}` }),
  },
  reexported: { test: true, render: (r) => ({ callee: `x${capital(r)}` }) },
  'star-as': { test: true, render: (r) => ({ callee: `vt.${r}` }) },
  'default-export': {
    test: true,
    render: (r) => ({ callee: `d${capital(r)}` }),
  },
  // Bindings that carry a modifier: a local alias of `.skip` and of a
  // `.skipIf` call, which no-disabled reports where they are written, and a
  // module's `.skip` alias, which it reports at the call that uses it.
  'modifier-alias': {
    test: true,
    declares: `alias`,
    render: (r, k) => ({ setup: [`const m${k} = ${r}.skip`], callee: `m${k}` }),
  },
  'condition-alias': {
    test: true,
    declares: `alias`,
    render: (r, k) => ({
      setup: [`const w${k} = ${r}.skipIf(false)`],
      callee: `w${k}`,
    }),
  },
  'relayed-skip': {
    test: true,
    carries: `skip`,
    render: (r) => ({ callee: `s${capital(r)}` }),
  },
  // Bindings that are no test function, whatever their names.
  'variable-cycle': {
    test: false,
    render: (_r, k) => ({
      setup: [`let y${k} = z${k}`, `let z${k} = y${k}`],
      callee: `y${k}`,
    }),
  },
  shadowed: {
    test: false,
    render: (r) => ({ callee: r, block: `const ${r} = compute` }),
  },
  'ordinary-module': {
    test: false,
    render: (r) => ({ callee: `patterns.${r}` }),
  },
  'other-package': {
    test: false,
    render: (r) => ({ callee: `other.${r}` }),
  },
  'other-package-named': {
    test: false,
    render: (r) => ({ callee: `o${capital(r)}` }),
  },
  'other-package-relayed': {
    test: false,
    render: (r) => ({ callee: `p${capital(r)}` }),
  },
}
const BINDING_NAMES = Object.keys(BINDINGS)

const MODIFIERS = [
  `none`,
  `skip`,
  `only`,
  `todo`,
  `skipIf`,
  `concurrent`,
  `fails`,
  `sequential`,
  `each`,
  `each-tagged`,
  `skip-each-tagged`,
  `prop`,
]

/** Whether a binding, root, and modifier make a statement of the grammar. */
const allowed = (binding, root, modifier) =>
  (BINDINGS[binding].roots ?? ROOTS).includes(root) &&
  (modifier !== `prop` || !(SUITES.has(root) || root === `bench`))

const agreeStatement = fc
  .record({
    binding: fc.constantFrom(...BINDING_NAMES),
    root: fc.constantFrom(...ROOTS),
    modifier: fc.constantFrom(...MODIFIERS),
  })
  .filter(({ binding, root, modifier }) => allowed(binding, root, modifier))

const agreeHistories = fc.record({
  language: fc.constantFrom(`ts`, `js`),
  statements: fc.array(agreeStatement, { maxLength: 6 }),
})

const AGREE_HELPERS = {
  'plain.js': HELPERS[`plain.js`],
  'agree-fixtures.js': `import { it, test } from 'vitest'\nexport const fxIt = it.extend({})\nexport const fxTest = test.extend({})\n`,
  'agree-aliases.js': `import { bench, describe, it, suite, test } from 'vitest'\n${ROOTS.map((r) => `export const r${capital(r)} = ${r}`).join(`\n`)}\n`,
  'agree-reexports.js': `export { ${ROOTS.map((r) => `${r} as x${capital(r)}`).join(`, `)} } from 'vitest'\n`,
  'agree-star-as.js': `export * as vt from 'vitest'\n`,
  'agree-other.js': `export { ${ROOTS.map((r) => `${r} as p${capital(r)}`).join(`, `)} } from 'regex-lib'\n`,
  'agree-skipped.js': `import { bench, describe, it, suite, test } from 'vitest'\n${ROOTS.map((r) => `export const s${capital(r)} = ${r}.skip`).join(`\n`)}\n`,
  ...Object.fromEntries(
    ROOTS.map((r) => [
      `agree-default-${r}.js`,
      `import { ${r} } from 'vitest'\nexport default ${r}\n`,
    ]),
  ),
  'agree-patterns.js': ROOTS.map(
    (r) => `export function ${r}() {\n  return 1\n}\n`,
  ).join(``),
}

const AGREE_HEADER = [
  `import { bench, describe, it, suite, test } from 'vitest'`,
  `import { ${ROOTS.map((r) => `${r} as a${capital(r)}`).join(`, `)} } from 'vitest'`,
  `import * as vitest from 'vitest'`,
  `import * as other from 'regex-lib'`,
  `import { ${ROOTS.map((r) => `${r} as o${capital(r)}`).join(`, `)} } from 'regex-lib'`,
  `import { ${ROOTS.map((r) => `p${capital(r)}`).join(`, `)} } from './agree-other.js'`,
  `import { oracleProperty } from '@tanstack/oracles'`,
  `import { checkHistory, compute } from './plain.js'`,
  `import { fxIt, fxTest } from './agree-fixtures.js'`,
  `import { ${ROOTS.map((r) => `r${capital(r)}`).join(`, `)} } from './agree-aliases.js'`,
  `import * as roots from './agree-aliases.js'`,
  `import { ${ROOTS.map((r) => `x${capital(r)}`).join(`, `)} } from './agree-reexports.js'`,
  `import { vt } from './agree-star-as.js'`,
  `import { ${ROOTS.map((r) => `s${capital(r)}`).join(`, `)} } from './agree-skipped.js'`,
  ...ROOTS.map((r) => `import d${capital(r)} from './agree-default-${r}.js'`),
  `import * as patterns from './agree-patterns.js'`,
]

/** The call of a statement: its callee with its modifier and arguments. */
function callOf(callee, root, modifier) {
  const suite = SUITES.has(root)
  const body = suite
    ? `() => { oracleProperty({ id: 'p', check: checkHistory }) }`
    : `() => { compute() }`
  const rowBody = suite
    ? `(v) => { oracleProperty({ id: String(v), check: checkHistory }) }`
    : `(v) => { compute(v) }`
  switch (modifier) {
    case `none`:
      return `${callee}('n', ${body})`
    case `skipIf`:
      return `${callee}.skipIf(true)('n', ${body})`
    case `each`:
      return `${callee}.each([1])('n %s', ${rowBody})`
    case `each-tagged`:
      return `${callee}.each\`v \${1}\`('n', ${rowBody})`
    case `skip-each-tagged`:
      return `${callee}.skip.each\`v \${1}\`('n', ${rowBody})`
    case `prop`:
      return `${callee}.prop([1])('n', ${rowBody})`
    default:
      return `${callee}.${modifier}('n', ${body})`
  }
}

/** The lines of each statement, in order, beside the header. */
function agreeLines(history) {
  return history.statements.map(({ binding, root, modifier }, k) => {
    const {
      setup = [],
      callee,
      block,
    } = BINDINGS[binding].render(root, k, history.language)
    const call = callOf(callee, root, modifier)
    return [...setup, block === undefined ? call : `{ ${block}; ${call} }`]
  })
}

const agreeName = (history) => `agree-oracle.test.${history.language}`

function agreeRender(history) {
  const lines = [...AGREE_HEADER, ...agreeLines(history).flat()]
  return new Map([
    ...Object.entries(AGREE_HELPERS),
    [agreeName(history), `${lines.join(`\n`)}\n`],
  ])
}

// -- Model --------------------------------------------------------------------

/**
 * The reports that each rule owes for one statement's call. `carried` is a
 * modifier that the binding brings from another module. no-disabled reports
 * one switch-off per call: `.only` first, then a condition, then a skip.
 */
function callReports({ root, modifier }, carried) {
  const reports = []
  if (!SUITES.has(root)) reports.push(`no-unit-test:unitTest`)
  const modifiers = [
    ...(carried === undefined ? [] : [carried]),
    ...(modifier === `skip-each-tagged` ? [`skip`] : [modifier]),
  ]
  const disabled = modifiers.includes(`only`)
    ? `only`
    : modifiers.includes(`skipIf`)
      ? `conditional`
      : modifiers.some((name) => name === `skip` || name === `todo`)
        ? `skip`
        : undefined
  if (disabled !== undefined) reports.push(`no-disabled:${disabled}`)
  if (modifier === `prop`) reports.push(`oracle-property-only:rawProperty`)
  return reports
}

function agreeModel(history) {
  const keys = []
  let line = AGREE_HEADER.length
  agreeLines(history).forEach((lines, k) => {
    const item = history.statements[k]
    const binding = BINDINGS[item.binding]
    const callLine = line + lines.length
    // A setup line that passes a bare test function as a value is the last
    // setup line: the initializer or the assignment.
    if (binding.test && binding.declares !== undefined)
      keys.push(`${callLine - 1}:no-disabled:${binding.declares}`)
    if (binding.test)
      for (const report of callReports(item, binding.carries))
        keys.push(`${callLine}:${report}`)
    line = callLine
  })
  return { keys: keys.sort(), budget: `within ${BUDGET_MS} ms` }
}

// -- Production path ----------------------------------------------------------

async function agreeDriver(history, observe) {
  const directory = join(scratch, `a${sequence++}`)
  mkdirSync(directory)
  const files = agreeRender(history)
  for (const [name, text] of files) writeFileSync(join(directory, name), text)
  const file = join(directory, agreeName(history))
  const keys = await lintBothPaths(
    file,
    files.get(agreeName(history)),
    AGREE_RULES,
  )
  observe(`eslint`, keys.eslint)
  observe(`linter`, keys.linter)
  observe(`budget`, keys.budget)
}

function agreeCheck(_history, observations, expected) {
  for (const observation of observations) {
    const verdict = differs(
      observation.checkpoint,
      AGREE_LAW,
      observation.value,
      observation.checkpoint === `budget` ? expected.budget : expected.keys,
    )
    if (verdict !== undefined) return verdict
  }
  return pass
}

// -- Reach --------------------------------------------------------------------
//
// Each binding with each modifier is a declared state, and so is each
// binding with each root it allows. A constructed history appends one
// statement in that state.

const pairState = (binding, modifier) => `${binding} with ${modifier}`
const rootState = (binding, root) => `${binding} for ${root}`
const firstRoot = (binding, modifier) =>
  ROOTS.find((root) => allowed(binding, root, modifier))
const AGREE_STATES = [
  ...BINDING_NAMES.flatMap((binding) =>
    MODIFIERS.map((modifier) => pairState(binding, modifier)),
  ),
  ...BINDING_NAMES.flatMap((binding) =>
    ROOTS.filter((root) => allowed(binding, root, `none`)).map((root) =>
      rootState(binding, root),
    ),
  ),
  `javascript under espree`,
]

function agreeReached(history) {
  const states = new Set()
  for (const { binding, root, modifier } of history.statements) {
    states.add(pairState(binding, modifier))
    states.add(rootState(binding, root))
  }
  if (history.language === `js`) states.add(`javascript under espree`)
  return states
}

const withAgreeStatement = (generated, item) => ({
  ...generated,
  statements: [...generated.statements.slice(0, 5), item],
})

const agreeConstructed = [
  ...BINDING_NAMES.flatMap((binding) =>
    MODIFIERS.map((modifier) => ({
      name: pairState(binding, modifier),
      enters: [pairState(binding, modifier)],
      build: (generated) =>
        withAgreeStatement(generated, {
          binding,
          root: firstRoot(binding, modifier),
          modifier,
        }),
    })),
  ),
  ...BINDING_NAMES.flatMap((binding) =>
    ROOTS.filter((root) => allowed(binding, root, `none`)).map((root) => ({
      name: rootState(binding, root),
      enters: [rootState(binding, root)],
      build: (generated) =>
        withAgreeStatement(generated, { binding, root, modifier: `none` }),
    })),
  ),
  {
    name: `javascript under espree`,
    enters: [`javascript under espree`],
    build: (generated) => ({ ...generated, language: `js` }),
  },
]

oracleProperty({
  id: `lint.test-function-agreement`,
  law: {
    statement: `oracle/no-unit-test, oracle/no-disabled, and oracle/oracle-property-only resolve a callee's root to the same test function: it, test, describe, suite, or bench of vitest, @fast-check/vitest, or @playwright/test, or a fixture of one, through an alias, a namespace member, a variable's initializer or assignment, a destructuring, a cast, a branch of a conditional or logical expression, and a test module's constant, re-export, export * as, or default export. Any other binding is no test function, whatever its name. For a test root no-unit-test reports unitTest; no-disabled reports only, skip for .skip and a .todo with a body, and conditional for .skipIf(true), and aliasTest where a bare test function is passed as a value; oracle-property-only reports rawProperty for .prop. A modifier that a module's binding carries counts at the call, and no-disabled reports alias where a modifier or a modifier call is passed as a value. Every lint ends within ${BUDGET_MS} ms.`,
    authority: `The D2 law of lint.registration-only; the no-disabled and oracle-property-only rules' contracts in their source headers; the review of remove/declare-oracle of 2026-11-11 (P1), which asks that the three rules share one root recognizer and that an unknown callee that may resolve to a test root is reported.`,
    limits: `One oracle file per history with fixed helper modules. A test function passed as a parameter, a global test function, a modifier call relayed from another module (a relayed .skip is generated), a fixture exported by a package, and an unparsable module are not generated.`,
  },
  histories: {
    arbitrary: agreeHistories,
    runs: 40,
    fixedSeeds: [2261112],
    states: AGREE_STATES,
    constructed: agreeConstructed,
  },
  reached: agreeReached,
  model: agreeModel,
  driver: agreeDriver,
  check: agreeCheck,
  calibrations: [
    {
      name: `one rule misses a registration that another sees`,
      law: AGREE_LAW,
      corrupt: (trace) =>
        corruptFirst(trace, (keys) => {
          const at = keys.findIndex((key) => key.includes(`:no-disabled:`))
          return at < 0 ? undefined : keys.filter((_, i) => i !== at)
        }),
    },
    {
      name: `a rule reports a binding that is no test function`,
      law: AGREE_LAW,
      corrupt: (trace) =>
        corruptFirst(trace, (keys) => [...keys, `0:no-unit-test:unitTest`]),
    },
  ],
  timeout: 600_000,
})
