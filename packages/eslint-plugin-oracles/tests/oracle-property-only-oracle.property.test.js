/**
 * # `oracle/oracle-property-only`: an oracle file's campaigns run through `oracleProperty`
 *
 * Law: in an oracle file, a generated-history campaign runs only through
 * `oracleProperty`. The rule reports a raw campaign: `fc.assert` or `fc.check`
 * on a fast-check binding, from `fast-check` or from `@fast-check/vitest`, or a
 * `.prop` registration of a test root. It also reports an import of a legacy
 * reach or campaign API, `createOracleReach` or `runOracleCampaign`, under any
 * module. A file that the project lists in `settings.oracles.legacyCampaigns`
 * with a reason keeps its raw campaigns and imports until it migrates. An entry
 * without a reason exempts nothing and is reported. An entry whose file has no
 * legacy use is reported as stale. A framework implementation module is exempt
 * from every report about its own uses. A configuration entry the rule cannot
 * judge is reported, never thrown: the rule never throws on a program that
 * parses (frozen design principle P8; maintainer decision 2026-11-09). A
 * reported entry exempts nothing, and the file's other entries are judged as
 * usual.
 *
 * Configuration reports, at line 1. A malformed entry (not an object with a
 * string `file`, and a `reason` that is absent or a string) is `malformedEntry`.
 * A `legacyCampaigns` value that is not an array is `malformedList`, and it
 * replaces the file's own list. An entry that names a file outside the
 * oracle-file glob (its name has no `oracle` and an extension of .ts, .tsx,
 * .js, .jsx, or .mjs), or a framework implementation module, is `refusedEntry`.
 * ESLint runs a rule once per file, so each oracle file that the configuration
 * reaches reports the entry.
 *
 * Authority: the maintainer decision of 2026-11-09 that `oracleProperty` is the
 * only campaign API in `@tanstack/oracles`. The header of
 * `packages/oracles/src/oracle-property.ts` gives the reason: only a
 * constructed history makes a state's reach required, so a raw campaign's
 * reach depends on the seed. The never-throws law rests on P8 and the same
 * maintainer decision of 2026-11-09 ("lint rules never throw").
 *
 * Grammar: a program is one module with a fast-check import in one of three
 * forms (`alias`), one configuration entry for the file (`entry`), a file's own
 * legacy-list setting (`setting`), and one site per line. A campaign site calls
 * `assert` or `check` through the default `fc` import or the alias. A prop site
 * registers through `fcTest` or `it`. A legacy import site names one of the two
 * APIs. A quiet site is a fast-check use that runs no campaign, a text, or a
 * binding that is not fast-check, and it must stay silent. A directive is
 * one block comment written on the alias import's line, so the sites below it
 * are inside it: `eslint-disable oracle/oracle-property-only` or a bare
 * `eslint-disable`. P8 forbids a disable of an oracle rule, so the directive is
 * inert: the reports are the same as without it.
 *
 * Model: the expected reports follow from the program alone. A configuration
 * entry owes its report at line 1, whatever the file, including an
 * implementation module. A non-array list owes `malformedList` and voids the
 * file's own entry. An implementation module is otherwise exempt from its uses.
 * A reasonless entry reports `baselineWithoutReason`. A matching entry with no
 * legacy use reports `staleBaseline`. A file with a reasoned entry exempts its
 * raw uses and imports; any other setting reports each use at its line.
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
 * legacy module are not generated. The rule reads only the forms above. Only
 * `legacyCampaigns` is generated as configuration; `implementationModules` is
 * not. A baseline entry for a deleted or renamed file is not reported, because
 * no lint run sees that file.
 */
import tsParser from '@typescript-eslint/parser'
import { Linter } from 'eslint'
import fc from 'fast-check'
import { differs, oracleProperty, pass, violation } from '@tanstack/oracles'
import plugin from '../src/index.js'

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

