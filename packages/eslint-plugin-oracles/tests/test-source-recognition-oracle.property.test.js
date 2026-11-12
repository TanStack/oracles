/**
 * # A test function is recognized by the module it comes from
 *
 * Law (oracle/no-unit-test, oracle/no-disabled, oracle/oracle-property-only):
 * the rules decide whether a callee is a test function by the source of its
 * binding, not by its name alone.
 *
 * - **A test framework's export is a test function, or a suite**, as that
 *   framework documents it. The export can be named, default, a member of a
 *   namespace import, a member of `require(...)`, a relay through a relative
 *   module, or a global of the framework's test environment. An export that
 *   is already disabled or focused, such as Jest's `xit` or `fit`, or
 *   node:test's `skip` and `only`, carries its modifier. A factory that
 *   returns a test function counts too: Playwright's `mergeTests()`, uvu's
 *   `suite('S')`, `jest-each`, Lab's `script()`, and Vitest's
 *   `createTaskCollector`. The members that keep a call a registration are
 *   each framework's own: `.fail` (Playwright), `.failing` (Jest, AVA, Bun),
 *   `.expectFailure` (node:test), `.ignore` (Deno), `.if` and `.todoIf`
 *   (Bun), `.override` and `.scoped` (Vitest), `.effect` and `.live`
 *   (`@effect/vitest`), and the rest. A member that registers nothing, such
 *   as Playwright's `test.step` or `test.describe.configure`, keeps nothing.
 * - **A known non-test library's export is no test function**, whatever its
 *   name: Ramda's and Rambda's `test`, mitata's and `@thi.ng/bench`'s
 *   `bench`, benny's `suite`, remeda's `only`, TensorFlow's `step`, and the
 *   `step` package. None of them is ever reported.
 * - **A project's own module is read.** A relative module, a `#` import
 *   through the nearest `package.json` `imports`, and a workspace package
 *   (a `node_modules` entry whose real path is outside every `node_modules`
 *   directory, through its `exports`, never its `types`) are followed to the
 *   framework. A fixture (`base.extend(...)`) and a skip wrapper
 *   (`base.skip`) there are test functions, and the wrapper carries its
 *   `skip`. A package whose real path is under `node_modules` is never read,
 *   whatever its file says.
 *   A project whose own real path is under a `node_modules` directory is
 *   read all the same. A `#` import whose target is a package
 *   (`"#vitest": "vitest"`) is that package.
 * - **Settings.** `settings.oracles.testPackages` maps a specifier to a
 *   framework's specifier, or to a table of its exports (`{ authTest:
 *   'test' }`). `nonTestPackages` lists specifiers that export no test
 *   function. Both are read before the built-in tables. A setting that the
 *   rules cannot use (a `settings.oracles` that is null, a string, a
 *   number, or an array; a `testPackages` array or an entry naming
 *   `constructor` or `toString`; a `nonTestPackages` string; an unknown
 *   `unknownSources` mode) gets one `malformedSourceSetting` report at line
 *   1, is read as unset, all of it, and never makes a rule throw.
 * - **An unknown source is reported, not guessed.** Every import from any
 *   other package, named, default, or namespace, under any local name, is a
 *   source the rules cannot classify. With `unknownSources: 'report'`, the
 *   default, a title-shaped call through it (a string or template title,
 *   then a function) gets one `unknownTestSource` report, at its import,
 *   once per import, and no other report. A call with no title before its
 *   function (`pMap(xs, fn)`, `debounce(fn, 10)`, `effect(fn)`) gets none:
 *   that is the precision law. A call to a relative helper that makes a
 *   title-shaped call gets the report at the call. `unknownSources: 'test'`
 *   reads a framework's name as the framework's and any other export as
 *   none, and `'ignore'` reads every export as none. The report is owed in
 *   an `oracle-` machinery file too, where `no-unit-test` judges nothing
 *   else, because there `no-disabled` alone guards a switched-off law.
 * - **A body may come first.** A framework's test function called with its
 *   function before any title (`test(fn)`, `test(fn, 10)`,
 *   `test.skip(condition, 'description')`) or after data (`test([1], fn)`)
 *   is a registration.
 *
 * What each rule owes for a call is the account of `lint.registration-only`
 * and `lint.test-function-agreement`: `unitTest` for a test (not a suite),
 * `only`, `conditional`, or `skip` from `no-disabled` (in that order of
 * precedence), and `rawProperty` for `.prop`. A call to a relative helper
 * that registers a test of its own gets `importedRegistration`.
 *
 * Authority: the decisions recorded in the repository README, "Decisions":
 * the maintainer decision of 2026-11-12 ("agree with reversed decision --
 * false positives are annoying and we should be able to be precise"), which
 * replaces the coordinator decision of 2026-11-11 that failed closed on any
 * package's import of a test-function name, and sets `unknownSources` to
 * `'report'` by default; and the coordinator's decisions under it, of the
 * same day, that an unknown source is judged by the call's title shape, not
 * by its name, and that a registration's body may come first. The framework rows come from
 * each package's own files, as the research of 2026-11-12 read them (each
 * row cites its source: a `package.json` `exports`, a `.d.ts`, or the
 * framework's documentation). The no-disabled and registration accounts are
 * the D2 law of `lint.registration-only` and the no-disabled rule's header.
 *
 * The model is the table below, written from those sources. It never reads
 * production's tables: the two copies of the facts are meant to be compared.
 *
 * Production paths: a long-lived ESLint instance with the plugin's
 * `recommended` config and the history's settings, and a single-file
 * `Linter` call. The observation is the sorted `line:rule:messageId` keys of
 * the three rules on each path, and the slower path's time against the
 * budget.
 *
 * Limits (the README's "Decisions" lists the accepted ones): one oracle file
 * per history, with fixed workspace and package fixtures. A test function
 * passed as a parameter (`t.test` in a body, `it.layer(L)(name, (it) =>
 * ...)`), QUnit's `test.if(name, condition, fn)`, Japa's chain after the
 * call (`test('n').skip(true)`), an options object that disables a test
 * (`{ skip: true }`), a dynamic `import()`, TypeScript `paths` aliases, a
 * nested `exports` condition other than `import` and `default`, a workspace
 * package that exports only built files that do not exist, and a published
 * workspace package's `src/` (production, which no rule reads) are not
 * generated or not recognized. An unknown source's untitled call is silent
 * by law, and its title-shaped call that is no test (`step('install', fn)`)
 * is reported by law. The parse cost of a fresh process is not observed.
 * The version of each row is the one its citation names.
 */
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import tsParser from '@typescript-eslint/parser'
import { ESLint, Linter } from 'eslint'
import fc from 'fast-check'
import { afterAll, beforeAll } from 'vitest'
import { differs, oracleProperty, pass } from '@tanstack/oracles'
import oraclePlugin from '../src/index.js'
import { lintCharged, lintChargedAsync } from './lint-observation.js'

const LAW = `test sources`
const RULES = [
  `oracle/no-unit-test`,
  `oracle/no-disabled`,
  `oracle/oracle-property-only`,
]

// -- Model: what follows a test function's root --------------------------------
//
// A chain is the members and arguments between a root and its call. Its
// effects say what the chain does: `skip`, `only`, or `condition` switch the
// test off, `prop` makes a raw property, `suite` makes the call a suite
// (Playwright's `test.describe`), and `nothing` makes it no registration
// (`test.step`). A chain with no effect keeps the registration.

// The arguments of the call, by shape. A title-shaped call passes a string
// title first and a function after it, as every framework's registration
// does; the other shapes pass a function in another position, as node:test's
// `test(fn)` and Playwright's `test.skip(condition, description)` do, or as
// a library's `pMap(xs, fn)`, `debounce(fn, 10)`, and `effect(fn)` do.
const SHAPES = {
  title: (b, table) => (table ? `'n %s', ${b.row}` : `'n', ${b.body}`),
  'fn-first': (b, table) => (table ? `${b.row}, 'n %s'` : `${b.body}, 'n'`),
  'data-first': (b) => `[1], ${b.body}`,
  'fn-only': (b) => b.body,
  'fn-number': (b) => `${b.body}, 10`,
}
const plainCall = (members) => (c, b, args) =>
  `${c}${members}(${args(b, false)})`
const curried = (member, argument) => (c, b, args) =>
  `${c}.${member}(${argument})(${args(b, false)})`
const tabled = (member) => (c, b, args) =>
  `${c}.${member}([1])(${args(b, true)})`

