/**
 * The test modules that a lint reads beyond the file it lints: the relative
 * imports of an oracle file, parsed with the linted file's parser, and what
 * each exports. Every oracle rule reads them through one session per lint,
 * so a module is parsed and each export is resolved once.
 */
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { Linter } from 'eslint'
import { findVariable } from './registration.js'
import { sourceSettings } from './sources.js'

/**
 * Every module that an earlier lint parsed, by path, with the mtime and size
 * it was read at and the language options it was parsed with. Parsing is the
 * costly part, so a module is parsed again only when it changes, or when a
 * file with other language options imports it. The options are compared by
 * identity, so a long-lived ESLint process reuses a parse, and a fresh
 * process parses again. What a lint resolves is never
 * kept between lints, so an edit to any module reaches the next lint: see
 * LintSession.
 */
const parsedModules = new Map()

/**
 * The state of one lint: the language options and the source settings
 * (sources.js) of the file it lints, the modules it loaded and the paths it
 * resolved, the package manifests it read, and what it answered. `resolved`
 * holds one answer for each question about a module's export, keyed by the
 * question, the module, and the export's name, so no export is resolved
 * twice, whatever the call graph of the modules.
 */
export class LintSession {
  modules = new Map()
  paths = new Map()
  manifests = new Map()
  resolved = new Map()
  // Answers that assumed a question still in progress, each with the index
  // of that question in `asking`. They hold only while it is in progress.
  provisional = new Map()
  // The questions in progress, innermost last, each with the lowest index
  // of a question in progress that its answer assumed.
  asking = []
  constructor(languageOptions, settings) {
    this.languageOptions = languageOptions
    this.sources = sourceSettings(settings?.oracles)
  }

  /**
   * The memoized answer of `compute` for `key`. A question that is still
   * being answered when it is asked again, through a cycle of modules,
   * answers undefined for now. Every answer that used that assumption is
   * kept only until the question that closed the cycle is answered, so no
   * answer depends on which question of a cycle the lint asked first.
   */
  once(key, compute) {
    if (this.resolved.has(key)) return this.resolved.get(key)
    const kept = this.provisional.get(key)
    if (kept !== undefined && this.asking[kept.root]?.key === kept.rootKey) {
      this.#assume(kept.root)
      return kept.answer
    }
    const cycle = this.asking.findIndex((question) => question.key === key)
    if (cycle >= 0) {
      this.#assume(cycle)
      return undefined
    }
    const index = this.asking.length
    const question = { key, assumes: index }
    this.asking.push(question)
    const answer = compute()
    this.asking.pop()
    if (question.assumes < index)
      this.provisional.set(key, {
        answer,
        root: question.assumes,
        rootKey: this.asking[question.assumes].key,
      })
    else this.resolved.set(key, answer)
    return answer
  }

  /** Marks every question above `root` as assuming that it has no answer yet. */
  #assume(root) {
    for (const question of this.asking.slice(root + 1))
      question.assumes = Math.min(question.assumes, root)
  }
}

// One session for each lint of a file. ESLint gives every rule of one lint
// the same SourceCode, so the rules share their session.
const sessions = new WeakMap()

/** The session of the lint that `context` belongs to. */
export function lintSession(context) {
  let session = sessions.get(context.sourceCode)
  if (session === undefined) {
    session = new LintSession(context.languageOptions, context.settings)
    sessions.set(context.sourceCode, session)
  }
  return session
}

/**
 * The test module that an import names, or undefined: a relative module, a
 * `#` import through the nearest package.json's `imports`, or a module of a
 * workspace package. Each directory and specifier is resolved once for each
 * lint.
 */
export function resolveTestModule(fromFile, source, session) {
  const key = `${dirname(fromFile)}\0${source}`
  if (!session.paths.has(key))
    session.paths.set(key, findTestModule(fromFile, source, session))
  return session.paths.get(key)
}

