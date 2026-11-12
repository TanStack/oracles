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

const vitest = {
  it: `test`,
  test: `test`,
  bench: `test`,
  describe: `suite`,
  suite: `suite`,
}
const playwright = {
  test: `test`,
  default: `test`,
  mergeTests: { factory: `test` },
}
const nodeTest = {
  default: `test`,
  test: `test`,
  it: `test`,
  describe: `suite`,
  suite: `suite`,
  skip: `test.skip`,
  todo: `test.todo`,
  only: `test.only`,
  expectFailure: `test`,
}
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
const tapObject = {
  namespace: {
    test: `test`,
    skip: `test.skip`,
    only: `test.only`,
    todo: `test.todo`,
  },
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
  tape: { default: `test`, test: `test`, skip: `test.skip`, only: `test.only` },
  zora: { test: `test`, only: `test.only`, skip: `test.skip` },
  brittle: {
    default: `test`,
    test: `test`,
    solo: `test.only`,
    skip: `test.skip`,
    todo: `test.todo`,
  },
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
  [`@playwright/experimental-ct-`, { test: `test` }],
  [`jsr:@std/testing`, stdTesting],
]

/**
 * Packages that export other functions under a test function's name, by
 * exact specifier, or by prefix when the entry ends in `*`.
 */
const nonTestPackages = [
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
  Deno: { namespace: { test: `test` } },
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

/**
 * The source settings of `settings.oracles`, and the names of those that
 * are malformed. `testPackages` maps a specifier (or a prefix ending in
 * `*`) to a framework's specifier or to a table of export roles;
 * `nonTestPackages` lists specifiers; `unknownSources` is `report` (the
 * default), `test`, or `ignore`. A malformed setting is read as unset.
 */
export function sourceSettings(configured = {}) {
  const malformed = []
  const { testPackages = {}, nonTestPackages: listed = [] } = configured
  const tables = {}
  if (typeof testPackages !== `object` || testPackages === null)
    malformed.push(`testPackages`)
  else
    for (const [pattern, value] of Object.entries(testPackages)) {
      const table =
        typeof value === `string`
          ? frameworkTable(value)
          : typeof value === `object` &&
              value !== null &&
              Object.values(value).every((role) => ROLE_NAMES.has(role))
            ? value
            : undefined
      if (table === undefined) malformed.push(`testPackages`)
      else tables[pattern] = table
    }
  const nonTest =
    Array.isArray(listed) && listed.every((entry) => typeof entry === `string`)
      ? listed
      : (malformed.push(`nonTestPackages`), [])
  const unknownSources = configured.unknownSources ?? `report`
  if (!UNKNOWN_MODES.includes(unknownSources)) malformed.push(`unknownSources`)
  return {
    tables,
    nonTest,
    unknownSources: UNKNOWN_MODES.includes(unknownSources)
      ? unknownSources
      : `report`,
    malformed: [...new Set(malformed)],
  }
}

function frameworkTable(specifier) {
  return (
    frameworks[specifier] ??
    frameworkPatterns.find(([prefix]) => specifier.startsWith(prefix))?.[1]
  )
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
  return nonTestPackages.some((pattern) => matches(pattern, specifier))
    ? `none`
    : undefined
}