const CHAINS = {
  none: { render: plainCall(``), effects: [] },
  skip: { render: plainCall(`.skip`), effects: [`skip`] },
  todo: { render: plainCall(`.todo`), effects: [`skip`] },
  fixme: { render: plainCall(`.fixme`), effects: [`skip`] },
  ignore: { render: plainCall(`.ignore`), effects: [`skip`] },
  only: { render: plainCall(`.only`), effects: [`only`] },
  concurrent: { render: plainCall(`.concurrent`), effects: [] },
  sequential: { render: plainCall(`.sequential`), effects: [] },
  shuffle: { render: plainCall(`.shuffle`), effects: [] },
  fails: { render: plainCall(`.fails`), effects: [] },
  failing: { render: plainCall(`.failing`), effects: [] },
  fail: { render: plainCall(`.fail`), effects: [] },
  serial: { render: plainCall(`.serial`), effects: [] },
  expectFailure: { render: plainCall(`.expectFailure`), effects: [] },
  effect: { render: plainCall(`.effect`), effects: [] },
  live: { render: plainCall(`.live`), effects: [] },
  'concurrent.only': {
    render: plainCall(`.concurrent.only`),
    effects: [`only`],
  },
  'concurrent.failing': {
    render: plainCall(`.concurrent.failing`),
    effects: [],
  },
  'only.failing': { render: plainCall(`.only.failing`), effects: [`only`] },
  'fail.only': { render: plainCall(`.fail.only`), effects: [`only`] },
  'serial.only': { render: plainCall(`.serial.only`), effects: [`only`] },
  'effect.skip': { render: plainCall(`.effect.skip`), effects: [`skip`] },
  each: { render: tabled(`each`), effects: [] },
  for: { render: tabled(`for`), effects: [] },
  prop: { render: tabled(`prop`), effects: [`prop`] },
  skipIf: { render: curried(`skipIf`, `true`), effects: [`condition`] },
  runIf: { render: curried(`runIf`, `false`), effects: [`condition`] },
  if: { render: curried(`if`, `false`), effects: [`condition`] },
  todoIf: { render: curried(`todoIf`, `true`), effects: [`condition`] },
  failingIf: { render: curried(`failingIf`, `true`), effects: [] },
  extend: { render: curried(`extend`, `{}`), effects: [] },
  override: { render: curried(`override`, `{}`), effects: [] },
  scoped: { render: curried(`scoped`, `{}`), effects: [] },
  describe: { render: plainCall(`.describe`), effects: [`suite`] },
  'describe.only': {
    render: plainCall(`.describe.only`),
    effects: [`suite`, `only`],
  },
  'describe.skip': {
    render: plainCall(`.describe.skip`),
    effects: [`suite`, `skip`],
  },
  'describe.fixme': {
    render: plainCall(`.describe.fixme`),
    effects: [`suite`, `skip`],
  },
  'describe.serial': {
    render: plainCall(`.describe.serial`),
    effects: [`suite`],
  },
  'describe.parallel': {
    render: plainCall(`.describe.parallel`),
    effects: [`suite`],
  },
  'describe.configure': {
    render: (c) => `${c}.describe.configure({ mode: 'serial' })`,
    effects: [`nothing`],
  },
  step: { render: plainCall(`.step`), effects: [`nothing`] },
  'step.skip': { render: plainCall(`.step.skip`), effects: [`nothing`] },
}

// The vocabularies, from each framework's types.
const VITEST_TEST = [
  `none`,
  `skip`,
  `only`,
  `todo`,
  `concurrent`,
  `sequential`,
  `fails`,
  `each`,
  `for`,
  `skipIf`,
  `runIf`,
  `extend`,
  `override`,
  `scoped`,
  `concurrent.only`,
]
const VITEST_SUITE = [
  `none`,
  `skip`,
  `only`,
  `todo`,
  `concurrent`,
  `shuffle`,
  `each`,
  `skipIf`,
  `runIf`,
]
const VITEST_BENCH = [`none`, `skip`, `only`, `todo`, `skipIf`, `runIf`]
const JEST_TEST = [
  `none`,
  `skip`,
  `only`,
  `todo`,
  `each`,
  `failing`,
  `concurrent`,
  `concurrent.only`,
  `concurrent.failing`,
  `only.failing`,
]
const JEST_SUITE = [`none`, `skip`, `only`, `each`]
const PW_TEST = [
  `none`,
  `only`,
  `skip`,
  `fixme`,
  `fail`,
  `fail.only`,
  `extend`,
  `describe`,
  `describe.only`,
  `describe.skip`,
  `describe.fixme`,
  `describe.serial`,
  `describe.parallel`,
  `describe.configure`,
  `step`,
  `step.skip`,
]
const MOCHA = [`none`, `only`, `skip`]
const NODE_TEST = [`none`, `skip`, `todo`, `only`, `expectFailure`]
const AVA = [
  `none`,
  `serial`,
  `only`,
  `skip`,
  `failing`,
  `todo`,
  `skipIf`,
  `runIf`,
  `serial.only`,
]
const BUN_TEST = [
  `none`,
  `only`,
  `skip`,
  `todo`,
  `failing`,
  `concurrent`,
  `serial`,
  `each`,
  `if`,
  `skipIf`,
  `todoIf`,
  `failingIf`,
]
const BUN_SUITE = [`none`, `only`, `skip`, `todo`, `each`, `if`, `skipIf`]
const EFFECT_TESTER = [
  `none`,
  `skip`,
  `only`,
  `each`,
  `fails`,
  `skipIf`,
  `runIf`,
]
const DENO = [`none`, `only`, `ignore`]
const QUNIT_TEST = [`none`, `only`, `skip`, `todo`, `each`]
const QUNIT_MODULE = [`none`, `only`, `skip`, `todo`]
const NONE = [`none`]
const REGEX_LIB_TEST = [`none`, `skip`, `only`, `each`, `skipIf`, `extend`]
const REGEX_LIB_SUITE = [`none`, `skip`, `only`, `each`]

// -- Model: the sources --------------------------------------------------------
//
// An entry is one way to reach a test function from a source: the export it
// imports (`import`), the expression that makes the root from that binding
// (`expr`, `R` for the export itself), and its role: `test` or `suite`, with
// a modifier it carries, and the chains it takes. A role of `none` is no
// test function.

const testRole = (chains, carries) => ({ kind: `test`, chains, carries })
const suiteRole = (chains, carries) => ({ kind: `suite`, chains, carries })
const noRole = { kind: `none`, chains: NONE }

/** An entry: its label, role, and, unless the label says it, its import and root expression. */
function entry(label, role, options = {}) {
  const [imported, ...rest] = label.split(`.`)
  const tail = rest.length === 0 ? `` : `.${rest.join(`.`)}`
  return {
    label,
    role,
    import: options.import ?? imported,
    expr: options.expr ?? ((binding) => `${binding}${tail}`),
    identity: options.expr === undefined && rest.length === 0,
    helper: options.helper ?? false,
  }
}

const vitestEntries = [
  entry(`it`, testRole(VITEST_TEST)),
  entry(`test`, testRole(VITEST_TEST)),
  entry(`bench`, testRole(VITEST_BENCH)),
  entry(`describe`, suiteRole(VITEST_SUITE)),
  entry(`suite`, suiteRole(VITEST_SUITE)),
]
const playwrightEntries = [
  entry(`test`, testRole(PW_TEST)),
  entry(`default`, testRole(PW_TEST)),
  entry(`mergeTests()`, testRole([`none`, `skip`, `only`]), {
    import: `mergeTests`,
    expr: (binding) => `${binding}()`,
  }),
]
const nodeTestEntries = [
  entry(`default`, testRole(NODE_TEST)),
  entry(`test`, testRole(NODE_TEST)),
  entry(`it`, testRole(NODE_TEST)),
  entry(`describe`, suiteRole(NODE_TEST)),
  entry(`suite`, suiteRole(NODE_TEST)),
  entry(`skip`, testRole(NONE, `skip`)),
  entry(`todo`, testRole(NONE, `skip`)),
  entry(`only`, testRole(NONE, `only`)),
  entry(`expectFailure`, testRole(NONE)),
]
const stdTestingEntries = [
  entry(`describe`, suiteRole([`none`, `only`, `skip`, `ignore`])),
  entry(`it`, testRole([`none`, `only`, `skip`, `ignore`])),
  entry(`test`, testRole([`none`, `only`, `skip`, `ignore`])),
]
const PW_FIXTURE_TEST = [
  `none`,
  `only`,
  `skip`,
  `fixme`,
  `fail`,
  `describe`,
  `step`,
]
// A project's fixtures module: Playwright's test re-exported, a fixture, a
// skip wrapper, and an ordinary helper.
const fixtureEntries = [
  entry(`test`, testRole(PW_FIXTURE_TEST)),
  entry(`authTest`, testRole(PW_FIXTURE_TEST), { helper: true }),
  entry(`skippedTest`, testRole(NONE, `skip`)),
  entry(`helper`, noRole),
]
const FIXTURES_MODULE = [
  `import { test as base } from '@playwright/test'`,
  `export { test } from '@playwright/test'`,
  `export const authTest = base.extend({})`,
  `export const skippedTest = base.skip`,
  `export function helper(name, fn) {`,
  `  return [name, fn]`,
  `}`,
  ``,
].join(`\n`)