function findTestModule(fromFile, source, session) {
  const base = source.startsWith(`.`)
    ? resolve(dirname(fromFile), source)
    : source.startsWith(`#`)
      ? subpathImport(dirname(fromFile), source, session)
      : workspaceModule(dirname(fromFile), source, session)
  if (base === undefined) return undefined
  const stem = base.replace(/\.(m?js|tsx?)$/, ``)
  // A `.js` specifier names the TypeScript source when one exists, and
  // otherwise the JavaScript module itself.
  const file = [
    `${stem}.ts`,
    `${stem}.tsx`,
    ...(/\.m?js$/.test(base) ? [base] : []),
    `${base}/index.ts`,
  ].find((candidate) => existsSync(candidate))
  // Production holds no test, so no rule parses it, and no rule reads a
  // package under node_modules, whatever path leads there.
  if (
    file === undefined ||
    isProductionModule(file, session) ||
    isInstalled(file, dirname(fromFile))
  )
    return undefined
  return file
}

/**
 * Whether `path` is inside an installed package, as the project in
 * `directory` sees it: below the directories that the two share, its real
 * path enters a node_modules directory. A project whose own path is under
 * a node_modules directory is not installed for that.
 */
function isInstalled(path, directory) {
  const from = realPath(directory).split(sep)
  const to = realPath(path).split(sep)
  let shared = 0
  while (shared < from.length && to[shared] === from[shared]) shared++
  // The last shared directory counts: a sibling package in node_modules
  // shares the node_modules directory itself.
  return to.slice(Math.max(shared - 1, 0)).includes(`node_modules`)
}

/**
 * The real path of `path`, or the path itself when it does not exist, as
 * the directory of a file that a lint names but that is not on disk.
 */
function realPath(path) {
  try {
    return realpathSync(path)
  } catch {
    return resolve(path)
  }
}

/** The parsed package.json in `directory`, or null when there is none. */
function manifest(directory, session) {
  if (!session.manifests.has(directory)) {
    const file = join(directory, `package.json`)
    let parsed = null
    if (existsSync(file))
      try {
        parsed = JSON.parse(readFileSync(file, `utf8`))
      } catch {
        // A manifest that does not parse names no module.
        parsed = {}
      }
    session.manifests.set(directory, parsed)
  }
  return session.manifests.get(directory)
}

/** The nearest directory from `directory` up that has a package.json. */
function packageDirectory(directory, session) {
  for (let at = directory; ; at = dirname(at)) {
    if (manifest(at, session) !== null) return at
    if (dirname(at) === at) return undefined
  }
}

/**
 * The file that an `exports` or `imports` target names for the conditions
 * `import` and `default`, or undefined. A `types` target is a declaration,
 * which holds no value, so it is never the module.
 */
function conditionalTarget(target) {
  if (typeof target === `string`) return target
  if (target === null || typeof target !== `object` || Array.isArray(target))
    return undefined
  for (const condition of [`import`, `default`])
    if (target[condition] !== undefined) {
      const found = conditionalTarget(target[condition])
      if (found !== undefined) return found
    }
  return undefined
}

/**
 * The target that a map of subpaths (an `exports` or `imports` field) gives
 * `subpath`: an exact key, or a pattern with one `*`.
 */
function mappedTarget(map, subpath) {
  if (Object.hasOwn(map, subpath)) return conditionalTarget(map[subpath])
  for (const [pattern, target] of Object.entries(map)) {
    const star = pattern.indexOf(`*`)
    if (star < 0) continue
    const [prefix, suffix] = [pattern.slice(0, star), pattern.slice(star + 1)]
    if (
      subpath.length >= prefix.length + suffix.length &&
      subpath.startsWith(prefix) &&
      subpath.endsWith(suffix)
    ) {
      const matched = subpath.slice(
        prefix.length,
        subpath.length - suffix.length,
      )
      return conditionalTarget(target)?.replaceAll(`*`, matched)
    }
  }
  return undefined
}

/** The target that a `#` import names through the nearest package.json. */
function subpathTarget(directory, source, session) {
  const owner = packageDirectory(directory, session)
  const imports = owner && manifest(owner, session).imports
  if (imports === null || typeof imports !== `object`) return undefined
  const target = mappedTarget(imports, source)
  return target === undefined ? undefined : { owner, target }
}

