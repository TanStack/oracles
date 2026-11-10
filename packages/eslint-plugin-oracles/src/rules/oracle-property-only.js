/**
 * An oracle file runs its generated histories through `oracleProperty`, and
 * through no other campaign. This rule reports the two other forms:
 *
 * - A raw campaign: `fc.assert(...)` or `fc.check(...)` on a fast-check
 *   binding (a default, namespace, or named import), and a `.prop([...])`
 *   registration of a test root such as `fcTest` from `@fast-check/vitest`.
 * - A legacy campaign API: an import of `createOracleReach` or
 *   `runOracleCampaign`, from any module, since the names have no other use.
 *
 * The name says what the rule enforces: the only property campaign in an
 * oracle file is `oracleProperty`, so the rule is `oracle-property-only`.
 *
 * Why. Only a constructed history makes a state's reach required. A raw
 * campaign has no constructed histories, so the states its law needs are
 * reached only where the seed happens to draw them, and a passing run shows
 * no reach (maintainer decision, 2026-11-09; packages/oracles/src/oracle-property.ts
 * header).
 *
 * Exemptions:
 *
 * - A framework implementation module (`settings.oracles.implementationModules`)
 *   is exempt. `oracleProperty` itself runs `fc.assert`, and it is the one
 *   campaign the framework has.
 * - A file named by a `settings.oracles.legacyCampaigns` entry with a non-empty
 *   `reason` keeps its raw campaigns and legacy imports while it migrates. The
 *   entry exempts only the file it names, by a path boundary.
 *
 * Entry checks. An entry without a reason exempts nothing and is reported
 * (`baselineWithoutReason`). An entry for a file that has no legacy use left is
 * reported as stale (`staleBaseline`). The rule never throws on a program that
 * parses (frozen design principle P8; maintainer decision 2026-11-09). An entry
 * that it cannot judge is reported instead, at line 1 of each oracle file that
 * the configuration reaches, since ESLint runs a rule once per file, and it
 * exempts nothing: a malformed entry (not an object with a string `file`, and a
 * `reason` that is absent or a string) is `malformedEntry`; a `legacyCampaigns`
 * value that is not an array is `malformedList`, and it replaces the file's
 * own list; a file outside the oracle-file glob, or a framework implementation
 * module, is `refusedEntry`.
 *
 * What the rule cannot do. It sees one file's source and its settings, not the
 * base commit, so it cannot tell a new entry from an old one. It does not stop
 * a baseline from growing. A project that wants the baseline to shrink only
 * enforces that in its own diff check, against the base's entries.
 *
 * The legacy-name check is kept after the APIs are removed from
 * @tanstack/oracles, so a project that still vendors them, and reimports
 * them, sees the reports.
 *
 * Limits: the rule reads the forms above only. A campaign held in an alias
 * (`const run = fc.assert`), called from a helper, or reached through a
 * re-exported fast-check binding is not followed. A stale entry for a deleted
 * file is not reported, since no lint run sees that file.
 */

import {
  calleeChain,
  findVariable,
  isModuleFile,
  isTestRoot,
  oracleSettings,
} from '../registration.js'

// The modules that export fast-check's campaign functions: fast-check itself,
// and @fast-check/vitest, which re-exports its `fc`.
const FAST_CHECK_MODULES = new Set([`fast-check`, `@fast-check/vitest`])
const CAMPAIGN_METHODS = new Set([`assert`, `check`])
const LEGACY_NAMES = new Set([`createOracleReach`, `runOracleCampaign`])

/** The name an import specifier takes from its module, by its identifier or string form. */
const importedName = (specifier) =>
  specifier.imported?.name ?? specifier.imported?.value

/** The `import` a binding came from, as `{ source, imported }`, or undefined. */
function importOf(identifier, sourceCode) {
  const definition = findVariable(
    sourceCode.getScope(identifier),
    identifier.name,
  )?.defs[0]
  if (definition?.type !== `ImportBinding`) return undefined
  return {
    source: definition.parent.source.value,
    imported: importedName(definition.node),
  }
}

/** Whether a file is in the oracle-file glob: its name has `oracle` and a source extension. */
const isOracleFileName = (file) => {
  const name = file.replaceAll(`\\`, `/`).split(`/`).at(-1)
  return name.includes(`oracle`) && /\.(ts|tsx|js|jsx|mjs)$/.test(name)
}

/**
 * Splits the configured entries into the ones the rule can judge, and the
 * problems it reports for the rest. Nothing here throws.
 */
function judgeEntries(entries, implementationModules) {
  if (!Array.isArray(entries))
    return { judged: [], problems: [{ messageId: `malformedList` }] }
  const judged = []
  const problems = []
  entries.forEach((entry, index) => {
    const at = `legacyCampaigns entry ${index}`
    if (
      typeof entry !== `object` ||
      entry === null ||
      typeof entry.file !== `string` ||
      (entry.reason !== undefined && typeof entry.reason !== `string`)
    )
      problems.push({ messageId: `malformedEntry`, data: { at } })
    else if (!isOracleFileName(entry.file))
      problems.push({
        messageId: `refusedEntry`,
        data: { at, file: entry.file, why: `not an oracle file` },
      })
    else if (isModuleFile(entry.file, implementationModules))
      problems.push({
        messageId: `refusedEntry`,
        data: {
          at,
          file: entry.file,
          why: `a framework implementation module`,
        },
      })
    else judged.push(entry)
  })
  return { judged, problems }
}