/**
 * Each source: its specifier, its class (`framework`, `global`, `project`,
 * `package` for a third-party fixture package, `non-test`, or `unknown`),
 * its entries, and the citation the row comes from.
 */
const SOURCES = [
  {
    id: `vitest`,
    spec: `vitest`,
    class: `framework`,
    entries: [
      ...vitestEntries.slice(0, 1).map((e) => ({ ...e, helper: true })),
      ...vitestEntries.slice(1),
    ],
    cite: `vitest 4.1.12 dist/index.d.ts (bench at line 22), @vitest/runner tasks.d.ts lines 720, 968, 978, 1203; vitest 5.1.0 config.d.ts lines 2715-2970`,
  },
  {
    id: `@vitest/runner`,
    spec: `@vitest/runner`,
    class: `framework`,
    entries: [
      ...vitestEntries.filter((e) => e.label !== `bench`),
      entry(`createTaskCollector()`, testRole([`none`, `skip`, `only`]), {
        import: `createTaskCollector`,
        expr: (binding) => `${binding}(() => {})`,
      }),
    ],
    cite: `@vitest/runner 4.1.11 .d.ts exports (createTaskCollector, describe, it, suite, test)`,
  },
  {
    id: `vite-plus/test`,
    spec: `vite-plus/test`,
    class: `framework`,
    entries: vitestEntries,
    cite: `vite-plus 1.5.0 dist/test/index.d.ts: export * from 'vitest'`,
  },
  {
    id: `@fast-check/vitest`,
    spec: `@fast-check/vitest`,
    class: `framework`,
    entries: [
      entry(`it`, testRole([...VITEST_TEST, `prop`])),
      entry(`test`, testRole([...VITEST_TEST, `prop`])),
    ],
    cite: `@fast-check/vitest 0.5.0 lib/vitest-fast-check.d.ts`,
  },
  {
    id: `@fast-check/jest`,
    spec: `@fast-check/jest`,
    class: `framework`,
    entries: [
      entry(`it`, testRole([...JEST_TEST, `prop`])),
      entry(`test`, testRole([...JEST_TEST, `prop`])),
    ],
    cite: `@fast-check/jest 2.3.0 lib/jest-fast-check.d.ts`,
  },
  {
    id: `@fast-check/ava`,
    spec: `@fast-check/ava`,
    class: `framework`,
    entries: [entry(`test`, testRole(AVA)), entry(`testProp`, testRole(NONE))],
    cite: `@fast-check/ava 3.0.1 lib/ava-fast-check.d.ts`,
  },
  {
    id: `@effect/vitest`,
    spec: `@effect/vitest`,
    class: `framework`,
    entries: [
      entry(`it`, testRole([...VITEST_TEST, `effect`, `live`, `effect.skip`])),
      entry(`test`, testRole(VITEST_TEST)),
      entry(`describe`, suiteRole(VITEST_SUITE)),
      entry(`effect`, testRole(EFFECT_TESTER)),
      entry(`live`, testRole(EFFECT_TESTER)),
      entry(`scoped`, testRole(EFFECT_TESTER)),
      entry(`scopedLive`, testRole(EFFECT_TESTER)),
      entry(`describeWrapped`, suiteRole(NONE)),
    ],
    cite: `@effect/vitest 4.1.2 dist/index.d.ts lines 20-335; 0.29.0 dist/dts/index.d.ts lines 93-210 (scoped, scopedLive)`,
  },
  {
    id: `@playwright/test`,
    spec: `@playwright/test`,
    class: `framework`,
    entries: playwrightEntries,
    cite: `@playwright/test 1.65.0 index.mjs; playwright types/test.d.ts lines 2809-7249, 9374-9397`,
  },
  {
    id: `playwright/test`,
    spec: `playwright/test`,
    class: `framework`,
    entries: playwrightEntries,
    cite: `playwright 1.65.0 test.mjs lines 30-35`,
  },
  {
    id: `@playwright/experimental-ct-react`,
    spec: `@playwright/experimental-ct-react`,
    class: `framework`,
    entries: [entry(`test`, testRole(PW_TEST))],
    cite: `@playwright/experimental-ct-react 1.62.1 index.d.ts line 37`,
  },
  {
    id: `@playwright/experimental-ct-vue`,
    spec: `@playwright/experimental-ct-vue`,
    class: `framework`,
    entries: [entry(`test`, testRole(PW_TEST))],
    cite: `@playwright/experimental-ct-vue 1.62.1 (same shape as ct-react)`,
  },
  {
    id: `@jest/globals`,
    spec: `@jest/globals`,
    class: `framework`,
    entries: [
      entry(`it`, testRole(JEST_TEST)),
      entry(`test`, testRole(JEST_TEST)),
      entry(`fit`, testRole([`none`, `each`], `only`)),
      entry(`xit`, testRole([`none`, `each`], `skip`)),
      entry(`xtest`, testRole([`none`, `each`], `skip`)),
      entry(`describe`, suiteRole(JEST_SUITE)),
      entry(`fdescribe`, suiteRole([`none`, `each`], `only`)),
      entry(`xdescribe`, suiteRole([`none`, `each`], `skip`)),
    ],
    cite: `@jest/globals 30.5.2 build/index.d.ts; @jest/types build/index.d.ts lines 458-869, 1131-1143`,
  },
  {
    id: `jest-each`,
    spec: `jest-each`,
    class: `framework`,
    entries: [
      entry(`each().test`, testRole(NONE), {
        import: `default`,
        expr: (binding) => `${binding}([[1]]).test`,
      }),
      entry(`each().it`, testRole(NONE), {
        import: `default`,
        expr: (binding) => `${binding}([[1]]).it`,
      }),
      entry(`each().xit`, testRole(NONE, `skip`), {
        import: `default`,
        expr: (binding) => `${binding}([[1]]).xit`,
      }),
      entry(`each().describe`, suiteRole(NONE), {
        import: `default`,
        expr: (binding) => `${binding}([[1]]).describe`,
      }),
    ],
    cite: `jest-each 30.5.2 build/index.d.ts (export default each)`,
  },
  {
    id: `mocha`,
    spec: `mocha`,
    class: `framework`,
    entries: [
      entry(`describe`, suiteRole(MOCHA)),
      entry(`suite`, suiteRole(MOCHA)),
      entry(`it`, testRole(MOCHA)),
      entry(`test`, testRole(MOCHA)),
      entry(`xit`, testRole(NONE, `skip`)),
      entry(`xdescribe`, suiteRole(NONE, `skip`)),
    ],
    cite: `mocha 12.0.3 lib/mocha.cjs lines 106-157`,
  },
  {
    id: `mocha-steps`,
    spec: `mocha-steps`,
    class: `framework`,
    entries: [
      entry(`step`, testRole(NONE)),
      entry(`xstep`, testRole(NONE, `skip`)),
    ],
    cite: `mocha-steps 1.3.0 lib/step.js lines 1, 87`,
  },
  {
    id: `node:test`,
    spec: `node:test`,
    class: `framework`,
    entries: nodeTestEntries,
    cite: `@types/node 26.6.6 test.d.ts lines 47-153, 2557; https://nodejs.org/api/test.html`,
  },
  {
    id: `test`,
    spec: `test`,
    class: `framework`,
    entries: nodeTestEntries,
    cite: `test 3.3.0 lib/test.js line 7 ("Node.js 18's node:test, as an npm package")`,
  },
  {
    id: `ava`,
    spec: `ava`,
    class: `framework`,
    entries: [entry(`default`, testRole(AVA))],
    cite: `ava 8.4.0 entrypoints/main.d.ts, types/test-fn.d.ts lines 104-257`,
  },
  {
    id: `tap`,
    spec: `tap`,
    class: `framework`,
    entries: [
      entry(`default.test`, testRole(NONE)),
      entry(`default.skip`, testRole(NONE, `skip`)),
      entry(`default.only`, testRole(NONE, `only`)),
      entry(`t.test`, testRole(NONE)),
      entry(`t.todo`, testRole(NONE, `skip`)),
      entry(`test`, testRole(NONE)),
      entry(`skip`, testRole(NONE, `skip`)),
      entry(`only`, testRole(NONE, `only`)),
      entry(`todo`, testRole(NONE, `skip`)),
    ],
    cite: `tap 21.8.1 dist/esm/index.d.ts, dist/esm/main.d.ts line 6`,
  },
  {
    id: `tape`,
    spec: `tape`,
    class: `framework`,
    entries: [
      entry(`default`, testRole([`none`, `skip`, `only`])),
      entry(`test`, testRole([`none`, `skip`, `only`])),
      entry(`skip`, testRole(NONE, `skip`)),
      entry(`only`, testRole(NONE, `only`)),
    ],
    cite: `tape 5.10.3 index.js lines 216-231`,
  },
  {
    id: `zora`,
    spec: `zora`,
    class: `framework`,
    entries: [
      entry(`test`, testRole(NONE)),
      entry(`only`, testRole(NONE, `only`)),
      entry(`skip`, testRole(NONE, `skip`)),
    ],
    cite: `zora 6.0.4 dist/index.d.ts lines 129-165`,
  },
  {
    id: `brittle`,
    spec: `brittle`,
    class: `framework`,
    entries: [
      entry(`default`, testRole(NONE)),
      entry(`test`, testRole(NONE)),
      entry(`solo`, testRole(NONE, `only`)),
      entry(`skip`, testRole(NONE, `skip`)),
      entry(`todo`, testRole(NONE, `skip`)),
    ],
    cite: `brittle 4.5.0 index.js lines 941-953, 1000-1052`,
  },
  {
    id: `uvu`,
    spec: `uvu`,
    class: `framework`,
    entries: [
      entry(`test`, testRole([`none`, `only`, `skip`])),
      entry(`suite()`, testRole([`none`, `only`, `skip`]), {
        import: `suite`,
        expr: (binding) => `${binding}('S')`,
      }),
    ],
    cite: `uvu 0.5.6 index.d.ts`,
  },
  {
    id: `bun:test`,
    spec: `bun:test`,
    class: `framework`,
    entries: [
      entry(`test`, testRole(BUN_TEST)),
      entry(`it`, testRole(BUN_TEST)),
      entry(`xtest`, testRole(NONE, `skip`)),
      entry(`xit`, testRole(NONE, `skip`)),
      entry(`describe`, suiteRole(BUN_SUITE)),
      entry(`xdescribe`, suiteRole(NONE, `skip`)),
    ],
    cite: `bun-types 1.4.4 test.d.ts lines 16, 263-283, 303-312, 559, 618-629`,
  },
  {
    id: `@std/testing/bdd`,
    spec: `@std/testing/bdd`,
    class: `framework`,
    entries: stdTestingEntries,
    cite: `https://jsr.io/@std/testing/doc/bdd/~ (1.0.21)`,
  },
  {
    id: `jsr:@std/testing/bdd`,
    spec: `jsr:@std/testing@^1.0.21/bdd`,
    class: `framework`,
    entries: stdTestingEntries,
    cite: `https://jsr.io/@std/testing/doc/bdd/~ (1.0.21)`,
  },
  {
    id: `qunit`,
    spec: `qunit`,
    class: `framework`,
    entries: [
      entry(`default.test`, testRole(QUNIT_TEST)),
      entry(`default.module`, suiteRole(QUNIT_MODULE)),
      entry(`QUnit.test`, testRole(QUNIT_TEST)),
      entry(`test`, testRole(QUNIT_TEST)),
      entry(`module`, suiteRole(QUNIT_MODULE)),
      entry(`only`, testRole(NONE, `only`)),
      entry(`skip`, testRole(NONE, `skip`)),
      entry(`todo`, testRole(NONE, `skip`)),
    ],
    cite: `qunit 3.0.0 qunit/esm/qunit.module.js line 7298; @types/qunit lines 561-905`,
  },
  {
    id: `@japa/runner`,
    spec: `@japa/runner`,
    class: `framework`,
    entries: [entry(`test`, testRole(NONE))],
    cite: `@japa/runner 5.4.0 build/index.d.ts`,
  },
  {
    id: `@hapi/lab`,
    spec: `@hapi/lab`,
    class: `framework`,
    entries: [
      entry(`script().test`, testRole([`none`, `skip`, `only`]), {
        import: `script`,
        expr: (binding) => `${binding}().test`,
      }),
      entry(`script().it`, testRole([`none`, `skip`, `only`]), {
        import: `script`,
        expr: (binding) => `${binding}().it`,
      }),
      entry(`script().describe`, suiteRole([`none`, `skip`, `only`]), {
        import: `script`,
        expr: (binding) => `${binding}().describe`,
      }),
      entry(`script().experiment`, suiteRole([`none`, `skip`, `only`]), {
        import: `script`,
        expr: (binding) => `${binding}().experiment`,
      }),
    ],
    cite: `@hapi/lab 26.0.1 lib/index.js lines 37-72`,
  },
  // The globals of the test environments: Vitest's `globals`, Jest's,
  // Mocha's, and Jasmine's, as the `globals` package (17.14.0) lists them,
  // and the namespace globals of Deno and QUnit.
  {
    id: `globals`,
    class: `global`,
    entries: [
      entry(`it`, testRole([`none`, `only`, `skip`, `each`])),
      entry(`test`, testRole([`none`, `only`, `skip`, `each`])),
      entry(`specify`, testRole(MOCHA)),
      entry(`xit`, testRole(NONE, `skip`)),
      entry(`xtest`, testRole(NONE, `skip`)),
      entry(`xspecify`, testRole(NONE, `skip`)),
      entry(`fit`, testRole(NONE, `only`)),
      entry(`describe`, suiteRole([`none`, `only`, `skip`, `each`])),
      entry(`suite`, suiteRole(MOCHA)),
      entry(`context`, suiteRole(MOCHA)),
      entry(`xdescribe`, suiteRole(NONE, `skip`)),
      entry(`xcontext`, suiteRole(NONE, `skip`)),
      entry(`fdescribe`, suiteRole(NONE, `only`)),
    ],
    cite: `globals 17.14.0 globals.json (vitest, jest, mocha, jasmine); vitest globals.d.ts`,
  },
  {
    id: `Deno`,
    class: `global`,
    entries: [entry(`Deno.test`, testRole(DENO))],
    cite: `https://docs.deno.com/api/deno/~/Deno.test`,
  },
  {
    id: `QUnit`,
    class: `global`,
    entries: [
      entry(`QUnit.test`, testRole(QUNIT_TEST)),
      entry(`QUnit.module`, suiteRole(QUNIT_MODULE)),
    ],
    cite: `globals 17.14.0 globals.json (qunit); @types/qunit`,
  },
  // The project's own fixtures: a workspace package, linked into
  // node_modules, and a `#` import of the package beside the oracle file.
  {
    id: `@acme/fixtures`,
    spec: `@acme/fixtures`,
    class: `project`,
    entries: fixtureEntries,
    cite: `the workspace written by this oracle (packages/fixtures)`,
  },
  {
    id: `#test/fixtures`,
    spec: `#test/fixtures`,
    class: `project`,
    entries: fixtureEntries,
    cite: `the package.json imports written by this oracle`,
  },
  // `#` imports whose `imports` target is a package: classified as the
  // package is.
  {
    id: `#vitest`,
    spec: `#vitest`,
    class: `framework`,
    entries: vitestEntries,
    cite: `the package.json imports written by this oracle ("#vitest": "vitest")`,
  },
  {
    id: `#ramda`,
    spec: `#ramda`,
    class: `non-test`,
    entries: [entry(`test`, noRole)],
    cite: `the package.json imports written by this oracle ("#ramda": "ramda")`,
  },
  // A fixture package in node_modules: never read, so only the settings
  // classify it. Its file is deliberately not what it claims.
  {
    id: `pw-fixtures`,
    spec: `pw-fixtures`,
    class: `package`,
    entries: [
      entry(`test`, testRole(PW_FIXTURE_TEST), { helper: true }),
      entry(`authTest`, testRole(PW_FIXTURE_TEST)),
    ],
    cite: `the node_modules package written by this oracle`,
  },
  // Libraries that are not test frameworks and export a test function's name.
  {
    id: `ramda`,
    spec: `ramda`,
    class: `non-test`,
    entries: [entry(`test`, noRole, { helper: true })],
    cite: `ramda 0.32.0 es/test.js`,
  },
  {
    id: `rambda`,
    spec: `rambda`,
    class: `non-test`,
    entries: [entry(`test`, noRole)],
    cite: `rambda 11.3.0 index.d.ts line 2287`,
  },
  {
    id: `mitata`,
    spec: `mitata`,
    class: `non-test`,
    entries: [entry(`bench`, noRole)],
    cite: `mitata 1.0.34 src/main.d.mts lines 69-91`,
  },
  {
    id: `@thi.ng/bench`,
    spec: `@thi.ng/bench`,
    class: `non-test`,
    entries: [entry(`bench`, noRole), entry(`suite`, noRole)],
    cite: `@thi.ng/bench 3.7.1 bench.d.ts line 10, suite.d.ts line 2`,
  },
  {
    id: `benny`,
    spec: `benny`,
    class: `non-test`,
    entries: [entry(`suite`, noRole)],
    cite: `benny 3.7.1 lib/index.d.ts line 8`,
  },
  {
    id: `remeda`,
    spec: `remeda`,
    class: `non-test`,
    entries: [entry(`only`, noRole)],
    cite: `remeda 2.58.0 dist/index.d.ts line 13147`,
  },
  {
    id: `@tensorflow/tfjs-core`,
    spec: `@tensorflow/tfjs-core`,
    class: `non-test`,
    entries: [entry(`step`, noRole)],
    cite: `@tensorflow/tfjs-core 4.22.0 dist/ops/ops.d.ts line 187`,
  },
  {
    id: `step`,
    spec: `step`,
    class: `non-test`,
    entries: [entry(`default`, noRole)],
    cite: `step 1.0.0 lib/step.js (module.exports = Step)`,
  },
  // A package that no table lists and that is not installed.
  {
    id: `regex-lib`,
    spec: `regex-lib`,
    class: `unknown`,
    entries: [
      entry(`test`, testRole(REGEX_LIB_TEST), { helper: true }),
      entry(`it`, testRole(REGEX_LIB_TEST)),
      entry(`bench`, testRole(REGEX_LIB_TEST)),
      entry(`describe`, suiteRole(REGEX_LIB_SUITE)),
      entry(`suite`, suiteRole(REGEX_LIB_SUITE)),
      entry(`xit`, testRole(NONE)),
      entry(`fit`, testRole(NONE)),
      entry(`skip`, testRole(NONE)),
      entry(`only`, testRole(NONE)),
      entry(`todo`, testRole(NONE)),
      entry(`step`, testRole(NONE)),
      entry(`context`, suiteRole(NONE)),
      entry(`testProp`, testRole(NONE)),
      entry(`effect`, testRole(NONE)),
      entry(`compute2`, testRole(NONE)),
      entry(`default`, testRole(NONE)),
    ],
    cite: `no package: the source that the rules cannot read`,
  },
  // An unknown package whose name is a member of every object's prototype.
  {
    id: `constructor`,
    spec: `constructor`,
    class: `unknown`,
    entries: [entry(`test`, testRole(REGEX_LIB_TEST))],
    cite: `no package: a specifier that a plain object lookup would find on Object.prototype`,
  },
]

