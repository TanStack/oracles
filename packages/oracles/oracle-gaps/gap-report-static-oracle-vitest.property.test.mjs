/**
 * # A Vitest older than the peer range is refused before it loads
 *
 * This oracle owns the gap check's promise about the Vitest a package runs,
 * checked on the ending of the real CLI (index.mjs), cold and through
 * `--daemon`, in a scratch package that holds a stand-in Vitest of a drawn
 * version. It owns the version check of `openSession` (check.mjs).
 *
 * ```sh
 * oracle-gaps --package . --source src/v.ts   # Vitest 1.6.1 installed
 * # → exit 2, refused: names 1.6.1 and ^4.1.0 || ^5.0.0, fix: upgrade Vitest
 * #   (oracles-setup step 2), run the existing tests before and after
 * oracle-gaps --package . --source src/v.ts   # Vitest 4.1.0 installed
 * # → that Vitest is loaded
 * ```
 *
 * The package's own manifest is not the Vitest that runs. A package that
 * declares `"vitest": "^4.1.0"` can still have 1.6.1 installed (a lockfile
 * that was never updated), and one that declares `^1.6.0` can run 4.1.0. Under
 * Vitest 1.6 the check used to stop with `context.getRootProject is not a
 * function`, reported as a bug in oracle-gaps; under Vitest 3.2 with Vite 5 it
 * stopped after its baseline with `this Vitest exposes no Vite environments
 * with module graphs`. Neither says that the package needs a newer Vitest.
 *
 * The parts: the installed copy is the Vitest that `vitest/node` resolves to
 * from the package, the copy the CLI would load, whose own package.json holds
 * its version; the peer range is the `vitest` entry of this package's
 * `peerDependencies`, the versions the framework and the CLI are written for;
 * the refusal is the CLI's `refused:` block, which a run ends with before any
 * test runs.
 *
 * The law: for every installed copy whose version is older than every version
 * of the peer range, the run, cold or through `--daemon`, refuses before it
 * loads that copy. It exits 2 with a report-shaped refusal (law 12 of the
 * end-to-end oracle) whose cause names the installed version and the peer
 * range, and whose fix says to upgrade Vitest (the oracles-setup skill's step
 * 2) and to run the package's existing tests before and after the upgrade. A
 * copy in the peer range is loaded. A prerelease of the range's lowest
 * version is older than it, as semver orders them.
 *
 * The model is a table of versions, each marked older or in the range, written
 * by hand against the peer range `^4.1.0 || ^5.0.0` and not computed: the
 * table refuses to load once the manifest's range changes, so the marks are
 * rewritten with it. The stand-in Vitest throws when it is loaded, with its
 * version in the message, so the ending shows whether the CLI loaded the copy
 * it resolved: a refusal must not carry that message, and a run on a copy in
 * the range must. Each history draws the installed version, the version the
 * package's manifest declares, whether the copy is linked into node_modules
 * as pnpm links it or sits there as npm puts it, whether its `exports` name its
 * package.json, whether a package.json of its own `dist` lies between its
 * entry and its manifest, and whether the run goes through `--daemon`.
 *
 * Limits: a version newer than the peer range is not generated, and what the
 * CLI owes it is not decided. A copy whose manifest has no version is the
 * end-to-end oracle's `brokenVitest` history, which loads. The stand-in
 * Vitest only throws when loaded, so what a real old Vitest does after it
 * loads is not judged, nor are two copies of Vitest in one run (#66). A plain
 * `vitest run` under an old Vitest is the framework's, judged in
 * tests/package.test.ts.
 */
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { oracleProperty, pass, violation } from '../src/oracle-property.ts'
import { endingOf, refusalBreach } from './gap-report-model-oracle.mjs'
import { posix } from './paths.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const LAW = `old Vitest refused`

