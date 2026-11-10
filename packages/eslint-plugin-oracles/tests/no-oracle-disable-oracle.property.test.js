/**
 * # `oracle/no-oracle-disable`: a disable directive that names an oracle rule is reported
 *
 * Law: an ESLint disable directive that names an `oracle/*` rule is reported,
 * wherever it sits: in an oracle file and in production source, as a line
 * comment or a block comment, in the `eslint-disable`, `eslint-disable-line`,
 * and `eslint-disable-next-line` forms, with or without a `-- description`, and
 * whether the list names only oracle rules, only other rules, or both. A
 * directive that names no oracle rule is not reported. The report sits on the
 * line of the directive comment itself, and each directive gets one report.
 *
 * Authority: P8 of the frozen v20 design grammar (lint rules cannot be disabled
 * inline), and the maintainer's decision on the production-config limit:
 * the `production` config cannot set `noInlineConfig` without also ignoring
 * every other rule's directives in production source, so the rule reports the
 * directive instead.
 *
 * Limits of the law, which the grammar does not generate. A blanket directive
 * with no rule list (`/* eslint-disable *\/`) is not seen: it names no rule,
 * and ESLint suppresses this rule's report on the lines it covers. A directive
 * that names `oracle/no-oracle-disable` itself can suppress the report on the
 * line below it; the first directive of such a chain is still reported.
 *
 * Grammar: a program is one module that is either an oracle file (the
 * `recommended` config) or a production source file (the `production` config).
 * Each site is one code line, and its directive takes one of five forms: the
 * line form (`// eslint-disable-line`), the next-line form (`// eslint-disable-next-line`,
 * on its own line above the code), the block form (`/* eslint-disable *\/`), the block
 * next-line form, or the block line form. Its rule list is one of five kinds:
 * one oracle rule, two oracle rules, one other rule, an other rule with an
 * oracle rule, or one oracle rule with a description. A site with no directive
 * is the `none` form.
 *
 * Model: a directive is reported when its list names a rule whose name starts
 * with `oracle/`. Its report is on the directive's line: the code line for an
 * inline form, the comment line for a next-line form. The model counts those
 * lines from the grammar alone. It does not read the rule.
 *
 * Driver: lints the program with the plugin's config for its location (the
 * `recommended` config for an oracle file, `production` for production source),
 * from the repository root so that the configs' file globs apply. The outcome
 * is the rule's reports, or the error that the run threw.
 *
 * Check: a throw violates the never-throws law (P8). Otherwise the sorted
 * reports equal the model's, exactly.
 */
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import tsParser from '@typescript-eslint/parser'
import { Linter } from 'eslint'
import fc from 'fast-check'
import { differs, oracleProperty, pass, violation } from '@tanstack/oracles'
import plugin from '../src/index.js'

const RULE = `oracle/no-oracle-disable`
const repoRoot = fileURLToPath(new URL(`../../../`, import.meta.url))
const ORACLE_FILE = join(repoRoot, `packages/example/tests/a-oracle.test.js`)
const PRODUCTION_FILE = join(repoRoot, `packages/example/src/app.ts`)
const FIRST_LINE = 2

// -- Grammar ------------------------------------------------------------------

const FORMS = [`line`, `nextLine`, `block`, `blockNextLine`, `blockLine`]
const LISTS = {
  oracleOne: [`oracle/probe-form`],
  oracleTwo: [`oracle/probe-form`, `oracle/no-disabled`],
  otherOne: [`no-console`],
  mixed: [`no-console`, `oracle/no-disabled`],
}
const LIST_KINDS = Object.keys(LISTS)
const LOCATIONS = [`oracleFile`, `productionSource`]

const site = fc.record({
  form: fc.constantFrom(`none`, ...FORMS),
  list: fc.constantFrom(...LIST_KINDS),
  described: fc.boolean(),
})

const program = fc.record({
  location: fc.constantFrom(...LOCATIONS),
  sites: fc.array(site, { minLength: 1, maxLength: 6 }),
})

