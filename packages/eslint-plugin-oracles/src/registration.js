/**
 * How the oracle rules recognize a test registration and the shared helpers
 * from `@tanstack/oracles`. Every rule uses these, so that the rules agree on what
 * a test is.
 */

export const testRoots = new Set([`describe`, `fcTest`, `it`, `suite`, `test`])
export const disablingModifiers = new Set([`fixme`, `skip`, `todo`])
export const conditionalModifiers = new Set([`runIf`, `skipIf`])
export const aliasModifiers = new Set([
  ...disablingModifiers,
  ...conditionalModifiers,
  `only`,
])
// The members that keep a call a test registration. Playwright's `test` also
// has calls such as `test.info()` and `test.step()` that register nothing.
export const registrationMembers = new Set([
  ...aliasModifiers,
  `concurrent`,
  `describe`,
  `each`,
  `fails`,
  `for`,
  `parallel`,
  `prop`,
  `sequential`,
  `serial`,
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

/**
 * Whether an identifier names a test function: `it`, `test`, and the
 * other test roots, a renamed import of one (`import { it as vitestIt }`),
 * or a constant bound to one through a selection helper or a member chain
 * (`const fixedCase = oracleReplayTest(it)`). A registration made through
 * such a constant is checked as a registration of its test.
 */
export function isTestRoot(node, sourceCode, seen = new Set()) {
  if (node?.type !== `Identifier`) return false
  if (testRoots.has(node.name)) return true
  const definition = findVariable(sourceCode.getScope(node), node.name)?.defs[0]
  if (definition === undefined || seen.has(definition.node)) return false
  seen.add(definition.node)
  if (definition.type === `ImportBinding`) {
    const imported = definition.node.imported
    return (
      imported !== undefined && testRoots.has(imported.name ?? imported.value)
    )
  }
  return (
    definition.type === `Variable` &&
    definition.parent.kind === `const` &&
    definition.node.init !== null &&
    isTestRoot(calleeChain(definition.node.init).rootNode, sourceCode, seen)
  )
}

export function isFunction(node) {
  return (
    node?.type === `ArrowFunctionExpression` ||
    node?.type === `FunctionExpression`
  )
}

export function findVariable(scope, name) {
  for (let current = scope; current; current = current.upper) {
    const variable = current.set.get(name)
    if (variable !== undefined) return variable
  }
  return undefined
}

// The package entries that export each framework module. A project imports the
// framework from `@tanstack/oracles`, or from its `declaration` entry, which
// loads only the declaration helpers.
const frameworkEntries = {
  'oracle-config': [`@tanstack/oracles`],
  'oracle-declaration': [`@tanstack/oracles`, `@tanstack/oracles/declaration`],
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
    isFrameworkSource(source, `oracle-declaration`)
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
 * - `legacyCampaigns`: `[{ file, reason }]`, the files that still run raw
 *   campaigns or import a legacy campaign API while they migrate to
 *   `oracleProperty`. An entry counts only with a non-empty reason.
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
      runsMultiplier: `${envPrefix}_RUNS_MULTIPLIER`,
    },
    implementationModules: moduleList(configured, `implementationModules`),
    replayWitnessModules: moduleList(configured, `replayWitnessModules`),
    legacyCampaigns: configured.legacyCampaigns ?? [],
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
 * The test that a call registers, as `{ body }`, or undefined when the call
 * registers no test. A suite (`describe`) registers no test of its own. The
 * body is the function, or the name of the function, that the test runs.
 */
export function registeredTest(node, sourceCode) {
  if (node.parent.type === `CallExpression` && node.parent.callee === node) {
    // `it.each(table)` is the callee of the registration, not one itself.
    return undefined
  }
  const { root, rootNode, names } = calleeChain(node.callee)
  if (
    !isTestRoot(rootNode, sourceCode) ||
    root === `describe` ||
    root === `suite` ||
    names.includes(`describe`) ||
    !names.every((member) => registrationMembers.has(member))
  ) {
    return undefined
  }
  const body = registrationBody(node.arguments.slice(1), sourceCode)
  return body === undefined ? undefined : { body }
}

/**
 * The argument that a registration runs. Vitest takes `(name, fn, options)` or
 * `(name, options, fn)`, so the body is the function wherever it is. Without a
 * function, the body is a call or member expression that yields one, then an
 * identifier. An options object, a number, or a value that is not a function
 * binding is never the body while another argument can be.
 */
function registrationBody(args, sourceCode) {
  return (
    args.find(isFunction) ??
    args.find(
      (argument) =>
        argument.type === `Identifier` &&
        isFunctionBinding(argument, sourceCode),
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
function isFunctionBinding(identifier, sourceCode) {
  const definition = findVariable(
    sourceCode.getScope(identifier),
    identifier.name,
  )?.defs[0]
  if (definition?.type === `FunctionName`) return true
  if (definition?.type === `Variable`) {
    const init = definition.node.init
    return init !== null && !plainValueTypes.has(init.type)
  }
  return definition !== undefined
}
