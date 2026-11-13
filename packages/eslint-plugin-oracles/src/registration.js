/**
 * How the oracle rules recognize a test registration and the shared helpers
 * from `@tanstack/oracles`. Every rule uses these, so that the rules agree on what
 * a test is.
 */
import {
  lintSession,
  loadModule,
  resolveTestModule,
  subpathPackage,
} from './modules.js'
import {
  ANNOTATIONS,
  OPTIONAL_TITLE,
  classifySource,
  frameworkNames,
  globalRoles,
} from './sources.js'

export const disablingModifiers = new Set([`fixme`, `ignore`, `skip`, `todo`])
// The members that switch a test off under a condition: Vitest's and AVA's
// `skipIf` and `runIf`, and Bun's `if` and `todoIf`.
export const conditionalModifiers = new Set([`if`, `runIf`, `skipIf`, `todoIf`])
export const aliasModifiers = new Set([
  ...disablingModifiers,
  ...conditionalModifiers,
  `only`,
])
// The members that keep a call a test registration, in any framework that
// the rules know (sources.js). Playwright's `test` also has calls such as
// `test.info()` and `test.step()` that register nothing.
export const registrationMembers = new Set([
  ...aliasModifiers,
  `concurrent`,
  `concurrentIf`,
  `describe`,
  `each`,
  `effect`,
  `expectFailure`,
  `fail`,
  `failing`,
  `failingIf`,
  `fails`,
  `for`,
  `live`,
  `parallel`,
  `prop`,
  `scopedLive`,
  `sequential`,
  `serial`,
  `serialIf`,
  `shuffle`,
])
// The shared helpers that return a test registration or its `skip` form.
export const selectionHelpers = new Set([
  `oracleCalibrationTest`,
  `oracleReplayTest`,
])

/** The root identifier and member names of a callee such as `it.skip.prop(...)`. */
export function calleeChain(callee) {
  const names = []
  let node = callee
  for (;;) {
    if (node.type === `MemberExpression`) {
      if (node.property.type === `Identifier`) names.unshift(node.property.name)
      node = node.object
    } else if (
      node.type === `CallExpression` &&
      node.callee.type === `Identifier` &&
      selectionHelpers.has(node.callee.name) &&
      node.arguments.length > 0
    ) {
      // `oracleReplayTest(it)` returns `it` or `it.skip`, so a registration
      // made through it is checked as a registration of `it`.
      node = node.arguments[0]
    } else if (node.type === `CallExpression`) {
      node = node.callee
    } else {
      break
    }
  }
  return {
    root: node.type === `Identifier` ? node.name : undefined,
    rootNode: node,
    names,
  }
}

export function isFunction(node) {
  return (
    node?.type === `ArrowFunctionExpression` ||
    node?.type === `FunctionExpression` ||
    node?.type === `FunctionDeclaration`
  )
}

// -- Test functions -----------------------------------------------------------
//
// Every oracle rule asks the same question of a callee: which test function,
// if any, is its root? The answer is a test value, `{ root, members, own,
// foreign }`: the framework function that it resolves to (`it`, `test`,
// `describe`, `suite`, or `bench`, or `test` and `describe` for a
// framework's other names), every member read after that root (`skip`,
// `each`, `extend`), the members written since the last binding (those that
// the expression itself spells), and the members that a binding of another
// module carries (Jest's `xit` carries `skip`). A namespace value, `{
// member(name), call }`, is a namespace import, or a `require(...)`, whose
// `call` is what calling it calls. A factory value, `{ result }`, returns a
// test function when it is called (Playwright's `mergeTests`). An unknown
// value is an export of a package that the rules cannot classify
// (sources.js), with the import that binds it (`site`).
//
// A binding resolves when it is an import (named, default, or namespace) or
// a `require` of a source that sources.js classifies, an export of a
// project's test module (relative, `#` import, or workspace package:
// modules.js), a namespace member, or a variable (its initializer, a
// destructuring, and each plain assignment). Casts, the branches of a
// conditional or logical expression, `test.extend(fixtures)`, a selection
// helper such as `oracleReplayTest(it)`, and a tagged template such as
// `it.each` with a table keep the value. Any other binding, such as a local
// function of the same name, is no test function. An unbound name is a
// global of a test environment (globalRoles).

