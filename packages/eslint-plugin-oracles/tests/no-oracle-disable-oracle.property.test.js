/**
 * # `oracle/no-oracle-disable`: a directive that would silence an oracle rule is reported
 *
 * Law: every ESLint directive that would silence an `oracle/*` rule gets one
 * report, and so does every inline config comment that names one. A directive
 * silences an oracle rule when its rule list names an oracle rule, or when its
 * list is empty (a blanket directive silences every rule). The directive is
 * reported however it is spelled: as a line or block comment, in the
 * `eslint-disable`, `eslint-disable-line`, `eslint-disable-next-line` forms and
 * the block forms of the last two, with the rule names bare, in single quotes,
 * or in double quotes, with the names separated by `, ` or `,`, with or without
 * a `-- description`, and with the block comment split over two lines.
 * A comment that ESLint does not read as a directive is not reported, and
 * neither is a description that names an oracle rule.
 *
 * Where the report sits. A directive that names this rule itself, or that has
 * no rule list, is reported at the file's start, because the directive
 * covers its own line (and, when it is a block directive, every later line) and
 * so would hide a report placed there. Any other reported directive, and any
 * inline config comment, is reported on its own line, unless an earlier block
 * directive covers that line: then it too sits at the file's start. The message
 * names the directive's line whatever the report's location.
 *
 * Authority: P8 of the frozen v20 design grammar: lint rules cannot be disabled
 * inline, and the maintainer chose to have a plugin rule report a directive that
 * would silence an oracle rule (option b). The maintainer also chose that a
 * blanket directive is reported, wherever ESLint lets the report through, and
 * that the rule reports a self-naming directive at the file's start. The directive
 * grammar is ESLint's own: a quoted rule name is the rule's name, and a comment
 * is a directive only when ESLint reads its first word as a directive keyword.
 * P10: a failure of the harness is never charged to the rule.
 *
 * Limits of the law, which the grammar does not generate. A directive written
 * before the first token covers that token, so the file's start cannot
 * carry its report; the grammar always starts with code. A block directive that
 * covers a line also covers later `enable` directives, which the grammar does
 * not write. An inline config comment is reported whatever its severity; the
 * grammar writes only `off`.
 *
 * Grammar: a program is one module that is either an oracle file (the
 * `recommended` config) or a production source file (the `production` config).
 * It may begin with a plain header comment. Each site is one code line, with a
 * directive or comment of one of these forms: a directive in the line,
 * next-line, block, block next-line, or block line form; an inline config
 * comment (`config`); or a comment or string that is not a directive (`prose`,
 * `jsdoc`, `string`). A site with no comment is `none`. A directive's list is
 * one of six kinds: one oracle rule, two oracle rules, one other rule, an other
 * rule with an oracle rule, the oracle rule `oracle/no-oracle-disable` itself,
 * or no list at all. The names are bare, single-quoted, or double-quoted. The
 * description is none, one that says why, or one that names an oracle rule.
 *
 * Model: the independent judgment for each site, read from the grammar alone:
 * which rules the grammar's lists name (the plugin's rule set is written here,
 * not read from the rule), whether a comment is a directive, whether it
 * silences an oracle rule, and where its report sits. The model does not read
 * the rule, and it does not call ESLint's suppression code. It models the
 * coverage that the law needs: a block directive that names this rule or has no
 * list covers the later lines of the file.
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
import { lintCharged } from './lint-observation.js'

const RULE = `oracle/no-oracle-disable`
const repoRoot = fileURLToPath(new URL(`../../../`, import.meta.url))
const ORACLE_FILE = join(repoRoot, `packages/example/tests/a-oracle.test.js`)
const PRODUCTION_FILE = join(repoRoot, `packages/example/src/app.ts`)

// -- Grammar ------------------------------------------------------------------

const FORMS = [`line`, `nextLine`, `block`, `blockNextLine`, `blockLine`]
const NON_DIRECTIVE_FORMS = [`prose`, `jsdoc`, `string`]
const LISTS = {
  oracleOne: [`oracle/probe-form`],
  oracleTwo: [`oracle/probe-form`, `oracle/no-disabled`],
  otherOne: [`no-console`],
  mixed: [`no-console`, `oracle/no-disabled`],
  selfNaming: [`oracle/no-oracle-disable`],
  blank: [],
}
const LIST_KINDS = Object.keys(LISTS)
const QUOTES = [`bare`, `single`, `double`]
const DESCRIPTIONS = [`none`, `why`, `namesOracle`]
const LOCATIONS = [`oracleFile`, `productionSource`]
// The parser decides where ESLint's Program node begins: a header comment or the first statement.
const PARSERS = [`typescript`, `espree`]

const arbitrarySite = fc.record({
  form: fc.constantFrom(`none`, `config`, ...FORMS, ...NON_DIRECTIVE_FORMS),
  list: fc.constantFrom(...LIST_KINDS),
  quote: fc.constantFrom(...QUOTES),
  description: fc.constantFrom(...DESCRIPTIONS),
  tight: fc.boolean(),
  wrap: fc.boolean(),
})

// A config comment that names this rule turns it off for the file, so ESLint runs
// no rule and no rule can report it; the grammar writes such a comment as a
// comment for another oracle rule.
const site = arbitrarySite.filter(
  (item) => !(item.form === `config` && item.list === `selfNaming`),
)

const program = fc.record({
  location: fc.constantFrom(...LOCATIONS),
  parser: fc.constantFrom(...PARSERS),
  header: fc.boolean(),
  sites: fc.array(site, { minLength: 1, maxLength: 6 }),
})

// -- Model --------------------------------------------------------------------

// The plugin's rule names, written out here: the model must not read them from
// the rule, and it must not test a prefix, so a substring or prefix judgment
// in the rule cannot pass for the same judgment here.
const ORACLE_RULES = new Set([
  `oracle/no-disabled`,
  `oracle/no-oracle-disable`,
  `oracle/no-unit-test`,
  `oracle/oracle-property-only`,
  `oracle/pure-model`,
  `oracle/probe-form`,
  `oracle/replayable-seed`,
])
const isDirectiveForm = (form) => form === `config` || FORMS.includes(form)
const namesOracle = (list) => LISTS[list].some((name) => ORACLE_RULES.has(name))
const namesSelf = (list) => LISTS[list].includes(`oracle/no-oracle-disable`)
const isBlank = (list) => LISTS[list].length === 0
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

/** Whether a site's comment silences an oracle rule: a directive that names one, or has no list. */
const silencesOracle = (item) =>
  item.form === `config`
    ? namesOracle(item.list)
    : isDirectiveForm(item.form) &&
      (isBlank(item.list) || namesOracle(item.list))

