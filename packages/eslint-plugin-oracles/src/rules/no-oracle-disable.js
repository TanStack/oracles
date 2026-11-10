/**
 * Reports an ESLint disable directive that names an oracle rule: `oracle/*`.
 *
 * P8 of the frozen v20 design grammar says lint rules cannot be disabled inline.
 * The `recommended` config sets `noInlineConfig`, which ignores every directive
 * in an oracle file. The `production` config cannot, because that setting would
 * also ignore every other rule's directives in production source. So this rule
 * reports the directive itself, in both configs: a directive that names an
 * `oracle/*` rule is a report at its own line, whatever its form.
 *
 * Forms: `eslint-disable`, `eslint-disable-line`, and `eslint-disable-next-line`,
 * as a line comment or a block comment, with or without a `-- description`. A
 * directive that names no oracle rule is not reported.
 *
 * Limits. A blanket directive with no rule list is not seen, since it names no
 * rule; ESLint suppresses this rule's report on the lines it covers. A directive
 * that names this rule can suppress the report on the line below it.
 */

// The directive, as ESLint reads it from a comment's text: the list follows the
// keyword, and a description follows `--`.
const DIRECTIVE = /^\s*eslint-disable(?:-next-line|-line)?(?:\s+([\s\S]*))?$/

/** The rule names a directive comment lists, or undefined when the comment is not a directive. */
function listedRules(value) {
  const match = DIRECTIVE.exec(value)
  if (match === null) return undefined
  return (match[1] ?? ``)
    .split(`--`)[0]
    .split(`,`)
    .map((name) => name.trim())
    .filter((name) => name !== ``)
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: `problem`,
    docs: {
      description: `Report an ESLint disable directive that names an oracle rule: oracle rules cannot be disabled inline.`,
    },
    schema: [],
    messages: {
      oracleDisable: `This directive disables an oracle rule, which cannot be disabled inline (P8). Fix the shortcut the rule reports, or change the rule.`,
    },
  },
  create(context) {
    return {
      'Program:exit'() {
        for (const comment of context.sourceCode.getAllComments()) {
          const rules = listedRules(comment.value)
          if (rules?.some((name) => name.startsWith(`oracle/`)))
            context.report({ loc: comment.loc, messageId: `oracleDisable` })
        }
      },
    }
  },
}