export const suiteRoots = new Set([`describe`, `suite`])
// The members that keep a call a registration, and those that return a test
// function with fixtures: `extend`, and Vitest's `override` and `scoped`.
export const testFunctionMembers = new Set([
  ...registrationMembers,
  `extend`,
  `override`,
  `scoped`,
])
// Expressions that keep their operand's value: casts and parentheses.
const transparent = new Set([
  `ChainExpression`,
  `ParenthesizedExpression`,
  `TSAsExpression`,
  `TSInstantiationExpression`,
  `TSNonNullExpression`,
  `TSSatisfiesExpression`,
  `TSTypeAssertion`,
])

const rootNames = new Set([`it`, `test`, `describe`, `suite`, `bench`])
// `untitled` and `annotates` are the argument grammar of the table that
// the test function comes from (sources.js).
const framework = (root, carried, table) => ({
  kind: `test`,
  root,
  members: carried === undefined ? [] : [carried],
  own: [],
  foreign: carried === undefined ? [] : [carried],
  untitled: table?.[OPTIONAL_TITLE] === true,
  annotates: table?.[ANNOTATIONS] === true,
})

/**
 * The value of a role (sources.js) of the export `name` of `table`: a test
 * function or suite, with the modifier that it carries and the table's
 * argument grammar, a factory, or a namespace.
 */
function roleValue(role, name, table) {
  if (typeof role === `string`) {
    const [kind, carried] = role.split(`.`)
    const suite = kind === `suite`
    // The export's own name when it names a root of its kind.
    const root =
      rootNames.has(name) && suiteRoots.has(name) === suite
        ? name
        : suite
          ? `describe`
          : `test`
    return framework(root, carried, table)
  }
  if (role.factory !== undefined)
    return { kind: `factory`, result: roleValue(role.factory, ``, table) }
  return tableNamespace(role.namespace)
}

const tableNamespace = (table) => ({
  kind: `namespace`,
  member: (name) =>
    Object.hasOwn(table, name)
      ? roleValue(table[name], name, table)
      : undefined,
})

/** The expression that casts or parentheses around `node` make. */
export function outermostCast(node) {
  let outer = node
  while (transparent.has(outer.parent?.type)) outer = outer.parent
  return outer
}

/**
 * The test functions that a lint of `context`'s file can see:
 * `value(node)` is the value of an expression, and `callee(node)` the test
 * value of a callee, or undefined.
 */
export function testFunctions(context) {
  return scopedTestFunctions({
    file: context.filename,
    getScope: (node) => context.sourceCode.getScope(node),
    session: lintSession(context),
  })
}

/** The test functions of a test module that a session loaded. */
export function moduleTestFunctions(module, session) {
  return scopedTestFunctions({
    file: module.file,
    getScope: (node) => module.scopeOf(node),
    session,
  })
}

function scopedTestFunctions(scope) {
  const value = (node) => valueOf(node, scope, new Set())
  return {
    value,
    callee: (node) => testOnly(callable(value(node))),
    unknown: (node) => {
      const found = value(node)
      return found?.kind === `unknown` ? found : undefined
    },
    getScope: scope.getScope,
  }
}

const testOnly = (value) => (value?.kind === `test` ? value : undefined)
// A `require(...)` of a package whose export is a function is that function
// when it is called.
const callable = (value) =>
  value?.kind === `namespace` && value.call !== undefined ? value.call : value

/**
 * What calling a value gives: a test function or an unknown value with its
 * members, a factory's result, or nothing.
 */
function callResult(value) {
  const called = callable(value)
  if (called?.kind === `factory`) return called.result
  return called?.kind === `test` || called?.kind === `unknown`
    ? called
    : undefined
}

/**
 * Of the values that an expression may have, the one that the rules judge:
 * a test that is not a suite, then a suite. A branch that may be a test
 * function makes the expression one, so a registration through it is
 * reported, not passed.
 */
function pick(values) {
  const tests = values.filter((value) => value?.kind === `test`)
  return (
    tests.find((value) => !suiteRoots.has(value.root)) ??
    tests[0] ??
    values.find((value) => value?.kind === `unknown`) ??
    values.find((value) => value !== undefined)
  )
}

/** The name that a member expression reads, or undefined when it is computed. */
function memberName(node) {
  if (!node.computed && node.property.type === `Identifier`)
    return node.property.name
  return node.computed &&
    node.property.type === `Literal` &&
    typeof node.property.value === `string`
    ? node.property.value
    : undefined
}

