/**
 * # `oracle/oracle-property-only`: an oracle file's campaigns run through `oracleProperty`
 *
 * Law: in an oracle file, a generated-history campaign runs only through
 * `oracleProperty`. The rule reports a raw campaign: `fc.assert` or `fc.check`
 * on a fast-check binding, from `fast-check` or from `@fast-check/vitest`, or a
 * `.prop` registration of a test root. It also reports an import of a legacy
 * reach or campaign API, `createOracleReach` or `runOracleCampaign`, under any
 * module. No configuration exempts an oracle file from these reports. A
 * framework implementation module is exempt from every report about its own
 * uses, since `oracleProperty` itself runs `fc.assert`.
 *
 * The removed setting. `settings.oracles.legacyCampaigns` once exempted the
 * files it listed. It is removed. A configuration that still sets it, to any
 * value (an empty list, a list of entries, or a value that is not a list),
 * gets one `removedSetting` report at line 1 of each oracle file it reaches,
 * since ESLint runs a rule once per file. The setting exempts nothing: a file
 * that it lists reports each raw use as any other file does. A setting whose
 * value is `undefined` is unset, as every other `settings.oracles` field is.
 *
 * Configuration reports, at line 1. The `removedSetting` report and a
 * non-array `implementationModules` (`malformedSetting`, read as an empty list)
 * are owed whatever the file, an implementation module included. The rule never
 * throws on a program that parses (frozen design principle P8; maintainer
 * decision 2026-11-09), so a setting it cannot use is reported, not thrown on,
 * and not silently ignored.
 *
 * Authority: the maintainer decision of 2026-11-09 that `oracleProperty` is the
 * only campaign API in `@tanstack/oracles`. The header of
 * `packages/oracles/src/oracle-property.ts` gives the reason: only a
 * constructed history makes a state's reach required, so a raw campaign's
 * reach depends on the seed. The maintainer decision of 2026-11-10 removes the
 * exemption list: "remove legacyCampaigns, as that's another out for agents".
 * The never-throws law rests on P8 and the decision of 2026-11-09 ("lint rules
 * never throw").
 *
 * Grammar: a program is one module with a fast-check import in one of four
 * forms (`alias`), a `legacyCampaigns` setting (`legacy`), the file's own
 * implementation-module setting (`setting`), and one site per line. The
 * `legacy` setting is absent (no key, or the key set to `undefined`), a list of
 * any subset of entry kinds (the empty list included), or a value that is not
 * a list. The entry kinds are the ones that the old rule judged differently:
 * a reasoned or reasonless entry for this file, by its tail or its full path,
 * an entry for another file, a README, or an implementation module, and
 * malformed entries. A campaign site calls `assert` or `check` through the
 * default `fc` import or the alias. A prop site registers through `fcTest` or
 * `it`. A legacy import site names one of the two APIs. A quiet site is a
 * fast-check use that runs no campaign, a text, or a binding that is not
 * fast-check, and it must stay silent. A directive is one block comment written
 * on the alias import's line, so the sites below it are inside it:
 * `eslint-disable oracle/oracle-property-only` or a bare `eslint-disable`. P8
 * forbids a disable of an oracle rule, so the directive is inert: the reports
 * are the same as without it.
 *
 * Model: the expected reports follow from the program alone. A present
 * `legacyCampaigns` owes `removedSetting` at line 1, and a non-array
 * `implementationModules` owes `malformedSetting` there. An implementation
 * module owes nothing else. Any other file reports each use at its line,
 * whatever `legacyCampaigns` holds.
 *
 * Driver: renders the program and lints it with the plugin's `recommended`
 * config, so the rule must be enabled there. The outcome is the rule's reports,
 * or the message of the error that the run threw.
 *
 * Check: a throw is a violation of the never-throws law. Otherwise the sorted
 * reports equal the model's, exactly.
 *
 * Limits: an alias of a campaign (`const run = fc.assert`), a campaign held
 * in a helper, a fast-check import through a re-export, and `import()` of a
 * legacy module are not generated. The rule reads only the forms above. A
 * string entry in `implementationModules` is not generated. A `legacyCampaigns`
 * value whose reading throws (a getter or a proxy) is not generated.
 */
