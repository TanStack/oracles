/**
 * Where a test function can come from. The oracle rules cannot read a
 * package, so they know the packages that export test functions, and the
 * packages that export other functions under the same names, by these
 * tables. A project names its own packages in `settings.oracles`
 * (maintainer decision 2026-11-12: be precise, never guess).
 *
 * A role says what an export is:
 *
 * - `test` or `suite`, with a modifier that it carries after a dot
 *   (`test.skip` for Jest's `xit`, `suite.only` for `fdescribe`);
 * - `{ factory }`: a function whose call returns that role, as
 *   Playwright's `mergeTests()` returns a test function;
 * - `{ namespace }`: an object whose members have those roles, as tap's `t`
 *   or the `QUnit` object.
 *
 * Each framework's table is read from its own files: its `package.json`
 * `exports`, its declarations, or its documentation.
 */

/**
 * A table's argument grammar, on symbol keys that no export name can be:
 * `OPTIONAL_TITLE`, a framework whose registration takes a function first
 * when it has no title (node:test's `test(fn)`); `ANNOTATIONS`, Playwright,
 * whose `test.skip('reason')` switches the test that it runs in off. Any
 * other framework takes its body after the first argument.
 */
export const OPTIONAL_TITLE = Symbol(`optional title`)
export const ANNOTATIONS = Symbol(`annotations`)
const untitled = (table) => ({ ...table, [OPTIONAL_TITLE]: true })

const vitest = {
  it: `test`,
  test: `test`,
  bench: `test`,
  describe: `suite`,
  suite: `suite`,
}
// playwright 1.65.0 types/test.d.ts lines 4716-6306: `skip`, `fixme`,
// `fail`, and `slow` with `()`, `(description)`, `(condition,
// description?)`, or `(callback, description?)` annotate; only `(title,
// body)` and `(title, details, body)` register.
const playwright = {
  test: `test`,
  default: `test`,
  mergeTests: { factory: `test` },
  [ANNOTATIONS]: true,
}
// @types/node 26.6.6 test.d.ts lines 47-50: `test(fn)`, `test(options, fn)`.
const nodeTest = untitled({
  default: `test`,
  test: `test`,
  it: `test`,
  describe: `suite`,
  suite: `suite`,
  skip: `test.skip`,
  todo: `test.todo`,
  only: `test.only`,
  expectFailure: `test`,
})
const jest = {
  it: `test`,
  test: `test`,
  fit: `test.only`,
  xit: `test.skip`,
  xtest: `test.skip`,
  describe: `suite`,
  fdescribe: `suite.only`,
  xdescribe: `suite.skip`,
}
const stdTesting = { describe: `suite`, it: `test`, test: `test` }
const qunitObject = {
  namespace: {
    test: `test`,
    module: `suite`,
    only: `test.only`,
    skip: `test.skip`,
    todo: `test.todo`,
  },
}
// @tapjs/core 4.6.1 dist/esm/parse-test-args.d.ts line 10: `[cb]` alone.
const tapObject = {
  namespace: untitled({
    test: `test`,
    skip: `test.skip`,
    only: `test.only`,
    todo: `test.todo`,
  }),
}