/** The value of `name` read on `value`. */
function memberOf(value, name) {
  if (value === undefined || name === undefined) return undefined
  if (value.kind === `namespace`)
    return value.member(name) ?? memberOf(value.call, name)
  if (value.kind === `factory`) return undefined
  return {
    ...value,
    members: [...value.members, name],
    own: [...value.own, name],
  }
}

function valueOf(node, scope, seen) {
  if (transparent.has(node.type)) return valueOf(node.expression, scope, seen)
  switch (node.type) {
    case `ConditionalExpression`:
      return pick([
        valueOf(node.consequent, scope, seen),
        valueOf(node.alternate, scope, seen),
      ])
    case `LogicalExpression`:
      return pick([
        valueOf(node.left, scope, seen),
        valueOf(node.right, scope, seen),
      ])
    case `TaggedTemplateExpression`:
      return callResult(valueOf(node.tag, scope, seen))
    case `AssignmentExpression`:
      // Lab's `const { it } = exports.lab = Lab.script()`.
      return node.operator === `=`
        ? valueOf(node.right, scope, seen)
        : undefined
    case `CallExpression`:
      // `oracleReplayTest(it)` returns `it` or `it.skip`, so a registration
      // made through it is a registration of `it`.
      if (
        node.callee.type === `Identifier` &&
        selectionHelpers.has(node.callee.name) &&
        node.arguments.length > 0
      )
        return valueOf(node.arguments[0], scope, seen)
      if (isRequire(node, scope))
        return namespaceOf(node.arguments[0].value, scope, node, true)
      return callResult(valueOf(node.callee, scope, seen))
    case `MemberExpression`:
      return memberOf(valueOf(node.object, scope, seen), memberName(node))
    case `Identifier`:
      return bindingValue(node, scope, seen)
    default:
      return undefined
  }
}

function bindingValue(identifier, scope, seen) {
  const variable = findVariable(scope.getScope(identifier), identifier.name)
  // An unbound name, or a global that the configuration declares.
  if (variable === undefined || variable.defs.length === 0) {
    return Object.hasOwn(globalRoles, identifier.name)
      ? roleValue(globalRoles[identifier.name], identifier.name)
      : undefined
  }
  return variableValue(variable, scope, seen)
}

/** The value of a variable: its import, or what its declaration and assignments give. */
function variableValue(variable, scope, seen) {
  // A cycle of variables (`let a = b; let b = a`) has no value.
  if (seen.has(variable)) return undefined
  seen.add(variable)
  const definition = variable.defs[0]
  if (definition.type === `ImportBinding`) {
    const source = definition.parent.source.value
    if (definition.node.type === `ImportNamespaceSpecifier`)
      return namespaceOf(source, scope, definition.node)
    const { imported } = definition.node
    return importedValue(
      source,
      imported === undefined ? `default` : (imported.name ?? imported.value),
      scope,
      definition.node,
    )
  }
  if (definition.type !== `Variable`) return undefined
  const { id, init } = definition.node
  const written = [
    init === null
      ? undefined
      : id.type === `Identifier`
        ? valueOf(init, scope, seen)
        : destructured(id, definition.name, init, scope, seen),
    // Each plain assignment, as in `let t; t = it`.
    ...variable.references
      .filter(
        (reference) =>
          reference.isWrite() &&
          !reference.init &&
          reference.identifier.parent.type === `AssignmentExpression` &&
          reference.identifier.parent.left === reference.identifier &&
          reference.identifier.parent.operator === `=`,
      )
      .map((reference) =>
        valueOf(reference.identifier.parent.right, scope, seen),
      ),
  ]
  const value = pick(written)
  return value && { ...value, own: [] }
}

/** The value that an object pattern gives `name`, as `const { it: t } = vitest` does. */
function destructured(pattern, name, init, scope, seen) {
  if (pattern.type !== `ObjectPattern`) return undefined
  const property = pattern.properties.find(
    (candidate) =>
      candidate.type === `Property` &&
      (candidate.value === name ||
        (candidate.value.type === `AssignmentPattern` &&
          candidate.value.left === name)),
  )
  if (property === undefined) return undefined
  const key = property.computed
    ? typeof property.key.value === `string`
      ? property.key.value
      : undefined
    : property.key.name
  return memberOf(valueOf(init, scope, seen), key)
}

/**
 * A namespace import (or a `require`) of a package or of a test module, or
 * undefined for a relative module that is no test module. A `require` is
 * also the module's default export when it is called.
 */
