/**
 * A state probe is the only development code that a production build must not
 * carry, so its call has one form, which the production build strips:
 *
 *   const probing = typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production'
 *   probing && globalThis.__oracleProbe?.(name, condition)
 *
 * This rule reports every mention of `__oracleProbe` that is not the callee of
 * a probe statement in that form. The statement is one expression statement,
 * its guard on the left of `&&` is the identifier `probing`, which resolves to
 * a `const` with exactly that initializer in the nearest enclosing function
 * (at its top or in one of its blocks), and its receiver is `globalThis`,
 * optionally cast with `as`. A build that defines `process.env.NODE_ENV` folds
 * a function-local `probing` to `false` and drops the probe; a module-level
 * guard in a module with imports is not folded, and the bare comparison throws
 * where there is no `process` (maintainer decision, 2026-11-08). Its name is a literal or a
 * template literal without substitutions, of the form `package#name`. It has
 * exactly two arguments, and the condition contains no assignment, update,
 * `new`, `delete`, `await`, `yield`, function or class expression, or arrow
 * function with a block body. An arrow with an expression body is allowed,
 * and its body is held to the same rule, so a condition can scan a
 * collection (maintainer decision, 2026-11-05). A call is allowed in the
 * condition: a syntactic rule cannot prove that a call is pure.
 *
 * This header is the probe form's one definition, its law, and its limits:
 * the `oracle-gaps` CLI of `@tanstack/oracles` marks probe-only code by the
 * same clauses. Parentheses never matter; the guard may be declared at the
 * function's top, in a block of it, or in a switch case; an undeclared
 * `probing` is no guard.
 *
 * The production config in this package's `src/index.js` selects production
 * source, so the rule reads no other file.
 */

const PROBE = `__oracleProbe`
const GUARD = `probing`
const NAME = /^[a-z][a-z0-9-]*#[a-zA-Z][a-zA-Z0-9.-]*$/
const PRODUCTION = `production`

// The expression kinds that the condition must not contain. A function or a
// class expression can hide a mutation or an await. An arrow cannot when its
// body is an expression, which this check reads like the rest of the
// condition; an arrow with a block body is refused in `containsForbidden`.
const FORBIDDEN = new Set([
  `AssignmentExpression`,
  `UpdateExpression`,
  `NewExpression`,
  `AwaitExpression`,
  `YieldExpression`,
  `FunctionExpression`,
  `ClassExpression`,
])

const isNode = (value) =>
  value !== null && typeof value === `object` && typeof value.type === `string`

function childrenOf(node) {
  return Object.entries(node).flatMap(([key, value]) => {
    if (key === `parent`) return []
    if (Array.isArray(value)) return value.filter(isNode)
    return isNode(value) ? [value] : []
  })
}

function containsForbidden(node) {
  if (FORBIDDEN.has(node.type)) return true
  if (node.type === `UnaryExpression` && node.operator === `delete`) return true
  if (
    node.type === `ArrowFunctionExpression` &&
    node.body.type === `BlockStatement`
  )
    return true
  return childrenOf(node).some(containsForbidden)
}

// The text of a plain string literal, or of a template literal with no
// substitutions. Any other node has no static text.
function staticText(node) {
  if (node.type === `Literal` && typeof node.value === `string`) {
    return node.value
  }
  if (node.type === `TemplateLiteral` && node.expressions.length === 0) {
    return node.quasis[0].value.cooked
  }
  return undefined
}

// `process.env.NODE_ENV !== 'production'`, with the comparison on the left.
function isProductionGuard(node) {
  if (node.type !== `BinaryExpression` || node.operator !== `!==`) return false
  const env = node.left
  return (
    env.type === `MemberExpression` &&
    !env.computed &&
    env.property.type === `Identifier` &&
    env.property.name === `NODE_ENV` &&
    env.object.type === `MemberExpression` &&
    !env.object.computed &&
    env.object.property.type === `Identifier` &&
    env.object.property.name === `env` &&
    env.object.object.type === `Identifier` &&
    env.object.object.name === `process` &&
    staticText(node.right) === PRODUCTION
  )
}