import tsParser from '@typescript-eslint/parser'
import { Linter } from 'eslint'
import fc from 'fast-check'
import { differs, oracleProperty, pass, violation } from '@tanstack/oracles'
import plugin from '../src/index.js'
import { lintCharged } from './lint-observation.js'

const RULE = `oracle/oracle-property-only`
const FILE = `packages/example/tests/a-oracle.test.js`
const FIRST_SITE_LINE = 4
const LEGACY_NAMES = [`createOracleReach`, `runOracleCampaign`]

// -- Grammar ------------------------------------------------------------------

const site = fc.oneof(
  fc.record({
    kind: fc.constant(`campaign`),
    method: fc.constantFrom(`assert`, `check`),
    via: fc.constantFrom(`fc`, `alias`),
  }),
  fc.record({
    kind: fc.constant(`prop`),
    root: fc.constantFrom(`fcTest`, `it`),
  }),
  fc.record({
    kind: fc.constant(`legacyImport`),
    name: fc.constantFrom(...LEGACY_NAMES),
  }),
  fc.record({
    kind: fc.constant(`quiet`),
    variant: fc.constantFrom(
      `property`,
      `sample`,
      `oracleProperty`,
      `text`,
      `foreign`,
    ),
  }),
)

// The entries a `legacyCampaigns` list can hold. The first three name the file
// under test, so the old rule exempted it or reported its entry; the old rule
// refused or reported the others.
const LEGACY_ENTRIES = {
  reasoned: { file: `tests/a-oracle.test.js`, reason: `migrating` },
  fullPath: { file: FILE, reason: `migrating` },
  reasonless: { file: `tests/a-oracle.test.js` },
  otherFile: { file: `oracle.test.js`, reason: `another file` },
  readme: { file: `packages/example/README.md`, reason: `x` },
  implementationModule: {
    file: `packages/oracles/src/oracle-config.ts`,
    reason: `x`,
  },
  bareString: `tests/a-oracle.test.js`,
  missingFile: { reason: `x` },
  fileNotString: { file: 3, reason: `x` },
  reasonNotString: { file: FILE, reason: 3 },
}
const NAMES_FILE = new Set([`reasoned`, `fullPath`, `reasonless`])
const OLD_REPORTED = new Set([
  `readme`,
  `implementationModule`,
  `bareString`,
  `missingFile`,
  `fileNotString`,
  `reasonNotString`,
])
// `legacyCampaigns` values that are not a list.
const LEGACY_VALUES = {
  string: `tests/a-oracle.test.js`,
  null: null,
  object: { file: `tests/a-oracle.test.js`, reason: `migrating` },
  zero: 0,
  false: false,
}

const legacy = fc.oneof(
  {
    arbitrary: fc.record({
      form: fc.constant(`absent`),
      key: fc.constantFrom(`omitted`, `undefined`),
    }),
    weight: 2,
  },
  {
    arbitrary: fc.record({
      form: fc.constant(`list`),
      entries: fc.subarray(Object.keys(LEGACY_ENTRIES)),
    }),
    weight: 2,
  },
  {
    arbitrary: fc.record({
      form: fc.constant(`value`),
      value: fc.constantFrom(...Object.keys(LEGACY_VALUES)),
    }),
    weight: 1,
  },
)

const program = fc.record({
  alias: fc.constantFrom(`default`, `namespace`, `named`, `vitest`),
  setting: fc.constantFrom(`none`, `none`, `implementation`),
  legacy,
  // A block directive over the sites, or none. It must not change the reports.
  directive: fc.constantFrom(`none`, `none`, `oracleBlock`, `allBlock`),
  // The parser decides where ESLint's Program node begins: a leading comment, or the first statement.
  parser: fc.constantFrom(`typescript`, `espree`),
  // A header comment before the imports, so the program opens with a comment.
  header: fc.boolean(),
  // `implementationModules` as a non-array value, which the rule must report, not throw on.
  modules: fc.constantFrom(`none`, `none`, `notAnArray`),
  sites: fc.array(site, { minLength: 1, maxLength: 6 }),
})

// -- Model --------------------------------------------------------------------

const usesOf = (sites, header) =>
  sites.flatMap((item, index) => {
    const line = index + FIRST_SITE_LINE + (header ? 1 : 0)
    if (item.kind === `campaign`) return [{ line, messageId: `rawCampaign` }]
    if (item.kind === `prop`) return [{ line, messageId: `rawProperty` }]
    if (item.kind === `legacyImport`)
      return [{ line, messageId: `legacyImport` }]
    return []
  })