function namespaceOf(source, scope, site, required = false) {
  if (
    source.startsWith(`.`) &&
    resolveTestModule(scope.file, source, scope.session) === undefined
  )
    return undefined
  return {
    kind: `namespace`,
    member: (name) => importedValue(source, name, scope, site),
    call: required ? importedValue(source, `default`, scope, site) : undefined,
  }
}

/** Whether a call is `require('<specifier>')` of the unbound `require`. */
function isRequire(node, scope) {
  if (
    node.callee.type !== `Identifier` ||
    node.callee.name !== `require` ||
    node.arguments.length !== 1 ||
    node.arguments[0].type !== `Literal` ||
    typeof node.arguments[0].value !== `string`
  )
    return false
  const variable = findVariable(scope.getScope(node), `require`)
  return variable === undefined || variable.defs.length === 0
}

/**
 * The value of the export `name` of `source`, which `site` imports in this
 * module (with the local name `local` for a default import). A package that
 * sources.js classifies gives its table's role, or nothing. A project's test
 * module (modules.js) is read: each export is resolved once for each lint,
 * a cycle of modules resolves to nothing, and the members that it carries
 * are foreign to the importer. Any other package is an unknown source
 * (unknownValue).
 */
function importedValue(source, name, scope, site) {
  const { sources } = scope.session
  // A `#` import whose target is a package is that package's import.
  const target = source.startsWith(`#`)
    ? subpathPackage(scope.file, source, scope.session)
    : undefined
  if (target !== undefined) return importedValue(target, name, scope, site)
  const classified = source.startsWith(`.`)
    ? undefined
    : classifySource(source, sources)
  if (classified === `none`) return undefined
  if (classified !== undefined)
    return Object.hasOwn(classified.table, name)
      ? roleValue(classified.table[name], name, classified.table)
      : undefined
  const file = resolveTestModule(scope.file, source, scope.session)
  if (file === undefined)
    return source.startsWith(`.`)
      ? undefined
      : unknownValue(source, name, site, sources)
  const value = scope.session.once(`value\0${file}\0${name}`, () =>
    exportValue(file, name, scope.session),
  )
  if (value?.kind === `test`)
    return { ...value, own: [], foreign: value.members }
  // An unknown source reached through this module is reported where this
  // module imports it.
  return value?.kind === `unknown` ? { ...value, site } : value
}

/**
 * An export of a package that no table or setting classifies, whatever its
 * name, and `unknownSources` decides: `report` (the default) gives an
 * unknown value, which the rules report where a title-shaped call uses it
 * (unknownRegistration); `test` reads a name that some framework exports as
 * a test function or suite (frameworkNames) as the framework's, and any
 * other export as none.
 */
function unknownValue(source, name, site, sources) {
  if (sources.unknownSources === `test`)
    return Object.hasOwn(frameworkNames, name)
      ? roleValue(frameworkNames[name], name)
      : undefined
  return { kind: `unknown`, source, name, site, members: [], own: [] }
}

/** The value of a test module's export, through its re-exports and star exports. */
function exportValue(file, name, session) {
  const module = loadModule(file, session)
  if (module === undefined) return undefined
  const scope = { file, getScope: (node) => module.scopeOf(node), session }
  const entry = module.exported.get(name)
  if (entry?.variable !== undefined)
    return variableValue(entry.variable, scope, new Set())
  if (entry?.node !== undefined) return valueOf(entry.node, scope, new Set())
  if (entry?.namespace !== undefined) return namespaceOf(entry.namespace, scope)
  if (entry !== undefined)
    return importedValue(entry.source, entry.imported, scope, undefined)
  if (name === `default`) return undefined
  for (const source of module.starSources) {
    const value = importedValue(source, name, scope, undefined)
    if (value !== undefined) return value
  }
  return undefined
}

export function findVariable(scope, name) {
  for (let current = scope; current; current = current.upper) {
    const variable = current.set.get(name)
    if (variable !== undefined) return variable
  }
  return undefined
}

// The package entries that export each framework module. A project imports the
// framework from `@tanstack/oracles`, or from its browser-safe `route` entry,
// which loads only the route helpers.
const frameworkEntries = {
  'oracle-config': [`@tanstack/oracles`],
  'oracle-route': [`@tanstack/oracles`, `@tanstack/oracles/route`],
  'oracle-property': [`@tanstack/oracles`],
}

