/**
 * # A test's route never claims more than its campaign has
 *
 * The gap report counts a mutant's kill only on a reproducible route, so each
 * test registers the route of the campaign it runs through
 * `globalThis.__oracleRoute`, and the last registration wins. The routes are
 * one vocabulary, `OracleRoute` in `oracle-route.ts`, which every runner and
 * `oracleRoute` use:
 *
 * - `fixed seed`: a campaign whose seed was declared fixed: in code, with
 *   `oracleFixedSeed`, or by a seed-only replay that reseeds a campaign;
 * - `fixed history`: one written or recorded history, a path replay included;
 * - `case`: an enumerated history;
 * - `random seed`: any other campaign;
 * - `calibration`: a check of the property itself (a calibration, a probe
 *   calibration, the determinism test).
 *
 * The law: the route registered when a campaign runs describes that campaign
 * in this vocabulary, whatever order the test calls the framework's helpers
 * in, and never claims more reproducibility than the campaign has. Where the
 * framework cannot know that a seed is fixed, it says `random seed`, which
 * undercounts kills but never counts a kill it cannot reproduce (coordinator
 * decision for TanStack/oracles#1, 2026-11-08, findings R1c-1 and R1c-2).
 *
 * - One classifier, `oracleRouteOf(parameters)`, names the route of a
 *   campaign that runs with given fast-check parameters: `fixed history`
 *   with a path; `fixed seed` when the parameters still carry the framework's
 *   declaration of their seed; `random seed` otherwise. The declaration
 *   survives a spread, and only a spread: a seed set by hand, options rebuilt
 *   field by field, a JSON round trip, or a structured clone lose it.
 * - `oracleProperty` registers the route of its campaigns the same way; the
 *   self-oracle's `route` law owns its routes, because they run under Vitest.
 * - Building options registers nothing; options built from the replay
 *   environment under a seed-only or path replay declare their seed, and a
 *   seed the caller passes in, as a number or a configuration it built, is
 *   not declared.
 *
 * History: a test's own campaign that makes some of these calls (register a
 * named route; build property options or random parameters, from the replay
 * environment, from a seed the caller passes as a number, or from a
 * configuration it builds by hand; set the seed by hand; declare it fixed
 * with `oracleFixedSeed`; rebuild the options field by field; round-trip them
 * through JSON or `structuredClone`; register the route of the options),
 * under an
 * environment with no replay, a seed-only replay, or a path replay of the
 * test's property. The model tracks, from the history alone, where each
 * seed came from and whether its declaration survived, and owes the route in
 * force when each campaign would run. The driver records the route at that
 * point.
 *
 * Limits: a named route a caller registers is taken as its claim.
 */
import fc from 'fast-check'
import { vi } from 'vitest'
import { differs, oracleProperty, pass } from '../src/index.js'
import type { Observation, OracleRoute } from '../src/index.js'

type Call =
  | { call: `route`; route: OracleRoute }
  | {
      call:
        | `property options`
        | `random parameters`
        | `random parameters from a number`
        | `random parameters from a config`
        | `set seed`
        | `declare fixed seed`
        | `rebuild`
        | `json`
        | `clone`
        | `route of options`
    }
type Replay = `none` | `seed` | `path`
type History = {
  replay: Replay
  calls: Array<Call>
}

const routes: ReadonlyArray<OracleRoute> = [
  `fixed seed`,
  `fixed history`,
  `case`,
  `random seed`,
  `calibration`,
]
const call: fc.Arbitrary<Call> = fc.oneof(
  fc.record({
    call: fc.constant(`route` as const),
    route: fc.constantFrom(...routes),
  }),
  fc.record({
    call: fc.constantFrom(
      `property options` as const,
      `random parameters` as const,
      `random parameters from a number` as const,
      `random parameters from a config` as const,
      `set seed` as const,
      `declare fixed seed` as const,
      `rebuild` as const,
      `json` as const,
      `clone` as const,
      `route of options` as const,
    ),
  }),
)
const history: fc.Arbitrary<History> = fc.record({
  replay: fc.constantFrom<Replay>(`none`, `seed`, `path`),
  calls: fc.array(call, { maxLength: 5 }),
})

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------
//
// Options are described by whether their seed is known to be fixed (declared
// by the framework, and the declaration kept) and whether a path replays one
// history. A path survives every step here; a declaration only a spread.

type Options = { known: boolean; path: boolean }
const routeOfOptions = ({ known, path }: Options): OracleRoute =>
  path ? `fixed history` : known ? `fixed seed` : `random seed`

