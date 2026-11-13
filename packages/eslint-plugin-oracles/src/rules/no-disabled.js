/**
 * An oracle enforces its laws only in the tests that run. This rule reports
 * the edits that stop a law from running while every test still passes:
 *
 * - `.only` on a test or suite, which silences every other law in the file.
 * - `.skip`, `.todo`, Playwright's `.fixme`, or Deno's `.ignore` on a test or
 *   suite that has a body, inline or passed by name, and an export that
 *   carries one (Jest's `xit`, node:test's `skip`). An empty body disables
 *   nothing, so this
 *   rule does not report it; `oracle/no-unit-test` reports it as an empty
 *   test (maintainer decision, 2026-11-10). A replay that does not select a
 *   property registers it with `it.todo` and no body.
 * - A test that skips itself through its context, as in `ctx.skip()`.
 * - `.skipIf(condition)` or `.runIf(condition)`, and Bun's `.if(condition)`
 *   and `.todoIf(condition)`, unless the call is
 *   `.skipIf(oracleReplayRequested())` or `.skipIf(oracleReplaySkips(...))`.
 *   A replay may stand a test aside, and nothing else may switch an oracle
 *   test off. The shared helpers in oracle-config are false in an ordinary
 *   run, so no condition built from them can turn a test off there.
 * - A test modifier passed around as a value, as in
 *   `const run = replaying ? it.skip : it`. The rule cannot see what such an
 *   alias switches off. `oracleReplayTest(test, property)` selects a replay.
 * - A test registered under a condition, or after an early `return`, unless
 *   the condition is a shared replay helper and the test registers when the
 *   helper is false, as in `if (!oracleReplayRequested())`. Each helper is
 *   false in an ordinary run, so such a test runs there. An early `throw`
 *   fails the run loudly, and `continue` filters a loop's data, so neither
 *   guards a registration. A registration made through `oracleReplayTest`
 *   or `oracleCalibrationTest`, directly or through a constant bound to its
 *   result, or through a renamed import such as `import { it as vitestIt }`,
 *   is checked as a registration of its test.
 * - Playwright's runtime `test.skip()` or `test.fixme()` inside a test,
 *   unless its condition is `browserName !== '<browser>'`: a control that
 *   only one browser supports.
 * - A generated property limited to one run that has no fixed history: a
 *   literal `numRuns` of 1 or 0, or a base of 1 passed to the run helpers. One
 *   random history is not a generated property. A witness fixes its history
 *   with a recorded `path` (a literal, or a failure's `counterexamplePath`) or
 *   with a seed that is a number literal or a constant bound to one: a `seed`
 *   option, or the seed of the framework's `oracleFixedSeed(seed, { ... })`,
 *   in place, held in a constant, or spread into the object. A replay
 *   from configuration takes its options from `oraclePropertyOptions`, which
 *   returns one run for a path replay.
 * - A literal run count above 1 that has no fixed history. It does not scale with
 *   the runs-multiplier variable (`${envPrefix}_RUNS_MULTIPLIER`), so `oracleRuns` must wrap it.
 * - A private replay variable: a `process.env` read whose name ends in
 *   `_SEED`, `_PATH`, `_PROPERTY`, `_UNIT`, or `_RUNS`, other than the framework's
 *   shared `${envPrefix}_SEED`, `${envPrefix}_PATH`, `${envPrefix}_PROPERTY`, and
 *   `${envPrefix}_UNIT`, the random unit a path replay runs. The replay manifest, the guarded replay
 *   runner, and the retired-variable check see only the shared variables.
 *
 * The rule has no inline exception. A known counterexample is kept failing with
 * `it.fails` on a fixed seed, not skipped.
 *
 * The rule cannot see a run count lowered to any value above 1, a run count
 * or seed held in a variable that is not a constant bound to a number, a call
 * to a local helper that registers tests under a condition, or a table built
 * by a function that returns different items in different runs. Reviewers
 * still check those.
 */

import {
  aliasModifiers,
  calleeChain,
  callsFrameworkExport,
  conditionalModifiers,
  disablingModifiers,
  findVariable,
  isFunction,
  isModuleFile,
  isSharedHelperCall,
  oracleSettings,
  outermostCast,
  selectionHelpers,
  testFunctionMembers,
  testFunctions,
} from '../registration.js'