// -- Model --------------------------------------------------------------------

const isOracleRule = (name) => name.startsWith(`oracle/`)
const isPreceding = (form) => form === `nextLine` || form === `blockNextLine`
const isInline = (form) =>
  form === `line` || form === `block` || form === `blockLine`

/** Whether a site's directive is reported: a directive whose list names an oracle rule. */
const isReported = (item) =>
  item.form !== `none` && LISTS[item.list].some(isOracleRule)

function expectedReports({ sites }) {
  const reports = []
  let line = FIRST_LINE
  for (const item of sites) {
    // A next-line directive sits on its own line above the code it covers.
    if (isPreceding(item.form)) {
      if (isReported(item)) reports.push({ line, messageId: `oracleDisable` })
      line += 1
    }
    // An inline directive sits on the code line.
    if (isInline(item.form) && isReported(item))
      reports.push({ line, messageId: `oracleDisable` })
    line += 1
  }
  return reports
}

// The states a program enters, read from the grammar alone.
const statesOf = (drawn) => {
  const states = [`location:${drawn.location}`]
  for (const item of drawn.sites) {
    if (item.form !== `none`) states.push(`form:${item.form}`)
    states.push(`list:${item.list}`)
    if (item.described) states.push(`described`)
    if (item.form !== `none` && !isReported(item)) states.push(`silent`)
    if (isReported(item)) states.push(`reported`)
  }
  return states
}

const STATES = [
  ...LOCATIONS.map((location) => `location:${location}`),
  ...FORMS.map((form) => `form:${form}`),
  ...LIST_KINDS.map((list) => `list:${list}`),
  `described`,
  `silent`,
  `reported`,
]

// -- Driver -------------------------------------------------------------------

const linter = new Linter({ configType: `flat`, cwd: repoRoot })

// The directive text is the list, then an optional description.
const listText = (item) =>
  `${LISTS[item.list].join(`, `)}${item.described ? ` -- because the rule is a probe` : ``}`

function renderSite(item, index) {
  const code = `const s${index} = ${index}`
  const text = listText(item)
  switch (item.form) {
    case `none`:
      return { before: [], code }
    case `line`:
      return { before: [], code: `${code} // eslint-disable-line ${text}` }
    case `nextLine`:
      return { before: [`// eslint-disable-next-line ${text}`], code }
    case `block`:
      return { before: [], code: `${code} /* eslint-disable ${text} */` }
    case `blockNextLine`:
      return { before: [`/* eslint-disable-next-line ${text} */`], code }
    case `blockLine`:
      return { before: [], code: `${code} /* eslint-disable-line ${text} */` }
    default:
      throw new Error(`unknown form ${item.form}`)
  }
}

function renderProgram({ sites }) {
  const lines = [`const header = true`]
  sites.forEach((item, index) => {
    const rendered = renderSite(item, index)
    lines.push(...rendered.before, rendered.code)
  })
  return `${lines.join(`\n`)}\n`
}

/** The rule's reports for a rendered program, or the error that the run threw. */
function lintProgram(item) {
  const production = item.location === `productionSource`
  const configs = production
    ? [{ languageOptions: { parser: tsParser } }, plugin.configs.production]
    : [
        { languageOptions: { parser: tsParser, sourceType: `module` } },
        plugin.configs.recommended,
      ]
  let messages
  try {
    messages = linter.verify(renderProgram(item), configs, {
      filename: production ? PRODUCTION_FILE : ORACLE_FILE,
    })
  } catch (error) {
    // A rule that throws aborts ESLint's run of the file: the law rejects it.
    return { threw: String(error?.message ?? error) }
  }
  const fatal = messages.find((message) => message.fatal)
  if (fatal)
    throw new Error(`the rendered program does not parse: ${fatal.message}`)
  return {
    reports: messages
      .filter((message) => message.ruleId === RULE)
      .map(({ line, messageId }) => ({ line, messageId })),
  }
}

// -- Check --------------------------------------------------------------------

