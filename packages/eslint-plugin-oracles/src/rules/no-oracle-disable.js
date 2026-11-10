/**
 * Reports an ESLint directive that would silence an oracle rule: `oracle/*`.
 *
 * P8 of the frozen v20 design grammar says lint rules cannot be disabled inline.
 * The `recommended` config sets `noInlineConfig`, which ignores every directive
 * in an oracle file. The `production` config cannot, because that setting would
 * also ignore every other rule's directives in production source. So this rule
 * reports the directive itself, in both configs.
 *
 * What is reported: a directive whose rule list names an `oracle/*` rule, a
 * directive with no rule list (it silences every rule, oracle rules included),
 * and an inline config comment that names an oracle rule. The rule takes the
 * parsed directives from `sourceCode.getDisableDirectives()` and the config
 * comments from `sourceCode.getInlineConfigNodes()`.
 *
 * Where the report sits. ESLint hides a report at or after a block directive's
 * start, on the line that a line directive covers, and on the next line of a
 * next-line directive. A directive that names this rule, or has no list, can
 * therefore hide its own report, so it is reported at the file's first token,
 * which precedes it, whatever parser reads the file. A directive or config comment under an earlier block
 * directive is covered in the same way, and is reported there too. Any other
 * report sits on the comment's own line. The message names the directive's line
 * whatever the report's location.
 *
 * Limits. A directive on the file's first line, or at its start, that names this
 * rule or has no list covers the file's start, and ESLint hides its report:
 * no report can sit before it. A config comment that names this rule turns it
 * off for the file, so ESLint runs no rule and none reports it. A directive that
 * names only other rules is not reported, whatever its description says.
 */

const SELF = `oracle/no-oracle-disable`

/** The file's start: no directive precedes it, so no directive can hide a report there. */
const FILE_START = {
  start: { line: 1, column: 0 },
  end: { line: 1, column: 0 },
}

/** The rule names in a directive's list: quotes removed, empty entries dropped. */
const namesIn = (list) =>
  list
    .split(`,`)
    .map((name) => name.trim().replace(/^(['"])(.*)\1$/, `$2`))
    .filter((name) => name !== ``)

/** The rule names an inline config comment assigns: `name:` keys, quoted or bare. */
const configNamesIn = (value) =>
  [...value.matchAll(/(?:^|[\s,{])["']?(oracle\/[\w-]+)["']?\s*:/g)].map(
    (match) => match[1],
  )

/** Whether a comment is an inline config comment: `eslint` followed by a space, not a directive keyword. */
const isConfigComment = (value) => /^\s*eslint(?=\s|$)/.test(value)

/**
 * Whether `other` hides a report at `item`'s comment: a block directive that
 * starts before it, a line directive on its line, or a next-line directive on
 * the line above it.
 */
const covers = (other, item) =>
  other.type === `disable`
    ? other.node.range[0] < item.node.range[0]
    : other.type === `disable-line`
      ? other.line === item.line
      : other.type === `disable-next-line` && other.line + 1 === item.line

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: `problem`,
    docs: {
      description: `Report a directive that would silence an oracle rule: oracle rules cannot be disabled inline.`,
    },
    schema: [],
    messages: {
      oracleDisable: `The directive on line {{ line }} would silence an oracle rule, which cannot be disabled inline (P8). Fix the shortcut the rule reports, or change the rule.`,
    },
  },
  create(context) {
    const { sourceCode } = context
    return {
      'Program:exit'() {
        const items = []
        for (const directive of sourceCode.getDisableDirectives().directives) {
          if (directive.type === `enable`) continue
          const names = namesIn(directive.value)
          const blanket = names.length === 0
          items.push({
            node: directive.node,
            line: directive.node.loc.start.line,
            type: directive.type,
            silences:
              blanket || names.some((name) => name.startsWith(`oracle/`)),
            // A blanket or self-naming directive can hide reports from this rule.
            suppresses: blanket || names.includes(SELF),
          })
        }
        for (const comment of sourceCode.getInlineConfigNodes()) {
          if (!isConfigComment(comment.value)) continue
          items.push({
            node: comment,
            line: comment.loc.start.line,
            type: `config`,
            silences: configNamesIn(comment.value).length > 0,
            suppresses: false,
          })
        }
        const suppressors = items.filter((item) => item.suppresses)
        for (const item of items) {
          if (!item.silences) continue
          const hidden =
            item.suppresses ||
            suppressors.some((other) => other !== item && covers(other, item))
          context.report({
            loc: hidden ? FILE_START : item.node.loc,
            messageId: `oracleDisable`,
            data: { line: item.line },
          })
        }
      },
    }
  },
}
