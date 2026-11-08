// The CLI's arguments, shared by the CLI (index.mjs) and the daemon
// (daemon.mjs), which parses each request's arguments the same way.
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { join, relative, resolve } from 'node:path'

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
    // Each source as the package names it, so every spelling of a path
    // (`./src/x.ts`, `src/../src/x.ts`) names the same file in owns
    // entries, keys, and the report.
    sources: args.source
      .split(`,`)
      .map((source) => relative(pkg, resolve(pkg, source))),
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
    // a package whose tests need process isolation runs with `forks`.
    pool: args.pool ?? defaultPool(pkg),
    // A directory of authored mutants (see loadAuthored).
    mutants: args.mutants ? resolve(cwd, args.mutants) : undefined,
  }
}

/**
 * Threads, unless a direct dependency of the package is a native addon (a
 * `binding.gyp` beside its manifest, as better-sqlite3 has): an addon can
 * crash the whole process from a worker thread, which takes the CLI with
 * it, so such a package runs its tests in child processes.
 */
function defaultPool(pkg) {
  const manifest = JSON.parse(readFileSync(join(pkg, `package.json`), `utf8`))
  const names = Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  })
  return names.some((name) =>
    existsSync(join(pkg, `node_modules`, name, `binding.gyp`)),
  )
    ? `forks`
    : `threads`
}