/** Whether the site is a directive form whose list names this rule, or is blank: it suppresses this rule's reports. */
const suppresses = (item) =>
  item.form !== `config` &&
  isDirectiveForm(item.form) &&
  (isBlank(item.list) || namesSelf(item.list))

/** Whether the site's comment gets a report at all. */
const isReported = (item) => silencesOracle(item)

/**
 * Whether an earlier block directive covers this site's comment. The rule cannot
 * tell whether an oracle file's noInlineConfig is set, so coverage applies in
 * both locations, and a report there moves to the file's start.
 */
const coveredBy = (earlier) =>
  earlier.some((item) => item.form === `block` && suppresses(item))

/** The lines a site's leading comment takes: a wrapped block next-line comment takes two. */
const leadingLines = (item) => {
  if (item.form === `blockNextLine`) return item.wrap ? 2 : 1
  return isLeading(item.form) ? 1 : 0
}

/** The lines a site adds after its code line: a wrapped inline block comment takes one more. */
const trailingLines = (item) => (item.form === `block` && item.wrap ? 1 : 0)

/** The report location of a directive that hides its own report: the file's start, line 1, column 0. */
const FILE_START = 1

/** The line of the first code token: a header comment, when present, takes line 1. */
const firstTokenLine = ({ header }) => (header ? 2 : 1)

