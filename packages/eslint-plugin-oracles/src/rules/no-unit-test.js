import { basename } from 'node:path'
import {
  LintSession,
  lintSession,
  loadModule,
  resolveTestModule,
} from '../modules.js'
import {
  findVariable,
  isFunction,
  isPackageEntry,
  moduleTestFunctions,
  registeredTest,
  testFunctions,
  unknownRegistration,
} from '../registration.js'
import { classifySource } from '../sources.js'

/**
 * An oracle file registers its tests only through `oracleProperty`
 * (maintainer decision, 2026-11-11). Its histories hold its fixed
 * regressions, enumerated cases, and constructed histories; its calibrations
 * show that the check rejects wrong answers; and its declared states hold its
 * reach. A test that an oracle file registers any other way has no place in
 * the oracle, whatever it calls: a unit test, a model-rule expectation, or a
 * grammar-size check belongs in an ordinary test file, beside the oracle.
 *
 * The rule reports, in a file whose name contains `oracle`:
 *
 * - `unitTest`: a test registration (`it`, `test`, `bench`, and their
 *   `.each`, `.for`, `.skipIf`, `.concurrent`, `.prop`, and other members),
 *   whatever its body reaches. Its root is a test function as the oracle
 *   rules resolve it together (registration.js, testFunctions): through an
 *   import, a namespace member, a variable, a cast, a branch, a fixture, or
 *   an export of a test module. A suite is exempt by the function that it
 *   resolves to, not by its local name. A
 *   registration inside a local helper counts once, where it is written; the
 *   helper's calls are not registrations of their own. A call to an imported
 *   helper that registers the body its caller passes, curried or not, is a
 *   registration at the call: the argument at the body parameter's position
 *   is its body.
 * - `emptyTest` and `emptyTodo`: a registration whose body is a function
 *   whose block holds no statement checks nothing. Remove it, or register it
 *   with `it.todo`, which takes no body (maintainer decision, 2026-11-10). A
 *   bare `it.todo(name)` is no registration.
 * - `incompleteProperty`: a call to the framework's `oracleProperty` whose
 *   options are not an object literal with a `check` property, because the
 *   rule cannot see that the property has a check. The framework's
 *   `oracleProperty` is the export of `@tanstack/oracles`, or of a relative
 *   module whose file is named `oracle-property`, as a project's shim is. It
 *   is found through a named import, an alias, or a namespace member. A
 *   function named `oracleProperty` from any other module is an ordinary
 *   helper and is judged like one. (Maintainer decision, oracle-framework
 *   slice, 2026-11-02.)
 * - `importedRegistration`: a call to an imported helper that registers a
 *   test of its own, through a named, default, or namespace import. The
 *   helper's tests would appear under the oracle file, so an ordinary test
 *   file registers them instead.
 * - `unknownTestSource`: a call that would be a registration through an
 *   import from a source that the rules cannot classify (sources.js: no
 *   setting or table names it, and no project module is found), once per
 *   import, at the import; and a call to a helper that makes such a call,
 *   at the call. The rule cannot tell whether such a call registers a test,
 *   so it neither reports nor passes it as one (maintainer decision,
 *   2026-11-12). It is reported in an `oracle-` machinery file too, where
 *   `oracle/no-disabled` alone guards the tests. `settings.oracles.
 *   unknownSources` of `test` or `ignore` reads such a name as a framework's
 *   or as none, and this report is not made.
 * - `malformedSourceSetting`: a source setting that the rules cannot use, at
 *   line 1. It is read as unset.
 *
 * A complete `oracleProperty` call gets no report. Neither does a call to a
 * helper in an oracle-named module, because that module's tests are linted
 * on their own; an `oracle-` machinery module is not linted, so its helpers
 * are judged here as an ordinary module's are. A test function that an
 * oracle-named module exports still registers here, where it is called.
 * Files whose names start with
 * `oracle-`, such as `oracle-replay.test.ts`, test the shared oracle
 * machinery, and the rule judges only their sources and settings there.
 *
 * To classify an imported helper, the rule reads the module that the import
 * names, and follows its re-exports, star exports, relays of imported
 * bindings, and default exports to the module that defines it. In a
 * helper's body it asks only which callees are test functions, so it never
 * walks another helper's body, and each export is answered once per lint: a
 * cycle of modules ends, and no call graph makes a lint slow. It reads each module relative to
 * the file, with the parser and parser options that ESLint uses for the file
 * it lints, so it needs no TypeScript of its own. It reads a project's own
 * modules (relative, `#` imports, and workspace packages: modules.js), and
 * never a package under node_modules. It does
 * not read production: `src/` modules of a published package. A private
 * package, such as an end-to-end suite, keeps its tests in `src/`, and the
 * rule reads those. A module that the parser cannot read classifies no
 * helper, and the rule never throws on it.
 *
 * The rule cannot see whether a complete `oracleProperty` call's check is a
 * real check, or whether a wrapper in an oracle-named module registers its
 * caller's body as an oracle property. Reviewers check those.
 */

