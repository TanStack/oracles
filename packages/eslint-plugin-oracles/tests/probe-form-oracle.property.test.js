/**
 * Law (lint rule `oracle/probe-form`): a state probe in production source is
 * one expression statement of this exact form, and every other mention of
 * `__oracleProbe` is reported:
 *
 *   const probing = typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production'
 *   ...
 *   probing && globalThis.__oracleProbe?.(name, condition)
 *
 * The guard on the left of `&&` is the identifier `probing`, and it resolves
 * to a `const` with exactly that initializer in the nearest enclosing
 * function, at its top or in a block of it. A production build defines
 * `process.env.NODE_ENV`, folds a function-local `probing` to `false`, and
 * drops the probe; an unbundled browser or Deno has no `process`, and the
 * guard is `false` without throwing. A guard named otherwise, bound with
 * `let`, with another initializer (the bare `NODE_ENV` comparison, or
 * `typeof process !== 'undefined' && …`), declared in an outer function or
 * at module level, or the former form with the comparison itself on the left
 * of `&&`, is reported. The initializer's `'undefined'` and `'production'` may
 * be written with any of the three quote styles, because the repository
 * writes strings with backticks. The
 * receiver is `globalThis`, or `globalThis` cast with `as`. The name is a
 * string literal or a template literal without substitutions, and it names a
 * state as `package#name`. The statement has exactly two arguments,
 * and the condition contains no assignment, update, `new`, `delete`, `await`,
 * `yield`, function expression, class expression, or arrow function with a
 * block body. An arrow function with an expression body is allowed, under the
 * same rule for its body, so a condition can scan a collection
 * (`rows.every((row) => …)`). A call is allowed in a condition: a lint cannot
 * prove that a call is pure, which is a limit of this law.
 *
 * Authority: the maintainer's decision of 2026-11-08 on the guard (a
 * function-local `probing` constant: the bare `process.env.NODE_ENV` guard
 * throws in unbundled browsers and Deno and reads the environment per record,
 * and esbuild keeps a module-level constant in a module with imports, so its
 * probes ship), which revises the earlier decision on the probe form that
 * replaced the `devBuild()` guard ("this is a standalone framework now so we can't use the
 * devBuild() stuff", "our default lint forces the guard"), and the state probe
 * entry in docs/contributing/glossary.md, which names the call
 * `globalThis.__oracleProbe?.("package#name")`. AGENTS.md "Lint feedback while
 * you work" requires that an oracle-owned shortcut is reported, not disabled.
 *
 * Limits: the guard is generated at the top of the function and in a block
 * beside its probe; a module-level guard, a parameter or a function named
 * `probing`, and a guard declared after its probe are not generated (the
 * rule reads bindings through ESLint's scope manager, which places each).
 *
 * Structure, following ORC-003:
 *   1. The grammar draws a program of sites. Each site has a kind: a legal
 *      probe, or one near-miss that breaks exactly one part of the form.
 *   2. The model predicts the reports from the drawn kinds alone. A legal
 *      site has no report. A near-miss has one report for each mention of
 *      `__oracleProbe` on its line. The model does not read the rule.
 *   3. The drivers render the program as one TypeScript function, one site per
 *      line, and lint it on two receiving paths: the repository's root ESLint
 *      config, which is what CI and `pnpm lint` use, and the plugin's
 *      `production` config alone. The root config also lints the same program
 *      under a test file name, which must report nothing: the rule covers
 *      production source only.
 *   4. The comparison checks that each path's reports equal the prediction,
 *      as sorted (line, message) pairs.
 *   5. A census lints every kind and every pool value once. Random campaigns
 *      draw programs with fixed and random seeds. Declared reach fails when a
 *      legal form or a near-miss kind is never generated.
 */
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import tsParser from '@typescript-eslint/parser'
import { ESLint, Linter } from 'eslint'
import fc from 'fast-check'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createOracleReach,
  declareOracle,
  oraclePropertyOptions,
  oracleRuns,
} from '@tanstack/oracles'
import oraclePlugin from '../src/index.js'
import {
  MESSAGE_ID,
  MODEL,
  censusProgram,
  isLegal,
  predictReports,
  programArbitrary,
  renderProgram,
} from './probe-form-grammar.js'

const PROPERTY = `lint.probe-form`
const RULE = `oracle/probe-form`
const FIXED_SEED = 2234
const BASE_RUNS = 40
const repoRoot = fileURLToPath(new URL(`../../../`, import.meta.url))
// Neither file has to exist: ESLint lints the text under this name. The
// production name must match the production glob, and the test name must not.
// Both sit under packages/oracles, whose tsconfig includes `src` and `tests`, so
// the typed rules of the root config can parse them.
const PRODUCTION_FILE = join(
  repoRoot,
  `packages/oracles/src/probe-form-scratch.ts`,
)
const TEST_FILE = join(
  repoRoot,
  `packages/oracles/tests/probe-form-scratch.test.ts`,
)

// The root config's scope: production source has the rule as an error, and a
// test file has it off. Production source is `packages/*/src`, as the
// production config's globs say.
function predictSeverity(filePath) {
  return filePath.includes(`/src/`) ? `error` : `off`
}

// The rule's behavior is linted through the plugin's production config alone:
// the root config also enables typed rules, which need each file on disk, and
// the scratch text is never written. The root config's enablement is checked
// by asking it which rules apply to a file name, which reads nothing.
const eslint = new ESLint({ cwd: repoRoot })
const linter = new Linter({ configType: `flat`, cwd: repoRoot })

