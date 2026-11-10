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
import { differs, oracleProperty, pass } from '@tanstack/oracles'
import oraclePlugin from '../src/index.js'
import {
  LEGAL_CONDITIONS,
  MODEL,
  censusProgram,
  isLegal,
  predictReports,
  programArbitrary,
  renderProgram,
} from './probe-form-oracle-grammar.js'

const PROPERTY = `lint.probe-form`
const PROPERTY_CENSUS = `lint.probe-form.census`
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

// -- 4. Comparison and reach --------------------------------------------------

const reportKeys = (reports) =>
  reports.map((report) => `${report.line}:${report.messageId}`).sort()

const LAW = {
  statement: `A state probe in production source is reported exactly where the form is broken, and only in production source: each near-miss kind reports each mention of __oracleProbe on its line, a legal probe reports nothing, and the root config enables the rule for production source alone.`,
  authority: `The maintainer's decisions of 2026-11-08 on the probe form (the function-local probing guard) and the state probe entry in docs/contributing/glossary.md, as recorded in this file's header.`,
  limits: `The guard is generated at the top of the function only; a module-level guard, a parameter named probing, and a guard after its probe are not generated. A call inside a condition is allowed, as the form allows it.`,
  owner: `eslint-plugin-oracles lint rules`,
}

// The site kinds that declare a state (every kind), the legal sub-states of
// a probe, and the undeclared guard.
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
const KINDS = Object.keys(MODEL)
const STATES = [...KINDS, ...LEGAL_SUBSTATES, `undeclared-guard`]

/** The states a program enters, from the grammar and the model alone. */
function statesOf(program) {
  const states = []
  if (program.sites.some((site) => MODEL[site.kind].legal)) {
    if (program.guardQuote === `"`) states.push(`legal:guard-quote-double`)
    if (program.guardQuote === '`') states.push(`legal:guard-quote-backtick`)
  }
  if (
    program.header === `none` &&
    program.sites.some((site) => site.kind === `probe`)
  )
    states.push(`undeclared-guard`)
  for (const site of program.sites) {
    states.push(site.kind)
    if (!isLegal(site, program)) continue
    if (site.cast) states.push(`legal:cast`)
    if (site.cast && site.paren) states.push(`legal:parenthesized-cast`)
    if (site.quote === '`') states.push(`legal:template-name`)
    if (site.guardParens) states.push(`legal:guard-parens`)
    if (site.cond.calls) states.push(`legal:call-condition`)
    if (site.cond.arrow) states.push(`legal:arrow-condition`)
  }
  return states
}

// The file's own predictions: the reports, and the severity that the root
// config gives each file name. Production source has the rule; a test does not.
const expectationOf = (program) => ({
  reports: predictReports(program),
  productionSeverity: predictSeverity(PRODUCTION_FILE),
  testSeverity: predictSeverity(TEST_FILE),
})

function check(_program, observations, expected) {
  const observed = new Map(observations.map((o) => [o.checkpoint, o.value]))
  return (
    differs(
      `production reports`,
      `probe-form reports`,
      reportKeys(observed.get(`production reports`)),
      reportKeys(expected.reports),
    ) ??
    differs(
      `production severity`,
      `probe-form severity`,
      observed.get(`production severity`),
      expected.productionSeverity,
    ) ??
    differs(
      `test severity`,
      `probe-form severity`,
      observed.get(`test severity`),
      expected.testSeverity,
    ) ??
    pass
  )
}

async function driver(program, observe) {
  observe(
    `production reports`,
    lintWithProductionConfig(renderProgram(program), PRODUCTION_FILE),
  )
  // The root config also lints the same program under a test file name, which
  // must report nothing: the rule covers production source only.
  observe(`production severity`, await severityInRepository(PRODUCTION_FILE))
  observe(`test severity`, await severityInRepository(TEST_FILE))
}

// -- 5. Constructed histories -------------------------------------------------

/** A history whose first site is `patch` applied to the generated first site. */
const withSite = (patch, header) => (generated) => ({
  ...generated,
  ...(header === undefined ? {} : { header }),
  sites: [{ ...generated.sites[0], ...patch }, ...generated.sites.slice(1)],
})

const legalCondition = (arrow) =>
  LEGAL_CONDITIONS.find((c) => c.calls && (c.arrow === true) === arrow)

// One constructed history for each site kind, and for each state of a probe.
const constructed = [
  ...KINDS.map((kind) => ({
    name: kind,
    enters: [kind],
    build: withSite({ kind }),
  })),
  ...[`"`, '`'].map((quote) => ({
    name: `legal:guard-quote-${quote === '`' ? 'backtick' : 'double'}`,
    enters: [`legal:guard-quote-${quote === '`' ? 'backtick' : 'double'}`],
    build: (generated) => ({
      ...withSite({ kind: `probe` }, `guard`)(generated),
      guardQuote: quote,
    }),
  })),
  {
    name: `legal:cast`,
    enters: [`legal:cast`],
    build: withSite({ kind: `probe`, cast: true }, `guard`),
  },
  {
    name: `legal:parenthesized-cast`,
    enters: [`legal:parenthesized-cast`],
    build: withSite({ kind: `probe`, cast: true, paren: true }, `guard`),
  },
  {
    name: `legal:template-name`,
    enters: [`legal:template-name`],
    build: withSite({ kind: `probe`, quote: '`' }, `guard`),
  },
  {
    name: `legal:guard-parens`,
    enters: [`legal:guard-parens`],
    build: withSite({ kind: `probe`, guardParens: true }, `guard`),
  },
  {
    name: `legal:call-condition`,
    enters: [`legal:call-condition`],
    build: withSite({ kind: `probe`, cond: legalCondition(false) }, `guard`),
  },
  {
    name: `legal:arrow-condition`,
    enters: [`legal:arrow-condition`],
    build: withSite({ kind: `probe`, cond: legalCondition(true) }, `guard`),
  },
  {
    name: `undeclared-guard`,
    enters: [`undeclared-guard`],
    build: withSite({ kind: `probe` }, `none`),
  },
]

// The census gives every kind every pool value once. It is a fixed list of
// two histories, one with a guard and one without, and runs through the same
// model, driver, and check.
oracleProperty({
  id: PROPERTY_CENSUS,
  law: LAW,
  histories: [censusProgram(), { ...censusProgram(), header: `none` }],
  label: (program) =>
    program.header === `none`
      ? `census without a guard`
      : `census with a guard`,
  model: expectationOf,
  driver,
  check,
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
  model: expectationOf,
  driver,
  check,
  calibrations: [
    {
      name: `a report on a neighboring line`,
      law: `probe-form reports`,
      corrupt: (trace) => {
        const observed = trace.find(
          (o) => o.checkpoint === `production reports`,
        )
        if (observed.value.length === 0) return undefined
        return trace.map((o) =>
          o.checkpoint === `production reports`
            ? { ...o, value: o.value.map((r) => ({ ...r, line: r.line + 1 })) }
            : o,
        )
      },
    },
    {
      name: `a missing report`,
      law: `probe-form reports`,
      corrupt: (trace) => {
        const observed = trace.find(
          (o) => o.checkpoint === `production reports`,
        )
        if (observed.value.length === 0) return undefined
        return trace.map((o) =>
          o.checkpoint === `production reports`
            ? { ...o, value: o.value.slice(1) }
            : o,
        )
      },
    },
  ],
})
