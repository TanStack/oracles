// The CLI's arguments, shared by the CLI (index.mjs) and the daemon
// (daemon.mjs), which parses each request's arguments the same way.
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

const flags = new Set([`daemon`, `stop-daemon`, `ordinary`])
/**
 * The options in `argv`. Paths are resolved against `cwd`, the caller's
 * working directory, which the daemon receives with each request.
 */
export function parseArgs(argv, cwd = process.cwd()) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const [key, inline] = argv[i].replace(/^--/, ``).split(`=`)
    args[key] = flags.has(key) ? true : (inline ?? argv[++i])
  }
  if (!args.package) throw new Error(`--package is required`)
  // Test reports name files by their real path (on macOS, /tmp is
  // /private/tmp), so the package path is resolved the same way.
  const pkg = realpathSync(resolve(cwd, args.package))
  if (args[`stop-daemon`]) return { stop: true, pkg }
  if (!args.source) throw new Error(`--package and --source are required`)
  // The prefix of the framework's environment variables (`${envPrefix}_SEED`
  // and the rest), as the project passes it to configureOracles. The CLI sets
  // the seed under this name, so it must match the project's.
  const envPrefix = args[`env-prefix`] ?? `ORACLE`
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(envPrefix))
    throw new Error(`--env-prefix must be an environment variable prefix`)
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
    // Each source as the package names it (packagePath).
    sources: args.source.split(`,`).map((source) => packagePath(pkg, source)),
    seed: args.seed,
    diffBase: args[`diff-base`],
    out: resolve(cwd, args.out ?? `/tmp/oracle-gaps`),
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
    // Vitest's worker pool. Threads start much faster than child processes;
    // a package with a native addon in its tree runs with `forks`.
    pool: args.pool ?? defaultPool(pkg),
    // A directory of authored mutants (see loadAuthored).
    mutants: args.mutants ? resolve(cwd, args.mutants) : undefined,
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
  const named = relative(
    pkg,
    existsSync(absolute) ? realpathSync(absolute) : absolute,
  )
  if (named.startsWith(`..`) || isAbsolute(named))
    throw new Error(`${path} is outside the package`)
  return named
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
function defaultPool(pkg) {
  const seen = new Set()
  const queue = [pkg]
  while (queue.length > 0) {
    const dir = queue.shift()
    if (seen.has(dir)) continue
    seen.add(dir)
    if (dir !== pkg && isAddon(dir)) return `forks`
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
      const found = locate(dir, name)
      if (found) queue.push(found)
    }
  }
  return `threads`
}

/** Where Node finds package `name` from directory `from`, by its real path. */
function locate(from, name) {
  for (let dir = from; ; dir = dirname(dir)) {
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
