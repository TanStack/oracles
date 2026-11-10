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
 * from every report. An entry the rule cannot judge (malformed, or naming a
 * file outside the oracle-file glob or an implementation module) is a
 * configuration error: the rule throws when it reads the settings, so the run
 * stops with the message, and nothing else is reported.
 *
 * Authority: the maintainer decision of 2026-11-09 that `oracleProperty` is the
 * only campaign API in `@tanstack/oracles`. The header of
 * `packages/oracles/src/oracle-property.ts` gives the reason: only a
 * constructed history makes a state's reach required, so a raw campaign's
 * reach depends on the seed.
 *
 * Grammar: a program is one module with a fast-check import in one of three
 * forms (`setting` says which legacy-list entry, if any, names this file), and
 * one site per line. A campaign site calls `assert` or `check` through the
 * default `fc` import or the alias. A prop site registers through `fcTest` or
 * `it`. A legacy import site names one of the two APIs. A quiet site is a
 * fast-check use that runs no campaign, a text, or a binding that is not
 * fast-check, and it must stay silent.
 *
 * Model: the expected outcome follows from the program alone. A bad entry is a
 * configuration error, whatever the file, and the expected outcome names the
 * message's phrase. Otherwise an implementation module reports nothing. A
 * reasonless entry reports `baselineWithoutReason`. A matching entry with no
 * legacy use reports `staleBaseline`. A file with a reasoned entry exempts its
 * raw uses and imports; any other setting reports each use at its line.
 *
 * Driver: renders the program and lints it with the plugin's `recommended`
 * config, so the rule must be enabled there. The outcome is the rule's reports,
 * or the message of the error that the run threw.
 *
 * Check: the outcome is the configuration error the model owes (its message
 * contains the phrase), or else the sorted reports equal the model's, exactly.
 *
 * Limits: an alias of a campaign (`const run = fc.assert`), a campaign held
 * in a helper, a fast-check import through a re-export, and `import()` of a
 * legacy module are not generated. The rule reads only the forms above. A
 * baseline entry for a deleted or renamed file is not reported, because no
 * lint run sees that file.
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
  // The configuration entry that the rule must refuse, or none.
  entry: fc.constantFrom(
    `none`,
    `none`,
    `outsideGlob`,
    `implementationModule`,
    `bareString`,
    `fileNotString`,
    `reasonNotString`,
  ),
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

function predictReports({ setting, sites }) {
  if (setting === `implementation`) return []
  const uses = usesOf(sites)
  const reports = []
  if (setting === `reasonless`)
    reports.push({ line: 1, messageId: `baselineWithoutReason` })
  if (entryMatches(setting) && uses.length === 0)
    reports.push({ line: 1, messageId: `staleBaseline` })
  if (setting !== `reasoned`) reports.push(...uses)
  return reports
}

// The phrase of the configuration error that each bad entry owes. A bad entry
// is refused whatever the file, so it is judged before the implementation case.
const REFUSED = {
  outsideGlob: `is not an oracle file`,
  implementationModule: `is a framework implementation module`,
  bareString: `is malformed`,
  fileNotString: `is malformed`,
  reasonNotString: `is malformed`,
}

/** The outcome the model owes: a configuration error, or the reports. */
function predictOutcome(plan) {
  const phrase = REFUSED[plan.entry]
  return phrase === undefined
    ? { reports: predictReports(plan) }
    : { configuration: phrase }
}

// The states a history enters, read from the program and the model's answer.
const STATES = {
  campaign: `a raw campaign is reported`,
  property: `a raw property is reported`,
  legacy: `a legacy import is reported`,
  exempt: `a reasoned baseline exempts its uses`,
  reasonless: `a reasonless baseline is reported`,
  stale: `a stale baseline is reported`,
  refused: `an entry outside the oracle glob is a configuration error`,
  malformed: `a malformed entry is a configuration error`,
  vitest: `a campaign through @fast-check/vitest is reported`,
}
const MEASURED = {
  implementation: `an implementation module is exempt`,
  otherFile: `another file's entry does not apply`,
  quiet: `a quiet site is not reported`,
}