/** The module that a `#` import names, when its target is a file of the package. */
function subpathImport(directory, source, session) {
  const found = subpathTarget(directory, source, session)
  return found?.target.startsWith(`./`)
    ? resolve(found.owner, found.target)
    : undefined
}

/**
 * The package specifier that a `#` import names in `fromFile`, as in
 * `"#vitest": "vitest"`, or undefined when it names a file or nothing.
 */
export function subpathPackage(fromFile, source, session) {
  const found = subpathTarget(dirname(fromFile), source, session)
  return found === undefined || found.target.startsWith(`.`)
    ? undefined
    : found.target
}

/**
 * The module that a package specifier names when the package is a
 * workspace package: its node_modules entry, found from `directory` up,
 * resolves to a real path outside every node_modules directory, as a
 * workspace link does. A package installed under node_modules is never
 * read. The module is the package's `exports` target for the subpath, or,
 * without `exports`, its `main` or the subpath's file.
 */
function workspaceModule(directory, source, session) {
  const parts = source.split(`/`)
  const length = source.startsWith(`@`) ? 2 : 1
  const name = parts.slice(0, length).join(`/`)
  const subpath = [`.`, ...parts.slice(length)].join(`/`)
  for (let at = directory; ; at = dirname(at)) {
    const linked = join(at, `node_modules`, name)
    if (existsSync(linked)) {
      const real = realPath(linked)
      if (isInstalled(real, directory)) return undefined
      const { exports, main } = manifest(real, session) ?? {}
      const target =
        exports === undefined
          ? subpath === `.`
            ? (main ?? `./index.js`)
            : subpath
          : typeof exports === `string` ||
              Object.keys(exports ?? {}).every((key) => !key.startsWith(`.`))
            ? subpath === `.`
              ? conditionalTarget(exports)
              : undefined
            : mappedTarget(exports, subpath)
      return target === undefined ? undefined : resolve(real, target)
    }
    if (dirname(at) === at) return undefined
  }
}

/**
 * Whether a file is shipped source: under `src/` in a published package. A
 * private package, such as an end-to-end suite, keeps its tests in `src/`.
 */
function isProductionModule(file, session) {
  const owner = packageDirectory(dirname(file), session)
  return (
    owner !== undefined &&
    manifest(owner, session).private !== true &&
    relative(owner, file).split(sep)[0] === `src`
  )
}

/** The module that a file names, for this lint, or undefined when it cannot be read or parsed. */
export function loadModule(file, session) {
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
      parsed && new TestModule(file, parsed.ast, parsed.scopeManager),
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

/**
 * A test module that an oracle file imports, read for what it exports. Each
 * export is `{ variable }`, a module binding; `{ node }`, the expression of
 * `export default`; `{ source, imported }`, a re-export; or
 * `{ namespace }`, the source of `export * as name from`.
 */
export class TestModule {
  constructor(file, ast, scopeManager) {
    this.file = file
    this.scopeManager = scopeManager
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
      } else {
        const name = statement.exported.name ?? statement.exported.value
        this.exported.set(name, { namespace: statement.source.value })
      }
      return
    }
    if (statement.type !== `ExportNamedDeclaration`) return
    if (statement.declaration !== null) {
      // A class declares its name twice: in the module and inside its own
      // scope. The module binding is the one a declaration refers to.
      const moduleScope = this.moduleScope()
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
        const variable = findVariable(this.moduleScope(), local)
        if (variable !== undefined) this.exported.set(exported, { variable })
      }
    }
  }

  /**
   * `export default` names a module binding, declares a named function or
   * class, or exports an expression, which reaches when its code does.
   */
  #recordDefaultExport(declaration) {
    const moduleScope = this.moduleScope()
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

  moduleScope() {
    return (
      this.scopeManager.scopes.find((scope) => scope.type === `module`) ??
      this.scopeManager.globalScope
    )
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