/** How the export `name` of the module that `source` names registers tests. */
function importedRegisters(fromFile, source, name, session) {
  // A package that sources.js classifies holds no helper of the project's.
  if (classifySource(source, session.sources) !== undefined) return undefined
  const file = resolveTestModule(fromFile, source, session)
  if (file === undefined) return undefined
  return session.once(`shape\0${file}\0${name}`, () =>
    registrationShape(file, name, session),
  )
}

/**
 * The shape of an imported helper that a call in an oracle file invokes, or
 * undefined. The root is the callee under any curried calls, as in
 * `serializerProp(property, [arb])(name, check)`: a named or default import,
 * or a member of a namespace import, as in `helpers.registerUnits()`. A helper
 * in a module that is linted on its own is judged there.
 */
function importedHelperShape(node, file, sourceCode, session) {
  let callee = node.callee
  while (callee.type === `CallExpression`) callee = callee.callee
  const target = importedTarget(callee, sourceCode.getScope(node))
  if (
    target === undefined ||
    classifySource(target.source, session.sources) !== undefined
  )
    return undefined
  const module = resolveTestModule(file, target.source, session)
  if (module === undefined || lintedOnItsOwn(module)) return undefined
  return importedRegisters(file, target.source, target.name, session)
}

/** The framework module, whose `oracleProperty` calls are oracle properties. */
const frameworkModule = `oracle-property`
const frameworkExport = `oracleProperty`

/**
 * A call to the framework's `oracleProperty`, as `{ complete }`, or undefined
 * for any other call. A complete call passes an object literal with a `check`
 * property, so the property names its own check.
 */
function oraclePropertyCall(node, file, sourceCode, session) {
  const target = importedTarget(node.callee, sourceCode.getScope(node))
  if (target?.name !== frameworkExport) return undefined
  // The package entry names the framework without a file. A relative import
  // must resolve to the framework's module.
  if (!isPackageEntry(target.source, frameworkModule)) {
    const module = resolveTestModule(file, target.source, session)
    if (
      module === undefined ||
      basename(module).replace(/\.[cm]?[jt]sx?$/, ``) !== frameworkModule
    )
      return undefined
  }
  const [options] = node.arguments
  const complete =
    options?.type === `ObjectExpression` &&
    options.properties.some(
      (property) =>
        property.type === `Property` &&
        !property.computed &&
        (property.key.type === `Identifier`
          ? property.key.name === `check`
          : property.key.value === `check`),
    )
  return { complete }
}

/**
 * The import that an identifier or a namespace member names, as
 * `{ source, name }`, or undefined when it names no import.
 */
function importedTarget(node, scope) {
  if (
    node.type === `MemberExpression` &&
    !node.computed &&
    node.object.type === `Identifier`
  ) {
    const definition = findVariable(scope, node.object.name)?.defs[0]
    return definition?.type === `ImportBinding` &&
      definition.node.type === `ImportNamespaceSpecifier`
      ? { source: definition.parent.source.value, name: node.property.name }
      : undefined
  }
  if (node.type !== `Identifier`) return undefined
  const definition = findVariable(scope, node.name)?.defs[0]
  return definition?.type === `ImportBinding`
    ? importBindingTarget(definition)
    : undefined
}

/**
 * The export that an import binding names: the specifier's name, or `default`.
 * A namespace import names a whole module, so it gives undefined.
 */
function importBindingTarget(definition) {
  const source = definition.parent.source.value
  if (definition.node.type === `ImportSpecifier`) {
    const { imported } = definition.node
    return { source, name: imported.name ?? imported.value }
  }
  if (definition.node.type === `ImportDefaultSpecifier`) {
    return { source, name: `default` }
  }
  return undefined
}

/**
 * Whether the lint selection lints a module as an oracle file: its name
 * contains `oracle`, and it is not an `oracle-` machinery module, which no
 * lint reads.
 */
function lintedOnItsOwn(file) {
  const name = basename(file)
  return name.includes(`oracle`) && !name.startsWith(`oracle-`)
}

