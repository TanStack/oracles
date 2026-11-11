import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { Linter } from 'eslint'
import {
  findVariable,
  isFunction,
  isPackageEntry,
  registeredTest,
} from '../registration.js'

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
 * - `unitTest`: a test registration (`it`, `test`, and their `.each`, `.for`,
 *   `.skipIf`, `.prop`, and other members), whatever its body reaches. A
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
 *
 * A complete `oracleProperty` call gets no report. Neither does a call to a
 * helper in an oracle-named module, because that module's tests are linted
 * on their own; an `oracle-` machinery module is not linted, so its helpers
 * are judged here as an ordinary module's are. Files whose names start with
 * `oracle-`, such as `oracle-replay.test.ts`, test the shared oracle
 * machinery, and the rule skips them.
 *
 * To classify an imported helper, the rule reads the module that the import
 * names, relative to the file, with the parser and parser options that ESLint
 * uses for the file it lints, so it needs no TypeScript of its own. It does
 * not read production: `src/` modules of a published package. A private
 * package, such as an end-to-end suite, keeps its tests in `src/`, and the
 * rule reads those. A module that the parser cannot read classifies no
 * helper, and the rule never throws on it.
 *
 * The rule cannot see whether a complete `oracleProperty` call's check is a
 * real check, or whether a wrapper in an oracle-named module registers its
 * caller's body as an oracle property. Reviewers check those.
 */

/**
 * Every module that an earlier lint parsed, by path, with the mtime and size
 * it was read at and the language options it was parsed with. Parsing is the
 * costly part, so a module is parsed again only when it changes, or when a
 * file with other language options imports it. The reach that a lint computes
 * is never kept between lints, so an edit to any module reaches the next lint:
 * see LintSession.
 */
const parsedModules = new Map()

/**
 * The state of one lint run: the language options of the file it lints, the
 * modules it loaded, and the production package flags it read.
 */
class LintSession {
  modules = new Map()
  published = new Map()
  constructor(languageOptions) {
    this.languageOptions = languageOptions
  }
}

