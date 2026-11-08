/**
 * # A test's route describes the campaign that runs
 *
 * The gap report counts a mutant's kill only on a reproducible route (a
 * fixed seed, a fixed history, an enumerated case), so each test registers
 * the route of the campaign it runs through `globalThis.__oracleRoute`, and
 * the last registration wins. The law: the route registered when a campaign
 * runs describes that campaign, whatever order the test calls the framework's
 * helpers in.
 *
 * - The campaign runners register their own campaigns' routes:
 *   `runOracleCampaign` registers `fixed seed` for its fixed-seed and replay
 *   campaigns and `random seed` for its random one, before it calls the
 *   campaign. (`oracleProperty` registers its tests' routes too; the
 *   self-oracle's `route` law owns those, because they run under Vitest.)
 * - A test that runs its own fast-check campaign says which one with
 *   `oracleRoute`.
 * - Building options registers nothing. `oraclePropertyOptions` and
 *   `oracleRandomParameters` return parameters that a caller may still
 *   change, such as a seed it sets for a fixed-seed campaign, so a route they
 *   registered could describe a campaign that never runs, and would replace
 *   the caller's own registration when called after it.
 *
 * History: either a test's own campaign (a sequence of calls: register a
 * route, build property options, or build random parameters) or a
 * `runOracleCampaign` call whose campaigns make such calls, under an
 * environment with no replay or a path replay of the test's property. The
 * model owes the route in force when each campaign would run: the runner's,
 * then the last route the test registered itself. The driver records the
 * route at that point.
 *
 * Limits: the route values a caller registers are taken as its claim; the
 * framework cannot check that a caller's own `oracleRoute` is true.
 */
import fc from 'fast-check'
import { vi } from 'vitest'
import { differs, oracleProperty, pass } from '../src/index.js'
import type { Observation } from '../src/index.js'

type Route = `fixed seed` | `fixed history` | `random seed` | `case`
type Call =
  | { call: `route`; route: Route }
  | { call: `property options` }
  | { call: `random parameters` }
type History = {
  runner: `own` | `runOracleCampaign`
  replay: boolean
  calls: Array<Call>
}

const call: fc.Arbitrary<Call> = fc.oneof(
  fc.record({
    call: fc.constant(`route` as const),
    route: fc.constantFrom<Route>(
      `fixed seed`,
      `fixed history`,
      `random seed`,
      `case`,
    ),
  }),
  fc.record({ call: fc.constant(`property options` as const) }),
  fc.record({ call: fc.constant(`random parameters` as const) }),
)
const history: fc.Arbitrary<History> = fc.record({
  runner: fc.constantFrom(`own` as const, `runOracleCampaign` as const),
  replay: fc.boolean(),
  calls: fc.array(call, { maxLength: 4 }),
})

// The route in force when each campaign runs: the runner's, then the test's
// own registrations. Building options changes nothing.
function owedRoutes({ runner, replay, calls }: History): Array<string | null> {
  const after = (start: string | null) =>
    calls.reduce(
      (route, made) => (made.call === `route` ? made.route : route),
      start,
    )
  if (runner === `own`) return [after(null)]
  return (replay ? [`fixed seed`] : [`fixed seed`, `random seed`]).map(after)
}

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
    // A path replay of this test's property: the project's selection for the
    // test's own campaign, the runner's prefix for runOracleCampaign.
    if (replay)
      Object.assign(
        process.env,
        runner === `own`
          ? { ORACLE_SEED: `1`, ORACLE_PATH: `0`, ORACLE_PROPERTY: property }
          : {
              [`${campaignPrefix}_SEED`]: `1`,
              [`${campaignPrefix}_PATH`]: `0`,
            },
      )
    vi.resetModules()
    const config = await import(`../src/oracle-config.js`)
    const { runOracleCampaign } = await import(`../src/oracle-campaign.js`)
    const make = () => {
      for (const made of calls)
        if (made.call === `route`) config.oracleRoute(made.route)
        else if (made.call === `property options`)
          config.oraclePropertyOptions(10, property)
        else
          config.oracleRandomParameters(
            10,
            config.readOracleRunConfig(),
            property,
          )
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

oracleProperty({
  id: `self-oracle.route`,
  law: {
    statement: `The route registered when a campaign runs describes that campaign: the runner's own, or the last one the test registered; building options registers none.`,
    authority: `the gap report's route contract (globalThis.__oracleRoute in packages/oracles/src/oracle-property.ts; oracleRoute in oracle-config.ts); coordinator decision for TanStack/oracles#1, 2026-11-08 (finding F2)`,
    limits: `A caller's own route is taken as its claim; oracleProperty's own routes are owned by the self-oracle's route law.`,
    owner: `oracleProperty framework`,
  },
  histories: {
    arbitrary: history,
    runs: 100,
    fixedSeeds: [20261108],
    states: [builtAfterRoute, builtInRunner],
    fixed: [
      // A fixed-seed campaign that built random options, then registered its
      // route, then built options again for a second assertion.
      {
        name: `options built after the test registered fixed seed`,
        history: {
          runner: `own`,
          replay: false,
          calls: [
            { call: `route`, route: `fixed seed` },
            { call: `property options` },
          ],
        },
        enters: [builtAfterRoute],
      },
    ],
    constructed: [
      {
        name: builtAfterRoute,
        enters: [builtAfterRoute],
        build: (generated) => ({
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
        build: (generated) => ({
          ...generated,
          runner: `runOracleCampaign`,
          calls: [{ call: `property options` }, ...generated.calls.slice(0, 3)],
        }),
      },
    ],
  },
  model: owedRoutes,
  reached: ({ runner, calls }) => {
    const firstRoute = calls.findIndex((made) => made.call === `route`)
    const builds = calls.map((made) => made.call !== `route`)
    return [
      ...(runner === `own` &&
      firstRoute >= 0 &&
      builds.some((built, at) => built && at > firstRoute)
        ? [builtAfterRoute]
        : []),
      ...(runner === `runOracleCampaign` && builds.some(Boolean)
        ? [builtInRunner]
        : []),
    ]
  },
  driver: driveRoutes,
  check: checkRoutes,
})
