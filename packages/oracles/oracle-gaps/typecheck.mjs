// TypeScript coverage and semantic checking for TypeScript oracle files
// (check.mjs). Vitest strips types without checking them, so an oracle file
// with type errors — or one excluded from tsconfig.json — would otherwise
// pass silently.
//
// This module uses the CLI's bundled TypeScript 5 (`ts`), never the package's
// own `typescript`, so packages without TypeScript or on TypeScript 7 keep
// working. When a package has no tsconfig.json (for example a JavaScript repo
// or a synthetic fixture), there is nothing to report. When it has one, each
// run emits `oracle-gaps: note typecheck: ...` lines for uncovered `.ts`
// oracle files, incompatible tsconfig options (such as TypeScript 7's
// `contentMappers`), and TypeScript errors in covered oracle files. These are
// reported in the output and never fail a run (maintainer decision of
// 2026-11-23). Nothing is cached across runs: every check reads its inputs.
import { existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
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
        host: ts.createCompilerHost(cfg.options),
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