// ## The model
//
// The peer range, as this package's manifest states it: the authority for
// which Vitest the framework and the CLI support.
const PEER_RANGE = JSON.parse(
  readFileSync(join(here, `../package.json`), `utf8`),
).peerDependencies.vitest
// Each version's mark, by hand, against the range the marks were written for.
// `older` is the whole rule; the other fields only name the boundary a version
// stands at, for the reach counts.
const MARKED_FOR = `^4.1.0 || ^5.0.0`
const VERSIONS = {
  '0.34.6': { older: true },
  '1.6.1': { older: true },
  '2.1.9': { older: true },
  '3.2.4': { older: true },
  '4.0.18': { older: true, at: `an older minor of the range's lowest major` },
  '4.1.0-beta.6': {
    older: true,
    at: `a prerelease of the range's lowest version`,
  },
  '4.1.0': { older: false, at: `the range's lowest version` },
  '4.1.12': { older: false },
  '5.0.0': { older: false },
  '5.1.1': { older: false },
}
if (PEER_RANGE !== MARKED_FOR)
  throw new Error(
    `the peer range for vitest is ${PEER_RANGE}, and VERSIONS is marked for ${MARKED_FOR}: mark each version against the new range`,
  )

const model = (history) => ({
  older: VERSIONS[history.installed].older,
  installed: history.installed,
  range: PEER_RANGE,
})

// ## Histories
const versions = Object.keys(VERSIONS)
const historyArbitrary = fc.record({
  installed: fc.constantFrom(...versions),
  declared: fc.constantFrom(...versions),
  linked: fc.boolean(),
  manifestExported: fc.boolean(),
  distManifest: fc.boolean(),
  daemon: fc.boolean(),
})

const S = {
  older: `a Vitest older than the peer range`,
  supported: `a Vitest in the peer range`,
  decoy: `a manifest that declares a Vitest on the range's other side`,
  linked: `a Vitest linked into node_modules`,
  unexported: `a Vitest whose exports do not name its package.json`,
  distManifest: `a package.json between Vitest's entry and its own`,
  daemon: `an older Vitest through --daemon`,
}
const boundaries = [
  ...new Set(
    Object.values(VERSIONS)
      .map((mark) => mark.at)
      .filter(Boolean),
  ),
]

function statesOf(history) {
  const mark = VERSIONS[history.installed]
  return [
    mark.older ? S.older : S.supported,
    ...(mark.at ? [mark.at] : []),
    ...(VERSIONS[history.declared].older !== mark.older ? [S.decoy] : []),
    ...(history.linked ? [S.linked] : []),
    ...(history.manifestExported ? [] : [S.unexported]),
    ...(history.distManifest ? [S.distManifest] : []),
    ...(history.daemon && mark.older ? [S.daemon] : []),
  ]
}

const constructed = [
  {
    name: `an older Vitest beside a manifest that declares a supported one`,
    enters: [S.older, S.decoy],
    build: (g) => ({
      ...g,
      installed: `1.6.1`,
      declared: `4.1.12`,
      daemon: false,
    }),
  },
  {
    name: `an older Vitest through --daemon`,
    enters: [S.older, S.daemon],
    build: (g) => ({ ...g, installed: `3.2.4`, daemon: true }),
  },
  {
    name: `a linked older Vitest that does not export its package.json`,
    enters: [S.older, S.linked, S.unexported, S.distManifest],
    build: (g) => ({
      ...g,
      installed: `2.1.9`,
      linked: true,
      manifestExported: false,
      distManifest: true,
    }),
  },
  {
    name: `a prerelease of the range's lowest version`,
    enters: [S.older, `a prerelease of the range's lowest version`],
    build: (g) => ({ ...g, installed: `4.1.0-beta.6` }),
  },
  {
    name: `an older minor of the range's lowest major`,
    enters: [S.older, `an older minor of the range's lowest major`],
    build: (g) => ({ ...g, installed: `4.0.18`, daemon: false }),
  },
  {
    name: `the range's lowest version beside a manifest that declares an older one`,
    enters: [S.supported, `the range's lowest version`, S.decoy],
    build: (g) => ({ ...g, installed: `4.1.0`, declared: `1.6.1` }),
  },
  {
    name: `a linked supported Vitest through --daemon`,
    enters: [S.supported, S.linked],
    build: (g) => ({ ...g, installed: `5.1.1`, linked: true, daemon: true }),
  },
]

