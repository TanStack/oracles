import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire, isBuiltin } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as oracles from '../src/index'
import * as route from '../src/route'
import { commonJsForRouteOnly } from '../vite.config'

// The public surface, as a consumer imports it. An added or removed export
// changes this list on purpose.
describe(`@tanstack/oracles`, () => {
  it(`exports the framework's parts, configuration, failure fidelity, and replay witness`, () => {
    expect(Object.keys(oracles).sort()).toEqual(
      [
        `OracleCheckpointFailure`,
        `OracleFailureReport`,
        `OracleDataError`,
        `OracleModelError`,
        `OracleViolation`,
        `assertRegisteredOracleProperty`,
        `atOracleCheckpoint`,
        `configureOracles`,
        `createOracleFailureFidelity`,
        `differs`,
        `forwardCut`,
        `oracleCalibrationTest`,
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

  // A module bundled into a browser or a native webview registers its routes
  // through this entry.
  it(`exports the route helpers from the browser-safe route entry`, () => {
    expect(Object.keys(route).sort()).toEqual(
      [`oracleFixedSeed`, `oracleRoute`, `oracleRouteOf`].sort(),
    )
    expect(route.oracleRoute).toBe(oracles.oracleRoute)
    expect(route.oracleRouteOf).toBe(oracles.oracleRouteOf)
    expect(route.oracleFixedSeed).toBe(oracles.oracleFixedSeed)
  })

  // Each build of the CommonJS output, including each rebuild in watch mode,
  // holds exactly the modules the route entry reaches in that build.
  // Watch mode is not driven here; two builds call the plugin's hook in turn.
  it(`prunes each CommonJS build by that build's own imports`, () => {
    const plugin = commonJsForRouteOnly()
    const generate = plugin.generateBundle as (
      output: { format: string },
      bundle: Record<string, { type: string; imports?: Array<string> }>,
    ) => void
    const chunk = (...imports: Array<string>) => ({ type: `chunk`, imports })
    const first = {
      'cjs/route.cjs': chunk(`cjs/oracle-route.cjs`),
      'cjs/oracle-route.cjs': chunk(),
      'cjs/index.cjs': chunk(`cjs/oracle-route.cjs`),
    }
    generate({ format: `cjs` }, first)
    expect(Object.keys(first).sort()).toEqual([
      `cjs/oracle-route.cjs`,
      `cjs/route.cjs`,
    ])
    const second = {
      'cjs/route.cjs': chunk(`cjs/oracle-environment.cjs`),
      'cjs/oracle-environment.cjs': chunk(),
      'cjs/oracle-route.cjs': chunk(),
      'cjs/index.cjs': chunk(),
    }
    generate({ format: `cjs` }, second)
    expect(Object.keys(second).sort()).toEqual([
      `cjs/oracle-environment.cjs`,
      `cjs/route.cjs`,
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
    visit(`dist/esm/route.js`)
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

  // The gap CLI analyzes with its own TypeScript, which the package depends
  // on under the npm alias `typescript-for-tanstack-oracles`. With a plain
  // `typescript` dependency, npm hoisted it to a project without TypeScript,
  // and an incremental install into a project with `typescript@^5.4.5`
  // deduped the project's root TypeScript up to 5.9. Under the alias, the
  // project's `typescript` is its own. npm links the bins of every package at
  // the root, so the alias's `tsc` remains a known residue, asserted below as
  // documented behavior: in a project without TypeScript, and after an
  // incremental install into one with TypeScript, until a clean install
  // (`npm ci`). The alias name sorts after `typescript`, so on a clean
  // install the project's own `typescript` claims `tsc` first. The tarball
  // installs with npm's cache first; npm fetches only what the cache lacks,
  // from the configured registry.
  it(`installs with npm without a typescript the project resolves, and its gap CLI analyzes there`, () => {
    const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)))
    const local = createRequire(import.meta.url)
    const versionOf = (name: string) =>
      (local(`${name}/package.json`) as { version: string }).version
    const scratch = mkdtempSync(join(tmpdir(), `oracles-npm-install-`))
    // pnpm's own `npm_` variables would configure npm as pnpm runs.
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => !key.startsWith(`npm_`) && !key.startsWith(`ORACLE_`),
      ),
    )
    const run = (command: string, args: Array<string>, cwd: string) => {
      const ran = spawnSync(command, args, { cwd, encoding: `utf8`, env })
      expect(ran.status, `${ran.stdout}\n${ran.stderr}`).toBe(0)
      return ran
    }
    try {
      run(
        process.execPath,
        [
          join(dirname(local.resolve(`vite/package.json`)), `bin/vite.js`),
          `build`,
        ],
        packageDirectory,
      )
      run(
        `npm`,
        [`pack`, `--ignore-scripts`, `--pack-destination`, scratch],
        packageDirectory,
      )
      const tarball = join(
        scratch,
        readdirSync(scratch).find((file) => file.endsWith(`.tgz`))!,
      )
      const npm = (
        directory: string,
        command: string,
        ...specs: Array<string>
      ) =>
        run(
          `npm`,
          [
            command,
            `--prefer-offline`,
            `--no-audit`,
            `--no-fund`,
            `--ignore-scripts`,
            ...specs,
          ],
          directory,
        )
      const project = (name: string, ...specs: Array<string>) => {
        const directory = join(scratch, name)
        mkdirSync(directory)
        writeFileSync(
          join(directory, `package.json`),
          JSON.stringify({ name, private: true, type: `module` }),
        )
        npm(directory, `install`, ...specs)
        return directory
      }
      // Where the project's `tsc` command links.
      const tscOf = (directory: string) =>
        readlinkSync(join(directory, `node_modules/.bin/tsc`))
      const aliasTsc = join(
        `..`,
        `typescript-for-tanstack-oracles`,
        `bin`,
        `tsc`,
      )
      const ownTsc = join(`..`, `typescript`, `bin`, `tsc`)
      const typescriptOf = (directory: string) =>
        (
          JSON.parse(
            readFileSync(
              join(directory, `node_modules/typescript/package.json`),
              `utf8`,
            ),
          ) as { version: string }
        ).version

      // A project with no TypeScript of its own.
      const bare = project(
        `bare`,
        tarball,
        `vitest@${versionOf(`vitest`)}`,
        `fast-check@${versionOf(`fast-check`)}`,
      )
      expect(existsSync(join(bare, `node_modules/typescript`))).toBe(false)
      // The known residue: no other package claims `tsc`.
      expect(tscOf(bare)).toBe(aliasTsc)
      mkdirSync(join(bare, `src`))
      mkdirSync(join(bare, `tests`))
      writeFileSync(
        join(bare, `src/order.ts`),
        `export function larger(a: number, b: number): number {\n  return a > b ? a : b\n}\n`,
      )
      writeFileSync(
        join(bare, `tests/order-oracle.test.ts`),
        [
          `import fc from 'fast-check'`,
          `import { differs, oracleProperty, pass } from '@tanstack/oracles'`,
          `import { larger } from '../src/order'`,
          `oracleProperty({`,
          `  id: 'scratch.larger',`,
          `  owns: ['src/order.ts'],`,
          `  law: { statement: 'larger returns the larger argument.', authority: 'arithmetic', limits: 'small integers' },`,
          `  histories: { arbitrary: fc.tuple(fc.integer({ min: -3, max: 3 }), fc.integer({ min: -3, max: 3 })), runs: 20, fixedSeeds: [1] },`,
          `  model: ([a, b]: [number, number]) => Math.max(a, b),`,
          `  driver: ([a, b]: [number, number], observe) => observe('larger', larger(a, b)),`,
          `  check: (_plan, trace, expected) => differs('larger', 'larger', trace[0]?.value, expected) ?? pass,`,
          `})`,
          ``,
        ].join(`\n`),
      )
      run(
        process.execPath,
        [
          join(bare, `node_modules/@tanstack/oracles/oracle-gaps/index.mjs`),
          `--package`,
          bare,
          `--source`,
          `src/order.ts`,
          `--contexts`,
          `1`,
          `--out`,
          join(scratch, `out`),
        ],
        bare,
      )
      // The analysis parsed the source with the CLI's TypeScript and found
      // its mutants.
      const { results } = JSON.parse(
        readFileSync(join(scratch, `out/results.json`), `utf8`),
      ) as { results: Array<unknown> }
      expect(results.length).toBeGreaterThan(0)

      // A project with its own TypeScript, of a version the alias's range
      // excludes, then installs the package: npm saves `^5.4.5`, which a plain
      // dependency deduped up to 5.9. The project keeps 5.4.5.
      const owned = project(`owned`, `typescript@5.4.5`)
      npm(owned, `install`, tarball)
      expect(typescriptOf(owned)).toBe(`5.4.5`)
      // The known residue of the incremental install, until a clean one.
      expect(tscOf(owned)).toBe(aliasTsc)
      npm(owned, `ci`)
      expect(typescriptOf(owned)).toBe(`5.4.5`)
      expect(tscOf(owned)).toBe(ownTsc)
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  }, 180_000)
})
