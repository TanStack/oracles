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
 * The baseline only shrinks. An entry without a reason exempts nothing and is
 * reported (`baselineWithoutReason`). An entry for a file that has no legacy use
 * left is reported as stale (`staleBaseline`), so the file must be removed from
 * the baseline when it migrates.
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

const FAST_CHECK = `fast-check`
const CAMPAIGN_METHODS = new Set([`assert`, `check`])
const LEGACY_NAMES = new Set([`createOracleReach`, `runOracleCampaign`])

/** The `import` a binding came from, as `{ source, imported }`, or undefined. */
function importOf(identifier, sourceCode) {
  const definition = findVariable(
    sourceCode.getScope(identifier),
    identifier.name,
  )?.defs[0]
  if (definition?.type !== `ImportBinding`) return undefined
  const imported = definition.node.imported
  return {
    source: definition.parent.source.value,
    imported:
      definition.node.type === `ImportSpecifier`
        ? (imported.name ?? imported.value)
        : undefined,
  }
}

/**
 * The raw campaign that `node` is, as `{ messageId, call }`, or undefined:
 * `fc.assert(...)` or `fc.check(...)`, a named `assert(...)` or `check(...)`
 * from fast-check, or a `.prop(...)` registration of a test root.
 */
function rawCampaignOf(node, sourceCode) {
  const { callee } = node
  if (callee.type === `Identifier`) {
    const binding = importOf(callee, sourceCode)
    return binding?.source === FAST_CHECK &&
      CAMPAIGN_METHODS.has(binding.imported)
      ? { messageId: `rawCampaign`, call: callee.name }
      : undefined
  }
  if (callee.type !== `MemberExpression`) return undefined
  // `.prop` is checked on the call that the member is, so the curried
  // registration `fcTest.prop([...])(name, body)` reports once.
  const chain = calleeChain(callee)
  if (chain.names.at(-1) === `prop` && isTestRoot(chain.rootNode, sourceCode))
    return { messageId: `rawProperty`, call: sourceCode.getText(callee) }
  if (
    callee.object.type === `Identifier` &&
    callee.property.type === `Identifier` &&
    !callee.computed &&
    CAMPAIGN_METHODS.has(callee.property.name) &&
    importOf(callee.object, sourceCode)?.source === FAST_CHECK
  )
    return {
      messageId: `rawCampaign`,
      call: sourceCode.getText(callee),
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
    },
  },
  create(context) {
    const { sourceCode } = context
    const settings = oracleSettings(context)
    if (isModuleFile(context.filename, settings.implementationModules)) {
      return {}
    }
    const entries = settings.legacyCampaigns.filter((entry) =>
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
        if (raw !== undefined)
          uses.push({
            node,
            messageId: raw.messageId,
            data: { call: raw.call },
          })
      },
      ImportDeclaration(node) {
        for (const specifier of node.specifiers) {
          const name = specifier.imported?.name ?? specifier.imported?.value
          if (specifier.type === `ImportSpecifier` && LEGACY_NAMES.has(name))
            uses.push({
              node: specifier,
              messageId: `legacyImport`,
              data: { name },
            })
        }
      },
      'Program:exit'(program) {
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