// ## The driver
//
// A scratch package beside this file holds a manifest that declares the
// history's `declared` Vitest, one source, and the stand-in Vitest of the
// installed version: in `node_modules/vitest`, or, linked, in a pnpm-style
// store directory that `node_modules/vitest` links to. Its `vitest/node`
// entry throws when it is loaded, naming its version. The real CLI runs on
// it with an `--out` of its own, cold or through `--daemon`, and the driver
// records the run's ending as the end-to-end oracle reads it.
const loadedText = (version) => `the stand-in Vitest ${version} was loaded`

function writeVitest(pkg, history) {
  const at = history.linked
    ? join(
        pkg,
        `node_modules/.pnpm/vitest@${history.installed}/node_modules/vitest`,
      )
    : join(pkg, `node_modules/vitest`)
  mkdirSync(join(at, `dist`), { recursive: true })
  writeFileSync(
    join(at, `package.json`),
    `${JSON.stringify({
      name: `vitest`,
      version: history.installed,
      type: `module`,
      exports: {
        './node': `./dist/node.mjs`,
        ...(history.manifestExported
          ? { './package.json': `./package.json` }
          : {}),
      },
    })}\n`,
  )
  if (history.distManifest)
    writeFileSync(join(at, `dist/package.json`), `{"type":"module"}\n`)
  writeFileSync(
    join(at, `dist/node.mjs`),
    `throw new Error(${JSON.stringify(loadedText(history.installed))})\n`,
  )
  if (history.linked)
    symlinkSync(
      `.pnpm/vitest@${history.installed}/node_modules/vitest`,
      join(pkg, `node_modules/vitest`),
      `dir`,
    )
}

function driver(history, observe) {
  const pkg = realpathSync(mkdtempSync(join(here, `.scratch-`)))
  try {
    writeFileSync(
      join(pkg, `package.json`),
      `${JSON.stringify({
        name: `fixture`,
        private: true,
        devDependencies: { vitest: history.declared },
      })}\n`,
    )
    mkdirSync(join(pkg, `src`))
    writeFileSync(join(pkg, `src/v.ts`), `export const v = 1\n`)
    writeVitest(pkg, history)
    const out = join(pkg, `out`)
    const run = spawnSync(
      process.execPath,
      [
        join(here, `index.mjs`),
        ...(history.daemon ? [`--daemon`] : []),
        `--package`,
        pkg,
        `--source`,
        `src/v.ts`,
        `--out`,
        out,
      ],
      { cwd: pkg, encoding: `utf8`, timeout: 120_000 },
    )
    observe(
      `ending`,
      endingOf(
        run.status,
        run.stderr,
        out,
        // The CLI names paths in forward slashes (the Windows paths rule).
        (text) =>
          text.replaceAll(posix(pkg), `<package>`).replaceAll(pkg, `<package>`),
        run.stdout,
      ),
    )
    for (const state of statesOf(history)) observe(`reach`, state)
  } finally {
    rmSync(pkg, { recursive: true, force: true, maxRetries: 5 })
  }
}

// ## The check
//
// An older copy: the refusal law of the end-to-end oracle (refusalBreach),
// with the stream log named first, since the run started a check; a cause
// that names the peer range and the installed version as a whole version
// (`4.1.0` is not `4.1.0-beta.6`), and not the stand-in's load message; a
// fix that names the setup skill's step 2 and the existing tests before and
// after. A copy in the range: the run loaded it, so its ending carries the
// stand-in's load message.
const LOG_NOTE = `oracle-gaps: note log <package>/out/stream.log`
const namesVersion = (text, version) =>
  new RegExp(
    `(?<![\\w.-])${version.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`)}(?![\\w-]|\\.\\d)`,
  ).test(text)

function check(history, trace, expected) {
  const ending = trace.find((o) => o.checkpoint === `ending`)?.value
  if (!ending) return violation(`ending`, `no run was observed`, LAW)
  const run = `with Vitest ${expected.installed}${history.daemon ? ` and --daemon` : ``}`
  const loaded = ending.cause?.includes(loadedText(expected.installed)) === true
  if (!expected.older) {
    if (ending.exit === 2 && loaded) return pass
    return violation(
      `ending`,
      `${run}, in the peer range ${expected.range}, the run did not load that Vitest: exit ${ending.exit}, ${ending.cause ?? ending.done}`,
      LAW,
    )
  }
  const breach = refusalBreach(ending, {
    cause: expected.range,
    outKnown: true,
    logNote: LOG_NOTE,
  })
  if (breach) return violation(`ending`, `${run}, ${breach}`, LAW)
  if (loaded)
    return violation(
      `ending`,
      `${run}, the run loaded that Vitest before it refused: ${ending.cause}`,
      LAW,
    )
  if (!namesVersion(ending.cause, expected.installed))
    return violation(
      `ending`,
      `${run}, the refusal does not name the installed version: ${ending.cause}`,
      LAW,
    )
  if (
    !/oracles-setup/.test(ending.fix) ||
    !/step 2/.test(ending.fix) ||
    !/before and after/.test(ending.fix)
  )
    return violation(
      `ending`,
      `${run}, the fix does not say to upgrade Vitest by the oracles-setup skill's step 2 and to run the existing tests before and after: ${ending.fix}`,
      LAW,
    )
  return pass
}

