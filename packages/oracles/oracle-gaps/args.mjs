// The CLI's arguments, shared by the CLI (index.mjs) and the daemon
// (daemon.mjs), which parses each request's arguments the same way.
import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from 'node:fs'
import { randomBytes } from 'node:crypto'
import { availableParallelism } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { loadAuthored } from './authored.mjs'
import { Refusal } from './ending.mjs'

const flags = new Set([`daemon`, `stop-daemon`, `ordinary`, `help`])
// The options that take a positive whole number.
const counts = [
  `contexts`,
  `sample`,
  `test-timeout`,
  `hang-limit`,
  `first-limit`,
  `mutant-limit`,
]
// Every option that takes a value. Any other option refuses the run, so a
// misspelled option is not silently ignored.
const valued = new Set([
  ...counts,
  `package`,
  `source`,
  `env-prefix`,
  `seed`,
  `mutants`,
  `out`,
  `only`,
  `diff-base`,
  `pool`,
  `config`,
])
// The usage text `--help` prints (index.mjs).
export const usage = `Usage: oracle-gaps --package <dir> --source <src/x.ts,...>
  [--env-prefix <name>] [--daemon] [--ordinary] [--seed <n>] [--mutants <dir>]
  [--out <dir>] [--only <id,id>] [--diff-base <rev>] [--test-timeout <ms>]
  [--sample <n>] [--contexts <n>] [--pool threads|forks] [--config <file>]
  [--first-limit <ms>] [--hang-limit <ms>] [--mutant-limit <ms>]
  oracle-gaps --stop-daemon --package <dir>
  oracle-gaps --help

The paths in --source and --config are relative to --package. Without
--config, the run loads the Vitest config that Vitest discovers for the
package: in its directory, or else in the nearest parent directory that
has one. Run the CLI from any directory.
Exit codes: 0 the check completed, whatever its gaps: its last line is
\`completed: <n> gaps\`; 2 refused, with the fix on stderr;
3 an internal error of oracle-gaps; 130 or 143 stopped by SIGINT or
SIGTERM, once every process the run started has ended.`
const help = `as \`oracle-gaps --help\` shows`
/**
 * The options in `argv`. Paths are resolved against `cwd`, the caller's
 * working directory, which the daemon receives with each request. Arguments
 * that break the usage text refuse the run, naming the option or path; a
 * refusal carries the `--out` directory as `out` when the arguments name
 * one, so it is written there (ending.mjs).
 */
export function parseArgs(argv, cwd = process.cwd()) {
  const args = {}
  // The first option that is unknown or has no value, refused once `--out`
  // is read.
  let problem
  for (let i = 0; i < argv.length; i += 1) {
    const [key, inline] = argv[i].replace(/^--/, ``).split(`=`)
    if (!flags.has(key) && !valued.has(key))
      problem ??= [`unknown option ${argv[i]}`, `Use only the options ${help}.`]
    else args[key] = flags.has(key) ? true : (inline ?? argv[++i])
    if (valued.has(key) && args[key] === undefined)
      problem ??= [`--${key} has no value`, `Give --${key} a value, ${help}.`]
  }
  try {
    if (problem) throw new Refusal(...problem)
    return optionsOf(args, cwd)
  } catch (error) {
    if (error instanceof Refusal && args.out) error.out = resolve(cwd, args.out)
    throw error
  }
}

/**
 * The options of parsed arguments `args`, or the refusal of the first that
 * breaks the usage text.
 */