/**
 * The names that some framework or test environment exports as a test
 * function or suite: every framework or global entry that is its export
 * itself. `unknownSources: 'test'` reads an unknown source's export of one
 * of these names as the framework's.
 */
const frameworkNameRoles = new Map()
for (const source of SOURCES) {
  if (source.class !== `framework` && source.class !== `global`) continue
  for (const e of source.entries)
    if (
      e.identity &&
      e.import !== `default` &&
      !frameworkNameRoles.has(e.import)
    )
      frameworkNameRoles.set(e.import, e.role)
}

const sourceById = new Map(SOURCES.map((source) => [source.id, source]))

/** The role that a framework row gives the export `name`, or none. */
function frameworkExportRole(sourceId, name) {
  const found = sourceById
    .get(sourceId)
    .entries.find((e) => e.identity && e.import === name)
  return found?.role ?? noRole
}

/**
 * The role of an entry under the history's settings: the settings first,
 * then the source's own class.
 */
function roleOf(source, e, settings) {
  if (source.id === `regex-lib` && settings.regexLib === `nonTest`)
    return noRole
  if (source.id === `regex-lib` && settings.regexLib === `vitest`)
    return e.identity ? frameworkExportRole(`vitest`, e.import) : noRole
  if (source.id === `pw-fixtures` && settings.pwFixtures === `playwright`)
    return frameworkExportRole(`@playwright/test`, e.import)
  if (source.id === `pw-fixtures` && settings.pwFixtures === `exports`)
    return testRole(NONE)
  if (source.class === `unknown` || source.class === `package`) {
    // Whatever the export and its local name: only the call's shape decides
    // (reportKeys).
    if (settings.unknownSources === `ignore`) return noRole
    if (settings.unknownSources === `test`)
      return frameworkNameRoles.get(e.import) ?? noRole
    return { kind: `unknown`, chains: e.role.chains }
  }
  return e.role
}