const program = fc.record({
  alias: fc.constantFrom(`default`, `namespace`, `named`, `vitest`),
  setting: fc.constantFrom(
    `none`,
    `implementation`,
    `reasoned`,
    `reasonless`,
    `otherFile`,
  ),
  // The configuration entry that the rule must report, or none. Each kind is a
  // way that an entry, or the list itself, cannot be judged.
  entry: fc.constantFrom(
    `none`,
    `none`,
    `outsideGlob`,
    `readme`,
    `implementationModule`,
    `bareString`,
    `missingFile`,
    `fileNotString`,
    `reasonNotString`,
    `notAList`,
  ),
  // A block directive over the sites, or none. It must not change the reports.
  directive: fc.constantFrom(`none`, `none`, `oracleBlock`, `allBlock`),
  sites: fc.array(site, { minLength: 1, maxLength: 6 }),
})

// -- Model --------------------------------------------------------------------

const usesOf = (sites) =>
  sites.flatMap((item, index) => {
    const line = index + FIRST_SITE_LINE
    if (item.kind === `campaign`) return [{ line, messageId: `rawCampaign` }]
    if (item.kind === `prop`) return [{ line, messageId: `rawProperty` }]
    if (item.kind === `legacyImport`)
      return [{ line, messageId: `legacyImport` }]
    return []
  })

// Whether the file's own entry matches it: a reasoned or reasonless entry.
const entryMatches = (setting) =>
  setting === `reasoned` || setting === `reasonless`

const MALFORMED = new Set([
  `bareString`,
  `missingFile`,
  `fileNotString`,
  `reasonNotString`,
])
const REFUSED = new Set([`outsideGlob`, `readme`, `implementationModule`])

/** The report that a configuration entry owes at line 1, or none. */
function configurationReports(entry) {
  if (entry === `notAList`) return [{ line: 1, messageId: `malformedList` }]
  if (MALFORMED.has(entry)) return [{ line: 1, messageId: `malformedEntry` }]
  if (REFUSED.has(entry)) return [{ line: 1, messageId: `refusedEntry` }]
  return []
}

function expectedReports({ setting, entry, sites }) {
  const configuration = configurationReports(entry)
  // The configuration report is owed whatever the file, implementation or not.
  if (setting === `implementation`) return configuration
  // A list that is not an array is ignored whole, so the file's own entry is void.
  const effective = entry === `notAList` ? `none` : setting
  const uses = usesOf(sites)
  const reports = [...configuration]
  if (effective === `reasonless`)
    reports.push({ line: 1, messageId: `baselineWithoutReason` })
  if (entryMatches(effective) && uses.length === 0)
    reports.push({ line: 1, messageId: `staleBaseline` })
  if (effective !== `reasoned`) reports.push(...uses)
  return reports
}

// The states a history enters, read from the program and the model's answer.
const STATES = {
  campaign: `a raw campaign is reported`,
  property: `a raw property is reported`,
  legacy: `a legacy import is reported`,
  exempt: `a reasoned baseline exempts its uses`,
  reasonless: `a reasonless baseline is reported`,
  stale: `a stale baseline is reported`,
  refused: `an entry the rule refuses (outside the oracle glob, a README, or an implementation module) is reported`,
  malformed: `a malformed entry is reported`,
  notList: `a legacyCampaigns value that is not an array is reported`,
  vitest: `a campaign through @fast-check/vitest is reported`,
  silenced: `a disable directive is written over a reported site, and it does not silence it`,
}
const MEASURED = {
  implementation: `an implementation module is exempt`,
  otherFile: `another file's entry does not apply`,
  quiet: `a quiet site is not reported`,
}