function owedRoutes({ replay, calls }: History): Array<string | null> {
  let route: string | null = null
  // No options yet: fast-check would draw the seed.
  let options: Options = { known: false, path: false }
  for (const made of calls)
    switch (made.call) {
      case `route`:
        route = made.route
        break
      case `property options`:
      case `random parameters`:
        // A replay's seed comes from the environment and is declared; a
        // drawn one is not.
        options = { known: replay !== `none`, path: replay === `path` }
        break
      // A seed the caller passed, as a number or a configuration it built,
      // is not known to be fixed.
      case `random parameters from a number`:
      case `random parameters from a config`:
        options = { known: false, path: false }
        break
      case `set seed`:
      case `rebuild`:
      case `json`:
      case `clone`:
        options = { ...options, known: false }
        break
      case `declare fixed seed`:
        options = { ...options, known: true }
        break
      case `route of options`:
        route = routeOfOptions(options)
        break
    }
  return [route]
}

// ---------------------------------------------------------------------------
// Production driver
// ---------------------------------------------------------------------------

const property = `route.site`
const variables = [`ORACLE_SEED`, `ORACLE_PATH`, `ORACLE_PROPERTY`]

type Parameters = { numRuns?: number; seed?: number; path?: string }

async function driveRoutes(
  { replay, calls }: History,
  observe: (checkpoint: string, value: unknown) => void,
) {
  const saved = Object.fromEntries(
    variables.map((name) => [name, process.env[name]]),
  )
  const registered = globalThis.__oracleRoute
  const info = vi.spyOn(console, `info`).mockImplementation(() => {})
  let route: string | null = null
  globalThis.__oracleRoute = (next) => {
    route = next
  }
  try {
    for (const name of variables) delete process.env[name]
    // The replay applies to the project's selection, which the options read.
    if (replay !== `none`) Object.assign(process.env, { ORACLE_SEED: `1` })
    if (replay === `path`)
      Object.assign(process.env, {
        ORACLE_PATH: `0`,
        ORACLE_PROPERTY: property,
      })
    vi.resetModules()
    const config = await import(`../src/oracle-config.js`)
    {
      let options: Parameters = {}
      for (const made of calls)
        switch (made.call) {
          case `route`:
            config.oracleRoute(made.route)
            break
          case `property options`:
            options = config.oraclePropertyOptions(10, property)
            break
          case `random parameters`:
            options = config.oracleRandomParameters(
              10,
              config.readOracleRunConfig(),
              property,
            )
            break
          case `random parameters from a number`:
            options = config.oracleRandomParameters(10, 7, property)
            break
          case `random parameters from a config`:
            options = config.oracleRandomParameters(
              10,
              {
                campaignSeed: 7,
                replayPath: undefined,
                replayProperty: undefined,
              },
              property,
            )
            break
          // A seed other than any declared one, so an override is visible.
          case `set seed`:
            options = { ...options, seed: 43 }
            break
          case `declare fixed seed`:
            options = config.oracleFixedSeed(42, options)
            break
          case `rebuild`:
            options = {
              numRuns: options.numRuns,
              seed: options.seed,
              ...(options.path === undefined ? {} : { path: options.path }),
            }
            break
          case `json`:
            options = JSON.parse(JSON.stringify(options)) as Parameters
            break
          case `clone`:
            options = structuredClone(options)
            break
          case `route of options`:
            config.oracleRoute(config.oracleRouteOf(options))
            break
        }
    }
    observe(`campaign 0`, route)
  } finally {
    globalThis.__oracleRoute = registered
    info.mockRestore()
    for (const name of variables)
      if (saved[name] === undefined) delete process.env[name]
      else process.env[name] = saved[name]
  }
}

function checkRoutes(
  _history: History,
  trace: ReadonlyArray<Observation>,
  owed: Array<string | null>,
) {
  const seen = trace.map(({ value }) => value)
  return differs(`campaigns`, `route`, seen, owed) ?? pass
}

const builtAfterRoute = `options built after the test registered its route`
const lostDeclaration = `a declaration lost before the route of options`
const declaredFixedSeed = `the route of a seed declared fixed`

// Where a declaration of a known-fixed seed is lost before the options'
// route is registered.
const losesDeclaration = (calls: ReadonlyArray<Call>) => {
  let known = false
  let lost = false
  for (const made of calls) {
    if (made.call === `declare fixed seed`) [known, lost] = [true, false]
    if ([`set seed`, `rebuild`, `json`, `clone`].includes(made.call))
      if (known) [known, lost] = [false, true]
    if (made.call === `route of options` && lost) return true
  }
  return false
}