// -- Grammar ------------------------------------------------------------------
//
// A statement is one source, one way to bind it (`form`), one entry, and one
// chain. A form makes an import (deduplicated by what it imports, so a
// second statement reuses it) and the callee:
//
// - `named`, `default`, and `namespace` imports, `require(...)`, a relay
//   through a relative module (`export { x as r_x } from '<spec>'`), and a
//   global of the environment;
// - `helper`: a relative module whose function registers a test with the
//   entry, called with no arguments.
//
// A statement also has a shape (SHAPES) and a local name: `p`, the
// source's prefixed name (`n3_test`), `l`, a library's name (`pMap3_0`),
// or, for the unknown package's default import, `f`, a framework's name
// (`testProp`). The rules may not read the local name: a binding is what
// its source makes it.

const FORMS = [
  `named`,
  `default`,
  `namespace`,
  `require`,
  `relay`,
  `helper`,
  `global`,
]

function formsOf(source, e) {
  if (source.class === `global`) return [`global`]
  const forms =
    e.import === `default`
      ? [`default`, `namespace`, `relay`]
      : [`named`, `namespace`, `require`, `relay`]
  return e.helper ? [...forms, `helper`] : forms
}

/**
 * Every legal statement, as a key `source|form|entry|chain|shape|local`.
 * Each form takes each chain with a title and the prefixed name. The first
 * form of an entry also takes the other shapes (with no chain, and with
 * `.skip` where the entry has it), and a named or default import also takes
 * a library's local name.
 */
const STATEMENTS = SOURCES.flatMap((source, s) =>
  source.entries.flatMap((e, i) =>
    formsOf(source, e).flatMap((form, at) => {
      const key = (chainId, shape, local) =>
        `${s}|${form}|${i}|${chainId}|${shape}|${local}`
      if (form === `helper`) return [key(`none`, `title`, `p`)]
      const keys = e.role.chains.map((chainId) => key(chainId, `title`, `p`))
      if (at === 0)
        for (const shape of Object.keys(SHAPES).slice(1)) {
          keys.push(key(`none`, shape, `p`))
          if (shape === `fn-first` && e.role.chains.includes(`skip`))
            keys.push(key(`skip`, shape, `p`))
        }
      if (form === `named` || form === `default`)
        keys.push(key(`none`, `title`, `l`))
      if (source.id === `regex-lib` && form === `default`)
        keys.push(key(`none`, `title`, `f`))
      return keys
    }),
  ),
)

function parse(key) {
  const [s, form, i, chainId, shape, local] = key.split(`|`)
  const source = SOURCES[Number(s)]
  return {
    s: Number(s),
    source,
    form,
    e: source.entries[Number(i)],
    i: Number(i),
    chainId,
    shape,
    local,
  }
}

// `malformed` replaces part of the settings with a value that the rules
// cannot use: `settings.oracles` itself (null, a string, a number, an
// array), `testPackages` (an array, or an entry that names a member of
// every object's prototype as its framework), `nonTestPackages` (a string),
// or `unknownSources` (an unknown mode).
const SETTINGS = {
  unknownSources: [`report`, `test`, `ignore`],
  regexLib: [`default`, `nonTest`, `vitest`],
  pwFixtures: [`default`, `playwright`, `exports`],
  malformed: [
    `none`,
    `oracles null`,
    `oracles string`,
    `oracles number`,
    `oracles array`,
    `testPackages array`,
    `framework constructor`,
    `framework toString`,
    `nonTestPackages string`,
    `unknownSources mode`,
  ],
}
const DEFAULT_SETTINGS = {
  unknownSources: `report`,
  regexLib: `default`,
  pwFixtures: `default`,
  malformed: `none`,
}

/**
 * The setting that a malformation spoils, and the settings that the rules
 * then read: a malformed setting is read as unset, all of it, and a
 * malformed `settings.oracles` leaves every setting unset.
 */
function effectiveSettings(settings) {
  const { malformed } = settings
  if (malformed === `none`) return { settings, spoiled: undefined }
  if (malformed.startsWith(`oracles `))
    return { settings: DEFAULT_SETTINGS, spoiled: `oracles` }
  if (malformed === `testPackages array` || malformed.startsWith(`framework `))
    return {
      settings: {
        ...settings,
        regexLib:
          settings.regexLib === `vitest` ? `default` : settings.regexLib,
        pwFixtures: `default`,
      },
      spoiled: `testPackages`,
    }
  if (malformed === `nonTestPackages string`)
    return {
      settings: {
        ...settings,
        regexLib:
          settings.regexLib === `nonTest` ? `default` : settings.regexLib,
      },
      spoiled: `nonTestPackages`,
    }
  return {
    settings: { ...settings, unknownSources: `report` },
    spoiled: `unknownSources`,
  }
}