function optionsOf(args, cwd) {
  if (args.help) return { help: true }
  if (!args.package)
    throw new Refusal(
      `--package is required`,
      `Pass --package <dir>, the package whose sources to check.`,
    )
  const at = resolve(cwd, args.package)
  if (!existsSync(at))
    throw new Refusal(
      `--package ${args.package} does not exist`,
      `Pass --package the directory of an existing package.`,
    )
  // Test reports name files by their real path (on macOS, /tmp is
  // /private/tmp), so the package path is resolved the same way.
  const pkg = realpathSync.native(at)
  if (args[`stop-daemon`]) return { stop: true, pkg }
  if (!args.source)
    throw new Refusal(
      `--source is required`,
      `Pass --source with the files to mutate, relative to --package, such as --source src/x.ts.`,
    )
  // The prefix of the framework's environment variables (`${envPrefix}_SEED`
  // and the rest), as the project passes it to configureOracles. The CLI sets
  // the seed under this name, so it must match the project's.
  const envPrefix = args[`env-prefix`] ?? `ORACLE`
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(envPrefix))
    throw new Refusal(
      `--env-prefix must be an environment variable prefix, not ${envPrefix}`,
      `Pass --env-prefix the prefix your project gives configureOracles, such as ORACLE.`,
    )
  // The framework reads the seed as an integer (oracle-environment.ts).
  if (
    args.seed !== undefined &&
    (args.seed.trim() === `` || !Number.isSafeInteger(Number(args.seed)))
  )
    throw new Refusal(
      `--seed must be an integer, not "${args.seed}"`,
      `Pass --seed a whole number, such as --seed 1.`,
    )
  for (const name of counts)
    if (args[name] !== undefined && !/^[1-9]\d*$/.test(args[name]))
      throw new Refusal(
        `--${name} must be a positive whole number, not "${args[name]}"`,
        `Pass --${name} a positive whole number, ${help}.`,
      )
  if (args.pool !== undefined && ![`threads`, `forks`].includes(args.pool))
    throw new Refusal(
      `--pool must be threads or forks, not "${args.pool}"`,
      `Pass --pool threads, or --pool forks for a package with a native addon.`,
    )
  // The Vitest config the run loads, a file of the package (`--config`); by
  // default the one Vitest discovers there (check.mjs).
  const config =
    args.config === undefined ? undefined : packagePath(pkg, args.config)
  if (
    config !== undefined &&
    !statSync(join(pkg, config), { throwIfNoEntry: false })?.isFile()
  )
    throw new Refusal(
      `--config ${args.config} is not a file of the package`,
      `Pass --config the package's Vitest config file, relative to --package.`,
    )
  const mutants = args.mutants && resolve(cwd, args.mutants)
  if (mutants && !statSync(mutants, { throwIfNoEntry: false })?.isDirectory())
    throw new Refusal(
      `--mutants ${args.mutants} is not a directory`,
      `Pass --mutants the directory that holds the authored mutants' JSON files.`,
    )
  // Authored mutants are the author's files: one that cannot be read
  // refuses the run before any work.
  if (mutants) loadAuthored(mutants)
  // Each source as the package names it (packagePath), a file of the
  // package.
  const sources = args.source.split(`,`).map((source) => {
    const named = packagePath(pkg, source)
    if (!statSync(join(pkg, named), { throwIfNoEntry: false })?.isFile())
      throw new Refusal(
        `--source ${source} is not a file of the package`,
        `Pass --source files that exist under --package, relative to it.`,
      )
    return named
  })
  return {
    pkg,
    envPrefix,
    daemon: args.daemon === true,
    // Ordinary (non-oracle) test files run only when asked: they never close
    // a gap, and only report whether they would have caught a survivor.
    ordinary: args.ordinary === true,
    // Each warm context runs one mutant at a time with one worker. Measured on
    // offline-transactions' FIFO executor (163 mutants, 18 cores): 8 contexts
    // 124 s, 16 contexts 91 s, with identical classes.
    contexts: Number(
      args.contexts ?? Math.min(16, Math.max(2, availableParallelism() - 2)),
    ),
    sources,
    seed: args.seed,
    diffBase: args[`diff-base`],
    // Each run's output is a directory of its own under the package's state
    // (`.oracle-gaps/out`), so runs of one package and of two packages never
    // collide (maintainer decision, 2026-11-10: namespacing).
    out: resolve(cwd, args.out ?? join(pkg, `.oracle-gaps`, `out`, runName())),
    only: args.only ? new Set(args.only.split(`,`)) : undefined,
    // A fixed-seed random sample of this many mutants per source file, for
    // surveys across many modules.
    sample: args.sample ? Number(args.sample) : undefined,
    // A mutant can make a test hang. Oracles that run in milliseconds do not
    // need Vitest's default limits, which would make each hang cost seconds.
    testTimeout: Number(args[`test-timeout`] ?? 15000),
    // The base of each mutant run's time limit, in milliseconds; the limit
    // adds three times the file's unmutated duration (see limitFor).
    hangLimit: Number(args[`hang-limit`] ?? 10000),
    // The base of a mutant run's first, short budget; a copy past it runs
    // again alone with the full limit before it can be a timeout.
    firstLimit: Number(args[`first-limit`] ?? 2000),
    // The floor of a mutant's budget, which the runs that confirm its
    // cut-off copies share (check.mjs, `budgetOf`): 30 s by default, room
    // for three confirmations at the default hang limit.
    mutantLimit: Number(args[`mutant-limit`] ?? 30000),
    // Vitest's worker pool. Threads start much faster than child processes;
    // a package with a native addon in its tree runs with `forks`.
    pool: args.pool ?? defaultPool(pkg),
    // A directory of authored mutants (see loadAuthored).
    mutants,
    config,
  }
}

/**
 * A file of the package as the package names it, so every spelling of it
 * (`./src/x.ts`, `src/../src/x.ts`, an absolute path, one through a
 * symbolic link) names the same file in `--source`, in owns entries, in
 * keys, and in the report: its real path relative to the package's real
 * path (`pkg`). A file that does not exist keeps its resolved path, so its
 * absence is reported where it is named. A file outside the package
 * refuses the run: the report would call its code unowned.
 */
export function packagePath(pkg, path) {
  const absolute = resolve(pkg, path)
  // The native real path, which also gives each name its letter case on a
  // filesystem that ignores case.
  const named = relative(
    pkg,
    existsSync(absolute) ? realpathSync.native(absolute) : absolute,
  )
  if (isOutside(named))
    throw new Refusal(
      `${path} is outside the package`,
      `Name a file inside the package, relative to --package.`,
    )
  return named
}