/** Whether a function that a module imports from `source` registers a test. */
function importedRegisters(fromFile, source, name, session, visiting) {
  const file = resolveTestModule(fromFile, source, session)
  const module = file === undefined ? undefined : loadModule(file, session)
  return module?.registrationShape(name, visiting)
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
  if (target === undefined) return undefined
  const module = resolveTestModule(file, target.source, session)
  if (module === undefined || lintedOnItsOwn(module)) return undefined
  return loadModule(module, session)?.registrationShape(target.name)
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

/** The test module that a relative import names, or undefined. */
function resolveTestModule(fromFile, source, session) {
  if (!source.startsWith(`.`)) return undefined
  const base = resolve(dirname(fromFile), source)
  const stem = base.replace(/\.(m?js|tsx?)$/, ``)
  // A `.js` specifier names the TypeScript source when one exists, and
  // otherwise the JavaScript module itself.
  const file = [
    `${stem}.ts`,
    `${stem}.tsx`,
    ...(/\.m?js$/.test(base) ? [base] : []),
    `${base}/index.ts`,
  ].find((candidate) => existsSync(candidate))
  // Production declares no oracle part, so the rule does not parse it.
  if (file === undefined || isProductionModule(file, session)) return undefined
  return file
}

/**
 * Whether a file is shipped source: under `src/` in a published package. A
 * private package, such as an end-to-end suite, keeps its tests in `src/`.
 */
function isProductionModule(file, session) {
  for (let directory = dirname(file); ; directory = dirname(directory)) {
    const manifest = join(directory, `package.json`)
    if (existsSync(manifest)) {
      if (!session.published.has(directory)) {
        const { private: isPrivate } = JSON.parse(
          readFileSync(manifest, `utf8`),
        )
        session.published.set(directory, isPrivate !== true)
      }
      return (
        session.published.get(directory) &&
        relative(directory, file).split(sep)[0] === `src`
      )
    }
    if (dirname(directory) === directory) return false
  }
}

/** The module that a file names, for this lint, or undefined when it cannot be read or parsed. */
function loadModule(file, session) {
  if (!session.modules.has(file)) {
    // Only reading and parsing the module may fail here; an error in the
    // rule's own analysis of a parsed module is a rule bug.
    let parsed
    try {
      parsed = parseModule(file, session.languageOptions)
    } catch {
      parsed = undefined
    }
    session.modules.set(
      file,
      parsed &&
        new OracleModule(file, parsed.ast, parsed.scopeManager, session),
    )
  }
  return session.modules.get(file)
}

/**
 * The parsed source of a module, reused while its mtime, size, and language
 * options are unchanged. ESLint's own Linter parses it with the language
 * options of the file being linted, so an imported module is read with the
 * parser and parser options that the consumer configured, whichever parser
 * that is, and it gets the scope analysis and `parent` links that ESLint
 * gives the linted file.
 *
 * The rule reads syntax and scope, not types. typescript-eslint's `project`,
 * `projectService`, and `programs` options build a type-checked program, which
 * costs far more than the parse and changes the program that the consumer's
 * type-aware rules then read for that module, so they are left out.
 */
function parseModule(file, languageOptions) {
  const { mtimeMs, size } = statSync(file)
  const cached = parsedModules.get(file)
  if (
    cached?.mtimeMs === mtimeMs &&
    cached.size === size &&
    cached.languageOptions === languageOptions
  )
    return cached
  const linter = new Linter({ cwd: dirname(file) })
  const [fatal] = linter
    .verify(
      readFileSync(file, `utf8`),
      [
        {
          files: [`**/*.*`],
          // The imported module's own eslint comments configure rules and
          // environments this parse does not run.
          linterOptions: {
            noInlineConfig: true,
            reportUnusedDisableDirectives: `off`,
          },
          languageOptions: {
            ...languageOptions,
            parserOptions: {
              ...languageOptions.parserOptions,
              project: undefined,
              projectService: undefined,
              programs: undefined,
            },
          },
        },
      ],
      file,
    )
    .filter((message) => message.fatal)
  if (fatal !== undefined) throw new Error(fatal.message)
  const { ast, scopeManager } = linter.getSourceCode()
  const parsed = { mtimeMs, size, languageOptions, ast, scopeManager }
  parsedModules.set(file, parsed)
  return parsed
}

/** A module that an oracle file imports, read for the helpers it exports. */
class OracleModule {
  constructor(file, ast, scopeManager, session) {
    this.file = file
    this.scopeManager = scopeManager
    this.session = session
    this.exported = new Map()
    this.starSources = []
    for (const statement of ast.body) this.#recordExports(statement)
  }

  #recordExports(statement) {
    if (statement.type === `ExportDefaultDeclaration`) {
      this.#recordDefaultExport(statement.declaration)
      return
    }
    if (statement.type === `ExportAllDeclaration`) {
      if (statement.exported === null) {
        this.starSources.push(statement.source.value)
      }
      return
    }
    if (statement.type !== `ExportNamedDeclaration`) return
    if (statement.declaration !== null) {
      // A class declares its name twice: in the module and inside its own
      // scope. The module binding is the one a declaration refers to.
      const moduleScope = this.#moduleScope()
      for (const variable of this.scopeManager.getDeclaredVariables(
        statement.declaration,
      )) {
        if (variable.scope === moduleScope)
          this.exported.set(variable.name, { variable })
      }
      return
    }
    for (const specifier of statement.specifiers) {
      const exported = specifier.exported.name ?? specifier.exported.value
      const local = specifier.local.name ?? specifier.local.value
      if (statement.source !== null) {
        this.exported.set(exported, {
          source: statement.source.value,
          imported: local,
        })
      } else {
        const variable = findVariable(this.#moduleScope(), local)
        if (variable !== undefined) this.exported.set(exported, { variable })
      }
    }
  }

  /**
   * `export default` names a module binding, declares a named function or
   * class, or exports an expression, which reaches when its code does.
   */
  #recordDefaultExport(declaration) {
    const moduleScope = this.#moduleScope()
    const variable =
      declaration.type === `Identifier`
        ? findVariable(moduleScope, declaration.name)
        : declaration.id
          ? this.scopeManager
              .getDeclaredVariables(declaration)
              .find((declared) => declared.scope === moduleScope)
          : undefined
    this.exported.set(
      `default`,
      variable === undefined ? { node: declaration } : { variable },
    )
  }

  #moduleScope() {
    return (
      this.scopeManager.scopes.find((scope) => scope.type === `module`) ??
      this.scopeManager.globalScope
    )
  }

  /**
   * How an export of this module registers tests, or undefined when it
   * registers none. A function registers the body that it writes ('own') or
   * the body that its caller passes ('parameter'). A cycle of re-exports
   * registers nothing.
   */
  registrationShape(name, visiting = new Set()) {
    const key = `${this.file}\0${name}`
    if (visiting.has(key)) return undefined
    visiting.add(key)
    const entry = this.exported.get(name)
    if (entry?.variable !== undefined) {
      const definition = entry.variable.defs[0]
      const fn =
        definition?.type === `FunctionName`
          ? definition.node
          : definition?.type === `Variable` && isFunction(definition.node.init)
            ? definition.node.init
            : undefined
      return fn === undefined ? undefined : this.#bodyShape(fn)
    }
    if (entry?.node !== undefined) {
      return isFunction(entry.node) ? this.#bodyShape(entry.node) : undefined
    }
    if (entry !== undefined) {
      return importedRegisters(
        this.file,
        entry.source,
        entry.imported,
        this.session,
        visiting,
      )
    }
    if (name === `default`) return undefined
    for (const source of this.starSources) {
      const shape = importedRegisters(
        this.file,
        source,
        name,
        this.session,
        visiting,
      )
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
   * function writes, which wins.
   */
  #bodyShape(fn) {
    const sourceCode = { getScope: (node) => this.scopeOf(node) }
    let shape
    walk(fn, (node) => {
      if (node.type !== `CallExpression`) return
      const test = registeredTest(node, sourceCode)
      if (test === undefined) return
      const position = this.#passedBody(test.body, fn, sourceCode)
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
  #passedBody(body, fn, sourceCode) {
    const positionOf = (identifier) => {
      const definition = findVariable(
        sourceCode.getScope(identifier),
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

  /** The innermost scope of a node, as ESLint's `getScope` finds it. */
  scopeOf(node) {
    for (let current = node; current; current = current.parent) {
      const scope = this.scopeManager.acquire(current, true)
      if (scope) return scope
    }
    return this.scopeManager.globalScope
  }
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
    },
  },
  create(context) {
    // `oracle-config`, `oracle-property`, and the other `oracle-` modules are
    // the shared oracle machinery. Their tests check that machinery, not a law.
    if (basename(context.filename).startsWith(`oracle-`)) return {}
    const { sourceCode } = context
    const session = new LintSession(context.languageOptions)
    return {
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
        const test = registeredTest(node, sourceCode)
        if (test === undefined) return
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
