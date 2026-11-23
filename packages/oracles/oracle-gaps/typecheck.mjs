// TypeScript coverage and semantic checking for TypeScript oracle files
// (check.mjs). Vitest strips types without checking them, so an oracle file
// with type errors — or one excluded from tsconfig.json — would otherwise
// pass silently.
//
// This module uses the CLI's bundled TypeScript 5 (`ts`), never the package's
// own `typescript`, so packages without TypeScript or on TypeScript 7 keep
// working. When a package has no tsconfig.json (for example a JavaScript repo
// or a synthetic fixture), default runs do nothing; `--typecheck` refuses.
// When a tsconfig.json exists, default runs emit `oracle-gaps: note
// typecheck: ...` lines for uncovered `.ts` oracle files, incompatible
// tsconfig options (such as TypeScript 7's `contentMappers`), and TypeScript
// errors in covered oracle files, while `--typecheck` refuses on any of them.
import { existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { Refusal } from './ending.mjs'
import { posix, realPathOf, relativeWithin } from './paths.mjs'
import { escapeControls, streamLine } from './stream.mjs'

// Maximum diagnostic note lines printed per run so a file with many errors
// does not flood the stream; results.json keeps every diagnostic.
const MAX_DIAGNOSTIC_NOTES = 20
// Maximum uncovered oracle file note lines printed per run.
const MAX_UNCOVERED_NOTES = 20

// Compiler options forced when typechecking in-memory: never write build
// outputs or .tsbuildinfo files, and never fail on third-party .d.ts files.
const CHECK_OVERRIDES = {
  noEmit: true,
  incremental: false,
  composite: false,
  emitDeclarationOnly: false,
  skipLibCheck: true,
}

// TypeScript error codes that only report an empty input list (common in
// solution-style tsconfigs or configs whose `include` has no files yet), not
// an incompatible or broken tsconfig.
const EMPTY_INPUT_CODES = new Set([18002, 18003])

/** Whether a file is a TypeScript oracle source file (not a declaration). */
export const isTypeScriptOracle = (file) =>
  /\.[cm]?tsx?$/i.test(file) && !/\.d\.[cm]?ts$/i.test(file)

const counted = (n, thing) => `${n} ${thing}${n === 1 ? `` : `s`}`

// Single-line, control-escaped text for any TypeScript diagnostic message.
function formatDiagnosticText(ts, diagnostic) {
  return escapeControls(
    ts
      .flattenDiagnosticMessageText(diagnostic.messageText, ` `)
      .replace(/\s+/g, ` `)
      .trim(),
  )
}

// One compiler-file cache per bundled TypeScript copy, caching only files
// under `/node_modules/` keyed by language options and stat stamp so daemon
// checks stay fast without ever returning stale project or dependency files.
const nodeModulesCache = new WeakMap()
function typecheckHostFor(ts, options) {
  const base = ts.createCompilerHost(options)
  if (!nodeModulesCache.has(ts)) nodeModulesCache.set(ts, new Map())
  const cache = nodeModulesCache.get(ts)
  return {
    ...base,
    getSourceFile(fileName, languageVersionOrOptions, onError, fresh) {
      const normalized = posix(fileName)
      if (fresh || !normalized.includes(`/node_modules/`))
        return base.getSourceFile(
          fileName,
          languageVersionOrOptions,
          onError,
          fresh,
        )
      const stat = statSync(fileName, { throwIfNoEntry: false })
      if (!stat?.isFile())
        return base.getSourceFile(
          fileName,
          languageVersionOrOptions,
          onError,
          fresh,
        )
      const languageKey =
        typeof languageVersionOrOptions === `object` &&
        languageVersionOrOptions !== null
          ? `${languageVersionOrOptions.languageVersion ?? ``}:${languageVersionOrOptions.impliedNodeFormat ?? ``}:${languageVersionOrOptions.jsDocParsingMode ?? ``}`
          : String(languageVersionOrOptions)
      const key = `${languageKey}\0${normalized}`
      const stamp = `${stat.size}:${stat.mtimeMs}`
      const cached = cache.get(key)
      if (cached?.stamp === stamp) return cached.sourceFile
      const sourceFile = base.getSourceFile(
        fileName,
        languageVersionOrOptions,
        onError,
        fresh,
      )
      if (sourceFile) cache.set(key, { stamp, sourceFile })
      return sourceFile
    },
  }
}

/**
 * Checks whether each TypeScript oracle file is covered by the package's
 * TypeScript config (following `projectReferences`) and, for every covering
 * config compatible with bundled TypeScript 5, collects syntactic and
 * semantic TypeScript error diagnostics on the oracle files.
 */
export function typecheckOracleFiles(
  ts,
  pkg,
  oracleFiles,
  { config = `tsconfig.json` } = {},
) {
  const pkgRoot = existsSync(pkg) ? realPathOf(pkg) : posix(resolve(pkg))
  const relative = (file) =>
    relativeWithin(pkgRoot, existsSync(file) ? realPathOf(file) : file) ??
    posix(file)
  const canonical = (file) => {
    const resolved = existsSync(file) ? realPathOf(file) : posix(resolve(file))
    return ts.sys.useCaseSensitiveFileNames ? resolved : resolved.toLowerCase()
  }
  const rootPath = join(pkg, config)
  if (!existsSync(rootPath)) {
    return {
      found: false,
      config,
      checked: [],
      uncovered: [],
      skipped: [],
      diagnostics: [],
      notes: [],
    }
  }
  const tsOracleFiles = [...new Set(oracleFiles)]
    .filter(isTypeScriptOracle)
    .sort((a, b) => {
      const ra = relative(a)
      const rb = relative(b)
      return ra < rb ? -1 : ra > rb ? 1 : 0
    })
  if (tsOracleFiles.length === 0) {
    return {
      found: true,
      config,
      checked: [],
      uncovered: [],
      skipped: [],
      diagnostics: [],
      notes: [],
    }
  }

  // BFS over rootPath and any existing projectReferences (guarding cycles).
  const loaded = []
  const visited = new Set()
  const queue = [rootPath]
  while (queue.length > 0) {
    const current = queue.shift()
    const key = canonical(current)
    if (visited.has(key)) continue
    visited.add(key)
    const posixPath = posix(current)
    const relativeConfig = relative(current)
    const read = ts.readConfigFile(posixPath, ts.sys.readFile)
    if (read.error) {
      loaded.push({
        configPath: current,
        relativeConfig,
        readError: formatDiagnosticText(ts, read.error),
        fileNames: [],
        fileByCanonical: new Map(),
        options: undefined,
        configErrors: [],
      })
      continue
    }
    const parsed = ts.parseJsonConfigFileContent(
      read.config,
      ts.sys,
      posix(dirname(current)),
      CHECK_OVERRIDES,
      posixPath,
    )
    const fileByCanonical = new Map()
    for (const fileName of parsed.fileNames) {
      const c = canonical(fileName)
      if (!fileByCanonical.has(c)) fileByCanonical.set(c, fileName)
    }
    const configErrors = parsed.errors.filter(
      (diagnostic) => !EMPTY_INPUT_CODES.has(diagnostic.code),
    )
    loaded.push({
      configPath: current,
      relativeConfig,
      readError: undefined,
      fileNames: parsed.fileNames,
      fileByCanonical,
      options: parsed.options,
      configErrors,
    })
    for (const ref of parsed.projectReferences ?? []) {
      const stat = statSync(ref.path, { throwIfNoEntry: false })
      const target = stat?.isDirectory()
        ? join(ref.path, `tsconfig.json`)
        : ref.path
      if (existsSync(target) && !visited.has(canonical(target)))
        queue.push(target)
    }
  }

  const checked = []
  const uncovered = []
  const skipped = []
  const diagnostics = []

  const root = loaded[0]
  if (root?.readError) {
    skipped.push({ config: root.relativeConfig, reason: root.readError })
  } else {
    const coveredByConfig = new Map()
    for (const file of tsOracleFiles) {
      const key = canonical(file)
      const owner = loaded.find((cfg) => cfg.fileByCanonical.has(key))
      if (!owner) {
        uncovered.push(relative(file))
        continue
      }
      if (!coveredByConfig.has(owner)) coveredByConfig.set(owner, [])
      coveredByConfig.get(owner).push({
        relativeFile: relative(file),
        programFileName: owner.fileByCanonical.get(key),
      })
    }
    // If any oracle file is uncovered and a loaded config failed to read or
    // parse, surface that config error (once per config) so the cause is visible.
    const skippedConfigs = new Set()
    const recordSkipped = (cfg, reason) => {
      if (skippedConfigs.has(cfg.relativeConfig)) return
      skippedConfigs.add(cfg.relativeConfig)
      skipped.push({ config: cfg.relativeConfig, reason })
    }
    if (uncovered.length > 0) {
      for (const cfg of loaded) {
        if (cfg.readError) recordSkipped(cfg, cfg.readError)
        else if (cfg.configErrors.length > 0)
          recordSkipped(cfg, formatDiagnosticText(ts, cfg.configErrors[0]))
      }
    }
    for (const [cfg, entries] of coveredByConfig) {
      if (cfg.configErrors.length > 0) {
        recordSkipped(cfg, formatDiagnosticText(ts, cfg.configErrors[0]))
        continue
      }
      const program = ts.createProgram({
        rootNames: cfg.fileNames,
        options: cfg.options,
        host: typecheckHostFor(ts, cfg.options),
      })
      for (const { relativeFile, programFileName } of entries) {
        checked.push(relativeFile)
        const sourceFile = program.getSourceFile(programFileName)
        if (!sourceFile) continue
        const fileDiagnostics = [
          ...program.getSyntacticDiagnostics(sourceFile),
          ...program.getSemanticDiagnostics(sourceFile),
        ].filter((d) => d.category === ts.DiagnosticCategory.Error)
        for (const diag of fileDiagnostics) {
          const position =
            diag.start !== undefined
              ? sourceFile.getLineAndCharacterOfPosition(diag.start)
              : { line: 0, character: 0 }
          diagnostics.push({
            file: relativeFile,
            line: position.line + 1,
            column: position.character + 1,
            code: diag.code,
            message: formatDiagnosticText(ts, diag),
          })
        }
      }
    }
    diagnostics.sort(
      (a, b) =>
        (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) ||
        a.line - b.line ||
        a.column - b.column ||
        a.code - b.code ||
        (a.message < b.message ? -1 : a.message > b.message ? 1 : 0),
    )
  }

  const result = {
    found: true,
    config,
    checked,
    uncovered,
    skipped,
    diagnostics,
  }
  return { ...result, notes: formatTypecheckNotes(result) }
}

/**
 * Formats typecheck findings as greppable single-line `oracle-gaps: note`
 * stream lines (stream.mjs, law 15).
 */
export function formatTypecheckNotes({
  config,
  uncovered,
  skipped,
  diagnostics,
}) {
  const notes = []
  for (const item of skipped)
    notes.push(
      streamLine(
        `note`,
        `typecheck: skipped ${escapeControls(item.config)} (${escapeControls(item.reason)})`,
      ),
    )
  for (const file of uncovered.slice(0, MAX_UNCOVERED_NOTES))
    notes.push(
      streamLine(
        `note`,
        `typecheck: ${escapeControls(file)} is not included in ${escapeControls(config)}; tsc will not typecheck it`,
      ),
    )
  if (uncovered.length > MAX_UNCOVERED_NOTES)
    notes.push(
      streamLine(
        `note`,
        `typecheck: ${counted(uncovered.length - MAX_UNCOVERED_NOTES, `more oracle file`)} not included in ${escapeControls(config)}`,
      ),
    )
  for (const diag of diagnostics.slice(0, MAX_DIAGNOSTIC_NOTES))
    notes.push(
      streamLine(
        `note`,
        `typecheck: ${escapeControls(diag.file)}:${diag.line}:${diag.column} TS${diag.code}: ${escapeControls(diag.message)}`,
      ),
    )
  if (diagnostics.length > MAX_DIAGNOSTIC_NOTES)
    notes.push(
      streamLine(
        `note`,
        `typecheck: ${counted(diagnostics.length - MAX_DIAGNOSTIC_NOTES, `more TypeScript error`)} in oracle files`,
      ),
    )
  if (diagnostics.length > 0) {
    const files = new Set(diagnostics.map((d) => d.file))
    notes.push(
      streamLine(
        `note`,
        `typecheck: ${counted(diagnostics.length, `TypeScript error`)} in ${counted(files.size, `oracle file`)}`,
      ),
    )
  }
  return notes
}

/**
 * The Refusal for `--typecheck` when a package lacks a compatible tsconfig,
 * leaves a TypeScript oracle file out of it, or has TypeScript errors in an
 * oracle file. Undefined when every TypeScript oracle file passes cleanly.
 */
export function typecheckRefusal(ts, result) {
  if (!result.found)
    return new Refusal(
      `--typecheck requires ${escapeControls(result.config)} in the package`,
      `Add ${escapeControls(result.config)} to the package, or pass --tsconfig <file> naming a TypeScript config inside the package.`,
    )
  if (result.skipped.length > 0) {
    const first = result.skipped[0]
    return new Refusal(
      `${escapeControls(first.config)} cannot be typechecked with bundled TypeScript ${ts.version}: ${escapeControls(first.reason)}`,
      `Fix ${escapeControls(first.config)}, or run the project's own TypeScript compiler instead of --typecheck.`,
    )
  }
  if (result.uncovered.length > 0) {
    const shown = result.uncovered.slice(0, 3).map(escapeControls).join(`, `)
    const listed =
      result.uncovered.length === 1
        ? shown
        : `${counted(result.uncovered.length, `oracle file`)} (${shown}${result.uncovered.length > 3 ? `, ...` : ``})`
    return new Refusal(
      `${escapeControls(result.config)} does not include ${listed}`,
      `Include the oracle files in ${escapeControls(result.config)}, or pass --tsconfig <file> naming a TypeScript config that includes them.`,
    )
  }
  if (result.diagnostics.length > 0) {
    const first = result.diagnostics[0]
    const more =
      result.diagnostics.length > 1
        ? ` (+${result.diagnostics.length - 1} more TypeScript ${result.diagnostics.length === 2 ? `error` : `errors`} in oracle files)`
        : ``
    return new Refusal(
      `${escapeControls(first.file)}:${first.line}:${first.column}: TS${first.code}: ${escapeControls(first.message)}${more}`,
      `Fix the TypeScript errors in the oracle files, then run the check again.`,
    )
  }
  return undefined
}