/**
 * How the export `name` of a test module registers tests, or undefined when
 * it registers none. A function registers the body that it writes ('own')
 * or the body that its caller passes ('parameter'). A binding imported from
 * another module, a re-export, and a star export are followed to that
 * module. Each answer is kept for the lint, and a cycle of modules answers
 * undefined (LintSession.once), so no export is walked twice.
 */
function registrationShape(file, name, session) {
  const module = loadModule(file, session)
  if (module === undefined) return undefined
  const entry = module.exported.get(name)
  if (entry?.variable !== undefined) {
    const definition = entry.variable.defs[0]
    if (definition?.type === `FunctionName`)
      return bodyShape(module, definition.node, session)
    if (definition?.type === `Variable` && isFunction(definition.node.init))
      return bodyShape(module, definition.node.init, session)
    // A binding imported by name or as the default, then exported.
    if (definition?.type === `ImportBinding`) {
      const target = importBindingTarget(definition)
      return (
        target && importedRegisters(file, target.source, target.name, session)
      )
    }
    return undefined
  }
  if (entry?.node !== undefined)
    return isFunction(entry.node)
      ? bodyShape(module, entry.node, session)
      : undefined
  if (entry?.source !== undefined)
    return importedRegisters(file, entry.source, entry.imported, session)
  if (entry !== undefined || name === `default`) return undefined
  for (const source of module.starSources) {
    const shape = importedRegisters(file, source, name, session)
    if (shape !== undefined) return shape
  }
  return undefined
}

/**
 * The shape of the registrations in a function's body. A registration
 * registers the caller's body when its body is a parameter of the function,
 * or of a function that it returns, or when its body is a wrapper written
 * here that calls such a parameter. The shape records where the caller
 * passes that body. Any other registration registers a body that the
 * function writes, which wins. The walk asks only which callees are test
 * functions, so it never walks another helper's body.
 */
function bodyShape(module, fn, session) {
  const functions = moduleTestFunctions(module, session)
  let shape
  walk(fn, (node) => {
    if (node.type !== `CallExpression`) return
    const test = registeredTest(node, functions)
    if (test === undefined) {
      // A call through a source that the rules cannot classify: the helper
      // may register a test, and that is reported unless it surely does.
      const unknown = unknownRegistration(node, functions)
      if (unknown !== undefined && shape === undefined)
        shape = { kind: `unknown`, name: unknown.name, source: unknown.source }
      return
    }
    const position = passedBody(test.body, fn, functions)
    if (position === undefined) shape = { kind: `own` }
    else if (shape?.kind !== `own`) {
      shape = { kind: `parameter`, ...position }
    }
  })
  return shape
}

/**
 * Where a registration's body comes from, when its caller passes it: the
 * body is a parameter of `fn` or of a function inside `fn`, or a wrapper
 * that calls one. The position is `{ index, level }`: the parameter's index,
 * and the number of functions from `fn` to the one that declares it.
 */
function passedBody(body, fn, functions) {
  const positionOf = (identifier) => {
    const definition = findVariable(
      functions.getScope(identifier),
      identifier.name,
    )?.defs[0]
    if (definition?.type !== `Parameter`) return undefined
    const owner = definition.node
    let level = 0
    for (let node = owner; node !== fn; node = node.parent) {
      // A parameter of the wrapper itself, or of a function outside `fn`.
      if (node === null || node === body) return undefined
      if (isFunction(node)) level++
    }
    return { index: owner.params.indexOf(definition.name), level }
  }
  if (body.type === `Identifier`) return positionOf(body)
  if (!isFunction(body)) return undefined
  let position
  walk(body, (node) => {
    if (
      position === undefined &&
      node.type === `CallExpression` &&
      node.callee.type === `Identifier`
    ) {
      position = positionOf(node.callee)
    }
  })
  return position
}

function walk(node, visit) {
  visit(node)
  for (const [key, child] of Object.entries(node)) {
    if (key === `parent`) continue
    for (const item of Array.isArray(child) ? child : [child]) {
      if (typeof item?.type === `string`) walk(item, visit)
    }
  }
}

function isEmpty(body) {
  return (
    isFunction(body) &&
    body.body.type === `BlockStatement` &&
    body.body.body.length === 0
  )
}

/**
 * The test module that a relative specifier names in `fromFile`, as this rule
 * resolves it: undefined for production source, a package, or a missing file.
 * A project's lint selection can follow these edges, so that an edit reaches
 * the oracle files that this rule reads.
 */
const selectionSession = new LintSession()
export function resolveImportedTestModule(fromFile, specifier) {
  return resolveTestModule(fromFile, specifier, selectionSession)
}

