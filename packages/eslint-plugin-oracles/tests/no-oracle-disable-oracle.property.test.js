/**
 * # `oracle/no-oracle-disable`: a directive that names an oracle rule is reported
 *
 * Law: an ESLint directive that disables an `oracle/*` rule is reported, and so
 * is an inline config comment that turns one off. The directive is reported
 * however it is spelled: as a line or block comment, in the `eslint-disable`,
 * `eslint-disable-line`, and `eslint-disable-next-line` forms, with the rule
 * name bare, in single quotes, or in double quotes, with the names separated by
 * `, ` or `,`, with or without a `-- description`, with the block comment split
 * over two lines, and whether its list names only oracle rules, only other
 * rules, or both, including `oracle/no-oracle-disable` itself. A comment that
 * ESLint does not read as a directive is not reported, and neither is a
 * description that names an oracle rule. Each reported directive gets one
 * report, on the line where the directive begins. The rule never throws on a
 * program that parses.
 *
 * Authority: P8 of the frozen v20 design grammar: lint rules cannot be disabled
 * inline, and the maintainer chose to have a plugin rule report a directive that
 * names an oracle rule (option b). The directive grammar is ESLint's own: a
 * quoted rule name is the rule's name, and a comment is a directive only when
 * ESLint reads its first word as a directive keyword. P10: a failure of the
 * harness is never charged to the rule.
 *
 * Limits of the law, which the grammar does not generate. A blanket directive
 * with no rule list (`/* eslint-disable *\/`) is not generated: it disables
 * oracle rules without naming one, and whether the rule reports it is a law
 * question (blanket directives are not in option b). Where the report sits for
 * a directive that another directive covers is also open: ESLint hides a report
 * at or after a directive's start, so a directive that names
 * `oracle/no-oracle-disable` can hide its own report. The grammar generates that
 * case, and the oracle expects the report on the directive's line, which is the
 * law as written today.
 *
 * Grammar: a program is one module that is either an oracle file (the
 * `recommended` config) or a production source file (the `production` config).
 * Each site is one code line, with a directive or comment of one of these
 * forms: a directive in the line, next-line, block, block next-line, or block
 * line form; an inline config comment (`config`); or a comment or string that
 * is not a directive (`prose`, `jsdoc`, `string`). A site with no comment is
 * `none`. A directive's list is one of five kinds: one oracle rule, two oracle
 * rules, one other rule, an other rule with an oracle rule, or the oracle rule
 * `oracle/no-oracle-disable` itself. The names are bare, single-quoted, or
 * double-quoted. The description is none, one that says why, or one that names
 * an oracle rule while the list names none.
 *
 * Model: a directive is reported when its list names a rule whose name starts
 * with `oracle/`, or when it is an inline config comment that names one. Its
 * report is on the line the comment begins: the code line for an inline form,
 * the comment line for a leading form. A non-directive comment or string is
 * never reported. The model counts lines from the grammar alone. It does not
 * read the rule, and it does not model ESLint's suppression: the law is that no
 * such directive escapes its report.
 *
 * Driver: lints the program with the plugin's config for its location (the
 * `recommended` config for an oracle file, `production` for production source),
 * from the repository root so that the configs' file globs apply. The outcome
 * is the rule's reports, or the error that the rule threw. An error that ESLint
 * did not tag with a rule id is a harness failure: it propagates and is never
 * charged to the rule.
 *
 * Check: a rule throw violates the never-throws law (P8). Otherwise the sorted
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
const NON_DIRECTIVE_FORMS = [`prose`, `jsdoc`, `string`]
const LISTS = {
  oracleOne: [`oracle/probe-form`],
  oracleTwo: [`oracle/probe-form`, `oracle/no-disabled`],
  otherOne: [`no-console`],
  mixed: [`no-console`, `oracle/no-disabled`],
  selfNaming: [`oracle/no-oracle-disable`],
}
const LIST_KINDS = Object.keys(LISTS)
const QUOTES = [`bare`, `single`, `double`]
const DESCRIPTIONS = [`none`, `why`, `namesOracle`]
const LOCATIONS = [`oracleFile`, `productionSource`]

const site = fc.record({
  form: fc.constantFrom(`none`, `config`, ...FORMS, ...NON_DIRECTIVE_FORMS),
  list: fc.constantFrom(...LIST_KINDS),
  quote: fc.constantFrom(...QUOTES),
  description: fc.constantFrom(...DESCRIPTIONS),
  tight: fc.boolean(),
  wrap: fc.boolean(),
})

const program = fc.record({
  location: fc.constantFrom(...LOCATIONS),
  sites: fc.array(site, { minLength: 1, maxLength: 6 }),
})

// -- Model --------------------------------------------------------------------

const isOracleRule = (name) => name.startsWith(`oracle/`)
const isDirectiveForm = (form) => form === `config` || FORMS.includes(form)
const isLeading = (form) =>
  form === `nextLine` ||
  form === `blockNextLine` ||
  form === `jsdoc` ||
  form === `prose`
const isInline = (form) =>
  form === `line` ||
  form === `block` ||
  form === `blockLine` ||
  form === `config`
const isWrappable = (form) => form === `block` || form === `blockNextLine`

/** Whether a site's comment is reported: a directive or config whose list names an oracle rule. */
const isReported = (item) =>
  isDirectiveForm(item.form) && LISTS[item.list].some(isOracleRule)