// Whether the file is exempt from its uses: an implementation module, by a list
// that the rule can read (a non-array list is read as empty).
const exemptModule = ({ setting, modules }) =>
  setting === `implementation` && modules === `none`

function expectedReports(plan) {
  const configuration = [
    ...(plan.modules === `notAnArray`
      ? [{ line: 1, messageId: `malformedSetting` }]
      : []),
    ...(plan.legacy.form === `absent`
      ? []
      : [{ line: 1, messageId: `removedSetting` }]),
  ]
  if (exemptModule(plan)) return configuration
  return [...configuration, ...usesOf(plan.sites, plan.header)]
}

// The states a history enters, read from the program and the model's answer.
const STATES = {
  campaign: `a raw campaign is reported`,
  property: `a raw property is reported`,
  legacy: `a legacy import is reported`,
  removedEmpty: `an empty legacyCampaigns list is reported as removed`,
  removedValue: `a legacyCampaigns value that is not a list is reported as removed`,
  listedReported: `a file that a legacyCampaigns entry names still reports its raw uses`,
  listedQuiet: `a file that a legacyCampaigns entry names, with no raw use, reports only the removal`,
  removedJudged: `a legacyCampaigns list with entries the old rule refused or found malformed is reported once as removed`,
  removedInModule: `an implementation module reports a present legacyCampaigns setting`,
  moduleNotArray: `an implementationModules value that is not an array is reported and exempts nothing`,
  openComment: `a program under espree opens with a comment, so its first statement is not its first line`,
  vitest: `a campaign through @fast-check/vitest is reported`,
  silenced: `a disable directive is written over a reported site, and it does not silence it`,
}
const MEASURED = {
  implementation: `an implementation module is exempt`,
  undefinedKey: `a legacyCampaigns key set to undefined is unset`,
  quiet: `a quiet site is not reported`,
}

function reachedStates(plan, _trace, expected) {
  const { sites, alias, header, parser, legacy: setting } = plan
  const messages = new Set(expected.reports.map((report) => report.messageId))
  const entries = setting.form === `list` ? setting.entries : []
  const listed = entries.some((entry) => NAMES_FILE.has(entry))
  const uses = usesOf(sites).length > 0
  const checked = !exemptModule(plan)
  return [
    ...(messages.has(`rawCampaign`) ? [STATES.campaign] : []),
    ...(messages.has(`rawProperty`) ? [STATES.property] : []),
    ...(messages.has(`legacyImport`) ? [STATES.legacy] : []),
    ...(setting.form === `list` && entries.length === 0
      ? [STATES.removedEmpty]
      : []),
    ...(setting.form === `value` ? [STATES.removedValue] : []),
    ...(listed && checked && uses ? [STATES.listedReported] : []),
    ...(listed && checked && !uses ? [STATES.listedQuiet] : []),
    ...(entries.some((entry) => OLD_REPORTED.has(entry))
      ? [STATES.removedJudged]
      : []),
    ...(!checked && messages.has(`removedSetting`)
      ? [STATES.removedInModule]
      : []),
    ...(messages.has(`malformedSetting`) ? [STATES.moduleNotArray] : []),
    ...(parser === `espree` && header ? [STATES.openComment] : []),
    ...(alias === `vitest` && messages.has(`rawCampaign`)
      ? [STATES.vitest]
      : []),
    ...(plan.setting === `implementation` ? [MEASURED.implementation] : []),
    ...(setting.form === `absent` && setting.key === `undefined`
      ? [MEASURED.undefinedKey]
      : []),
    ...(sites.some((item) => item.kind === `quiet`) ? [MEASURED.quiet] : []),
    ...(plan.directive !== `none` &&
    expected.reports.some((report) => report.line >= FIRST_SITE_LINE)
      ? [STATES.silenced]
      : []),
  ]
}

// -- Driver -------------------------------------------------------------------

