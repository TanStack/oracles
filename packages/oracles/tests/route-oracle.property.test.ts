/**
 * # A test's route describes the campaign that runs
 *
 * The gap report counts a mutant's kill only on a reproducible route, so each
 * test registers the route of the campaign it runs through
 * `globalThis.__oracleRoute`, and the last registration wins. The routes are
 * one vocabulary, `OracleRoute` in `oracle-route.ts`, which every runner and
 * `oracleRoute` use:
 *
 * - `fixed seed`: a campaign whose seed is fixed in code, or comes from the
 *   replay environment without a path (a reseeded campaign);
 * - `fixed history`: one written or recorded history, a path replay included;
 * - `case`: an enumerated history;
 * - `random seed`: a campaign whose seed the framework drew;
 * - `calibration`: a check of the property itself (a calibration, a probe
 *   calibration, the determinism test).
 *
 * The law: the route registered when a campaign runs describes that campaign
 * in this vocabulary, whatever order the test calls the framework's helpers
 * in, and every runner attributes the same campaign the same way.
 *
 * - `runOracleCampaign` registers each of its campaigns' routes before it
 *   calls the campaign: its fixed-seed campaign `fixed seed`, its random one
 *   `random seed`, a seed-only replay `fixed seed`, and a path replay
 *   `fixed history`. (`oracleProperty` registers its tests' routes by the same
 *   rule; the self-oracle's `route` law owns those, because they run under
 *   Vitest.)
 * - Building options registers nothing: `oraclePropertyOptions` and
 *   `oracleRandomParameters` return parameters that a caller may still
 *   change, such as a seed it fixes.
 * - `oracleRouteOf(parameters)` names the route of a campaign that runs with
 *   those parameters, by the rule above, so a test that runs its own campaign
 *   registers `oracleRoute(oracleRouteOf(parameters))` with the parameters it
 *   finally passes. A seed the test fixed itself is `fixed seed`.
 *
 * History: either a test's own campaign or a `runOracleCampaign` call whose
 * campaigns make the same calls (register a named route, build property
 * options, build random parameters, fix the seed of the options built, or
 * register the route of the options built), under an environment with no
 * replay, a seed-only replay, or a path replay of the test's property. The
 * model owes, from the history alone, the route in force when each campaign
 * would run. The driver records the route at that point.
 *
 * Limits: a named route a caller registers is taken as its claim.
 */
import fc from 'fast-check'
import { vi } from 'vitest'
import { differs, oracleProperty, pass } from '../src/index.js'
import type { Observation, OracleRoute } from '../src/index.js'

type Call =
  | { call: `route`; route: OracleRoute }
  | { call: `property options` }
  | { call: `random parameters` }
  | { call: `fix seed` }
  | { call: `route of options` }
type Replay = `none` | `seed` | `path`
type History = {
  runner: `own` | `runOracleCampaign`
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
    call: fc.constant(`route`),
    route: fc.constantFrom(...routes),
  }),
  fc.record({ call: fc.constant(`property options`) }),
  fc.record({ call: fc.constant(`random parameters`) }),
  fc.record({ call: fc.constant(`fix seed`) }),
  fc.record({ call: fc.constant(`route of options`) }),
)
const history: fc.Arbitrary<History> = fc.record({
  runner: fc.constantFrom(`own`, `runOracleCampaign`),
  replay: fc.constantFrom<Replay>(`none`, `seed`, `path`),
  calls: fc.array(call, { maxLength: 4 }),
})

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------
//
// The options a test built describe a campaign by where its seed came from:
// none yet (fast-check would draw one), drawn by the framework, from the
// replay environment, or fixed by the test; and whether a path replays one
// history. The route of that campaign follows the vocabulary above.

type Options = {
  seed: `none` | `drawn` | `environment` | `fixed`
  path: boolean
}
const routeOfOptions = ({ seed, path }: Options): OracleRoute =>
  path
    ? `fixed history`
    : seed === `none` || seed === `drawn`
      ? `random seed`
      : `fixed seed`

function owedRoutes({ runner, replay, calls }: History): Array<string | null> {
  // Each campaign starts from its runner's route; the test's calls follow.
  const after = (start: string | null) => {
    let route = start
    let options: Options = { seed: `none`, path: false }
    for (const made of calls) {
      if (made.call === `route`) route = made.route
      else if (made.call === `fix seed`) options = { ...options, seed: `fixed` }
      else if (made.call === `route of options`) route = routeOfOptions(options)
      else
        options = {
          seed: replay === `none` ? `drawn` : `environment`,
          path: replay === `path`,
        }
    }
    return route
  }
  if (runner === `own`) return [after(null)]
  const campaigns: Array<OracleRoute> =
    replay === `none`
      ? [`fixed seed`, `random seed`]
      : [replay === `path` ? `fixed history` : `fixed seed`]
  return campaigns.map(after)
}

// ---------------------------------------------------------------------------
// Production driver
// ---------------------------------------------------------------------------

const property = `route.site`
const campaignPrefix = `ROUTE_CAMPAIGN`
const variables = [
  `ORACLE_SEED`,
  `ORACLE_PATH`,
  `ORACLE_PROPERTY`,
  `${campaignPrefix}_SEED`,
  `${campaignPrefix}_PATH`,
]