function reachedStates(plan, _trace, expected) {
  const { setting, sites, alias, entry } = plan
  const messages = new Set(expected.reports.map((report) => report.messageId))
  return [
    ...(messages.has(`rawCampaign`) ? [STATES.campaign] : []),
    ...(messages.has(`rawProperty`) ? [STATES.property] : []),
    ...(messages.has(`legacyImport`) ? [STATES.legacy] : []),
    ...(setting === `reasoned` &&
    entry !== `notAList` &&
    usesOf(sites).length > 0
      ? [STATES.exempt]
      : []),
    ...(messages.has(`baselineWithoutReason`) ? [STATES.reasonless] : []),
    ...(messages.has(`staleBaseline`) ? [STATES.stale] : []),
    ...(messages.has(`refusedEntry`) ? [STATES.refused] : []),
    ...(messages.has(`malformedEntry`) ? [STATES.malformed] : []),
    ...(messages.has(`malformedList`) ? [STATES.notList] : []),
    ...(alias === `vitest` && messages.has(`rawCampaign`)
      ? [STATES.vitest]
      : []),
    ...(setting === `implementation` ? [MEASURED.implementation] : []),
    ...(setting === `otherFile` ? [MEASURED.otherFile] : []),
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

function renderProgram({ alias, sites, directive }) {
  return [
    ...HEADER,
    ALIAS_IMPORT[alias] + DIRECTIVE[directive],
    ...sites.map((item, index) => renderSite(item, alias, index)),
    ``,
  ].join(`\n`)
}

// The configuration entries that each bad-entry kind adds to the file's own.
const entryFor = {
  none: { legacyCampaigns: [], implementationModules: [] },
  outsideGlob: {
    legacyCampaigns: [{ file: `packages/example/src/app.ts`, reason: `x` }],
    implementationModules: [],
  },
  readme: {
    legacyCampaigns: [{ file: `packages/example/README.md`, reason: `x` }],
    implementationModules: [],
  },
  implementationModule: {
    legacyCampaigns: [
      { file: `packages/oracles/src/oracle-config.ts`, reason: `x` },
    ],
    implementationModules: [`packages/oracles/src/oracle-config.ts`],
  },
  bareString: {
    legacyCampaigns: [`tests/a-oracle.test.js`],
    implementationModules: [],
  },
  missingFile: {
    legacyCampaigns: [{ reason: `x` }],
    implementationModules: [],
  },
  fileNotString: {
    legacyCampaigns: [{ file: 3, reason: `x` }],
    implementationModules: [],
  },
  reasonNotString: {
    legacyCampaigns: [{ file: FILE, reason: 3 }],
    implementationModules: [],
  },
  // The list itself is not an array: it is a string, and it replaces the file's own list.
  notAList: {
    legacyCampaigns: `tests/a-oracle.test.js`,
    implementationModules: [],
  },
}

const settingsFor = {
  none: {},
  implementation: { implementationModules: [FILE] },
  reasoned: {
    legacyCampaigns: [{ file: `tests/a-oracle.test.js`, reason: `migrating` }],
  },
  reasonless: { legacyCampaigns: [{ file: `tests/a-oracle.test.js` }] },
  // A different file's name ends the same way: a path boundary is required.
  otherFile: {
    legacyCampaigns: [{ file: `oracle.test.js`, reason: `another file` }],
  },
}

const linter = new Linter({ configType: `flat` })

/** The rule's reports for a rendered program, or the error the run threw. */
function lintRendered(code, { setting, entry }) {
  const own = settingsFor[setting]
  const extra = entryFor[entry]
  const oracles = {
    ...own,
    implementationModules: [
      ...(own.implementationModules ?? []),
      ...extra.implementationModules,
    ],
    legacyCampaigns: Array.isArray(extra.legacyCampaigns)
      ? [...(own.legacyCampaigns ?? []), ...extra.legacyCampaigns]
      : extra.legacyCampaigns,
  }
  let messages
  try {
    messages = linter.verify(
      code,
      [
        {
          ...plugin.configs.recommended,
          files: [`**/*.js`],
          languageOptions: { parser: tsParser, sourceType: `module` },
          settings: { oracles },
        },
      ],
      { filename: FILE },
    )
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

oracleProperty({
  id: `lint.oracle-property-only`,
  law: {
    statement: `In an oracle file, a disable directive (eslint-disable, or a block for oracle/oracle-property-only) does not silence the rule: the reports are the same with or without it. A raw fast-check campaign (fc.assert, fc.check, or a .prop registration, through fast-check or @fast-check/vitest) and an import of createOracleReach or runOracleCampaign are reported, except in a file whose reasoned legacyCampaigns entry still matches a legacy use; a reasonless entry and a stale entry are reported; an implementation module is exempt from its own uses; a malformed or refused entry, and a legacyCampaigns value that is not an array, are reported at line 1 and exempt nothing; and the rule never throws on a program that parses.`,
    authority: `Maintainer decision (2026-11-09): oracleProperty is the only campaign API in @tanstack/oracles. Its header in packages/oracles/src/oracle-property.ts: constructed histories make a state's reach required, and a raw campaign has none.`,
    limits: `Aliased campaigns, a campaign held in a helper, re-exported fast-check bindings, and import() of a legacy module are not generated. Only legacyCampaigns is generated as configuration; implementationModules is not. A one-line directive (eslint-disable-next-line) is not generated, since it moves the site lines; the block forms are. A stale entry for a deleted file is not reported, since no lint run sees that file.`,
    owner: `eslint-plugin-oracles lint rules`,
  },
  histories: {
    arbitrary: program,
    runs: 60,
    fixedSeeds: [20261109],
    states: Object.values(STATES),
    measured: Object.values(MEASURED),
    constructed: [
      {
        name: `an entry outside the oracle glob`,
        enters: [STATES.refused],
        build: (generated) => ({
          ...generated,
          setting: `none`,
          entry: `outsideGlob`,
        }),
      },
      {
        name: `a README entry`,
        enters: [STATES.refused],
        build: (generated) => ({
          ...generated,
          setting: `none`,
          entry: `readme`,
        }),
      },
      {
        name: `a malformed entry`,
        enters: [STATES.malformed],
        build: (generated) => ({
          ...generated,
          setting: `none`,
          entry: `bareString`,
        }),
      },
      {
        name: `a legacy list that is not an array`,
        enters: [STATES.notList],
        build: (generated) => ({
          ...generated,
          setting: `reasoned`,
          entry: `notAList`,
        }),
      },
      {
        name: `a campaign through @fast-check/vitest`,
        enters: [STATES.vitest],
        build: (generated) => ({
          ...generated,
          setting: `none`,
          entry: `none`,
          alias: `vitest`,
          sites: [
            { kind: `campaign`, method: `assert`, via: `alias` },
            ...generated.sites.slice(1),
          ],
        }),
      },
      {
        name: `a disable directive over a raw campaign`,
        enters: [STATES.silenced],
        build: (generated) => ({
          ...generated,
          setting: `none`,
          entry: `none`,
          directive: `oracleBlock`,
          sites: [
            { kind: `campaign`, method: `assert`, via: `alias` },
            ...generated.sites.slice(1),
          ],
        }),
      },
      {
        name: `a raw campaign`,
        enters: [STATES.campaign],
        build: (generated) => ({
          ...generated,
          setting: `none`,
          entry: `none`,
          sites: [
            { kind: `campaign`, method: `assert`, via: `alias` },
            ...generated.sites.slice(1),
          ],
        }),
      },
      {
        name: `a raw property`,
        enters: [STATES.property],
        build: (generated) => ({
          ...generated,
          setting: `none`,
          entry: `none`,
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
          entry: `none`,
          sites: [
            { kind: `legacyImport`, name: `runOracleCampaign` },
            ...generated.sites.slice(1),
          ],
        }),
      },
      {
        name: `a reasoned baseline with a raw campaign`,
        enters: [STATES.exempt],
        build: (generated) => ({
          ...generated,
          setting: `reasoned`,
          entry: `none`,
          sites: [
            { kind: `campaign`, method: `check`, via: `fc` },
            ...generated.sites.slice(1),
          ],
        }),
      },
      {
        name: `a reasonless baseline`,
        enters: [STATES.reasonless],
        build: (generated) => ({
          ...generated,
          setting: `reasonless`,
          entry: `none`,
        }),
      },
      {
        name: `a reasoned baseline with no legacy use`,
        enters: [STATES.stale],
        build: (generated) => ({
          ...generated,
          setting: `reasoned`,
          entry: `none`,
          sites: [
            { kind: `quiet`, variant: `foreign` },
            ...generated.sites
              .filter((item) => item.kind === `quiet`)
              .slice(0, 5),
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