const HEADER = [
  `import fc from 'fast-check'`,
  `import { test as fcTest } from '@fast-check/vitest'`,
]
const ALIAS_IMPORT = {
  default: `import fastCheck from 'fast-check'`,
  namespace: `import * as fastCheck from 'fast-check'`,
  named: `import { assert, check } from 'fast-check'`,
  // The fast-check namespace that @fast-check/vitest re-exports.
  vitest: `import { fc as fastCheck } from '@fast-check/vitest'`,
}
const QUIET = {
  property: `const property{i} = fc.property(fc.nat(), (n) => n >= 0)`,
  sample: `fc.sample(fc.nat(), 3)`,
  oracleProperty: `oracleProperty({ id: 'site{i}' })`,
  text: `const text{i} = 'fc.assert(property)'`,
  foreign: `const other{i} = { assert() {} }; other{i}.assert(true)`,
}

function renderSite(item, alias, index) {
  if (item.kind === `campaign`) {
    const callee =
      item.via === `fc`
        ? `fc.${item.method}`
        : alias === `named`
          ? item.method
          : `fastCheck.${item.method}`
    return `${callee}(fc.property(fc.nat(), (n) => n >= 0))`
  }
  if (item.kind === `prop`)
    return `${item.root}.prop([fc.nat()])('case ${index}', (n) => n >= 0)`
  if (item.kind === `legacyImport`)
    return `import { ${item.name} as legacy${index} } from '@tanstack/oracles'`
  return QUIET[item.variant].replaceAll(`{i}`, String(index))
}

// A block directive on the alias import's line covers every site below it.
const DIRECTIVE = {
  none: ``,
  oracleBlock: ` /* eslint-disable oracle/oracle-property-only */`,
  allBlock: ` /* eslint-disable */`,
}

function renderProgram({ alias, sites, directive, header }) {
  return [
    ...(header ? [`/* a header comment */`] : []),
    ...HEADER,
    ALIAS_IMPORT[alias] + DIRECTIVE[directive],
    ...sites.map((item, index) => renderSite(item, alias, index)),
    ``,
  ].join(`\n`)
}

/** The `legacyCampaigns` part of `settings.oracles` for a generated setting. */
function legacySetting(setting) {
  if (setting.form === `absent`)
    return setting.key === `undefined` ? { legacyCampaigns: undefined } : {}
  if (setting.form === `value`)
    return { legacyCampaigns: LEGACY_VALUES[setting.value] }
  return {
    legacyCampaigns: setting.entries.map((entry) => LEGACY_ENTRIES[entry]),
  }
}

const linter = new Linter({ configType: `flat` })