/** The test frameworks, by exact specifier. */
export const frameworks = {
  // vitest 4.1.12 and 5.1.0 (5 no longer exports `bench`).
  vitest,
  '@vitest/runner': {
    ...vitest,
    createTaskCollector: { factory: `test` },
  },
  'vite-plus/test': vitest,
  '@fast-check/vitest': { it: `test`, test: `test` },
  '@fast-check/jest': { it: `test`, test: `test` },
  '@fast-check/ava': { test: `test`, testProp: `test` },
  '@effect/vitest': {
    ...vitest,
    effect: `test`,
    live: `test`,
    scoped: `test`,
    scopedLive: `test`,
    prop: `test`,
    layer: { factory: `suite` },
    describeWrapped: `suite`,
  },
  '@playwright/test': playwright,
  'playwright/test': playwright,
  '@jest/globals': jest,
  'jest-each': {
    default: {
      factory: {
        namespace: { ...jest, it: `test`, test: `test`, describe: `suite` },
      },
    },
  },
  mocha: {
    describe: `suite`,
    suite: `suite`,
    it: `test`,
    test: `test`,
    xit: `test.skip`,
    xdescribe: `suite.skip`,
  },
  'mocha-steps': { step: `test`, xstep: `test.skip` },
  'node:test': nodeTest,
  // The npm package `test` is node:test's API as a package.
  test: nodeTest,
  ava: { default: `test` },
  tap: { default: tapObject, t: tapObject, ...tapObject.namespace },
  // tape 5.10.3 lib/test.js lines 58-78: name, options, and callback in any
  // order.
  tape: untitled({
    default: `test`,
    test: `test`,
    skip: `test.skip`,
    only: `test.only`,
  }),
  zora: { test: `test`, only: `test.only`, skip: `test.skip` },
  // brittle 4.5.0 index.js lines 1000-1002: a function first is the callback.
  brittle: untitled({
    default: `test`,
    test: `test`,
    solo: `test.only`,
    skip: `test.skip`,
    todo: `test.todo`,
  }),
  uvu: { test: `test`, suite: { factory: `test` } },
  'bun:test': {
    test: `test`,
    it: `test`,
    xtest: `test.skip`,
    xit: `test.skip`,
    describe: `suite`,
    xdescribe: `suite.skip`,
  },
  '@std/testing/bdd': stdTesting,
  qunit: {
    default: qunitObject,
    QUnit: qunitObject,
    ...qunitObject.namespace,
  },
  '@japa/runner': { test: `test` },
  '@hapi/lab': {
    script: {
      factory: {
        namespace: {
          test: `test`,
          it: `test`,
          describe: `suite`,
          suite: `suite`,
          experiment: `suite`,
        },
      },
    },
  },
}

/** Specifier patterns of frameworks: a prefix, and the table it shares. */
const frameworkPatterns = [
  [`@playwright/experimental-ct-`, { test: `test`, [ANNOTATIONS]: true }],
  [`jsr:@std/testing`, stdTesting],
]

/**
 * Packages that export other functions under a test function's name, by
 * exact specifier, or by prefix when the entry ends in `*`.
 */
const knownNonTestPackages = [
  `ramda`,
  `ramda/*`,
  `rambda`,
  `rambdax`,
  `remeda`,
  `lodash`,
  `lodash/*`,
  `lodash-es`,
  `mitata`,
  `@thi.ng/*`,
  `benny`,
  `tinybench`,
  `@tensorflow/*`,
  `step`,
  `chai`,
  `@vitest/expect`,
  `vitest/*`,
  `@vitest/browser*`,
  `vitest-browser-*`,
  `@testing-library/*`,
  `storybook/*`,
  `@storybook/*`,
  `cypress`,
  `@wdio/globals`,
  `iter-tools`,
]

/**
 * The globals of the test environments, by the role of each name: Vitest's
 * `globals`, and Jest's, Mocha's, and Jasmine's, as the `globals` package
 * lists them, and the namespace objects of Deno and QUnit. `fcTest` is the
 * name that `@fast-check/vitest`'s `test` takes in an oracle file. A
 * global that another environment declares for something else (`module`,
 * `run`, `fail`) is left out.
 */
export const globalRoles = {
  ...vitest,
  fcTest: `test`,
  specify: `test`,
  context: `suite`,
  fit: `test.only`,
  xit: `test.skip`,
  xtest: `test.skip`,
  xspecify: `test.skip`,
  fdescribe: `suite.only`,
  xdescribe: `suite.skip`,
  xcontext: `suite.skip`,
  // Deno.test(fn), (options, fn), (name, options, fn).
  Deno: { namespace: untitled({ test: `test` }) },
  QUnit: qunitObject,
}