export default {
  meta: {
    type: `problem`,
    docs: {
      description: `Report tests in oracle files that do not register through oracleProperty.`,
    },
    schema: [],
    messages: {
      emptyTest: `This test's body is empty, so it checks nothing. Remove it, or use it.todo.`,
      emptyTodo: `it.todo takes no body; remove the body.`,
      unitTest: `An oracle file registers its tests only through oracleProperty. Put a fixed history in its histories (\`fixed\`, or an enumerated source), a calibration in its calibrations, and a reach check in its declared states. Move any other test to an ordinary test file.`,
      incompleteProperty: `This oracleProperty call does not pass an object literal with a check, so the rule cannot see that the property has one. Pass its options inline as \`oracleProperty({ id, law, histories, driver, model, check })\`.`,
      importedRegistration: `This oracle file calls a helper that registers tests. An oracle file registers only oracle tests, so register those tests from an ordinary test file and keep this file to its checks and model.`,
      unknownTestSource: `The rules cannot tell whether \`{{name}}\` from \`{{source}}\` is a test function, because they do not read that package. Name the package in \`settings.oracles.testPackages\` (a test framework's specifier, or a table of its exports such as \`{ authTest: 'test' }\`) or in \`settings.oracles.nonTestPackages\`.`,
      malformedSourceSetting: `\`settings.oracles.{{name}}\` is malformed, so the rules read it as unset. \`testPackages\` maps a specifier to a framework's specifier or to a table of export roles (\`'test'\` or \`'suite'\`), \`nonTestPackages\` is an array of specifiers, and \`unknownSources\` is \`'report'\`, \`'test'\`, or \`'ignore'\`.`,
    },
  },
  create(context) {
    const { sourceCode } = context
    const session = lintSession(context)
    const functions = testFunctions(context)
    // Each import of a source that the rules cannot classify is reported
    // once, at the import, for the first call that would register through it.
    const reported = new Set()
    function reportUnknown(node) {
      const unknown = unknownRegistration(node, functions)
      if (unknown === undefined || reported.has(unknown.site)) return
      reported.add(unknown.site)
      context.report({
        node: unknown.site ?? node,
        messageId: `unknownTestSource`,
        data: { name: unknown.name, source: unknown.source },
      })
    }
    const settingProblems = {
      Program() {
        for (const name of session.sources.malformed)
          context.report({
            loc: { line: 1, column: 0 },
            messageId: `malformedSourceSetting`,
            data: { name },
          })
      },
    }
    // `oracle-config`, `oracle-property`, and the other `oracle-` modules are
    // the shared oracle machinery. Their tests check that machinery, not a law,
    // so only a source that the rules cannot classify is reported there:
    // `oracle/no-disabled` alone guards those tests, and it cannot see one.
    if (basename(context.filename).startsWith(`oracle-`))
      return {
        ...settingProblems,
        CallExpression(node) {
          if (registeredTest(node, functions) === undefined) reportUnknown(node)
        },
      }
    return {
      ...settingProblems,
      CallExpression(node) {
        // A curried callee is not a call of its own: the outermost call is the
        // registration.
        if (
          node.parent.type === `CallExpression` &&
          node.parent.callee === node
        )
          return
        const property = oraclePropertyCall(
          node,
          context.filename,
          sourceCode,
          session,
        )
        if (property !== undefined) {
          if (!property.complete)
            context.report({ node, messageId: `incompleteProperty` })
          return
        }
        const helper = importedHelperShape(
          node,
          context.filename,
          sourceCode,
          session,
        )
        if (helper?.kind === `own`) {
          context.report({ node, messageId: `importedRegistration` })
          return
        }
        // The helper registers the body its caller passes, so the call is a
        // test registration of this file.
        if (helper?.kind === `parameter`) {
          context.report({ node, messageId: `unitTest` })
          return
        }
        if (helper?.kind === `unknown`) {
          context.report({
            node,
            messageId: `unknownTestSource`,
            data: { name: helper.name, source: helper.source },
          })
          return
        }
        const test = registeredTest(node, functions)
        if (test === undefined) {
          reportUnknown(node)
          return
        }
        if (isEmpty(test.body)) {
          // `it.todo` with a body contradicts itself: a todo takes none.
          const todo = test.modifiers.includes(`todo`)
          context.report({ node, messageId: todo ? `emptyTodo` : `emptyTest` })
          return
        }
        context.report({ node, messageId: `unitTest` })
      },
    }
  },
}