const replayConditions = new Set([`oracleReplayRequested`, `oracleReplaySkips`])
// A replay-selection module (`implementationModules`) may read the replay
// variables and select a replay from configuration.
// Any variable whose name ends in one of these suffixes is a replay variable.
const replayVariableName = /_(PATH|PROPERTY|RUNS|SEED|UNIT)$/
const runHelpers = new Set([
  `oraclePropertyOptions`,
  `oracleRandomParameters`,
  `oracleRuns`,
])

/** A test body that runs something: a named function or a non-empty one. */
function hasBody(body) {
  if (!isFunction(body)) return true
  return body.body.type !== `BlockStatement` || body.body.body.length > 0
}

function isStringLike(node) {
  return (
    node.type === `TemplateLiteral` ||
    (node.type === `Literal` && typeof node.value === `string`)
  )
}

/** The `skipIf` or `runIf` call in a callee chain, if there is one. */
function registrationCondition(callee) {
  let node = callee
  while (node.type === `CallExpression` || node.type === `MemberExpression`) {
    if (
      node.type === `CallExpression` &&
      node.callee.type === `MemberExpression` &&
      conditionalModifiers.has(node.callee.property.name)
    ) {
      return { name: node.callee.property.name, args: node.arguments }
    }
    node = node.type === `CallExpression` ? node.callee : node.object
  }
  return undefined
}

/**
 * The condition that a test function of another module carries, as
 * `export const maybe = it.skipIf(flag)` does. Its arguments are out of
 * sight, so it can never be a replay selection.
 */
function foreignCondition(foreign) {
  const name = foreign.find((member) => conditionalModifiers.has(member))
  return name === undefined ? undefined : { name, args: [] }
}

/** Exactly `.skipIf(<shared replay condition>)`, not negated. */
function isReplaySelection({ name, args }, sourceCode) {
  return (
    name === `skipIf` &&
    args.length === 1 &&
    isSharedHelperCall(args[0], replayConditions, sourceCode)
  )
}

/**
 * Whether a statement always returns from its function. A `throw` fails the
 * run loudly, and `continue` or `break` skips one item of a loop's data, as
 * `.filter` would, so neither guards a registration.
 */
function returns(statement) {
  if (statement === null || statement === undefined) return false
  if (statement.type === `ReturnStatement`) return true
  if (statement.type === `BlockStatement`) {
    return returns(statement.body.at(-1))
  }
  if (statement.type === `IfStatement`) {
    return returns(statement.consequent) && returns(statement.alternate)
  }
  return false
}

function isEmptyArray(node) {
  return node?.type === `ArrayExpression` && node.elements.length === 0
}

/**
 * The conditions that decide which items a loop's iterable or an `.each()`
 * table holds, each with the value under which the items register. A branch
 * that is `[]` registers nothing, a `.filter` callback that reads
 * `process.env` filters by environment, and a constant is read through to
 * its initializer.
 */
function iterableConditions(node, sourceCode, seen = new Set()) {
  if (node === null || node === undefined || seen.has(node)) return []
  seen.add(node)
  if (node.type === `Identifier`) {
    const definition = findVariable(sourceCode.getScope(node), node.name)
      ?.defs[0]
    return definition?.type === `Variable` && definition.parent.kind === `const`
      ? iterableConditions(definition.node.init, sourceCode, seen)
      : []
  }
  if (node.type === `ConditionalExpression`) {
    const conditions = []
    if (isEmptyArray(node.alternate)) {
      conditions.push({ test: node.test, registersWhen: true })
    } else if (isEmptyArray(node.consequent)) {
      conditions.push({ test: node.test, registersWhen: false })
    }
    return [
      ...conditions,
      ...iterableConditions(node.consequent, sourceCode, seen),
      ...iterableConditions(node.alternate, sourceCode, seen),
    ]
  }
  if (node.type === `LogicalExpression`) {
    return [
      {
        test: node.left,
        registersWhen: node.operator === `&&` ? true : undefined,
      },
      ...iterableConditions(node.right, sourceCode, seen),
    ]
  }
  if (
    node.type === `CallExpression` &&
    node.callee.type === `MemberExpression` &&
    node.callee.property.name === `filter`
  ) {
    const [callback] = node.arguments
    const readsEnvironment =
      callback !== undefined &&
      /process\.env/.test(sourceCode.getText(callback))
    return [
      ...(readsEnvironment
        ? [{ test: callback, registersWhen: undefined }]
        : []),
      ...iterableConditions(node.callee.object, sourceCode, seen),
    ]
  }
  return []
}