/**
 * The names that some framework exports as a test function or suite. An
 * unknown source's export of one of these names is what the rules cannot
 * classify, and `unknownSources: 'test'` reads it as the framework's.
 */
export const frameworkNames = {
  ...nodeTest,
  ...jest,
  ...vitest,
  ...globalRoles,
  step: `test`,
  xstep: `test.skip`,
  solo: `test.only`,
  testProp: `test`,
  effect: `test`,
  live: `test`,
  scoped: `test`,
  scopedLive: `test`,
  module: `suite`,
}
delete frameworkNames.default
delete frameworkNames.Deno
delete frameworkNames.QUnit

const matches = (pattern, specifier) =>
  pattern.endsWith(`*`)
    ? specifier.startsWith(pattern.slice(0, -1))
    : specifier === pattern

const UNKNOWN_MODES = [`report`, `test`, `ignore`]
const ROLE_NAMES = new Set([`test`, `suite`])

const isPlainObject = (value) =>
  typeof value === `object` && value !== null && !Array.isArray(value)

/** The table that a `testPackages` value names, or undefined when it names none. */
function configuredTable(value) {
  if (typeof value === `string`) return frameworkTable(value)
  return isPlainObject(value) &&
    Object.values(value).every((role) => ROLE_NAMES.has(role))
    ? value
    : undefined
}

/**
 * The source settings of `settings.oracles`, and the names of those that
 * are malformed. `testPackages` maps a specifier (or a prefix ending in
 * `*`) to a framework's specifier or to a table of export roles;
 * `nonTestPackages` lists specifiers; `unknownSources` is `report` (the
 * default), `test`, or `ignore`. A setting that is not `undefined` and
 * that the rules cannot use is malformed, and it is read as unset, all of
 * it. A `settings.oracles` that is not an object is malformed as a whole.
 */
export function sourceSettings(configured) {
  const unset = { tables: {}, nonTest: [], unknownSources: `report` }
  if (configured === undefined) return { ...unset, malformed: [] }
  if (!isPlainObject(configured)) return { ...unset, malformed: [`oracles`] }
  const malformed = []
  const { testPackages, nonTestPackages, unknownSources } = configured
  let tables = unset.tables
  if (testPackages !== undefined) {
    const entries = isPlainObject(testPackages)
      ? Object.entries(testPackages).map(([pattern, value]) => [
          pattern,
          configuredTable(value),
        ])
      : undefined
    if (entries?.every(([, table]) => table !== undefined))
      tables = Object.fromEntries(entries)
    else malformed.push(`testPackages`)
  }
  let nonTest = unset.nonTest
  if (nonTestPackages !== undefined) {
    if (
      Array.isArray(nonTestPackages) &&
      nonTestPackages.every((entry) => typeof entry === `string`)
    )
      nonTest = nonTestPackages
    else malformed.push(`nonTestPackages`)
  }
  let mode = unset.unknownSources
  if (unknownSources !== undefined) {
    if (UNKNOWN_MODES.includes(unknownSources)) mode = unknownSources
    else malformed.push(`unknownSources`)
  }
  return { tables, nonTest, unknownSources: mode, malformed }
}

function frameworkTable(specifier) {
  return Object.hasOwn(frameworks, specifier)
    ? frameworks[specifier]
    : frameworkPatterns.find(([prefix]) => specifier.startsWith(prefix))?.[1]
}

/**
 * How a package specifier is classified: `{ table }` for a test framework
 * or a configured package, `none` for a package that exports no test
 * function, or undefined when no setting or table knows it. The settings
 * come first.
 */
export function classifySource(specifier, settings) {
  const configured = Object.entries(settings.tables).find(([pattern]) =>
    matches(pattern, specifier),
  )
  if (configured !== undefined) return { table: configured[1] }
  if (settings.nonTest.some((pattern) => matches(pattern, specifier)))
    return `none`
  const table = frameworkTable(specifier)
  if (table !== undefined) return { table }
  return knownNonTestPackages.some((pattern) => matches(pattern, specifier))
    ? `none`
    : undefined
}