/**
 * Whether `source` imports the framework module `name` (`oracle-property`,
 * for example): through a package entry that exports it, or through a
 * relative module with that name, as a project keeps a shim that re-exports
 * the package at the framework's old path.
 */
export function isPackageEntry(source, name) {
  return frameworkEntries[name].includes(source)
}

export function isFrameworkSource(source, name) {
  return (
    isPackageEntry(source, name) ||
    new RegExp(`(^|/)${name}(\\.js)?$`).test(source)
  )
}

/** Whether `source` is an import specifier of the shared oracle-config module. */
export function isOracleConfigSource(source) {
  return (
    isFrameworkSource(source, `oracle-config`) ||
    isFrameworkSource(source, `oracle-route`)
  )
}

/**
 * Whether `node` calls the framework's export `name`, imported under that
 * name or another from a framework entry or a project's oracle-config.
 */
export function callsFrameworkExport(node, name, sourceCode) {
  if (node?.type !== `CallExpression` || node.callee.type !== `Identifier`) {
    return false
  }
  const definition = findVariable(sourceCode.getScope(node), node.callee.name)
    ?.defs[0]
  const imported = definition?.node.imported
  return (
    definition?.type === `ImportBinding` &&
    (imported?.name ?? imported?.value) === name &&
    isOracleConfigSource(definition.parent.source.value)
  )
}

/** The settings whose value is a list of module paths. */
const MODULE_LISTS = [`implementationModules`, `replayWitnessModules`]

/**
 * The project's settings for these rules, from `settings.oracles` in the flat
 * config. Every field is optional:
 *
 * - `envPrefix` (default `ORACLE`): the prefix of the framework's environment
 *   variables, `${envPrefix}_SEED`, `_PATH`, `_PROPERTY`, and
 *   `_RUNS_MULTIPLIER`. It must match the framework's configuration.
 * - `implementationModules`: paths of the modules that implement replay
 *   selection. They may read the replay variables, and a replay may be
 *   selected through them.
 * - `replayWitnessModules`: paths of the module that writes a replay witness,
 *   whose record is serialized by the standard JSON serializer.
 *
 * `legacyCampaigns` is removed (maintainer decision 2026-11-10): it was the
 * exemption list of `oracle/oracle-property-only`. `legacyCampaignsSet` tells
 * whether a configuration still sets it, to any value but `undefined`. It
 * exempts nothing, and that rule reports it.
 *
 * A path names a file by its end at a path boundary, relative to the
 * repository (such as `<package>/tests/oracle-config.ts`). Paths are not patterns,
 * so a file named `oracle-config.ts` elsewhere is not exempt.
 */
export function oracleSettings(context) {
  const configured = context.settings?.oracles ?? {}
  const envPrefix = configured.envPrefix ?? `ORACLE`
  // A module list that is not an array is read as an empty list, and its name is
  // reported (malformedSetting), since no module of it can be judged.
  const malformed = MODULE_LISTS.filter(
    (name) =>
      configured[name] !== undefined && !Array.isArray(configured[name]),
  )
  return {
    envNames: {
      seed: `${envPrefix}_SEED`,
      path: `${envPrefix}_PATH`,
      property: `${envPrefix}_PROPERTY`,
      unit: `${envPrefix}_UNIT`,
      runsMultiplier: `${envPrefix}_RUNS_MULTIPLIER`,
    },
    implementationModules: moduleList(configured, `implementationModules`),
    replayWitnessModules: moduleList(configured, `replayWitnessModules`),
    legacyCampaignsSet: configured.legacyCampaigns !== undefined,
    malformed,
  }
}

/** The module paths of a setting, or no paths when the value is not an array. */
function moduleList(configured, name) {
  const value = configured[name] ?? []
  return Array.isArray(value) ? value : []
}

/** Whether `filename` is one of the module paths in `modules`. */
export function isModuleFile(filename, modules) {
  const file = filename.replaceAll(`\\`, `/`)
  return modules.some(
    (module) => file === module || file.endsWith(`/${module}`),
  )
}

/** A call to one of `names`, imported from oracle-config. */
export function isSharedHelperCall(node, names, sourceCode) {
  if (
    node?.type !== `CallExpression` ||
    node.callee.type !== `Identifier` ||
    !names.has(node.callee.name)
  ) {
    return false
  }
  const definition = findVariable(sourceCode.getScope(node), node.callee.name)
    ?.defs[0]
  return (
    definition?.type === `ImportBinding` &&
    isOracleConfigSource(definition.parent.source.value)
  )
}