async function driveRoutes(
  { runner, replay, calls }: History,
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
    // The replay applies to the project's selection, which the options read,
    // and to the runner's own prefix.
    if (replay !== `none`)
      Object.assign(process.env, {
        ORACLE_SEED: `1`,
        [`${campaignPrefix}_SEED`]: `1`,
      })
    if (replay === `path`)
      Object.assign(process.env, {
        ORACLE_PATH: `0`,
        ORACLE_PROPERTY: property,
        [`${campaignPrefix}_PATH`]: `0`,
      })
    vi.resetModules()
    const config = await import(`../src/oracle-config.js`)
    const { runOracleCampaign } = await import(`../src/oracle-campaign.js`)
    const make = () => {
      let options: { seed?: number; path?: string } = {}
      for (const made of calls)
        if (made.call === `route`) config.oracleRoute(made.route)
        else if (made.call === `property options`)
          options = config.oraclePropertyOptions(10, property)
        else if (made.call === `random parameters`)
          options = config.oracleRandomParameters(
            10,
            config.readOracleRunConfig(),
            property,
          )
        else if (made.call === `fix seed`) options = { ...options, seed: 42 }
        else config.oracleRoute(config.oracleRouteOf(options))
    }
    if (runner === `own`) {
      make()
      observe(`campaign 0`, route)
      return
    }
    let campaign = 0
    await runOracleCampaign(campaignPrefix, [], () => {
      make()
      observe(`campaign ${campaign++}`, route)
    })
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
const builtInRunner = `options built inside a runner's campaign`
const routeOfFixedSeed = `the route of options whose seed the test fixed`
const runnerReplay = `a runner's replay`

oracleProperty<History, Array<string | null>>({
  id: `self-oracle.route`,
  law: {
    statement: `The route registered when a campaign runs describes that campaign in the one route vocabulary: the runner's own, the route of the options it runs with, or the last one the test named; building options registers none, and every runner attributes a seed-only and a path replay alike.`,
    authority: `the gap report's route contract (OracleRoute in packages/oracles/src/oracle-route.ts); coordinator decisions for TanStack/oracles#1, 2026-11-08 (findings F2, R1b-4, R1b-7, R1b-8)`,
    limits: `A named route a caller registers is taken as its claim; oracleProperty's own routes are owned by the self-oracle's route law.`,
    owner: `oracleProperty framework`,
  },
  histories: {
    arbitrary: history,
    runs: 100,
    fixedSeeds: [20261108],
    states: [builtAfterRoute, builtInRunner, routeOfFixedSeed, runnerReplay],
    fixed: [
      // A fixed-seed campaign that built random options, then registered its
      // route, then built options again for a second assertion.
      {
        name: `options built after the test registered fixed seed`,
        history: {
          runner: `own`,
          replay: `none`,
          calls: [
            { call: `route`, route: `fixed seed` },
            { call: `property options` },
          ],
        },
        enters: [builtAfterRoute],
      },
      // runOracleCampaign attributed a path replay to `fixed seed`, and
      // oracleProperty to `fixed history`.
      {
        name: `a runner's path replay is a fixed history`,
        history: {
          runner: `runOracleCampaign`,
          replay: `path`,
          calls: [],
        },
        enters: [runnerReplay],
      },
      {
        name: `options with a seed the test fixed`,
        history: {
          runner: `own`,
          replay: `none`,
          calls: [
            { call: `property options` },
            { call: `fix seed` },
            { call: `route of options` },
          ],
        },
        enters: [routeOfFixedSeed],
      },
    ],
    constructed: [
      {
        name: builtAfterRoute,
        enters: [builtAfterRoute],
        build: (generated): History => ({
          ...generated,
          runner: `own`,
          calls: [
            { call: `route`, route: `fixed seed` },
            { call: `random parameters` },
            ...generated.calls.slice(0, 2),
          ],
        }),
      },
      {
        name: builtInRunner,
        enters: [builtInRunner],
        build: (generated): History => ({
          ...generated,
          runner: `runOracleCampaign`,
          calls: [{ call: `property options` }, ...generated.calls.slice(0, 3)],
        }),
      },
      {
        name: routeOfFixedSeed,
        enters: [routeOfFixedSeed],
        build: (generated): History => ({
          ...generated,
          calls: [
            { call: `random parameters` },
            { call: `fix seed` },
            { call: `route of options` },
            ...generated.calls.slice(0, 1),
          ],
        }),
      },
      {
        name: runnerReplay,
        enters: [runnerReplay],
        build: (generated): History => ({
          ...generated,
          runner: `runOracleCampaign`,
          replay: generated.replay === `none` ? `path` : generated.replay,
        }),
      },
    ],
  },
  model: owedRoutes,
  reached: ({ runner, replay, calls }) => {
    const firstRoute = calls.findIndex((made) => made.call === `route`)
    const builds = calls.map(
      (made) =>
        made.call === `property options` || made.call === `random parameters`,
    )
    const firstBuild = builds.indexOf(true)
    const fixedAt = calls.findIndex((made) => made.call === `fix seed`)
    return [
      ...(runner === `own` &&
      firstRoute >= 0 &&
      builds.some((built, at) => built && at > firstRoute)
        ? [builtAfterRoute]
        : []),
      ...(runner === `runOracleCampaign` && firstBuild >= 0
        ? [builtInRunner]
        : []),
      ...(firstBuild >= 0 &&
      fixedAt > firstBuild &&
      calls.some((made, at) => made.call === `route of options` && at > fixedAt)
        ? [routeOfFixedSeed]
        : []),
      ...(runner === `runOracleCampaign` && replay !== `none`
        ? [runnerReplay]
        : []),
    ]
  },
  driver: driveRoutes,
  check: checkRoutes,
})