const reportKey = (report) => `${report.line}:${report.messageId}`
const sortedReports = (reports) =>
  [...reports].sort((a, b) => (reportKey(a) < reportKey(b) ? -1 : 1))

function check(_program, observations, expected) {
  const observed = observations.find((o) => o.checkpoint === `outcome`).value
  if (observed.threw !== undefined)
    return violation(
      `outcome`,
      `the rule threw, which aborts ESLint's run of the file: a rule never throws on a program that parses`,
      `outcome`,
      { actual: observed, expected },
    )
  return (
    differs(
      `outcome`,
      `outcome`,
      sortedReports(observed.reports),
      sortedReports(expected.reports),
    ) ?? pass
  )
}

// -- Constructed histories ----------------------------------------------------

/** A history whose first site is `patch`, optionally in another location. */
const withSite = (patch, location) => (generated) => ({
  ...generated,
  ...(location === undefined ? {} : { location }),
  sites: [{ ...generated.sites[0], ...patch }, ...generated.sites.slice(1)],
})

const constructed = [
  ...FORMS.map((form) => ({
    name: `form ${form}`,
    enters: [`form:${form}`],
    build: withSite({ form, list: `oracleOne` }),
  })),
  ...LIST_KINDS.map((list) => ({
    name: `list ${list}`,
    enters: [`list:${list}`],
    build: withSite({ form: `line`, list }),
  })),
  {
    name: `a described directive over an oracle rule`,
    enters: [`described`, `reported`],
    build: withSite({ form: `block`, list: `oracleOne`, described: true }),
  },
  {
    name: `a directive that names no oracle rule`,
    enters: [`silent`],
    build: withSite({ form: `line`, list: `otherOne` }),
  },
  {
    name: `an oracle file`,
    enters: [`location:oracleFile`, `reported`],
    build: withSite({ form: `line`, list: `oracleOne` }, `oracleFile`),
  },
  {
    name: `a directive in production source`,
    enters: [`location:productionSource`, `reported`],
    build: withSite({ form: `nextLine`, list: `mixed` }, `productionSource`),
  },
]

oracleProperty({
  id: `lint.no-oracle-disable`,
  law: {
    statement: `An ESLint disable directive that names an oracle/* rule is reported on its own line, in an oracle file and in production source, in the line, next-line, and block forms, with or without a description, and whether its list names only oracle rules, only other rules, or both; a directive that names no oracle rule is not reported; and the rule never throws on a program that parses.`,
    authority: `P8 of the frozen v20 design grammar (lint rules cannot be disabled inline) and the maintainer's decision on the production-config limit: the production config cannot set noInlineConfig, so the rule reports the directive instead.`,
    limits: `A blanket directive with no rule list is not seen: ESLint suppresses the report itself. A directive that names oracle/no-oracle-disable can hide the report on the line below it. The grammar does not generate either form. Only one directive is written per site, and it is never a one-line directive that changes the site lines.`,
    owner: `eslint-plugin-oracles lint rules`,
  },
  histories: {
    arbitrary: program,
    runs: 60,
    fixedSeeds: [20261110],
    states: STATES,
    constructed,
  },
  reached: statesOf,
  model: (item) => ({ reports: expectedReports(item) }),
  driver: (item, observe) => observe(`outcome`, lintProgram(item)),
  check,
  calibrations: [
    {
      name: `a report dropped from the rule's output`,
      law: `outcome`,
      corrupt: (trace) => {
        const observed = trace.find((o) => o.checkpoint === `outcome`)
        if (!observed.value.reports?.length) return undefined
        return trace.map((o) =>
          o.checkpoint === `outcome`
            ? { ...o, value: { reports: o.value.reports.slice(1) } }
            : o,
        )
      },
    },
    {
      name: `a rule's throw in a clean history`,
      law: `outcome`,
      corrupt: (trace) =>
        trace.map((o) =>
          o.checkpoint === `outcome`
            ? { ...o, value: { threw: `calibration: the rule threw` } }
            : o,
        ),
    },
  ],
})