/** The table of an `.each(table)` call in a registration's callee chain. */
function eachTable(callee) {
  let node = callee
  while (node.type === `CallExpression` || node.type === `MemberExpression`) {
    if (
      node.type === `CallExpression` &&
      node.callee.type === `MemberExpression` &&
      node.callee.property.name === `each`
    ) {
      return node.arguments[0]
    }
    node = node.type === `CallExpression` ? node.callee : node.object
  }
  return undefined
}

/**
 * The conditions that decide whether `node` runs, each with the value that
 * the condition must have for `node` to run: every enclosing `if`,
 * conditional, or logical branch, and every earlier `if` in an enclosing
 * block that returns. `registersWhen` is undefined when no single value
 * decides it, as for `??`.
 */
function guardingConditions(node, sourceCode) {
  const conditions = []
  let child = node
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === `ForOfStatement` && child === parent.body) {
      conditions.push(...iterableConditions(parent.right, sourceCode))
    }
    if (
      parent.type === `IfStatement` &&
      child !== parent.test &&
      registersBothWays(node, parent, child)
    ) {
      // `if (c) describe(name, register) else register()`: either way the
      // callback's tests register, inside the suite or beside it.
    } else if (
      (parent.type === `IfStatement` ||
        parent.type === `ConditionalExpression`) &&
      child !== parent.test
    ) {
      conditions.push({
        test: parent.test,
        registersWhen: child === parent.consequent,
      })
    } else if (parent.type === `LogicalExpression` && child === parent.right) {
      conditions.push({
        test: parent.left,
        registersWhen:
          parent.operator === `&&`
            ? true
            : parent.operator === `||`
              ? false
              : undefined,
      })
    } else if (
      parent.type === `BlockStatement` ||
      parent.type === `Program` ||
      parent.type === `SwitchCase`
    ) {
      const body =
        parent.type === `SwitchCase` ? parent.consequent : parent.body
      for (const statement of body.slice(0, body.indexOf(child))) {
        if (statement.type === `IfStatement` && returns(statement.consequent)) {
          conditions.push({ test: statement.test, registersWhen: false })
        }
      }
    }
    child = parent
  }
  return conditions
}

/**
 * Whether `branch`, a branch of an `if`, is one expression statement, or a
 * block of only one, whose expression passes `test`.
 */
function soleStatement(branch, test) {
  const statement =
    branch?.type === `BlockStatement` && branch.body.length === 1
      ? branch.body[0]
      : branch
  return statement?.type === `ExpressionStatement` && test(statement.expression)
}

/**
 * Whether the `if` statement `branching`, whose branch `child` holds the
 * suite call `suite`, registers the same tests on its other branch: the
 * suite's callback is a name, the suite is its branch's only statement, and
 * the other branch only calls that name.
 */
function registersBothWays(suite, branching, child) {
  const callback = suite.arguments[1]
  if (
    calleeChain(suite.callee).root !== `describe` ||
    suite.arguments.length !== 2 ||
    callback?.type !== `Identifier`
  )
    return false
  const other =
    child === branching.consequent ? branching.alternate : branching.consequent
  return (
    soleStatement(child, (expression) => expression === suite) &&
    soleStatement(
      other,
      (expression) =>
        expression.type === `CallExpression` &&
        expression.arguments.length === 0 &&
        expression.callee.type === `Identifier` &&
        expression.callee.name === callback.name,
    )
  )
}

/**
 * Whether a guard keeps a registration in every ordinary run. Each shared
 * replay helper is false in an ordinary run, so the registration must run
 * when the helper is false: under `!helper()`, in the `else` branch of
 * `helper()`, or after `if (helper()) return`. A registration that runs only
 * when a helper is true would run only during a replay.
 */