const weighted = (values) =>
  fc.oneof(
    { weight: 4, arbitrary: fc.constant(values[0]) },
    ...values
      .slice(1)
      .map((value) => ({ weight: 1, arbitrary: fc.constant(value) })),
  )

const MAX_STATEMENTS = 6
const historyArbitrary = fc.record({
  language: fc.constantFrom(`ts`, `js`),
  machinery: fc.oneof(
    { weight: 6, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
  settings: fc.record({
    unknownSources: weighted(SETTINGS.unknownSources),
    regexLib: weighted(SETTINGS.regexLib),
    pwFixtures: weighted(SETTINGS.pwFixtures),
    malformed: fc.oneof(
      { weight: 9, arbitrary: fc.constant(`none`) },
      { weight: 1, arbitrary: fc.constantFrom(...SETTINGS.malformed.slice(1)) },
    ),
  }),
  // The project's real path: a plain directory, or one under a node_modules
  // directory, as a project checked out inside another package's
  // node_modules is.
  root: fc.oneof(
    { weight: 4, arbitrary: fc.constant(`plain`) },
    { weight: 1, arbitrary: fc.constant(`under node_modules`) },
  ),
  statements: fc.array(fc.constantFrom(...STATEMENTS), {
    maxLength: MAX_STATEMENTS,
  }),
})

const safe = (name) => name.replace(/\W/g, `_`)
const BODIES = {
  test: { body: `() => { compute() }`, row: `(v) => { compute(v) }` },
  suite: {
    body: `() => { oracleProperty({ id: 'p', check: checkHistory }) }`,
    row: `(v) => { oracleProperty({ id: String(v), check: checkHistory }) }`,
  },
}
const HEADER = [
  `import { oracleProperty } from '@tanstack/oracles'`,
  `import { checkHistory, compute } from './plain.js'`,
]
const PLAIN = `export function compute() {\n  return 1\n}\nexport function checkHistory() {\n  return 1\n}\n`

/** The import that a statement needs: its key, line, and binding. */
function importOf({ s, source, form, e, i, local: name }) {
  const local = (prefix) =>
    name === `l` ? `pMap${s}_${i}` : `${prefix}${s}_${safe(e.import)}`
  switch (form) {
    case `named`: {
      const binding = local(`n`)
      return {
        key: `${form}|${s}|${e.import}|${name}`,
        line: `import { ${e.import} as ${binding} } from '${source.spec}'`,
        binding,
      }
    }
    case `default`: {
      const binding = name === `f` ? `testProp` : local(`d`)
      return {
        key: `${form}|${s}|${name}`,
        line: `import ${binding} from '${source.spec}'`,
        binding,
      }
    }
    case `namespace`: {
      const namespace = `ns${s}`
      return {
        key: `${form}|${s}`,
        line: `import * as ${namespace} from '${source.spec}'`,
        binding: `${namespace}.${e.import}`,
      }
    }
    case `require`: {
      const required = `rq${s}`
      return {
        key: `${form}|${s}`,
        line: `const ${required} = require('${source.spec}')`,
        binding: `${required}.${e.import}`,
      }
    }
    case `relay`: {
      const binding = local(`r`)
      return {
        key: `${form}|${s}|${e.import}`,
        line: `import { r_${safe(e.import)} as ${binding} } from './relay-${s}.js'`,
        binding,
      }
    }
    case `helper`: {
      const binding = `h${s}_${i}`
      return {
        key: `${form}|${s}|${i}`,
        line: `import { register_${i} as ${binding} } from './helper-${s}.js'`,
        binding,
      }
    }
    default:
      return { key: undefined, line: undefined, binding: e.import }
  }
}

/** The relay and helper modules of a source. */
function sourceModules(source, s) {
  if (source.spec === undefined) return []
  const imports = [...new Set(source.entries.map((e) => e.import))]
  const modules = [
    [
      `relay-${s}.js`,
      `export { ${imports.map((name) => `${name} as r_${safe(name)}`).join(`, `)} } from '${source.spec}'\n`,
    ],
  ]
  const helpers = source.entries
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.helper)
  if (helpers.length > 0)
    modules.push([
      `helper-${s}.js`,
      helpers
        .map(
          ({ e, i }) =>
            `import { ${e.import} as x_${i} } from '${source.spec}'\nexport function register_${i}() {\n  ${e.expr(`x_${i}`)}('inner', () => { void 0 })\n}\n`,
        )
        .join(``),
    ])
  return modules
}
const SOURCE_MODULES = SOURCES.flatMap(sourceModules)

/**
 * The lines of a history's oracle file, and for each statement the line of
 * its import and of its call.
 */
function layout(history) {
  const lines = [...HEADER]
  const importLines = new Map()
  const placed = history.statements.map((key) => {
    const statement = parse(key)
    const imported = importOf(statement)
    if (imported.key !== undefined && !importLines.has(imported.key)) {
      lines.push(imported.line)
      importLines.set(imported.key, lines.length)
    }
    const { e, form } = statement
    let text
    if (form === `helper`) text = `${imported.binding}()`
    else {
      const chainSpec = CHAINS[statement.chainId]
      const kind =
        chainSpec.effects.includes(`suite`) || e.role.kind === `suite`
          ? `suite`
          : `test`
      text = chainSpec.render(
        e.expr(imported.binding),
        BODIES[kind],
        SHAPES[statement.shape],
      )
    }
    lines.push(text)
    return {
      ...statement,
      importKey: imported.key,
      importLine: importLines.get(imported.key),
      callLine: lines.length,
    }
  })
  return { lines, placed }
}

const oracleName = (history) =>
  `${history.machinery ? `oracle-case` : `case-oracle`}.test.${history.language}`

function render(history) {
  return new Map([
    [`plain.js`, PLAIN],
    ...SOURCE_MODULES,
    [oracleName(history), `${layout(history).lines.join(`\n`)}\n`],
  ])
}

// -- Model --------------------------------------------------------------------

/** The reports that a call owes, as `rule:messageId` keys. */
function callReports(kind, carries, effects) {
  const reports = []
  if (kind === `test`) reports.push(`no-unit-test:unitTest`)
  const switches = [...(carries === undefined ? [] : [carries]), ...effects]
  const disabled = switches.includes(`only`)
    ? `only`
    : switches.includes(`condition`)
      ? `conditional`
      : switches.includes(`skip`)
        ? `skip`
        : undefined
  if (disabled !== undefined) reports.push(`no-disabled:${disabled}`)
  if (effects.includes(`prop`)) reports.push(`oracle-property-only:rawProperty`)
  return reports
}

function reportKeys(history) {
  const { settings, spoiled } = effectiveSettings(history.settings)
  const keys =
    spoiled === undefined ? [] : [`1:no-unit-test:malformedSourceSetting`]
  const diagnosed = new Set()
  for (const placed of layout(history).placed) {
    const role = roleOf(placed.source, placed.e, settings)
    if (role.kind === `none`) continue
    if (placed.form === `helper`) {
      // The helper registers a test of its own, or makes a call that the
      // rules cannot classify. A machinery file's helpers are not judged.
      if (history.machinery) continue
      if (role.kind === `unknown`)
        keys.push(`${placed.callLine}:no-unit-test:unknownTestSource`)
      else if (role.kind === `test`)
        keys.push(`${placed.callLine}:no-unit-test:importedRegistration`)
      continue
    }
    const { effects } = CHAINS[placed.chainId]
    if (effects.includes(`nothing`)) continue
    if (role.kind === `unknown`) {
      // Only a title-shaped call through an unknown source can be a
      // registration: `pMap(xs, fn)` and `effect(fn)` are not.
      if (placed.shape !== `title`) continue
      if (!diagnosed.has(placed.importKey)) {
        diagnosed.add(placed.importKey)
        keys.push(`${placed.importLine}:no-unit-test:unknownTestSource`)
      }
      continue
    }
    const kind = effects.includes(`suite`) ? `suite` : role.kind
    for (const report of callReports(kind, role.carries, effects)) {
      // A machinery file's tests are not judged as unit tests.
      if (history.machinery && report === `no-unit-test:unitTest`) continue
      keys.push(`${placed.callLine}:${report}`)
    }
  }
  return keys.sort()
}

function model(history) {
  return { keys: reportKeys(history), budget: `within ${BUDGET_MS} ms` }
}

// -- Production paths ---------------------------------------------------------

let scratch
const roots = {}
const instances = new Map()
// One Linter per project root: ESLint ignores files under node_modules
// below its cwd, so each path lints from the project's own root.
const linters = {}
let sequence = 0

/** The `settings.oracles` that a history's settings name. */
function settingsOf(settings) {
  const oracles = {}
  if (settings.unknownSources !== `report`)
    oracles.unknownSources = settings.unknownSources
  const testPackages = {}
  if (settings.regexLib === `vitest`) testPackages[`regex-lib`] = `vitest`
  if (settings.pwFixtures === `playwright`)
    testPackages[`pw-fixtures`] = `@playwright/test`
  if (settings.pwFixtures === `exports`)
    testPackages[`pw-fixtures`] = { test: `test`, authTest: `test` }
  if (Object.keys(testPackages).length > 0) oracles.testPackages = testPackages
  if (settings.regexLib === `nonTest`) oracles.nonTestPackages = [`regex-lib`]
  switch (settings.malformed) {
    case `oracles null`:
      return { oracles: null }
    case `oracles string`:
      return { oracles: `regex-lib` }
    case `oracles number`:
      return { oracles: 42 }
    case `oracles array`:
      return { oracles: [`regex-lib`] }
    case `testPackages array`:
      return { oracles: { ...oracles, testPackages: [] } }
    case `framework constructor`:
    case `framework toString`:
      return {
        oracles: {
          ...oracles,
          testPackages: {
            ...oracles.testPackages,
            'other-lib': settings.malformed.split(` `)[1],
          },
        },
      }
    case `nonTestPackages string`:
      return { oracles: { ...oracles, nonTestPackages: `regex-lib` } }
    case `unknownSources mode`:
      return { oracles: { ...oracles, unknownSources: `warn` } }
    default:
      return { oracles }
  }
}

function eslintFor(settings, root) {
  const key = JSON.stringify([settings, root])
  if (!instances.has(key))
    instances.set(
      key,
      new ESLint({
        cwd: roots[root],
        overrideConfigFile: true,
        overrideConfig: [
          { files: [`**/*.ts`], languageOptions: { parser: tsParser } },
          oraclePlugin.configs.recommended,
          { settings: settingsOf(settings) },
        ],
      }),
    )
  return instances.get(key)
}

const linterConfigFor = (settings) => [
  { files: [`**/*.ts`], languageOptions: { parser: tsParser } },
  {
    files: [`**/*.ts`, `**/*.js`],
    plugins: { oracle: oraclePlugin },
    settings: settingsOf(settings),
    rules: Object.fromEntries(RULES.map((rule) => [rule, `error`])),
  },
]

/**
 * The workspace beside every history: a package.json whose `imports` map
 * `#test/*`, the fixtures module that it names, a workspace package linked
 * into node_modules whose `exports` list a `types` entry before its source,
 * and a third-party package in node_modules whose file says that its `test`
 * is a plain function.
 */
function writeWorkspace(root) {
  writeFileSync(
    join(root, `package.json`),
    JSON.stringify({
      name: `scratch`,
      imports: {
        '#test/*': `./support/*.js`,
        '#vitest': `vitest`,
        '#ramda': `ramda`,
      },
    }),
  )
  mkdirSync(join(root, `support`))
  writeFileSync(join(root, `support`, `fixtures.js`), FIXTURES_MODULE)
  const workspace = join(root, `packages`, `fixtures`)
  mkdirSync(join(workspace, `src`), { recursive: true })
  writeFileSync(
    join(workspace, `package.json`),
    JSON.stringify({
      name: `@acme/fixtures`,
      private: true,
      exports: { '.': { types: `./src/index.d.ts`, import: `./src/index.js` } },
    }),
  )
  writeFileSync(join(workspace, `src`, `index.js`), FIXTURES_MODULE)
  writeFileSync(
    join(workspace, `src`, `index.d.ts`),
    `export declare const test: unknown\nexport declare const authTest: unknown\nexport declare const skippedTest: unknown\nexport declare function helper(): void\n`,
  )
  mkdirSync(join(root, `node_modules`, `@acme`), { recursive: true })
  symlinkSync(workspace, join(root, `node_modules`, `@acme`, `fixtures`), `dir`)
  const external = join(root, `node_modules`, `pw-fixtures`)
  mkdirSync(external)
  writeFileSync(
    join(external, `package.json`),
    JSON.stringify({ name: `pw-fixtures`, exports: { '.': `./index.js` } }),
  )
  writeFileSync(
    join(external, `index.js`),
    `export function test() {\n  return 1\n}\nexport const authTest = 1\n`,
  )
}

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), `test-source-oracle-`))
  roots.plain = join(scratch, `plain`)
  roots[`under node_modules`] = join(scratch, `node_modules`, `project`)
  for (const root of Object.values(roots)) {
    mkdirSync(root, { recursive: true })
    writeWorkspace(root)
  }
  for (const [name, root] of Object.entries(roots))
    linters[name] = new Linter({ configType: `flat`, cwd: root })
}, 60_000)
afterAll(() => rmSync(scratch, { recursive: true, force: true }), 60_000)