/**
 * The test that a call registers, as `{ body, modifiers }`, or undefined
 * when the call registers no test. A suite (`describe`, or a fixture's
 * `.describe`) registers no test of its own, whatever its local name. The
 * body is the function, or the name of the function, that the test runs.
 * `functions` are the test functions of the call's file (testFunctions).
 */
export function registeredTest(node, functions) {
  if (node.parent.type === `CallExpression` && node.parent.callee === node) {
    // `it.each(table)` is the callee of the registration, not one itself.
    return undefined
  }
  const test = functions.callee(node.callee)
  if (
    test === undefined ||
    suiteRoots.has(test.root) ||
    test.members.includes(`describe`) ||
    !test.members.every((member) => testFunctionMembers.has(member))
  ) {
    return undefined
  }
  // The body follows the first argument (a title). Where the framework's
  // title is optional, a function first is the body, as in node:test's
  // `test(fn)`; elsewhere it is not, as in Playwright's annotation
  // `test.skip(condition, description)`.
  const [first, ...rest] = node.arguments
  const body =
    registrationBody(rest, functions) ??
    (test.untitled && first !== undefined && isFunctionValue(first, functions)
      ? first
      : undefined)
  // The modifiers between the root and the call, such as `skip` or `todo`.
  return body === undefined ? undefined : { body, modifiers: test.members }
}

/**
 * The unknown source that a call would register through, or undefined: the
 * callee resolves to an unknown value (an export of a package that the
 * rules cannot classify), its members are ones that keep a registration,
 * and the call is title-shaped: a string or template title first, and a
 * function after it, as every framework's registration is. Such a call is a
 * registration if the source is a test framework. A library's `pMap(xs,
 * fn)`, `debounce(fn, 10)`, and `effect(fn)` are not title-shaped
 * (coordinator decision under the maintainer decision of 2026-11-12).
 */
export function unknownRegistration(node, functions) {
  if (node.parent.type === `CallExpression` && node.parent.callee === node)
    return undefined
  const unknown = functions.unknown(node.callee)
  const [title, ...rest] = node.arguments
  if (
    unknown === undefined ||
    !unknown.members.every((member) => testFunctionMembers.has(member)) ||
    !(
      title?.type === `TemplateLiteral` ||
      (title?.type === `Literal` && typeof title.value === `string`)
    ) ||
    !rest.some((argument) => isFunctionValue(argument, functions))
  )
    return undefined
  return unknown
}

/** Whether an argument is a function: written inline, or a binding of one. */
function isFunctionValue(argument, functions) {
  if (isFunction(argument)) return true
  if (argument.type !== `Identifier`) return false
  const definition = findVariable(functions.getScope(argument), argument.name)
    ?.defs[0]
  return (
    definition?.type === `FunctionName` ||
    (definition?.type === `Variable` && isFunction(definition.node.init))
  )
}

/**
 * The argument that a registration runs. Vitest takes `(name, fn, options)` or
 * `(name, options, fn)`, so the body is the function wherever it is. Without a
 * function, the body is a call or member expression that yields one, then an
 * identifier. An options object, a number, or a value that is not a function
 * binding is never the body while another argument can be.
 */
function registrationBody(args, functions) {
  return (
    args.find(isFunction) ??
    args.find(
      (argument) =>
        argument.type === `Identifier` &&
        isFunctionBinding(argument, functions),
    ) ??
    args.find(
      (argument) =>
        !plainValueTypes.has(argument.type) && argument.type !== `Identifier`,
    ) ??
    args.find((argument) => argument.type === `Identifier`)
  )
}

// Argument types that carry data, not behavior, so they can be options.
const plainValueTypes = new Set([
  `Literal`,
  `ObjectExpression`,
  `ArrayExpression`,
  `TemplateLiteral`,
])

/**
 * Whether an identifier names a function, or may. A binding that holds a plain
 * value is not a function. An import, a parameter, or a call result may be one.
 */
function isFunctionBinding(identifier, functions) {
  const definition = findVariable(
    functions.getScope(identifier),
    identifier.name,
  )?.defs[0]
  if (definition?.type === `FunctionName`) return true
  if (definition?.type === `Variable`) {
    const init = definition.node.init
    return init !== null && !plainValueTypes.has(init.type)
  }
  return definition !== undefined
}