/** The lines a site's leading comment takes: a wrapped block next-line comment takes two. */
const leadingLines = (item) => {
  if (item.form === `blockNextLine`) return item.wrap ? 2 : 1
  return isLeading(item.form) ? 1 : 0
}

/** The lines a site adds after its code line: a wrapped inline block comment takes one more. */
const trailingLines = (item) => (item.form === `block` && item.wrap ? 1 : 0)

function expectedReports({ sites }) {
  const reports = []
  let line = FIRST_LINE
  for (const item of sites) {
    // A leading directive is reported on its own first line, before the code.
    if (isReported(item) && isLeading(item.form))
      reports.push({ line, messageId: `oracleDisable` })
    // An inline directive is reported on the code line.
    if (isReported(item) && isInline(item.form))
      reports.push({ line, messageId: `oracleDisable` })
    line += leadingLines(item) + 1 + trailingLines(item)
  }
  return reports
}

// The states a program enters, read from the grammar alone.
const statesOf = (drawn) => {
  const states = [`location:${drawn.location}`]
  for (const item of drawn.sites) {
    if (item.form !== `none`) states.push(`form:${item.form}`)
    if (NON_DIRECTIVE_FORMS.includes(item.form)) states.push(`nonDirective`)
    states.push(`list:${item.list}`)
    if (isDirectiveForm(item.form) && item.quote !== `bare`)
      states.push(`quoted`)
    if (item.tight) states.push(`tight`)
    if (isWrappable(item.form) && item.wrap) states.push(`wrapped`)
    if (item.description !== `none`) states.push(`described`)
    if (item.description === `namesOracle`) states.push(`describesOracle`)
    if (item.list === `selfNaming` && isDirectiveForm(item.form))
      states.push(`selfNaming`)
    if (isDirectiveForm(item.form) && !isReported(item)) states.push(`silent`)
    if (isReported(item)) states.push(`reported`)
  }
  return states
}

const STATES = [
  ...LOCATIONS.map((location) => `location:${location}`),
  ...[`config`, ...FORMS, ...NON_DIRECTIVE_FORMS].map((form) => `form:${form}`),
  ...LIST_KINDS.map((list) => `list:${list}`),
  `nonDirective`,
  `quoted`,
  `tight`,
  `wrapped`,
  `described`,
  `describesOracle`,
  `selfNaming`,
  `silent`,
  `reported`,
]

// -- Driver -------------------------------------------------------------------

const linter = new Linter({ configType: `flat`, cwd: repoRoot })

const quoteName = (name, quote) =>
  quote === `single` ? `'${name}'` : quote === `double` ? `"${name}"` : name

/** The directive's list text: the names, then an optional description. */
function listText(item) {
  const separator = item.tight ? `,` : `, `
  const names = LISTS[item.list].map((name) => quoteName(name, item.quote))
  const description =
    item.description === `why`
      ? ` -- because the rule is a probe`
      : item.description === `namesOracle`
        ? ` -- see oracle/probe-form`
        : ``
  return `${names.join(separator)}${description}`
}

/** An inline config comment that turns each listed rule off. */
const configText = (item) =>
  `/* eslint ${LISTS[item.list].map((name) => `${name}: "off"`).join(`, `)} */`

/**
 * A site's rendered lines: the leading comment lines, then the code line, which
 * may hold an inline comment. A wrapped block comment spans two lines.
 */
function renderSite(item, index) {
  const code = `const s${index} = ${index}`
  const text = listText(item)
  const block = (open) =>
    item.wrap ? `${open}\n   ${text} */` : `${open} ${text} */`
  switch (item.form) {
    case `none`:
      return { leading: [], code }
    case `config`:
      return { leading: [], code: `${code} ${configText(item)}` }
    case `line`:
      return { leading: [], code: `${code} // eslint-disable-line ${text}` }
    case `nextLine`:
      return { leading: [`// eslint-disable-next-line ${text}`], code }
    case `block`:
      return { leading: [], code: `${code} ${block(`/* eslint-disable`)}` }
    case `blockNextLine`:
      return {
        leading: [block(`/* eslint-disable-next-line`)],
        code,
      }
    case `blockLine`:
      return { leading: [], code: `${code} /* eslint-disable-line ${text} */` }
    case `prose`:
      return {
        leading: [`// see the eslint-disable comment for oracle/probe-form`],
        code,
      }
    case `jsdoc`:
      return { leading: [`/** eslint-disable ${text} */`], code }
    case `string`:
      return {
        leading: [],
        code: `const note${index} = \`eslint-disable-line ${text}\``,
      }
    default:
      throw new Error(`unknown form ${item.form}`)
  }
}