// The time that one lint may take on one path, as in the registration-only
// oracle: a lint takes milliseconds, so the budget rejects only a resolver
// that grows with the workspace or the call graph.
const BUDGET_MS = 2000

async function driver(history, observe) {
  const directory = join(roots[history.root], `h${sequence++}`)
  mkdirSync(directory)
  const files = render(history)
  for (const [name, text] of files) writeFileSync(join(directory, name), text)
  const file = join(directory, oracleName(history))
  const keysOf = (messages) =>
    messages
      .filter((message) => RULES.includes(message.ruleId))
      .map(
        (message) =>
          `${message.line}:${message.ruleId.replace(`oracle/`, ``)}:${message.messageId}`,
      )
      .sort()
  let started = performance.now()
  const instance = await lintChargedAsync(async () => {
    const [result] = await eslintFor(history.settings, history.root).lintFiles([
      file,
    ])
    return result.messages
  })
  const instanceMs = performance.now() - started
  started = performance.now()
  const single = lintCharged(() =>
    linters[history.root].verify(
      files.get(oracleName(history)),
      linterConfigFor(history.settings),
      {
        filename: file,
      },
    ),
  )
  const slowest = Math.max(instanceMs, performance.now() - started)
  const keys = (run) =>
    run.threw === undefined ? keysOf(run.messages) : [`threw:${run.threw}`]
  observe(`eslint`, keys(instance))
  observe(`linter`, keys(single))
  observe(
    `budget`,
    slowest <= BUDGET_MS
      ? `within ${BUDGET_MS} ms`
      : `over ${BUDGET_MS} ms: ${Math.round(slowest)} ms`,
  )
}

// -- Check ----------------------------------------------------------------------

/** Every path's keys equal the model's, exactly, and each lint ends within the budget. */
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
// Each source with each form, each entry, and each chain is a declared
// state, and so is each setting, two calls through one unknown import, a
// machinery file, and JavaScript. The constructed histories pack those
// states six statements at a time.

const formState = (source, form) => `${source.id} via ${form}`
const entryState = (source, e) => `${source.id} ${e.label}`
const chainState = (source, chainId) => `${source.id} with ${chainId}`
const shapeState = (source, shape) => `${source.id} shaped ${shape}`
const localState = (source, form, local) =>
  `${source.id} via ${form} named ${local}`
const ROOT_STATE = `project under a node_modules path`
const malformedState = (value) => `malformed ${value}`
const SETTING_STATES = {
  'unknown sources test': (h) => h.settings.unknownSources === `test`,
  'unknown sources ignore': (h) => h.settings.unknownSources === `ignore`,
  'regex-lib is no test package': (h) => h.settings.regexLib === `nonTest`,
  'regex-lib configured as vitest': (h) => h.settings.regexLib === `vitest`,
  'pw-fixtures configured as @playwright/test': (h) =>
    h.settings.pwFixtures === `playwright`,
  'pw-fixtures configured by exports': (h) =>
    h.settings.pwFixtures === `exports`,
}
const SETTING_SOURCE = {
  'unknown sources test': `regex-lib`,
  'unknown sources ignore': `regex-lib`,
  'regex-lib is no test package': `regex-lib`,
  'regex-lib configured as vitest': `regex-lib`,
  'pw-fixtures configured as @playwright/test': `pw-fixtures`,
  'pw-fixtures configured by exports': `pw-fixtures`,
}
const ONCE = `two calls through one unknown import`
const UNTITLED = `unknown calls without a title`

function statementStates(key) {
  const { source, form, e, chainId, shape, local } = parse(key)
  return [
    formState(source, form),
    entryState(source, e),
    chainState(source, chainId),
    shapeState(source, shape),
    localState(source, form, local),
  ]
}

const STATES = [
  ...new Set(STATEMENTS.flatMap(statementStates)),
  ...Object.keys(SETTING_STATES),
  ...SETTINGS.malformed.slice(1).map(malformedState),
  ONCE,
  UNTITLED,
  `machinery file`,
  `javascript under espree`,
  ROOT_STATE,
]