oracleProperty<History, Array<string | null>>({
  id: `self-oracle.route`,
  law: {
    statement: `The route registered when a campaign runs describes that campaign in the one route vocabulary and never claims more reproducibility than it has: fixed seed only for a seed the framework declared fixed and the parameters still carry, fixed history only with a path, random seed otherwise; one classifier serves every test.`,
    authority: `the gap report's route contract (OracleRoute in packages/oracles/src/oracle-route.ts); coordinator decisions for TanStack/oracles#1, 2026-11-08 (findings F2, R1b-4, R1b-7, R1b-8, R1c-1, R1c-2, R1c-9)`,
    limits: `A named route a caller registers is taken as its claim; oracleProperty's own routes are owned by the self-oracle's route law.`,
    owner: `oracleProperty framework`,
  },
  histories: {
    arbitrary: history,
    runs: 150,
    fixedSeeds: [20261108],
    states: [builtAfterRoute, lostDeclaration, declaredFixedSeed],
    fixed: [
      // A fixed-seed campaign that built random options, then registered its
      // route, then built options again for a second assertion.
      {
        name: `options built after the test registered fixed seed`,
        history: {
          replay: `none`,
          calls: [
            { call: `route`, route: `fixed seed` },
            { call: `property options` },
          ],
        },
        enters: [builtAfterRoute],
      },
      // A seed the framework drew lost its mark in a JSON round trip and
      // read as fixed; a seed set by hand read as fixed too.
      {
        name: `options round-tripped through JSON`,
        history: {
          replay: `none`,
          calls: [
            { call: `property options` },
            { call: `json` },
            { call: `route of options` },
          ],
        },
      },
      {
        name: `a seed set by hand`,
        history: {
          replay: `none`,
          calls: [
            { call: `property options` },
            { call: `set seed` },
            { call: `route of options` },
          ],
        },
      },
      // A caller's own seed was declared fixed because it was defined.
      {
        name: `random parameters from a caller's number`,
        history: {
          replay: `none`,
          calls: [
            { call: `random parameters from a number` },
            { call: `route of options` },
          ],
        },
      },
      {
        name: `random parameters from a hand-built configuration`,
        history: {
          replay: `seed`,
          calls: [
            { call: `random parameters from a config` },
            { call: `route of options` },
          ],
        },
      },
      {
        name: `a declared seed overridden by hand`,
        history: {
          replay: `none`,
          calls: [
            { call: `declare fixed seed` },
            { call: `set seed` },
            { call: `route of options` },
          ],
        },
        enters: [lostDeclaration],
      },
      {
        name: `a declared seed cloned before its route`,
        history: {
          replay: `none`,
          calls: [
            { call: `declare fixed seed` },
            { call: `clone` },
            { call: `route of options` },
          ],
        },
        enters: [lostDeclaration],
      },
    ],
    constructed: [
      {
        name: builtAfterRoute,
        enters: [builtAfterRoute],
        build: (generated): History => ({
          ...generated,
          calls: [
            { call: `route`, route: `fixed seed` },
            { call: `random parameters` },
            ...generated.calls.slice(0, 2),
          ],
        }),
      },
      {
        name: lostDeclaration,
        enters: [lostDeclaration],
        build: (generated): History => ({
          ...generated,
          calls: [
            { call: `property options` },
            { call: `declare fixed seed` },
            ...generated.calls
              .slice(0, 1)
              .filter((made) => made.call !== `declare fixed seed`),
            // Each way of losing a declaration, by the generated history.
            {
              call: ([`set seed`, `rebuild`, `json`, `clone`] as const)[
                generated.calls.length % 4
              ]!,
            },
            { call: `route of options` },
          ],
        }),
      },
      {
        name: declaredFixedSeed,
        enters: [declaredFixedSeed],
        build: (generated): History => ({
          ...generated,
          calls: [
            { call: `random parameters` },
            { call: `declare fixed seed` },
            { call: `route of options` },
            ...generated.calls.slice(0, 2),
          ],
        }),
      },
    ],
  },
  model: owedRoutes,
  reached: ({ calls }) => {
    const firstRoute = calls.findIndex((made) => made.call === `route`)
    const builds = calls.map(
      (made) =>
        made.call === `property options` || made.call === `random parameters`,
    )
    const declaredAt = calls.findIndex(
      (made) => made.call === `declare fixed seed`,
    )
    return [
      ...(firstRoute >= 0 &&
      builds.some((built, at) => built && at > firstRoute)
        ? [builtAfterRoute]
        : []),
      ...(losesDeclaration(calls) ? [lostDeclaration] : []),
      ...(declaredAt >= 0 && calls[declaredAt + 1]?.call === `route of options`
        ? [declaredFixedSeed]
        : []),
    ]
  },
  driver: driveRoutes,
  check: checkRoutes,
})