function renderProgram({ sites }) {
  const lines = [`const header = true`]
  sites.forEach((item, index) => {
    const rendered = renderSite(item, index)
    lines.push(...rendered.leading, rendered.code)
  })
  return `${lines.join(`\n`)}\n`
}

/** The rule's reports for a rendered program, or the error that the rule threw. */
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
    // ESLint tags an error that a rule threw with the rule's id. Any other
    // error is a harness failure: it propagates, and it is not charged to the rule.
    if (error?.ruleId === undefined) throw error
    return { threw: String(error) }
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
  ...[`config`, ...FORMS, ...NON_DIRECTIVE_FORMS].map((form) => ({
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
    name: `a directive whose names are single-quoted`,
    enters: [`quoted`, `reported`],
    build: withSite({ form: `line`, list: `oracleOne`, quote: `single` }),
  },
  {
    name: `a directive whose names are double-quoted`,
    enters: [`quoted`, `reported`],
    build: withSite({ form: `nextLine`, list: `oracleTwo`, quote: `double` }),
  },
  {
    name: `a directive whose names are separated without a space`,
    enters: [`tight`, `reported`],
    build: withSite({ form: `line`, list: `oracleTwo`, tight: true }),
  },
  {
    name: `a block directive split over two lines`,
    enters: [`wrapped`, `reported`],
    build: withSite({ form: `block`, list: `oracleOne`, wrap: true }),
  },
  {
    name: `a described directive over an oracle rule`,
    enters: [`described`, `reported`],
    build: withSite({ form: `block`, list: `oracleOne`, description: `why` }),
  },
  {
    name: `a description that names an oracle rule, over no oracle rule`,
    enters: [`describesOracle`, `silent`],
    build: withSite({
      form: `line`,
      list: `otherOne`,
      description: `namesOracle`,
    }),
  },
  {
    name: `a directive that names no oracle rule`,
    enters: [`silent`],
    build: withSite({ form: `line`, list: `otherOne` }),
  },
  {
    name: `a block directive that names the rule itself`,
    enters: [`selfNaming`, `form:block`, `reported`],
    build: withSite({ form: `block`, list: `selfNaming` }),
  },
  {
    name: `a line directive that names the rule itself`,
    enters: [`selfNaming`, `form:line`, `reported`],
    build: withSite({ form: `line`, list: `selfNaming` }),
  },
  {
    name: `an inline config comment that turns an oracle rule off`,
    enters: [`form:config`, `reported`],
    build: withSite({ form: `config`, list: `oracleOne` }),
  },
  {
    name: `a comment that mentions an oracle rule but is not a directive`,
    enters: [`form:prose`, `nonDirective`],
    build: withSite({ form: `prose`, list: `oracleOne` }),
  },
  {
    name: `a JSDoc comment that holds directive text`,
    enters: [`form:jsdoc`, `nonDirective`],
    build: withSite({ form: `jsdoc`, list: `oracleOne` }),
  },
  {
    name: `a string that holds directive text`,
    enters: [`form:string`, `nonDirective`],
    build: withSite({ form: `string`, list: `oracleOne` }),
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
    statement: `An ESLint directive that disables an oracle/* rule is reported on the line it begins, in an oracle file and in production source, whatever its spelling: the line, next-line, and block forms; a bare, single-quoted, or double-quoted rule name; names separated with or without a space; a description; a block comment split over two lines; and a list that names only oracle rules, only other rules, or both, including oracle/no-oracle-disable itself. An inline config comment that turns an oracle rule off is reported. A comment that ESLint does not read as a directive, and a description that names an oracle rule, are not reported. The rule never throws on a program that parses.`,
    authority: `P8 of the frozen v20 design grammar: lint rules cannot be disabled inline, and the maintainer chose option b, a plugin rule that reports a directive naming an oracle rule. P10: a harness failure is never charged to the rule. The directive grammar is ESLint's.`,
    limits: `A blanket directive with no rule list is not generated: whether it is reported is a law question. The report location of a directive that another directive covers is open: ESLint hides a report at or after a directive's start, so the self-naming form may hide its own report, and the law's location is undecided. A config comment that sets a severity other than off is not generated.`,
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