function probeReports(messages) {
  const fatal = messages.find((message) => message.fatal)
  if (fatal) {
    throw new Error(`the rendered program does not parse: ${fatal.message}`)
  }
  return messages
    .filter((message) => message.ruleId === RULE)
    .map((message) => ({ line: message.line, messageId: message.messageId }))
}

function lintWithProductionConfig(code, filePath) {
  return probeReports(
    linter.verify(
      code,
      [
        { languageOptions: { parser: tsParser } },
        oraclePlugin.configs.production,
      ],
      { filename: filePath },
    ),
  )
}

async function severityInRepository(filePath) {
  const config = await eslint.calculateConfigForFile(filePath)
  const entry = config.rules?.[RULE]
  const severity = Array.isArray(entry) ? entry[0] : entry
  return severity === 2 || severity === `error` ? `error` : `off`
}

// -- 4. Comparison ------------------------------------------------------------

const reportKeys = (reports) =>
  reports.map((report) => `${report.line}:${report.messageId}`).sort()

function compareReports(path, actual, expected) {
  expect(reportKeys(actual), path).toEqual(reportKeys(expected))
}

function compareSeverity(path, actual, expected) {
  expect(actual, path).toBe(expected)
}

// -- 5. Reach and campaigns ---------------------------------------------------

const LEGAL_SUBSTATES = [
  `legal:guard-quote-double`,
  `legal:guard-quote-backtick`,
  `legal:cast`,
  `legal:parenthesized-cast`,
  `legal:template-name`,
  `legal:guard-parens`,
  `legal:call-condition`,
  `legal:arrow-condition`,
]
const STATES = [...Object.keys(MODEL), ...LEGAL_SUBSTATES, `undeclared-guard`]
const reach = createOracleReach(PROPERTY, STATES, { minimum: 1 })

function recordStates(program) {
  if (program.sites.some((site) => MODEL[site.kind].legal)) {
    if (program.guardQuote === `"`) reach.reach(`legal:guard-quote-double`)
    if (program.guardQuote === '`') reach.reach(`legal:guard-quote-backtick`)
  }
  if (
    program.header === `none` &&
    program.sites.some((s) => s.kind === `probe`)
  )
    reach.reach(`undeclared-guard`)
  for (const site of program.sites) {
    reach.reach(site.kind)
    if (!isLegal(site, program)) continue
    if (site.cast) reach.reach(`legal:cast`)
    if (site.cast && site.paren) reach.reach(`legal:parenthesized-cast`)
    if (site.quote === '`') reach.reach(`legal:template-name`)
    if (site.guardParens) reach.reach(`legal:guard-parens`)
    if (site.cond.calls) reach.reach(`legal:call-condition`)
    if (site.cond.arrow) reach.reach(`legal:arrow-condition`)
  }
}

async function checkProgram(program) {
  reach.beginHistory()
  recordStates(program)
  const code = renderProgram(program)
  compareReports(
    `production file, production config`,
    lintWithProductionConfig(code, PRODUCTION_FILE),
    predictReports(program),
  )
  // The root config enables the rule for production source and nowhere else.
  compareSeverity(
    `production file, root config`,
    await severityInRepository(PRODUCTION_FILE),
    predictSeverity(PRODUCTION_FILE),
  )
  compareSeverity(
    `test file, root config: the rule covers production source only`,
    await severityInRepository(TEST_FILE),
    predictSeverity(TEST_FILE),
  )
}

function campaign(name) {
  it(`${name}: fixed-seed campaign`, async () => {
    await fc.assert(fc.asyncProperty(programArbitrary, checkProgram), {
      numRuns: oracleRuns(BASE_RUNS),
      seed: FIXED_SEED,
    })
  }, 600_000)
  it(`${name}: random-seed campaign`, async () => {
    await fc.assert(
      fc.asyncProperty(programArbitrary, checkProgram),
      oraclePropertyOptions(BASE_RUNS, PROPERTY),
    )
  }, 600_000)
}

describe(`probe form in production source`, () => {
  it(`census: every kind and every pool value is linted as predicted`, async () => {
    await checkProgram(censusProgram())
    // The same census in a function with no guard of its own.
    await checkProgram({ ...censusProgram(), header: `none` })
  }, 600_000)
  campaign(`random programs`)
  afterAll(() => {
    if (process.env.TANSTACK_DB_ORACLE_REACH_REPORT)
      console.log(`REACH`, JSON.stringify([...reach.counts()]))
    reach.assertReached()
  })
})

// The comparison must reject a wrong observation: a report on the wrong line,
// and a missing report. Both feed the same check that the campaigns use.
describe(`the comparison rejects wrong reports`, () => {
  it(`rejects a report on a neighboring line`, () => {
    expect(() =>
      compareReports(
        `calibration`,
        [{ line: 3, messageId: MESSAGE_ID }],
        [{ line: 2, messageId: MESSAGE_ID }],
      ),
    ).toThrow()
  })
  it(`rejects a missing report`, () => {
    expect(() =>
      compareReports(`calibration`, [], [{ line: 2, messageId: MESSAGE_ID }]),
    ).toThrow()
  })
})

declareOracle({
  model: [predictReports, predictSeverity],
  check: [compareReports, compareSeverity],
  grammar: [programArbitrary],
})