function keepsOrdinaryRun({ test, registersWhen }, sourceCode) {
  if (registersWhen === undefined) return false
  const negated = test.type === `UnaryExpression` && test.operator === `!`
  const helper = negated ? test.argument : test
  if (!isSharedHelperCall(helper, replayConditions, sourceCode)) return false
  return negated ? registersWhen : !registersWhen
}

/** A `path` that a witness recorded: a literal, or a failure's path. */
function isRecordedPath(node) {
  if (node.type === `TemplateLiteral`) return node.expressions.length === 0
  if (node.type === `Literal`) return typeof node.value === `string`
  return (
    node.type === `MemberExpression` &&
    !node.computed &&
    node.property.name === `counterexamplePath`
  )
}

/** Playwright's `browserName !== '<browser>'`. */
function isBrowserCondition(node) {
  return (
    node.type === `BinaryExpression` &&
    node.operator === `!==` &&
    node.left.type === `Identifier` &&
    node.left.name === `browserName` &&
    isStringLike(node.right)
  )
}

/**
 * Whether a `.skip`, `.todo`, or `.fixme` call switches off a body that runs
 * something. A test registration passes `(name, body)`, and a todo passes
 * only its name. Playwright's annotation passes `(condition, reason)`,
 * `(condition)`, `(callback, reason)`, `(reason)`, or nothing, and skips the
 * test or group that it runs in, so for Playwright's test function
 * (`annotates`) a lone string is a reason, not a todo's name.
 */
function disablesBody(args, annotates) {
  const [first, second] = args
  if (first === undefined) return true
  if (second === undefined && isStringLike(first)) return annotates
  if (second === undefined || isStringLike(second)) {
    return !isBrowserCondition(first)
  }
  return hasBody(second)
}

/** A numeric literal at most 1: the run counts that check one history or none. */
function isSingleRunLiteral(node) {
  return (
    node?.type === `Literal` &&
    typeof node.value === `number` &&
    node.value <= 1
  )
}

function isNumberLiteral(node) {
  if (node?.type === `UnaryExpression` && node.operator === `-`) {
    return isNumberLiteral(node.argument)
  }
  return node?.type === `Literal` && typeof node.value === `number`
}

function isProcessEnv(node) {
  return (
    node?.type === `MemberExpression` &&
    !node.computed &&
    node.object.type === `Identifier` &&
    node.object.name === `process` &&
    node.property.name === `env`
  )
}

/** The name in `process.env.NAME` or `process.env['NAME']`. */
function environmentKey(node) {
  if (!isProcessEnv(node.object)) return undefined
  if (!node.computed) return node.property.name
  return node.property.type === `Literal` &&
    typeof node.property.value === `string`
    ? node.property.value
    : undefined
}

function isPrivateReplayVariable(name, envNames) {
  const shared = [
    envNames.seed,
    envNames.path,
    envNames.property,
    envNames.unit,
  ]
  return replayVariableName.test(name) && !shared.includes(name)
}

/** The initializer of the `const` that `node` names, if it names one. */
function constantInit(node, sourceCode) {
  if (node?.type !== `Identifier`) return undefined
  const definition = findVariable(sourceCode.getScope(node), node.name)?.defs[0]
  return definition?.type === `Variable` && definition.parent.kind === `const`
    ? definition.node.init
    : undefined
}

/** The number literal that `node` is, or that a constant `node` names. */
function constantNumber(node, sourceCode) {
  if (isNumberLiteral(node)) return node
  const init = constantInit(node, sourceCode)
  return isNumberLiteral(init) ? init : undefined
}

/** A number literal, or a constant bound to one. */
function isFixedSeed(node, sourceCode) {
  return constantNumber(node, sourceCode) !== undefined
}

/**
 * The framework's `oracleFixedSeed(seed, ...)` with a fixed seed, in place or
 * held in a constant.
 */
function isFixedSeedDeclaration(node, sourceCode) {
  const call =
    node?.type === `Identifier` ? constantInit(node, sourceCode) : node
  return (
    callsFrameworkExport(call, `oracleFixedSeed`, sourceCode) &&
    isFixedSeed(call.arguments[0], sourceCode)
  )
}

function propertyName(property) {
  if (property.type !== `Property` || property.computed) return undefined
  return property.key.type === `Identifier`
    ? property.key.name
    : property.key.value
}