/** The expected reports for a program, from the grammar alone. */
function expectedReports(drawn) {
  const reports = []
  let line = firstTokenLine(drawn) + 1
  drawn.sites.forEach((item, index) => {
    if (isReported(item)) {
      // A directive that names this rule or has no list sits at the file's start.
      const atFirstToken =
        suppresses(item) || coveredBy(drawn.sites.slice(0, index))
      const ownLine = isLeading(item.form) ? line : line + leadingLines(item)
      reports.push({
        line: atFirstToken ? FILE_START : ownLine,
        messageId: `oracleDisable`,
      })
    }
    line += leadingLines(item) + 1 + trailingLines(item)
  })
  return reports
}

// The states a program enters, read from the grammar alone.
const statesOf = (drawn) => {
  const states = [`location:${drawn.location}`]
  if (drawn.header) states.push(`header`)
  states.push(`parser:${drawn.parser}`)
  drawn.sites.forEach((item, index) => {
    if (item.form !== `none`) states.push(`form:${item.form}`)
    if (NON_DIRECTIVE_FORMS.includes(item.form)) states.push(`nonDirective`)
    states.push(`list:${item.list}`)
    if (isDirectiveForm(item.form) && item.quote !== `bare`)
      states.push(`quoted`)
    if (item.tight) states.push(`tight`)
    if (isWrappable(item.form) && item.wrap) states.push(`wrapped`)
    if (item.description !== `none`) states.push(`described`)
    if (item.description === `namesOracle`) states.push(`describesOracle`)
    if (isDirectiveForm(item.form) && isBlank(item.list)) states.push(`blank`)
    if (item.list === `selfNaming` && isDirectiveForm(item.form))
      states.push(`selfNaming`)
    if (isDirectiveForm(item.form) && !isReported(item)) states.push(`silent`)
    if (isReported(item)) {
      states.push(`reported`)
      const earlier = drawn.sites.slice(0, index)
      if (coveredBy(earlier)) states.push(`covered`)
      else if (!suppresses(item)) states.push(`ownLine`)
    }
  })
  return states
}