// `typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production'`.
function isGuardInit(node) {
  return (
    node?.type === `ConditionalExpression` &&
    node.test.type === `BinaryExpression` &&
    node.test.operator === `===` &&
    node.test.left.type === `UnaryExpression` &&
    node.test.left.operator === `typeof` &&
    node.test.left.argument.type === `Identifier` &&
    node.test.left.argument.name === `process` &&
    staticText(node.test.right) === `undefined` &&
    node.consequent.type === `Literal` &&
    node.consequent.value === false &&
    isProductionGuard(node.alternate)
  )
}

// Whether `node` is the identifier `probing` and resolves to the guard: a
// `const` with the guard's initializer, bound in the nearest enclosing
// function (the function's own scope or a block of it).
function isGuard(node, sourceCode) {
  if (node.type !== `Identifier` || node.name !== GUARD) return false
  const scope = sourceCode.getScope(node)
  let variable
  for (let at = scope; at && !variable; at = at.upper)
    variable = at.set.get(GUARD)
  // An undeclared `probing` is no guard.
  if (variable === undefined) return false
  const [definition] = variable.defs
  return (
    scope.variableScope.type === `function` &&
    variable.scope.variableScope === scope.variableScope &&
    variable.defs.length === 1 &&
    definition.type === `Variable` &&
    definition.parent.kind === `const` &&
    isGuardInit(definition.node.init)
  )
}

// `globalThis`, or `globalThis as ...`. A cast returns its type annotation's
// `__oracleProbe` member keys, which mention the probe too.
function receiverKeys(node) {
  if (node.type === `Identifier` && node.name === `globalThis`) return []
  if (
    node.type === `TSAsExpression` &&
    node.expression.type === `Identifier` &&
    node.expression.name === `globalThis`
  ) {
    const type = node.typeAnnotation
    if (type.type !== `TSTypeLiteral`) return []
    return type.members
      .filter(
        (member) =>
          member.type === `TSPropertySignature` &&
          member.key.type === `Identifier` &&
          member.key.name === PROBE,
      )
      .map((member) => member.key)
  }
  return undefined
}

// The nodes of a probe statement's `__oracleProbe` mentions, or undefined when
// the expression is not a probe in the required form.
function probeMentions(expression, sourceCode) {
  if (
    expression.type !== `LogicalExpression` ||
    expression.operator !== `&&` ||
    !isGuard(expression.left, sourceCode)
  ) {
    return undefined
  }
  const chain = expression.right
  if (chain.type !== `ChainExpression`) return undefined
  const call = chain.expression
  if (call.type !== `CallExpression` || !call.optional) return undefined
  const callee = call.callee
  if (
    callee.type !== `MemberExpression` ||
    callee.computed ||
    callee.optional ||
    callee.property.type !== `Identifier` ||
    callee.property.name !== PROBE
  ) {
    return undefined
  }
  const receiver = receiverKeys(callee.object)
  if (receiver === undefined) return undefined
  if (call.arguments.length !== 2) return undefined
  const [name, condition] = call.arguments
  if (name.type === `SpreadElement` || condition.type === `SpreadElement`) {
    return undefined
  }
  const text = staticText(name)
  if (text === undefined || !NAME.test(text)) return undefined
  if (containsForbidden(condition)) return undefined
  return [callee.property, ...receiver]
}

const message = `\`__oracleProbe\` may be called only as a state probe: one expression statement, \`probing && globalThis.__oracleProbe?.('package#name', condition)\`, where \`probing\` is \`const probing = typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production'\` in the nearest enclosing function, with a name literal of the form package#name and a condition that has no assignment, update, new, delete, await, yield, function or class expression, or arrow with a block body.`

export default {
  meta: {
    type: `problem`,
    messages: { probeForm: message },
    schema: [],
  },
  create(context) {
    // Every mention of the probe, and the mentions that a probe statement
    // in the required form owns. A mention outside the owned set is reported.
    const mentions = []
    const owned = new Set()
    return {
      Identifier(node) {
        if (node.name === PROBE) mentions.push(node)
      },
      Literal(node) {
        if (node.value === PROBE) mentions.push(node)
      },
      TemplateLiteral(node) {
        if (staticText(node) === PROBE) mentions.push(node)
      },
      ExpressionStatement(node) {
        const owns = probeMentions(node.expression, context.sourceCode)
        if (owns !== undefined) for (const mention of owns) owned.add(mention)
      },
      'Program:exit'() {
        for (const mention of mentions) {
          if (!owned.has(mention)) {
            context.report({ node: mention, messageId: `probeForm` })
          }
        }
      },
    }
  },
}