/**
 * A one-run object has a fixed history when it replays a `path` or passes a
 * fixed seed: as its `seed`, as the parameters of a fixed-seed declaration,
 * or by spreading one. An object that an `expect` matcher compares holds an observed
 * run count, and `fc.sample` draws examples without running a property.
 */
function isFixedOrObservation(object, sourceCode) {
  const option = (name) =>
    object.properties.find((property) => propertyName(property) === name)
  const path = option(`path`)
  if (path !== undefined && isRecordedPath(path.value)) return true
  const seed = option(`seed`)
  if (seed !== undefined && isFixedSeed(seed.value, sourceCode)) return true
  const { parent } = object
  if (
    (parent.type === `CallExpression` &&
      parent.arguments[1] === object &&
      isFixedSeedDeclaration(parent, sourceCode)) ||
    object.properties.some(
      (property) =>
        property.type === `SpreadElement` &&
        isFixedSeedDeclaration(property.argument, sourceCode),
    )
  )
    return true
  if (parent.type !== `CallExpression` || !parent.arguments.includes(object)) {
    return false
  }
  const { root, names } = calleeChain(parent.callee)
  return root === `expect` || (root === `fc` && names[0] === `sample`)
}

/**
 * The shared replay writer serializes completed-history counts. They are
 * observations, not run options. A type name alone proves nothing: every
 * value reference must pass directly to the unshadowed one-argument standard
 * serializer. Aliases, writes, callbacks and additional uses retain reporting.
 */
function isSerializedReplayWitness(
  object,
  filename,
  sourceCode,
  witnessModules,
) {
  if (!isModuleFile(filename, witnessModules) || !isPlainWitness(object))
    return false
  if (isGuardedWitnessWrite(object, sourceCode)) return true
  const declaration = object.parent
  if (
    declaration.type !== `VariableDeclarator` ||
    declaration.init !== object ||
    declaration.id.type !== `Identifier`
  )
    return false
  if (
    declaration.parent.type === `VariableDeclaration` &&
    declaration.parent.parent.type === `ExportNamedDeclaration`
  )
    return false
  const id = declaration.id
  const type = id.typeAnnotation?.typeAnnotation
  if (
    type?.type !== `TSTypeReference` ||
    type.typeName.type !== `Identifier` ||
    type.typeName.name !== `OracleReplayWitness`
  )
    return false
  const variable = findVariable(sourceCode.getScope(object), id.name)
  return isOnlySerialized(variable, id, sourceCode)
}

// Standard JSON invokes own or inherited toJSON hooks. A spread, accessor,
// method or prototype field can expose the record through `this` without
// another binding reference. Only the plain witness data shape qualifies.
function isPlainWitness(object) {
  const fields = new Set([`property`, `seed`, `path`, `numRuns`, `failed`])
  return object.properties.every(
    (property) =>
      property.type === `Property` &&
      property.kind === `init` &&
      !property.method &&
      !property.computed &&
      fields.has(propertyName(property)),
  )
}

/**
 * A plain witness written straight through the module's guarded writer:
 * `appendWitness(channel, { ... })`, where `appendWitness` resolves to a
 * function declaration of the module, whose record parameter is an
 * `OracleReplayWitness` that it only serializes.
 */
function isGuardedWitnessWrite(object, sourceCode) {
  const call = object.parent
  if (
    call.type !== `CallExpression` ||
    call.optional ||
    call.arguments.length !== 2 ||
    call.arguments[1] !== object ||
    call.callee.type !== `Identifier` ||
    call.callee.name !== `appendWitness`
  )
    return false
  const writer = findVariable(sourceCode.getScope(call), `appendWitness`)
  const [definition] = writer?.defs ?? []
  if (writer?.defs.length !== 1 || definition.type !== `FunctionName`)
    return false
  const parameter = definition.node.params[1]
  const type = parameter?.typeAnnotation?.typeAnnotation
  if (
    parameter?.type !== `Identifier` ||
    type?.type !== `TSTypeReference` ||
    type.typeName.type !== `Identifier` ||
    type.typeName.name !== `OracleReplayWitness`
  )
    return false
  const record = sourceCode
    .getDeclaredVariables(definition.node)
    .find((variable) => variable.name === parameter.name)
  return isOnlySerialized(record, parameter, sourceCode)
}

