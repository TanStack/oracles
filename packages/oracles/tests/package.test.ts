import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire, isBuiltin } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as oracles from '../src/index'
import * as declaration from '../src/declaration'
import { commonJsForDeclarationOnly } from '../vite.config'

// The public surface, as a consumer imports it. An added or removed export
// changes this list on purpose.
describe(`@tanstack/oracles`, () => {
  it(`exports the framework's parts, configuration, failure fidelity, and replay witness`, () => {
    expect(Object.keys(oracles).sort()).toEqual(
      [
        `OracleCheckpointFailure`,
        `OracleFailureReport`,
        `OracleModelError`,
        `OracleViolation`,
        `assertRegisteredOracleProperty`,
        `atOracleCheckpoint`,
        `configureOracles`,
        `createOracleFailureFidelity`,
        `createOracleReach`,
        `declareOracle`,
        `differs`,
        `forwardCut`,
        `oracleCalibrationTest`,
        `oracleCampaignSeed`,
        `oracleProperty`,
        `oracleRandomParameters`,
        `oracleReplayRequested`,
        `oracleReplaySkips`,
        `oracleReplayReporter`,
        `oracleReplayTest`,
        `oracleFixedSeed`,
        `oracleRoute`,
        `oracleRouteOf`,
        `oracleRuns`,
        `oraclePropertyOptions`,
        `pass`,
        `readOracleRunConfig`,
        `recordOracleFiniteReplay`,
        `recordOracleReplay`,
        `runOracleCampaign`,
        `scheduleFrom`,
        `useOracleClock`,
        `validateOraclePropertyRegistry`,
        `violation`,
        `withOracleFixedHistories`,
        `withinTurns`,
      ].sort(),
    )
  })

  it(`offers the main entry as ES modules only`, async () => {
    // The main entry imports Vitest, which refuses require(), so a CommonJS
    // condition would only advertise a build that cannot load.
    const { default: manifest } = await import(`../package.json`, {
      with: { type: `json` },
    })
    expect(Object.keys(manifest.exports[`.`])).toEqual([`import`])
    expect(manifest.main).toBe(manifest.module)
  })

  // A module bundled into a browser or a native webview declares its parts
  // and registers its routes through this entry.
  it(`exports declareOracle and the route helpers from the browser-safe declaration entry`, () => {
    expect(Object.keys(declaration).sort()).toEqual(
      [
        `declareOracle`,
        `oracleFixedSeed`,
        `oracleRoute`,
        `oracleRouteOf`,
      ].sort(),
    )
    expect(declaration.declareOracle).toBe(oracles.declareOracle)
    expect(declaration.oracleRoute).toBe(oracles.oracleRoute)
    expect(declaration.oracleRouteOf).toBe(oracles.oracleRouteOf)
    expect(declaration.oracleFixedSeed).toBe(oracles.oracleFixedSeed)
  })

  // Each build of the CommonJS output, including each rebuild in watch mode,
  // holds exactly the modules the declaration entry reaches in that build.
  // Watch mode is not driven here; two builds call the plugin's hook in turn.
  it(`prunes each CommonJS build by that build's own imports`, () => {
    const plugin = commonJsForDeclarationOnly()
    const generate = plugin.generateBundle as (
      output: { format: string },
      bundle: Record<string, { type: string; imports?: Array<string> }>,
    ) => void
    const chunk = (...imports: Array<string>) => ({ type: `chunk`, imports })
    const first = {
      'cjs/declaration.cjs': chunk(`cjs/oracle-declaration.cjs`),
      'cjs/oracle-declaration.cjs': chunk(),
      'cjs/index.cjs': chunk(`cjs/oracle-declaration.cjs`),
    }
    generate({ format: `cjs` }, first)
    expect(Object.keys(first).sort()).toEqual([
      `cjs/declaration.cjs`,
      `cjs/oracle-declaration.cjs`,
    ])
    const second = {
      'cjs/declaration.cjs': chunk(`cjs/oracle-route.cjs`),
      'cjs/oracle-route.cjs': chunk(),
      'cjs/oracle-declaration.cjs': chunk(),
      'cjs/index.cjs': chunk(),
    }
    generate({ format: `cjs` }, second)
    expect(Object.keys(second).sort()).toEqual([
      `cjs/declaration.cjs`,
      `cjs/oracle-route.cjs`,
    ])
  })

  // The tarball is what a consumer installs, so every runtime module in it
  // must load under its own module system (an ES module by import, a
  // CommonJS module by require()), every CommonJS module must be reachable
  // from a `require` export, and every path the exports map names must ship.
  // The package builds first, so the check reads this commit's build.
  it(`packs only loadable, reachable modules, and every export target`, () => {
    const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)))
    const local = createRequire(import.meta.url)
    const vite = join(
      dirname(local.resolve(`vite/package.json`)),
      `bin/vite.js`,
    )
    const build = spawnSync(process.execPath, [vite, `build`], {
      cwd: packageDirectory,
      encoding: `utf8`,
    })
    expect(build.status, build.stderr).toBe(0)
    const pack = spawnSync(
      `npm`,
      [`pack`, `--dry-run`, `--json`, `--ignore-scripts`],
      { cwd: packageDirectory, encoding: `utf8` },
    )
    expect(pack.status, pack.stderr).toBe(0)
    const [{ files }] = JSON.parse(pack.stdout) as [
      { files: Array<{ path: string }> },
    ]
    const packed = files.map(({ path }) => path)
    // The browser-safe entry's ES module graph imports no Node built-in.
    const builtins: Array<string> = []
    const visit = (file: string, seen = new Set<string>()) => {
      if (seen.has(file)) return
      seen.add(file)
      const text = readFileSync(join(packageDirectory, file), `utf8`)
      for (const [, specifier] of text.matchAll(
        /(?:from|import)\s*['"]([^'"]+)['"]/g,
      ))
        if (specifier!.startsWith(`.`))
          visit(join(dirname(file), specifier!), seen)
        else if (isBuiltin(specifier!)) builtins.push(`${file}: ${specifier}`)
    }
    visit(`dist/esm/declaration.js`)
    expect(builtins).toEqual([])
    const { exports } = local(`../package.json`) as { exports: unknown }
    const targets = (
      JSON.stringify(exports).match(/"\.\/dist\/[^"]+"/g) ?? []
    ).map((target) => (JSON.parse(target) as string).slice(2))
    expect(targets.filter((target) => !packed.includes(target))).toEqual([])
    // A CommonJS declaration file describes a module that ships.
    expect(
      packed.filter(
        (path) =>
          path.endsWith(`.d.cts`) &&
          !packed.includes(path.replace(/\.d\.cts$/, `.cjs`)),
      ),
    ).toEqual([])
    const modules = packed.filter((path) => /^dist\/.*\.c?js$/.test(path))
    const required = targets.filter((target) => target.endsWith(`.cjs`))
    // One Node process loads every module, then requires the `require`
    // targets alone, and prints the modules that failed and the CommonJS
    // modules those targets never reached.
    const load = spawnSync(
      process.execPath,
      [
        `--input-type=module`,
        `-e`,
        `import { createRequire } from 'node:module'
import { resolve } from 'node:path'
const require = createRequire(import.meta.url)
const failed = []
for (const path of ${JSON.stringify(modules)}) {
  try {
    if (path.endsWith('.cjs')) require('./' + path)
    else await import('./' + path)
  } catch (error) {
    failed.push(path + ': ' + String(error.message).split('\\n')[0])
  }
}
for (const key of Object.keys(require.cache)) delete require.cache[key]
for (const path of ${JSON.stringify(required)}) require('./' + path)
const reached = new Set(Object.keys(require.cache))
const unreached = ${JSON.stringify(modules)}.filter(
  (path) => path.endsWith('.cjs') && !reached.has(resolve(path)),
)
console.log(JSON.stringify({ failed, unreached }))`,
      ],
      { cwd: packageDirectory, encoding: `utf8` },
    )
    expect(load.status, load.stderr).toBe(0)
    expect(JSON.parse(load.stdout)).toEqual({ failed: [], unreached: [] })
  }, 60_000)
})