function reached(history) {
  const states = new Set(history.statements.flatMap(statementStates))
  const sources = new Set(history.statements.map((key) => parse(key).source.id))
  const { settings } = effectiveSettings(history.settings)
  for (const [state, holds] of Object.entries(SETTING_STATES))
    if (holds({ settings }) && sources.has(SETTING_SOURCE[state]))
      states.add(state)
  if (history.settings.malformed !== `none`)
    states.add(malformedState(history.settings.malformed))
  if (history.root !== `plain`) states.add(ROOT_STATE)
  const unknownImports = layout(history)
    .placed.filter(
      (placed) =>
        placed.form !== `helper` &&
        placed.shape === `title` &&
        !CHAINS[placed.chainId].effects.includes(`nothing`) &&
        roleOf(placed.source, placed.e, settings).kind === `unknown`,
    )
    .map((placed) => placed.importKey)
  if (new Set(unknownImports).size < unknownImports.length) states.add(ONCE)
  const placed = layout(history).placed
  if (
    placed.some(
      (statement) =>
        statement.source.class === `unknown` && statement.shape !== `title`,
    ) &&
    placed.every(
      (statement) =>
        statement.source.class !== `unknown` || statement.shape !== `title`,
    )
  )
    states.add(UNTITLED)
  if (history.machinery) states.add(`machinery file`)
  if (history.language === `js`) states.add(`javascript under espree`)
  return states
}

/** Statements that together enter every statement state, chosen greedily. */
function coveringStatements() {
  const uncovered = new Set(STATEMENTS.flatMap(statementStates))
  const chosen = []
  for (const key of STATEMENTS) {
    const states = statementStates(key)
    if (states.some((state) => uncovered.has(state))) {
      chosen.push(key)
      for (const state of states) uncovered.delete(state)
    }
  }
  return chosen
}

const sourceStatements = (id, form = `named`) =>
  STATEMENTS.filter((key) => {
    const statement = parse(key)
    return (
      statement.source.id === id &&
      statement.form === form &&
      statement.shape === `title` &&
      statement.local === `p`
    )
  })

function packed() {
  const chosen = coveringStatements()
  const groups = []
  for (let at = 0; at < chosen.length; at += MAX_STATEMENTS)
    groups.push(chosen.slice(at, at + MAX_STATEMENTS))
  return groups.map((statements, at) => ({
    name: `statements ${at}`,
    enters: [...new Set(statements.flatMap(statementStates))],
    build: (generated) => ({
      ...generated,
      machinery: false,
      settings: DEFAULT_SETTINGS,
      statements,
    }),
  }))
}

/**
 * A history whose settings are malformed one way, beside the valid
 * settings that the malformation spoils, so that a rule that reads part of
 * a malformed setting, or ignores the malformation, answers differently.
 */
function malformedConstruction(value) {
  const statements = [
    sourceStatements(`regex-lib`)[0],
    sourceStatements(`pw-fixtures`)[0],
    sourceStatements(`vitest`)[0],
  ]
  const spoiled =
    value === `nonTestPackages string`
      ? { regexLib: `nonTest` }
      : value === `unknownSources mode`
        ? { unknownSources: `ignore` }
        : { regexLib: `vitest`, pwFixtures: `playwright` }
  return {
    name: malformedState(value),
    enters: [malformedState(value)],
    build: (generated) => ({
      ...generated,
      settings: { ...DEFAULT_SETTINGS, ...spoiled, malformed: value },
      statements,
    }),
  }
}

// An unknown source's calls that pass a function but no title, with no
// title-shaped call beside them: none is a registration, so the history
// owes no report (the precision law).
const untitledStatements = STATEMENTS.filter((key) => {
  const { source, shape } = parse(key)
  return source.class === `unknown` && shape !== `title`
})

/** A history with one setting and statements of the source it governs. */
function settingConstruction(state) {
  const settings = {
    'unknown sources test': { unknownSources: `test` },
    'unknown sources ignore': { unknownSources: `ignore` },
    'regex-lib is no test package': { regexLib: `nonTest` },
    'regex-lib configured as vitest': { regexLib: `vitest` },
    'pw-fixtures configured as @playwright/test': { pwFixtures: `playwright` },
    'pw-fixtures configured by exports': { pwFixtures: `exports` },
  }[state]
  const pool = sourceStatements(SETTING_SOURCE[state])
  const stride = Math.max(1, Math.floor(pool.length / MAX_STATEMENTS))
  const statements = pool
    .filter((_, at) => at % stride === 0)
    .slice(0, MAX_STATEMENTS)
  return {
    name: state,
    enters: [state],
    build: (generated) => ({
      ...generated,
      machinery: false,
      settings: { ...DEFAULT_SETTINGS, ...settings },
      statements,
    }),
  }
}

const unknownTest = sourceStatements(`regex-lib`).find(
  (key) => parse(key).chainId === `none`,
)
const unknownSkip = sourceStatements(`regex-lib`).find(
  (key) =>
    parse(key).i === parse(unknownTest).i && parse(key).chainId === `skip`,
)

const constructed = [
  ...packed(),
  ...Object.keys(SETTING_STATES).map(settingConstruction),
  ...SETTINGS.malformed.slice(1).map(malformedConstruction),
  {
    name: UNTITLED,
    enters: [UNTITLED],
    build: (generated) => ({
      ...generated,
      settings: DEFAULT_SETTINGS,
      statements: untitledStatements.slice(0, MAX_STATEMENTS),
    }),
  },
  {
    name: ROOT_STATE,
    enters: [ROOT_STATE],
    build: (generated) => ({
      ...generated,
      root: `under node_modules`,
      settings: DEFAULT_SETTINGS,
      statements: [
        sourceStatements(`@acme/fixtures`)[0],
        sourceStatements(`#test/fixtures`)[0],
        sourceStatements(`pw-fixtures`)[0],
        sourceStatements(`regex-lib`, `relay`)[0],
        sourceStatements(`regex-lib`, `helper`)[0],
        sourceStatements(`vitest`, `relay`)[0],
      ],
    }),
  },
  {
    name: ONCE,
    enters: [ONCE],
    build: (generated) => ({
      ...generated,
      settings: DEFAULT_SETTINGS,
      statements: [unknownTest, unknownSkip],
    }),
  },
  {
    name: `machinery file`,
    enters: [`machinery file`],
    build: (generated) => ({
      ...generated,
      machinery: true,
      settings: DEFAULT_SETTINGS,
      statements: [
        sourceStatements(`vitest`)[0],
        unknownTest,
        sourceStatements(`regex-lib`, `helper`)[0],
        sourceStatements(`node:test`).find(
          (key) => parse(key).chainId === `skip`,
        ),
      ],
    }),
  },
  {
    name: `javascript under espree`,
    enters: [`javascript under espree`],
    build: (generated) => ({ ...generated, language: `js` }),
  },
]

/** Applies a change to the first list of keys that it affects, or none applies. */
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
  id: `lint.test-source-recognition`,
  law: {
    statement: `A callee is a test function by the source of its binding: a framework's export (named, default, namespace, require, relay, or global, with the modifier it carries and the factories that return one) is one, a known non-test library's export of the same name is none, a project's relative, # and workspace modules are read and node_modules packages never are, testPackages and nonTestPackages decide first, and an unknown source's title-shaped call (a string title, then a function), under any import and local name, gets one unknownTestSource report per import (or per helper call) unless unknownSources is test or ignore, while its untitled calls get none; a registration's body may come first; and a malformed source setting gets malformedSourceSetting, is read as unset, and never throws.`,
    authority: `README "Decisions": the maintainer decision of 2026-11-12 ("agree with reversed decision -- false positives are annoying and we should be able to be precise"), which replaces the fail-closed decision of 2026-11-11 and makes unknownSources default to report, and the coordinator decisions under it (title shape for unknown sources; a body in any argument position); each source row's citation (package exports, .d.ts, or the framework's documentation, read 2026-11-12); the D2 law of lint.registration-only and the no-disabled rule's header for what each rule owes a registration.`,
    limits: `One oracle file per history with fixed workspace fixtures. Not generated or not recognized: a test function passed as a parameter (t.test, it.layer), QUnit's test.if(name, condition, fn), Japa's chain after the call, a disabling options object, dynamic import(), TypeScript paths aliases, a nested exports condition other than import and default, a workspace package whose exports name missing built files, and a published package's src/ (production). An unknown source's untitled call is silent by law, and its title-shaped call that is no test is reported by law (README "Decisions"). The parse cost of a fresh process is not observed. Each row holds for the version its citation names.`,
  },
  histories: {
    arbitrary: historyArbitrary,
    runs: 40,
    fixedSeeds: [2261113],
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
      name: `a false positive on a receiving path`,
      law: LAW,
      corrupt: (trace) =>
        corruptFirst(trace, (keys) => [...keys, `0:no-unit-test:unitTest`]),
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
