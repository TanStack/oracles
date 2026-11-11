/**
 * The test modules that a lint reads beyond the file it lints: the relative
 * imports of an oracle file, parsed with the linted file's parser, and what
 * each exports. Every oracle rule reads them through one session per lint,
 * so a module is parsed and each export is resolved once.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { Linter } from 'eslint'
import { findVariable } from './registration.js'

/**
 * Every module that an earlier lint parsed, by path, with the mtime and size
 * it was read at and the language options it was parsed with. Parsing is the
 * costly part, so a module is parsed again only when it changes, or when a
 * file with other language options imports it. What a lint resolves is never
 * kept between lints, so an edit to any module reaches the next lint: see
 * LintSession.
 */
const parsedModules = new Map()

/**
 * The state of one lint: the language options of the file it lints, the
 * modules it loaded and the paths it resolved, the production package flags
 * it read, and what it answered. `resolved` holds one answer for each
 * question about a module's export, keyed by the question, the module, and
 * the export's name, so no export is resolved twice, whatever the call
 * graph of the modules.
 */
export class LintSession {
  modules = new Map()
  paths = new Map()
  published = new Map()
  resolved = new Map()
  // Answers that assumed a question still in progress, each with the index
  // of that question in `asking`. They hold only while it is in progress.
  provisional = new Map()
  // The questions in progress, innermost last, each with the lowest index
  // of a question in progress that its answer assumed.
  asking = []
  constructor(languageOptions) {
    this.languageOptions = languageOptions
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
    session = new LintSession(context.languageOptions)
    sessions.set(context.sourceCode, session)
  }
  return session
}

/**
 * The test module that a relative import names, or undefined. Each
 * directory and specifier is resolved once for each lint.
 */
export function resolveTestModule(fromFile, source, session) {
  if (!source.startsWith(`.`)) return undefined
  const key = `${dirname(fromFile)}\0${source}`
  if (!session.paths.has(key))
    session.paths.set(key, findTestModule(fromFile, source, session))
  return session.paths.get(key)
}

function findTestModule(fromFile, source, session) {
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
  // Production holds no test, so no rule parses it.
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