/**
 * The raw campaign that `node` is, as `{ messageId, call }`, or undefined:
 * `fc.assert(...)` or `fc.check(...)`, a named `assert(...)` or `check(...)`
 * from fast-check, or a `.prop(...)` registration of a test root, as the
 * `messageId` and `data` of the report.
 */
function rawCampaignOf(node, sourceCode) {
  const { callee } = node
  if (callee.type === `Identifier`) {
    const binding = importOf(callee, sourceCode)
    return FAST_CHECK_MODULES.has(binding?.source) &&
      CAMPAIGN_METHODS.has(binding.imported)
      ? { messageId: `rawCampaign`, data: { call: callee.name } }
      : undefined
  }
  if (callee.type !== `MemberExpression`) return undefined
  // `.prop` is checked on the call that the member is, so the curried
  // registration `fcTest.prop([...])(name, body)` reports once.
  const chain = calleeChain(callee)
  if (chain.names.at(-1) === `prop` && isTestRoot(chain.rootNode, sourceCode))
    return {
      messageId: `rawProperty`,
      data: { call: sourceCode.getText(callee) },
    }
  if (
    callee.object.type === `Identifier` &&
    callee.property.type === `Identifier` &&
    !callee.computed &&
    CAMPAIGN_METHODS.has(callee.property.name) &&
    FAST_CHECK_MODULES.has(importOf(callee.object, sourceCode)?.source)
  )
    return {
      messageId: `rawCampaign`,
      data: { call: sourceCode.getText(callee) },
    }
  return undefined
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: `problem`,
    docs: {
      description: `Report a raw property campaign or a legacy campaign API in an oracle file: only oracleProperty declares a generated-history law.`,
    },
    schema: [],
    messages: {
      rawCampaign: `\`{{call}}\` runs a raw property campaign, which declares no constructed histories, so the states its law needs are reached only where the seed draws them. Declare the law with \`oracleProperty\` from \`@tanstack/oracles\`: its \`histories.constructed\` build each required state, so that reach is required.`,
      rawProperty: `\`{{call}}\` registers a raw fast-check property, which declares no constructed histories, so the states its law needs are reached only where the seed draws them. Declare the law with \`oracleProperty\` from \`@tanstack/oracles\`: its \`histories.constructed\` build each required state, so that reach is required.`,
      legacyImport: `\`{{name}}\` is a legacy campaign API whose reach depends on the seed. Declare the law with \`oracleProperty\` and its constructed histories instead.`,
      baselineWithoutReason: `This file's \`legacyCampaigns\` entry has no reason, so it exempts nothing. Give the reason that the file keeps its raw campaigns, or move the file to \`oracleProperty\`.`,
      staleBaseline: `This file's \`legacyCampaigns\` entry is stale: the file runs no raw campaign and imports no legacy API. Remove the entry, so the baseline only shrinks.`,
      malformedList: `\`legacyCampaigns\` must be an array of { file, reason } entries. The rule ignores it, so no file is exempt.`,
      malformedEntry: `\`{{at}}\` is malformed: expected { file: string, reason?: string }. The rule ignores it, so it exempts nothing.`,
      refusedEntry: `\`{{at}}\` names {{file}}, which is {{why}}. The rule never judges it, so the entry exempts nothing: remove it.`,
    },
  },
  create(context) {
    const { sourceCode } = context
    const settings = oracleSettings(context)
    const { judged, problems } = judgeEntries(
      settings.legacyCampaigns,
      settings.implementationModules,
    )
    const implementation = isModuleFile(
      context.filename,
      settings.implementationModules,
    )
    const entries = judged.filter((entry) =>
      isModuleFile(context.filename, [entry.file]),
    )
    const exempt = entries.some(
      (entry) => typeof entry.reason === `string` && entry.reason.trim() !== ``,
    )
    /** @type {Array<{ node: import('estree').Node, messageId: string, data: Record<string, string> }>} */
    const uses = []
    return {
      CallExpression(node) {
        const raw = rawCampaignOf(node, sourceCode)
        if (raw !== undefined) uses.push({ node, ...raw })
      },
      ImportDeclaration(node) {
        for (const specifier of node.specifiers) {
          const name = importedName(specifier)
          if (specifier.type === `ImportSpecifier` && LEGACY_NAMES.has(name))
            uses.push({
              node: specifier,
              messageId: `legacyImport`,
              data: { name },
            })
        }
      },
      'Program:exit'(program) {
        for (const problem of problems)
          context.report({ node: program, ...problem })
        // A framework implementation module is exempt from its own uses.
        if (implementation) return
        if (entries.length > 0) {
          if (!exempt)
            context.report({
              node: program,
              messageId: `baselineWithoutReason`,
            })
          if (uses.length === 0)
            context.report({ node: program, messageId: `staleBaseline` })
        }
        if (exempt) return
        for (const use of uses) context.report(use)
      },
    }
  },
}