/**
 * Whether every value reference to `variable`, other than its declaring
 * identifier `id`, passes it alone to the unshadowed standard serializer.
 */
function isOnlySerialized(variable, id, sourceCode) {
  if (variable === null || variable === undefined) return false
  const uses = variable.references.filter(({ identifier }) => {
    if (identifier === id) return false
    // A TS typeof query resolves a value symbol, so scope-manager marks it as
    // a value reference. Its syntax still has no runtime consumption.
    let name = identifier
    while (name.parent.type === `TSQualifiedName` && name.parent.left === name)
      name = name.parent
    return name.parent.type !== `TSTypeQuery` || name.parent.exprName !== name
  })
  return (
    uses.length > 0 &&
    uses.every((reference) => {
      if (!reference.isReadOnly()) return false
      const call = reference.identifier.parent
      if (
        call.type !== `CallExpression` ||
        call.optional ||
        call.arguments.length !== 1 ||
        call.arguments[0] !== reference.identifier
      )
        return false
      const callee = call.callee
      if (
        callee.type !== `MemberExpression` ||
        callee.computed ||
        callee.optional ||
        callee.object.type !== `Identifier` ||
        callee.object.name !== `JSON` ||
        callee.property.type !== `Identifier` ||
        callee.property.name !== `stringify`
      )
        return false
      // Type-only names do not shadow the standard runtime JSON binding. Keep
      // walking: an inner type alias can hide an outer runtime parameter from
      // findVariable, although that parameter still supplies JSON.stringify.
      for (
        let scope = sourceCode.getScope(call);
        scope !== null;
        scope = scope.upper
      ) {
        const json = scope.set.get(`JSON`)
        if (
          json?.defs.some(
            (definition) =>
              definition.isVariableDefinition !== false &&
              !(
                definition.type === `ImportBinding` &&
                (definition.parent?.importKind === `type` ||
                  definition.node.importKind === `type`)
              ),
          )
        )
          return false
      }
      return true
    })
  )
}

/**
 * Whether a call skips the test that it runs in through the test context,
 * as in `it('law', (ctx) => { ctx.skip() })`.
 */
function isContextSkip(node, sourceCode, functions) {
  const { callee } = node
  if (
    callee.type !== `MemberExpression` ||
    callee.property.type !== `Identifier` ||
    callee.property.name !== `skip` ||
    callee.object.type !== `Identifier`
  ) {
    return false
  }
  // Resolve the binding, so a context captured by a nested callback counts
  // and an unrelated variable of the same name does not.
  const definition = findVariable(sourceCode.getScope(node), callee.object.name)
    ?.defs[0]
  if (definition?.type !== `Parameter`) return false
  const fn = definition.node
  if (fn.params[0] !== definition.name) return false
  const registration = fn.parent
  return (
    registration.type === `CallExpression` &&
    registration.arguments.includes(fn) &&
    functions.callee(registration.callee) !== undefined
  )
}

/**
 * Whether a test function is passed around as a value: assigned, collected,
 * returned, or passed to any call except a shared selection helper.
 */