function reachedStates(plan, _trace, expected) {
  const { setting, sites, alias } = plan
  const reports = expected.reports ?? []
  const messages = new Set(reports.map((report) => report.messageId))
  return [
    ...(messages.has(`rawCampaign`) ? [STATES.campaign] : []),
    ...(messages.has(`rawProperty`) ? [STATES.property] : []),
    ...(messages.has(`legacyImport`) ? [STATES.legacy] : []),
    ...(setting === `reasoned` && usesOf(sites).length > 0
      ? [STATES.exempt]
      : []),
    ...(messages.has(`baselineWithoutReason`) ? [STATES.reasonless] : []),
    ...(messages.has(`staleBaseline`) ? [STATES.stale] : []),
    ...(plan.entry === `outsideGlob` || plan.entry === `implementationModule`
      ? [STATES.refused]
      : []),
    ...(plan.entry === `bareString` ||
    plan.entry === `fileNotString` ||
    plan.entry === `reasonNotString`
      ? [STATES.malformed]
      : []),
    ...(alias === `vitest` && messages.has(`rawCampaign`)
      ? [STATES.vitest]
      : []),
    ...(setting === `implementation` ? [MEASURED.implementation] : []),
    ...(setting === `otherFile` ? [MEASURED.otherFile] : []),
    ...(sites.some((item) => item.kind === `quiet`) ? [MEASURED.quiet] : []),
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

function renderProgram({ alias, sites }) {
  return [
    ...HEADER,
    ALIAS_IMPORT[alias],
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
  fileNotString: {
    legacyCampaigns: [{ reason: `x` }],
    implementationModules: [],
  },
  reasonNotString: {
    legacyCampaigns: [{ file: FILE, reason: 3 }],
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
    legacyCampaigns: [...(own.legacyCampaigns ?? []), ...extra.legacyCampaigns],
  }
  const messages = linter.verify(
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
  const fatal = messages.find((message) => message.fatal)
  if (fatal)
    throw new Error(`the rendered program does not parse: ${fatal.message}`)
  return messages
    .filter((message) => message.ruleId === RULE)
    .map(({ line, messageId }) => ({ line, messageId }))
}

// -- Check --------------------------------------------------------------------

const reportKey = (report) => `${report.line}:${report.messageId}`
const sortedReports = (reports) =>
  [...reports].sort((a, b) => (reportKey(a) < reportKey(b) ? -1 : 1))

function check(plan, observations, expected) {
  const observed = observations.find((o) => o.checkpoint === `outcome`).value
  if (expected.configuration !== undefined) {
    return observed.configuration?.includes(expected.configuration)
      ? pass
      : violation(
          `outcome`,
          `the rule should refuse the entry with a configuration error that says "${expected.configuration}"`,
          `outcome`,
          { actual: observed, expected },
        )
  }
  return (
    differs(
      `outcome`,
      `outcome`,
      sortedReports(observed.reports ?? []),
      sortedReports(expected.reports),
    ) ?? pass
  )
}

oracleProperty({
  id: `lint.oracle-property-only`,
  law: {
    statement: `In an oracle file, a raw fast-check campaign (fc.assert, fc.check, or a .prop registration, through fast-check or @fast-check/vitest) and an import of createOracleReach or runOracleCampaign are reported, except in a file whose reasoned legacyCampaigns entry still matches a legacy use; a reasonless entry and a stale entry are reported; an implementation module is exempt; a malformed entry, or an entry outside the oracle glob or naming an implementation module, is a configuration error that stops the run.`,
    authority: `Maintainer decision (2026-11-09): oracleProperty is the only campaign API in @tanstack/oracles. Its header in packages/oracles/src/oracle-property.ts: constructed histories make a state's reach required, and a raw campaign has none.`,
    limits: `Aliased campaigns, a campaign held in a helper, re-exported fast-check bindings, and import() of a legacy module are not generated. A stale entry for a deleted file is not reported, since no lint run sees that file.`,
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
        name: `a malformed entry`,
        enters: [STATES.malformed],
        build: (generated) => ({
          ...generated,
          setting: `none`,
          entry: `bareString`,
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
  model: predictOutcome,
  driver: (plan, observe) => {
    try {
      observe(`outcome`, { reports: lintRendered(renderProgram(plan), plan) })
    } catch (error) {
      // Only a bad entry may stop the run. Any other error is a driver error.
      if (plan.entry === `none`) throw error
      observe(`outcome`, { configuration: String(error.message) })
    }
  },
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
      name: `a configuration error hidden as no reports`,
      law: `outcome`,
      corrupt: (trace) => {
        const observed = trace.find((o) => o.checkpoint === `outcome`)
        if (observed.value.configuration === undefined) return undefined
        return trace.map((o) =>
          o.checkpoint === `outcome` ? { ...o, value: { reports: [] } } : o,
        )
      },
    },
  ],
})