const STATES = [
  ...LOCATIONS.map((location) => `location:${location}`),
  ...[`config`, ...FORMS, ...NON_DIRECTIVE_FORMS].map((form) => `form:${form}`),
  ...LIST_KINDS.map((list) => `list:${list}`),
  `header`,
  `parser:typescript`,
  `parser:espree`,
  `nonDirective`,
  `quoted`,
  `tight`,
  `wrapped`,
  `described`,
  `describesOracle`,
  `blank`,
  `selfNaming`,
  `silent`,
  `reported`,
  `covered`,
  `ownLine`,
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

/** An inline config comment that turns each listed rule off; an empty list has no rule to turn off. */
const configText = (item) =>
  LISTS[item.list].length === 0
    ? `/* eslint */`
    : `/* eslint ${LISTS[item.list].map((name) => `${name}: "off"`).join(`, `)} */`

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

function renderProgram({ header, sites }) {
  const lines = header ? [`/* a plain header comment */`] : []
  lines.push(`const header = true`)
  sites.forEach((item, index) => {
    const rendered = renderSite(item, index)
    lines.push(...rendered.leading, rendered.code)
  })
  return `${lines.join(`\n`)}\n`
}

/** The rule's reports for a rendered program, or the error that the rule threw. */
function lintProgram(item) {
  const production = item.location === `productionSource`
  const parser = item.parser === `typescript` ? { parser: tsParser } : {}
  const configs = production
    ? [{ languageOptions: parser }, plugin.configs.production]
    : [
        { languageOptions: { ...parser, sourceType: `module` } },
        plugin.configs.recommended,
      ]
  const run = lintCharged(() =>
    linter.verify(renderProgram(item), configs, {
      filename: production ? PRODUCTION_FILE : ORACLE_FILE,
    }),
  )
  if (run.threw !== undefined) return run
  const messages = run.messages
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

/** A history whose first two sites are the given patches. */
const withTwoSites = (first, second) => (generated) => {
  const base = generated.sites[0]
  return {
    ...generated,
    location: `productionSource`,
    sites: [
      { ...base, ...first },
      { ...base, ...second },
    ],
  }
}

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
    name: `a blanket line directive`,
    enters: [`blank`, `form:line`, `reported`],
    build: withSite({ form: `line`, list: `blank` }),
  },
  {
    name: `a blanket next-line directive`,
    enters: [`blank`, `form:nextLine`, `reported`],
    build: withSite({ form: `nextLine`, list: `blank` }),
  },
  {
    name: `a blanket block directive`,
    enters: [`blank`, `form:block`, `reported`],
    build: withSite({ form: `block`, list: `blank` }),
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
    name: `a directive after a block that names the rule itself`,
    enters: [`covered`, `reported`],
    build: withTwoSites(
      { form: `block`, list: `selfNaming` },
      { form: `line`, list: `oracleOne` },
    ),
  },
  {
    name: `a config comment after a blanket block`,
    enters: [`covered`, `form:config`, `reported`],
    build: withTwoSites(
      { form: `block`, list: `blank` },
      { form: `config`, list: `oracleOne` },
    ),
  },
  {
    name: `a directive after a block that names other rules`,
    enters: [`ownLine`, `reported`],
    build: withTwoSites(
      { form: `block`, list: `otherOne` },
      { form: `line`, list: `oracleOne` },
    ),
  },
  {
    name: `a program that begins with a header comment`,
    enters: [`header`, `reported`],
    build: (generated) => ({
      ...withSite({ form: `nextLine`, list: `oracleOne` })(generated),
      header: true,
    }),
  },
  {
    name: `a directive parsed by typescript-eslint`,
    enters: [`parser:typescript`, `reported`],
    build: (generated) => ({
      ...withSite({ form: `line`, list: `oracleOne` })(generated),
      parser: `typescript`,
    }),
  },
  {
    name: `a self-naming directive after a header comment, parsed by espree`,
    enters: [`header`, `parser:espree`, `selfNaming`, `reported`],
    build: (generated) => ({
      ...withSite({ form: `nextLine`, list: `selfNaming` })(generated),
      header: true,
      parser: `espree`,
    }),
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
    statement: `Every ESLint directive that would silence an oracle/* rule is reported once, in an oracle file and in production source, whatever its spelling: the line, next-line, and block forms; a bare, single-quoted, or double-quoted rule name; names separated with or without a space; a description; a block split over two lines; a list that names only oracle rules, only other rules, or both, including oracle/no-oracle-disable itself; and a blanket directive with no list. An inline config comment that names an oracle rule is reported. A report sits on the directive's line, or at the file's start (line 1, column 0, the same under either parser) when the directive names this rule, has no list, or lies under an earlier block directive. A comment that ESLint does not read as a directive, and a description that names an oracle rule, are not reported. The rule never throws on a program that parses.`,
    authority: `P8 of the frozen v20 design grammar: lint rules cannot be disabled inline, and the maintainer chose option b, a plugin rule that reports a directive that would silence an oracle rule; blanket directives are reported wherever ESLint lets the report through, and a self-naming directive is reported at the file's start. P10: a harness failure is never charged to the rule. The directive grammar is ESLint's.`,
    limits: `A self-naming or blanket directive on the first line covers the file's start, so no report can sit there; the grammar writes no directive on line 1. A config comment that names this rule turns it off for the file, so ESLint runs no rule and none reports it; the grammar does not write one. Block directives that cover later lines are not followed by enable directives. Config comments are reported at every severity; the grammar writes only off.`,
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