function isPassedAsValue(node) {
  const { parent } = node
  switch (parent.type) {
    case `VariableDeclarator`:
      return parent.init === node
    case `AssignmentExpression`:
      return parent.right === node
    case `ArrayExpression`:
    case `ReturnStatement`:
    case `SpreadElement`:
      return true
    case `Property`:
      return parent.value === node && parent.parent.type === `ObjectExpression`
    case `ConditionalExpression`:
      return parent.test !== node
    case `LogicalExpression`:
      return true
    case `ArrowFunctionExpression`:
      return parent.body === node
    case `CallExpression`:
      return (
        parent.arguments.includes(node) &&
        !(
          parent.callee.type === `Identifier` &&
          selectionHelpers.has(parent.callee.name) &&
          parent.arguments[0] === node
        )
      )
    default:
      return false
  }
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: `problem`,
    docs: {
      description: `Report oracle tests that stop running: .only, a skipped body, a switch-off condition, or one run with no fixed history.`,
    },
    schema: [],
    messages: {
      only: `\`.only\` runs only this test, so every other law in the file stops running. Remove it before committing.`,
      skip: `\`.{{name}}\` stops this test from enforcing its law. Remove it. To keep a known counterexample visible, write it as a failing fixed history with \`it.fails\` and a fixed seed.`,
      conditional: `\`.{{name}}\` can switch this test off in ordinary runs. Only \`.skipIf(oracleReplayRequested())\` or \`.skipIf(oracleReplaySkips(property))\` may switch an oracle test off, so that a replay can stand it aside. Remove the condition.`,
      alias: `\`.{{name}}\` is passed around as a value, so the rule cannot see what it switches off. Call it directly, or select a replay with \`oracleReplayTest(test, property)\` from \`@tanstack/oracles\`.`,
      aliasTest: `\`{{name}}\` is passed around as a value, so the rule cannot see what it registers or switches off. Call it directly, or select a replay with \`oracleReplayTest({{name}}, property)\` from \`@tanstack/oracles\`.`,
      guarded: `This test registers only under a condition, so it can stop running in ordinary runs. Register it unconditionally. A replay selection uses \`oracleReplayRequested()\` or \`oracleReplaySkips(property)\` from \`@tanstack/oracles\`, or \`oracleReplayTest(test, property)\`.`,
      singleRun: `A generated property with one run that has no fixed history checks one random history. Pass a base run count to oracleRuns or oraclePropertyOptions, which also selects a replay. A witness passes a recorded \`path\` or a seed that is a number literal or a constant.`,
      replayVariable: `\`{{name}}\` selects a replay or a run count outside the shared variables, so the replay manifest, the guarded replay runner, and the retired-variable check cannot see it. Take the options from \`oraclePropertyOptions\` or \`oracleRandomParameters\` in \`@tanstack/oracles\`, which read {{seed}}, {{path}}, {{property}}, and {{unit}}, and scale run counts with \`oracleRuns\`.`,
      literalRuns: `A literal run count does not scale with {{runsMultiplier}}. Wrap it in oracleRuns, or pass it to oraclePropertyOptions.`,
    },
  },
  create(context) {
    const { sourceCode } = context
    const functions = testFunctions(context)
    const settings = oracleSettings(context)
    const replaySelection = isModuleFile(
      context.filename,
      settings.implementationModules,
    )

    /** Whether `node` is the value of a `numRuns` option that a replay fixes. */
    function isFixedRunCount(node) {
      const { parent } = node
      return (
        parent.type === `Property` &&
        propertyName(parent) === `numRuns` &&
        parent.parent.type === `ObjectExpression` &&
        (isFixedOrObservation(parent.parent, sourceCode) ||
          isSerializedReplayWitness(
            parent.parent,
            context.filename,
            sourceCode,
            settings.replayWitnessModules,
          ))
      )
    }

    // The values already reported as passed test functions. The branches of
    // one conditional or logical expression pass one value, so it is
    // reported once.
    const passedValues = new Set()
    /** Whether `node` is the first test function of the value it passes. */
    function firstValue(node) {
      let value = outermostCast(node)
      while (
        (value.parent.type === `ConditionalExpression` &&
          value.parent.test !== value) ||
        value.parent.type === `LogicalExpression`
      )
        value = outermostCast(value.parent)
      if (passedValues.has(value)) return false
      passedValues.add(value)
      return true
    }

    return {
      CallExpression(node) {
        // A curried call such as `fcTest.prop(arbs)(name, fn)` is reported
        // once, at the outermost call, which holds the test body.
        if (
          node.parent.type === `CallExpression` &&
          node.parent.callee === node
        ) {
          return
        }
        if (isContextSkip(node, sourceCode, functions)) {
          context.report({ node, messageId: `skip`, data: { name: `skip` } })
          return
        }
        const { root, names: chain } = calleeChain(node.callee)
        if (runHelpers.has(root) && chain.length === 0) {
          if (
            isSingleRunLiteral(constantNumber(node.arguments[0], sourceCode)) &&
            !isFixedRunCount(node)
          ) {
            context.report({ node: node.arguments[0], messageId: `singleRun` })
          }
          return
        }
        const test = functions.callee(node.callee)
        if (
          test === undefined ||
          !test.members.every((member) => testFunctionMembers.has(member))
        ) {
          return
        }
        // A condition call passed as a value, as in
        // `const maybe = describe.skipIf(flag)`, can switch off whatever the
        // value later registers. Its own call registers nothing.
        const switchOff = test.own.at(-1)
        if (
          conditionalModifiers.has(switchOff) &&
          isPassedAsValue(outermostCast(node))
        ) {
          context.report({
            node,
            messageId: `alias`,
            data: { name: switchOff },
          })
          return
        }
        // The modifiers that this file writes, and those that a test
        // function of another module carries, which no report of this file
        // sees where that module writes them.
        const names = [...test.foreign, ...test.own]
        const unguarded = [
          ...guardingConditions(node, sourceCode),
          ...iterableConditions(eachTable(node.callee), sourceCode),
        ].every((condition) => keepsOrdinaryRun(condition, sourceCode))
        if (!unguarded) {
          context.report({ node, messageId: `guarded` })
          return
        }
        if (names.includes(`only`)) {
          context.report({ node: node.callee, messageId: `only` })
          return
        }
        const conditional =
          registrationCondition(node.callee) ?? foreignCondition(test.foreign)
        if (conditional !== undefined) {
          if (!isReplaySelection(conditional, sourceCode)) {
            context.report({
              node,
              messageId: `conditional`,
              data: { name: conditional.name },
            })
          }
          return
        }
        const disabled = names.find((name) => disablingModifiers.has(name))
        if (
          disabled !== undefined &&
          disablesBody(node.arguments, test.annotates)
        ) {
          context.report({ node, messageId: `skip`, data: { name: disabled } })
        }
      },
      Identifier(node) {
        if (!isPassedAsValue(outermostCast(node))) return
        // A variable bound to a test function is reported where the test
        // function is passed to it, not at each use.
        const definition = findVariable(sourceCode.getScope(node), node.name)
          ?.defs[0]
        if (definition !== undefined && definition.type !== `ImportBinding`) {
          return
        }
        const test = functions.callee(node)
        if (test === undefined || test.own.length > 0 || !firstValue(node))
          return
        context.report({
          node,
          messageId: `aliasTest`,
          data: { name: node.name },
        })
      },
      MemberExpression(node) {
        const variable = environmentKey(node)
        if (
          variable !== undefined &&
          isPrivateReplayVariable(variable, settings.envNames) &&
          !replaySelection
        ) {
          context.report({
            node,
            messageId: `replayVariable`,
            data: { name: variable, ...settings.envNames },
          })
        }
        // Report a chain such as `fcTest.skip` or `it.skip.prop` once, at its
        // outermost member, when nothing calls it or tags a template with it.
        if (
          node.parent.type === `MemberExpression` &&
          node.parent.object === node
        ) {
          return
        }
        if (
          (node.parent.type === `CallExpression` &&
            node.parent.callee === node) ||
          (node.parent.type === `TaggedTemplateExpression` &&
            node.parent.tag === node)
        ) {
          return
        }
        const test = functions.callee(node)
        if (test === undefined) return
        const name = test.own.find((member) => aliasModifiers.has(member))
        if (name !== undefined) {
          context.report({ node, messageId: `alias`, data: { name } })
          return
        }
        // A namespace member such as `vitest.it`, passed as a value.
        if (
          test.own.length === 0 &&
          isPassedAsValue(outermostCast(node)) &&
          firstValue(node)
        )
          context.report({
            node,
            messageId: `aliasTest`,
            data: { name: test.root },
          })
      },
      VariableDeclarator(node) {
        if (
          node.id.type !== `ObjectPattern` ||
          !isProcessEnv(node.init) ||
          replaySelection
        ) {
          return
        }
        for (const property of node.id.properties) {
          const name =
            property.type === `Property` ? propertyName(property) : undefined
          if (
            name !== undefined &&
            isPrivateReplayVariable(name, settings.envNames)
          ) {
            context.report({
              node: property,
              messageId: `replayVariable`,
              data: { name, ...settings.envNames },
            })
          }
        }
      },
      Property(node) {
        if (replaySelection || propertyName(node) !== `numRuns`) {
          return
        }
        // A constant bound to a number literal counts as that literal.
        const count = constantNumber(node.value, sourceCode)
        if (count === undefined || isFixedRunCount(node.value)) return
        context.report({
          node,
          messageId: isSingleRunLiteral(count) ? `singleRun` : `literalRuns`,
          data: settings.envNames,
        })
      },
    }
  },
}