/** A run's directory name: its start time, then random bytes, unique per run. */
function runName() {
  return `${new Date().toISOString().replace(/[:.]/g, `-`)}-${randomBytes(4).toString(`hex`)}`
}

/**
 * Whether a path relative to the package leaves it: its first segment is
 * `..` (a name such as `..gen` is inside), or it is absolute.
 */
export function isOutside(path) {
  return path === `..` || /^\.\.[\\/]/.test(path) || isAbsolute(path)
}

/**
 * Threads, unless a native addon is in the package's dependency tree: an
 * addon can crash the whole process from a worker thread, which takes the
 * CLI with it, so such a package runs its tests in child processes. The
 * tree is the package's dependencies, devDependencies, and peer
 * dependencies, and theirs in turn (dependencies and peers), resolved as
 * Node resolves them from each package's real directory. An addon is a
 * package with a `binding.gyp` beside its manifest, as better-sqlite3 has,
 * or a prebuilt `.node` file in its own directory, `build/Release`, or
 * `prebuilds/<platform>`. Optional dependencies are not followed: they hold
 * the platform binaries of bundlers and file watchers (rollup, fsevents),
 * which run in the runner's own process, and following them would send
 * nearly every package to child processes.
 */
// The last decision for each package, with the modification times of what
// it read: each manifest and node_modules it looked through, and each
// dependency's directory, build/Release, and prebuilds. The daemon
// parses every request's arguments; while those times are unchanged, the
// walk's answer stands, and an install or a new addon file changes one.
const pools = new Map()
const stampOf = (path) => {
  try {
    return statSync(path).mtimeMs
  } catch {
    return undefined
  }
}
function defaultPool(pkg) {
  const known = pools.get(pkg)
  if (known?.stamps.every(([path, stamp]) => stampOf(path) === stamp))
    return known.pool
  const decided = walkPool(pkg)
  pools.set(pkg, decided)
  return decided.pool
}
function walkPool(pkg) {
  const seen = new Set()
  const queue = [pkg]
  const stamps = []
  const decided = (pool) => ({ pool, stamps })
  for (let next = 0; next < queue.length; next += 1) {
    const dir = queue[next]
    if (seen.has(dir)) continue
    seen.add(dir)
    // What decides the walk here: the manifest and node_modules, and, for a
    // dependency, the directories an addon would appear in. The package's
    // own directory is left out: a check writes its state (`.oracle-gaps`)
    // there.
    const prebuilds = join(dir, `prebuilds`)
    for (const path of [
      join(dir, `package.json`),
      join(dir, `node_modules`),
      ...(dir === pkg
        ? []
        : [
            dir,
            join(dir, `build`, `Release`),
            prebuilds,
            ...(existsSync(prebuilds)
              ? readdirSync(prebuilds).map((platform) =>
                  join(prebuilds, platform),
                )
              : []),
          ]),
    ])
      stamps.push([path, stampOf(path)])
    if (dir !== pkg && isAddon(dir)) return decided(`forks`)
    let manifest
    try {
      manifest = JSON.parse(readFileSync(join(dir, `package.json`), `utf8`))
    } catch {
      continue
    }
    for (const name of Object.keys({
      ...manifest.dependencies,
      ...manifest.peerDependencies,
      ...(dir === pkg ? manifest.devDependencies : {}),
    })) {
      const found = locate(dir, name, stamps)
      if (found) queue.push(found)
    }
  }
  return decided(`threads`)
}

/** Where Node finds package `name` from directory `from`, by its real path. */
function locate(from, name, stamps) {
  // A scoped package installed into a scope directory that exists changes
  // only that directory.
  const scope = name.startsWith(`@`) ? [name.split(`/`)[0]] : []
  for (let dir = from; ; dir = dirname(dir)) {
    // A package installed later into any node_modules looked through.
    for (const path of [
      join(dir, `node_modules`),
      ...scope.map((s) => join(dir, `node_modules`, s)),
    ])
      stamps.push([path, stampOf(path)])
    const candidate = join(dir, `node_modules`, name)
    if (existsSync(join(candidate, `package.json`)))
      return realpathSync(candidate)
    if (dirname(dir) === dir) return undefined
  }
}

const holdsAddon = (dir) => {
  try {
    return readdirSync(dir).some((file) => file.endsWith(`.node`))
  } catch {
    return false
  }
}
const isAddon = (dir) =>
  existsSync(join(dir, `binding.gyp`)) ||
  holdsAddon(dir) ||
  holdsAddon(join(dir, `build`, `Release`)) ||
  (existsSync(join(dir, `prebuilds`)) &&
    readdirSync(join(dir, `prebuilds`)).some((platform) =>
      holdsAddon(join(dir, `prebuilds`, platform)),
    ))
