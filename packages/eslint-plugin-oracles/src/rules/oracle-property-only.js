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
 * no reach (maintainer decision, 2026-11-09; the `oracleProperty` contract of
 * `@tanstack/oracles`).
 *
 * Exemption: a framework implementation module
 * (`settings.oracles.implementationModules`) is exempt. `oracleProperty`
 * itself runs `fc.assert`, and it is the one campaign the framework has. No
 * other configuration exempts a file.
 *
 * The removed setting. `settings.oracles.legacyCampaigns` once listed files
 * that kept their raw campaigns while they migrated. It is removed (maintainer
 * decision 2026-11-10: "remove legacyCampaigns, as that's another out for
 * agents"). A configuration that still sets it, to any value, exempts nothing,
 * and gets `removedSetting` at line 1 of each oracle file it reaches, since
 * ESLint runs a rule once per file. The rule never throws on a program that
 * parses (frozen design principle P8; maintainer decision 2026-11-09), so the
 * setting is reported, not thrown on, and not ignored.
 *
 * The legacy-name check is kept after the APIs are removed from
 * @tanstack/oracles, so a project that still vendors them, and reimports
 * them, sees the reports.
 *
 * Limits: the rule reads the forms above only. A campaign held in an alias
 * (`const run = fc.assert`), called from a helper, or reached through a
 * re-exported fast-check binding is not followed.
 */

import {
  findVariable,
  isModuleFile,
  oracleSettings,
  testFunctions,
} from '../registration.js'

// The modules that export fast-check's campaign functions: fast-check itself,
// and @fast-check/vitest, which re-exports its `fc`.
const FAST_CHECK_MODULES = new Set([`fast-check`, `@fast-check/vitest`])
const CAMPAIGN_METHODS = new Set([`assert`, `check`])
const LEGACY_NAMES = new Set([`createOracleReach`, `runOracleCampaign`])
// The shared end of the two raw-campaign messages, so their advice cannot drift apart.
const RAW_HINT = `declares no constructed histories, so the states its law needs are reached only where the seed draws them. Declare the law with \`oracleProperty\` from \`@tanstack/oracles\`: its \`histories.constructed\` build each required state, so that reach is required.`
// The file's start, where the configuration reports sit: no directive can precede it.
const FILE_START = {
  start: { line: 1, column: 0 },
  end: { line: 1, column: 0 },
}

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

/**
 * The raw campaign that `node` is, as `{ messageId, call }`, or undefined:
 * `fc.assert(...)` or `fc.check(...)`, a named `assert(...)` or `check(...)`
 * from fast-check, or a `.prop(...)` registration of a test root, as the
 * `messageId` and `data` of the report.
 */
function rawCampaignOf(node, sourceCode, functions) {
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
  if (functions.callee(callee)?.own.at(-1) === `prop`)
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
      rawCampaign: `\`{{call}}\` runs a raw property campaign, which ${RAW_HINT}`,
      rawProperty: `\`{{call}}\` registers a raw fast-check property, which ${RAW_HINT}`,
      legacyImport: `\`{{name}}\` is a legacy campaign API whose reach depends on the seed. Declare the law with \`oracleProperty\` and its constructed histories instead.`,
      removedSetting: `\`legacyCampaigns\` is removed: convert the listed files to \`oracleProperty\`, then delete \`settings.oracles.legacyCampaigns\`. It exempts no file.`,
      malformedSetting: `\`settings.oracles.{{name}}\` must be an array of paths. The rule reads it as empty, so no module is exempt.`,
    },
  },
  create(context) {
    const { sourceCode } = context
    const functions = testFunctions(context)
    const settings = oracleSettings(context)
    const problems = settings.malformed.map((name) => ({
      messageId: `malformedSetting`,
      data: { name },
    }))
    if (settings.legacyCampaignsSet)
      problems.push({ messageId: `removedSetting` })
    const implementation = isModuleFile(
      context.filename,
      settings.implementationModules,
    )
    /** @type {Array<{ node: import('estree').Node, messageId: string, data: Record<string, string> }>} */
    const uses = []
    return {
      CallExpression(node) {
        const raw = rawCampaignOf(node, sourceCode, functions)
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
          context.report({ loc: FILE_START, ...problem })
        // A framework implementation module is exempt from its own uses.
        if (implementation) return
        for (const use of uses) context.report(use)
      },
    }
  },
}