// Each wrong ending replaces the refusal's cause or fix on stderr and in the
// results.json the run wrote alike, so only the law under test can reject it.
const corruptEnding = (change) => (trace, plan) =>
  trace.map((o) => {
    if (o.checkpoint !== `ending`) return o
    const value = structuredClone(o.value)
    const next = change(value, plan)
    value.cause = next.cause ?? value.cause
    value.fix = next.fix ?? value.fix
    if (value.written) {
      value.written.cause = value.cause
      value.written.directive = value.fix
    }
    return { ...o, value }
  })
const calibrations = [
  {
    name: `the refusal names the version the manifest declares`,
    law: LAW,
    history: {
      constructed: `an older Vitest beside a manifest that declares a supported one`,
    },
    corrupt: corruptEnding((ending, plan) => ({
      cause: ending.cause.replaceAll(plan.installed, plan.declared),
    })),
  },
  {
    name: `an older Vitest is loaded, and its load fails`,
    law: LAW,
    history: {
      constructed: `a linked older Vitest that does not export its package.json`,
    },
    corrupt: corruptEnding((_, plan) => ({
      cause: `the package's Vitest failed to load: ${loadedText(plan.installed)}`,
      fix: `Install a working Vitest in the package, so that vitest/node loads from it.`,
    })),
  },
  {
    name: `the fix says to upgrade, and not to run the tests before and after`,
    law: LAW,
    history: { constructed: `an older Vitest through --daemon` },
    corrupt: corruptEnding((ending) => ({
      fix: ending.fix.replace(/before and after/g, `after`),
    })),
  },
  {
    name: `the range's lowest version is refused as older`,
    law: LAW,
    history: {
      constructed: `the range's lowest version beside a manifest that declares an older one`,
    },
    corrupt: corruptEnding((_, plan) => ({
      cause: `the package's Vitest ${plan.installed} is older than ${PEER_RANGE}`,
    })),
  },
]

oracleProperty({
  id: `oracle-gaps.report-static-vitest`,
  law: {
    statement: `For every Vitest that the package's vitest/node resolves to, linked or not, whatever version the package's manifest declares: when its version is older than every version of @tanstack/oracles's peer range for vitest, the gap check, cold or through --daemon, refuses before it loads that Vitest, with exit 2 and a report-shaped refusal whose cause names the installed version and the peer range and whose fix says to upgrade Vitest (the oracles-setup skill's step 2) and to run the existing tests before and after; a Vitest in the peer range is loaded.`,
    authority: `The peer range in packages/oracles/package.json (peerDependencies.vitest), the versions the framework and the CLI are written for; the maintainer's decision of 2026-11-10 that the CLI never just crashes (law 12 of the end-to-end oracle, the report-shaped ending); the oracles-setup skill's step 2 for the upgrade.`,
    limits: `Versions newer than the peer range are not generated. A Vitest manifest with no version loads (the end-to-end oracle's brokenVitest history). The stand-in Vitest throws when it loads, so what a real old Vitest does after loading is not judged; two copies of Vitest in one run (#66) are not judged. The version marks are a hand table for the range ^4.1.0 || ^5.0.0.`,
  },
  histories: {
    arbitrary: historyArbitrary,
    runs: 12,
    fixedSeeds: [20261125],
    states: [...Object.values(S), ...boundaries],
    measured: [],
    constructed,
  },
  model,
  driver,
  check,
  calibrations,
  timeout: 120_000,
})
