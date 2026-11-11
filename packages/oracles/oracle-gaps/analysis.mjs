// The static half of a check: what the report owes before any test runs
// (check.mjs). It instruments each source file (schemata.mjs), reads every
// oracle file's `owns` declaration and refuses a broken one, resolves each
// function's owners through the type checker (owners.mjs), and names the
// function each mutant belongs to. It reads only files, so the CLI's own
// oracle checks it in-process.
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { basename, join } from 'node:path'
import { packagePath } from './args.mjs'
import { Refusal } from './ending.mjs'
import { ownership, readOwns, splitEntry } from './owners.mjs'
import { instrument } from './schemata.mjs'

/**
 * Whether a path is a runner copy of a test file (check.mjs, runBatch), this
 * process's or one that a check which died left behind. Discovery skips
 * copies: a copy is never a test file.
 */
export const isRunnerCopy = (path) => basename(path).startsWith(`.oracle-gaps-`)

// One compiler host per TypeScript copy. The declarations under
// node_modules, such as the standard library's, are parsed once and kept,
// which makes each later program several times faster to build.
const hosts = new WeakMap()
const compilerOptions = (ts) => ({
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowJs: true,
  noEmit: true,
  skipLibCheck: true,
  types: [],
})
function hostFor(ts) {
  if (!hosts.has(ts)) {
    const base = ts.createCompilerHost(compilerOptions(ts))
    const kept = new Map()
    hosts.set(ts, {
      ...base,
      getSourceFile(name, language, onError, fresh) {
        if (!name.includes(`/node_modules/`))
          return base.getSourceFile(name, language, onError, fresh)
        if (!kept.has(name))
          kept.set(name, base.getSourceFile(name, language, onError, fresh))
        return kept.get(name)
      },
    })
  }
  return hosts.get(ts)
}

/**
 * The instrumented sources, the mutants (each with its function), the
 * oracle files' declarations, and the ownership. `testFiles` are the
 * absolute paths of every test file the package's config includes. A
 * declaration that names nothing, a list that is not a literal, or an entry
 * that names a missing file or function throws, because it would hide gaps.
 * A run with no oracle file, or in which no function of a selected source
 * has an owner through the call trees, throws too.
 */
export function analyze(ts, pkg, sources, testFiles) {
  const relative = (file) => file.slice(pkg.length + 1)
  // An oracle file is a test file that calls `oracleProperty`, or the legacy
  // `declareOracle`, which the CLI still reads.
  const declarations = new Map()
  for (const file of testFiles) {
    const declared = readOwns(ts, file, readFileSync(file, `utf8`))
    if (!declared.declares) continue
    if (declared.problem)
      throw new Refusal(
        `${relative(file)}: ${declared.problem}`,
        `Write the owns list as a literal array of strings, such as owns: ['src/x.ts#run'].`,
      )
    // Each entry's file as the package names it, as `--source` is.
    const entries = declared.entries.map((entry) => {
      const [source, fn] = splitEntry(entry)
      let named
      try {
        named = packagePath(pkg, source)
      } catch (error) {
        throw new Refusal(
          `${relative(file)}: owns entry ${entry}: ${error.message}`,
          `Name a file inside the package in this owns entry.`,
        )
      }
      if (!existsSync(join(pkg, named)))
        throw new Refusal(
          `${relative(file)}: owns entry ${entry} names a missing file, ${source}`,
          `Correct the file in this owns entry, relative to the package.`,
        )
      return fn === undefined ? named : `${named}#${fn}`
    })
    declarations.set(file, entries)
  }
  // A run that owns nothing would read every mutant as unowned, so it is
  // refused here, once (maintainer decision, 2026-11-10).
  if (declarations.size === 0)
    throw new Refusal(
      `no oracle file: no test file calls oracleProperty, so no file owns any selected source`,
      `Declare owns: ['src/x.ts#fn'] in the oracleProperty call of the oracle that judges these sources.`,
    )
  const instrumented = new Map()
  const mutants = []
  for (const source of sources) {
    const path = realpathSync(join(pkg, source))
    const result = instrument(
      ts,
      path,
      readFileSync(path, `utf8`),
      source,
      mutants.length,
    )
    instrumented.set(path, result.code)
    mutants.push(...result.mutants)
  }
  // A function's owners are the oracle files whose `owns` reference trees
  // contain it; only their tests judge its mutants. The type checker reads
  // the package from the sources and the files owns names.
  const program = ts.createProgram(
    [
      ...new Set([
        ...sources,
        ...[...declarations.values()]
          .flat()
          .map((entry) => splitEntry(entry)[0]),
      ]),
    ].map((source) => join(pkg, source)),
    compilerOptions(ts),
    hostFor(ts),
  )
  const owned = ownership(ts, program, pkg, declarations)
  // A bad entry is named before the run's lack of an owner, which it can
  // cause: the entry is what the author must fix.
  for (const [file, entries] of declarations)
    for (const entry of entries) {
      const [source, fn] = splitEntry(entry)
      if (fn !== undefined && !owned.has(source, fn))
        throw new Refusal(
          `${relative(file)}: owns entry ${entry} names no function in ${source}`,
          `Name a function or module-level variable that ${source} defines in this owns entry, such as ${source}#run, ${source}#Class.method, or ${source}#TABLE.`,
        )
    }
  // Owned through the call trees, which may reach a selected source from an
  // entry in another file.
  if (!sources.some((source) => owned.ownsAny(source)))
    throw new Refusal(
      `no file owns any selected source: no function of a --source file has an owner`,
      `Add an owns entry for a function of a --source file to the oracle that judges it.`,
    )
  // Each mutant belongs to the innermost unit (a function or module data)
  // whose text holds its site; its key reads that unit's name, and its
  // owners are that unit's.
  for (const mutant of mutants)
    mutant.function = owned.at(mutant.source, mutant.position).name
  return { instrumented, mutants, declarations, owned }
}