/** The rule's reports for a rendered program, or the error the run threw. */
function lintRendered(code, { setting, legacy: legacyPlan, modules, parser }) {
  const oracles = {
    // A non-array value replaces the list, so no module is exempt.
    implementationModules:
      modules === `notAnArray`
        ? `tests/a-oracle.test.js`
        : setting === `implementation`
          ? [FILE]
          : [],
    ...legacySetting(legacyPlan),
  }
  const run = lintCharged(() =>
    linter.verify(
      code,
      [
        {
          ...plugin.configs.recommended,
          files: [`**/*.js`],
          languageOptions: {
            ...(parser === `typescript` ? { parser: tsParser } : {}),
            sourceType: `module`,
          },
          settings: { oracles },
        },
      ],
      { filename: FILE },
    ),
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

function check(plan, observations, expected) {
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

// The generated sites with a raw campaign first, so the history has a use to report.
const withCampaign = (generated, method = `assert`) => [
  { kind: `campaign`, method, via: `alias` },
  ...generated.sites.slice(1),
]

oracleProperty({
  id: `lint.oracle-property-only`,
  law: {
    statement: `In an oracle file, a raw fast-check campaign (fc.assert, fc.check, or a .prop registration, through fast-check or @fast-check/vitest) and an import of createOracleReach or runOracleCampaign are reported, and no configuration exempts the file; an implementation module is exempt from its own uses. A disable directive (eslint-disable, or a block for oracle/oracle-property-only) does not silence the rule. A settings.oracles.legacyCampaigns value that is set, whatever it holds, is reported once at line 1 as removed and exempts nothing; a non-array implementationModules is reported at line 1; both reports are owed in an implementation module too. The rule never throws on a program that parses.`,
    authority: `Maintainer decision (2026-11-09): oracleProperty is the only campaign API in @tanstack/oracles; its header in packages/oracles/src/oracle-property.ts: constructed histories make a state's reach required, and a raw campaign has none. Maintainer decision (2026-11-10): "remove legacyCampaigns, as that's another out for agents". Frozen principle P8: lint rules never throw.`,
    limits: `Aliased campaigns, a campaign held in a helper, re-exported fast-check bindings, and import() of a legacy module are not generated. A string entry in implementationModules is not generated. A legacyCampaigns value whose reading throws (a getter or a proxy) is not generated. A one-line directive (eslint-disable-next-line) is not generated, since it moves the site lines; the block forms are.`,
  },
  histories: {
    arbitrary: program,
    runs: 60,
    fixedSeeds: [20261109],
    states: Object.values(STATES),
    measured: Object.values(MEASURED),
    constructed: [
      {
        name: `an empty legacyCampaigns list`,
        enters: [STATES.removedEmpty],
        build: (generated) => ({
          ...generated,
          legacy: { form: `list`, entries: [] },
        }),
      },
      {
        name: `a legacyCampaigns value that is not a list`,
        enters: [STATES.removedValue],
        build: (generated) => ({
          ...generated,
          legacy: { form: `value`, value: `string` },
        }),
      },
      {
        name: `a reasoned legacyCampaigns entry for a file with a raw campaign`,
        enters: [STATES.listedReported],
        build: (generated) => ({
          ...generated,
          setting: `none`,
          legacy: { form: `list`, entries: [`reasoned`] },
          sites: withCampaign(generated, `check`),
        }),
      },
      {
        name: `a legacyCampaigns entry for a file with no raw use`,
        enters: [STATES.listedQuiet],
        build: (generated) => ({
          ...generated,
          setting: `none`,
          legacy: { form: `list`, entries: [`reasoned`, `reasonless`] },
          sites: [
            { kind: `quiet`, variant: `foreign` },
            ...generated.sites
              .filter((item) => item.kind === `quiet`)
              .slice(0, 5),
          ],
        }),
      },
      {
        name: `a legacyCampaigns list of refused and malformed entries`,
        enters: [STATES.removedJudged],
        build: (generated) => ({
          ...generated,
          legacy: {
            form: `list`,
            entries: [`readme`, `bareString`, `reasonNotString`],
          },
        }),
      },
      {
        name: `an implementation module with a legacyCampaigns setting`,
        enters: [STATES.removedInModule],
        build: (generated) => ({
          ...generated,
          setting: `implementation`,
          modules: `none`,
          legacy: { form: `list`, entries: [`fullPath`] },
        }),
      },
      {
        name: `a program under espree that opens with a comment`,
        enters: [STATES.openComment, STATES.removedValue],
        build: (generated) => ({
          ...generated,
          legacy: { form: `value`, value: `null` },
          parser: `espree`,
          header: true,
        }),
      },
      {
        name: `an implementationModules value that is not an array`,
        enters: [STATES.moduleNotArray],
        build: (generated) => ({
          ...generated,
          modules: `notAnArray`,
        }),
      },
      {
        name: `a campaign through @fast-check/vitest`,
        enters: [STATES.vitest],
        build: (generated) => ({
          ...generated,
          setting: `none`,
          alias: `vitest`,
          sites: withCampaign(generated),
        }),
      },
      {
        name: `a disable directive over a raw campaign`,
        enters: [STATES.silenced],
        build: (generated) => ({
          ...generated,
          setting: `none`,
          directive: `oracleBlock`,
          sites: withCampaign(generated),
        }),
      },
      {
        name: `a raw campaign`,
        enters: [STATES.campaign],
        build: (generated) => ({
          ...generated,
          setting: `none`,
          sites: withCampaign(generated),
        }),
      },
      {
        name: `a raw property`,
        enters: [STATES.property],
        build: (generated) => ({
          ...generated,
          setting: `none`,
          sites: [
            { kind: `prop`, root: `fcTest` },
            ...generated.sites.slice(1),
          ],
        }),
      },
      {
        name: `a legacy import`,
        enters: [STATES.legacy],
        build: (generated) => ({
          ...generated,
          setting: `none`,
          sites: [
            { kind: `legacyImport`, name: `runOracleCampaign` },
            ...generated.sites.slice(1),
          ],
        }),
      },
    ],
  },
  reached: reachedStates,
  model: (plan) => ({ reports: expectedReports(plan) }),
  driver: (plan, observe) =>
    observe(`outcome`, lintRendered(renderProgram(plan), plan)),
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
