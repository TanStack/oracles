import { oracleEnvName, setOracleEnvPrefix } from './oracle-environment.js'
import { oracleReplayReporter } from './oracle-replay-witness.js'

export { recordOracleReplay } from './oracle-replay-witness.js'

type OracleEnvironment = Record<string, string | undefined>

/**
 * The options of `configureOracles`, which a project calls once, before its
 * oracles run. Each is optional, and the defaults accept every property id
 * under the `ORACLE` prefix.
 */
export interface OracleConfigurationOptions {
  /**
   * The prefix of every oracle environment variable: `${envPrefix}_SEED`,
   * `${envPrefix}_PATH`, `${envPrefix}_PROPERTY`,
   * `${envPrefix}_RUNS_MULTIPLIER`, `${envPrefix}_CALIBRATION`, and
   * `${envPrefix}_REPLAY_WITNESS`. A project with its own prefix keeps its
   * variable names by passing it here.
   */
  envPrefix?: string
  /**
   * The property ids that a project's oracles may name. A replay of an id
   * outside the registry, or a property that declares one, fails. Without a
   * registry, every id is accepted.
   */
  registry?: Iterable<string>
  /**
   * Replay variables that an earlier version of a project read. Nothing reads
   * them now, so a command that still sets one would run the full campaigns
   * and appear to pass. Reading the config rejects them instead.
   */
  retiredVariables?: Iterable<string>
}

let registry: ReadonlySet<string> | undefined
let retiredVariables: ReadonlyArray<string> = []

export type OracleReplayConfig = {
  campaignSeed: number | undefined
  replayPath: string | undefined
  replayProperty: string | undefined
}

// The replay environment under the default configuration, read when this
// module loads, so a malformed environment fails at import. A variable
// initializer rather than a bare call: `sideEffects` is false, so a bundler
// may drop a bare call, but it keeps a variable that the exports read.
let configuredReplay: OracleReplayConfig & { multiplier: number } =
  readOracleRunConfig()

/**
 * Sets the environment prefix, the property registry, and the retired
 * variables for this process, then reads the replay environment under them. A
 * malformed replay environment throws here, so a project that configures its
 * oracles at import fails at import. A second call replaces the first.
 */
export function configureOracles({
  envPrefix = `ORACLE`,
  registry: propertyIds,
  retiredVariables: retired = [],
}: OracleConfigurationOptions = {}): void {
  if (envPrefix === ``) {
    throw new Error(`configureOracles: envPrefix must be non-empty`)
  }
  // Validate the registry before any state changes, so a bad one leaves the
  // previous configuration in place.
  const ids =
    propertyIds === undefined
      ? undefined
      : validateOraclePropertyRegistry([...propertyIds])
  setOracleEnvPrefix(envPrefix)
  registry = ids
  retiredVariables = [...retired]
  configuredReplay = readOracleRunConfig()
}

export function validateOraclePropertyRegistry(
  properties: ReadonlyArray<string>,
): ReadonlySet<string> {
  const registered = new Set<string>()
  for (const property of properties) {
    if (registered.has(property)) {
      throw new Error(`duplicate oracle property: ${property}`)
    }
    registered.add(property)
  }
  return registered
}

export function assertRegisteredOracleProperty(property: string): void {
  if (registry !== undefined && !registry.has(property)) {
    throw new Error(`unknown oracle property: ${property}`)
  }
}

export function readOracleRunConfig(
  environment: OracleEnvironment = process.env,
): OracleReplayConfig & { multiplier: number } {
  const seedName = oracleEnvName(`SEED`)
  const pathName = oracleEnvName(`PATH`)
  const propertyName = oracleEnvName(`PROPERTY`)
  const multiplierName = oracleEnvName(`RUNS_MULTIPLIER`)
  const retired = retiredVariables.filter(
    (variable) => environment[variable] !== undefined,
  )
  if (retired.length > 0) {
    throw new Error(
      `Retired oracle replay variables are set: ${retired.join(`, `)}. ` +
        `Use ${seedName}, ${pathName}, and ` +
        `${propertyName} to select a replay, and ` +
        `${multiplierName} to scale run counts.`,
    )
  }
  const multiplierValue = environment[multiplierName] ?? `1`
  const multiplier = Number(multiplierValue)
  if (
    multiplierValue.trim() === `` ||
    !Number.isSafeInteger(multiplier) ||
    multiplier < 1
  ) {
    throw new Error(`${multiplierName} must be a positive integer`)
  }

  const seedValue = environment[seedName]
  const replayPath = environment[pathName]
  const replayProperty = environment[propertyName]
  if (seedValue === undefined) {
    if (replayPath !== undefined) {
      throw new Error(`${pathName} requires ${seedName}`)
    }
    if (replayProperty !== undefined) {
      throw new Error(`${propertyName} requires ${pathName}`)
    }
    return {
      multiplier,
      campaignSeed: undefined,
      replayPath: undefined,
      replayProperty: undefined,
    }
  }

  const campaignSeed = Number(seedValue)
  if (seedValue.trim() === `` || !Number.isSafeInteger(campaignSeed)) {
    throw new Error(`${seedName} must be an integer`)
  }
  if (replayPath === undefined) {
    if (replayProperty !== undefined) {
      throw new Error(`${propertyName} requires ${pathName}`)
    }
    return {
      multiplier,
      campaignSeed,
      replayPath: undefined,
      replayProperty: undefined,
    }
  }
  if (replayPath.trim() === ``) {
    throw new Error(`${pathName} must be non-empty`)
  }
  if (!/^\d+(?::\d+)*$/.test(replayPath)) {
    throw new Error(
      `${pathName} must contain colon-separated nonnegative integers`,
    )
  }
  if (replayProperty === undefined || replayProperty.trim() === ``) {
    throw new Error(`${pathName} requires ${propertyName}`)
  }
  assertRegisteredOracleProperty(replayProperty)
  return { multiplier, campaignSeed, replayPath, replayProperty }
}

/**
 * Select a fresh campaign seed unless the caller supplied one. Report the
 * selection before fast-check runs: a later reach failure is outside its
 * reporter and must still be replayable. This line records selection, not
 * execution; guarded replay witnesses remain the execution evidence.
 */
export function oracleCampaignSeed(
  seed: number | undefined,
  property: string | undefined,
): number {
  const selected = seed ?? Math.floor(Math.random() * 0x100000000) - 0x80000000
  console.info(
    `ORACLE_SEED ${JSON.stringify({ property: property ?? null, seed: selected })}`,
  )
  return selected
}

type OracleRunParameters = {
  numRuns: number
  seed?: number
  path?: string
} & ReturnType<typeof oracleReplayReporter>

// fast-check infers a property's argument types from `examples` too, so only
// a call with examples returns them. `ReturnType` reads the last overload,
// the one without examples.
export function oracleRandomParameters<TExample>(
  numRuns: number,
  replay: OracleReplayConfig | number | undefined,
  property: string | undefined,
  examples: ReadonlyArray<TExample>,
): OracleRunParameters & { examples: Array<TExample> }
export function oracleRandomParameters(
  numRuns: number,
  replay: OracleReplayConfig | number | undefined,
  property?: string,
): OracleRunParameters
export function oracleRandomParameters<TExample>(
  numRuns: number,
  replay: OracleReplayConfig | number | undefined,
  property?: string,
  examples?: ReadonlyArray<TExample>,
): OracleRunParameters & { examples?: Array<TExample> } {
  return randomParameters(numRuns, replay, property, examples)
}

function randomParameters<TExample>(
  numRuns: number,
  replay: OracleReplayConfig | number | undefined,
  property: string | undefined,
  examples: ReadonlyArray<TExample> | undefined,
): OracleRunParameters & { examples?: Array<TExample> } {
  if (property !== undefined) assertRegisteredOracleProperty(property)
  const { campaignSeed, replayPath, replayProperty } =
    typeof replay === `object`
      ? replay
      : {
          campaignSeed: replay,
          replayPath: undefined,
          replayProperty: undefined,
        }
  const selectedSeed = oracleCampaignSeed(campaignSeed, property)
  // These are a random campaign's parameters; a path replay runs one
  // recorded history. The gap report reads the route only from a test that
  // builds its parameters while it runs, so a campaign whose parameters are
  // built when its file loads keeps an unknown route.
  globalThis.__oracleRoute?.(
    property !== undefined &&
      replayPath !== undefined &&
      replayProperty === property
      ? `fixed history`
      : `random seed`,
  )
  const parameters: OracleRunParameters =
    campaignSeed === undefined
      ? { numRuns, seed: selectedSeed }
      : {
          numRuns,
          seed: campaignSeed,
          // A path replays one recorded counterexample, so the replay runs
          // once. From a path with one segment, fast-check would otherwise
          // run `numRuns` histories that start at that index.
          ...(property !== undefined &&
          replayPath !== undefined &&
          replayProperty === property
            ? {
                numRuns: 1,
                path: replayPath,
                ...oracleReplayReporter(property, campaignSeed, replayPath),
              }
            : {}),
        }
  return examples === undefined
    ? parameters
    : withOracleExamples(parameters, examples)
}

/**
 * Run parameters with examples added. fast-check runs the examples first and
 * counts them in numRuns, so they come on top of the random runs: the
 * examples never displace one. A path replay runs one recorded history, which
 * can be an example.
 */
export function withOracleExamples<
  TParameters extends { numRuns: number; path?: string },
  TExample,
>(
  parameters: TParameters,
  examples: ReadonlyArray<TExample>,
): TParameters & { examples: Array<TExample> } {
  return {
    ...parameters,
    examples: [...examples],
    numRuns:
      parameters.path === undefined
        ? parameters.numRuns + examples.length
        : parameters.numRuns,
  }
}

/**
 * Replay selection.
 *
 * A path replay runs one property's recorded history. Every other test
 * stands aside, so the replay reports only that history. A seed without a
 * path only reseeds the random campaigns, so every test still runs. These
 * helpers are the only replay conditions that the `oracle/no-disabled` lint
 * rule accepts. Each is false in an ordinary run, so no replay selection can
 * switch an oracle test off there.
 */

/** Whether a path replay is selected. */
export function oracleReplayRequested(): boolean {
  return configuredReplay.replayPath !== undefined
}

/**
 * Whether a path replay of a property outside `properties` is selected. A
 * test that serves several properties' replays passes all of them.
 */
export function oracleReplaySkips(
  ...properties: ReadonlyArray<string>
): boolean {
  for (const property of properties) assertRegisteredOracleProperty(property)
  return (
    configuredReplay.replayPath !== undefined &&
    (configuredReplay.replayProperty === undefined ||
      !properties.includes(configuredReplay.replayProperty))
  )
}

/**
 * The registration to use for a test that stands aside during another
 * test's replay: its `skip` form while that replay runs, and itself
 * otherwise. Without `properties`, the test stands aside during every path
 * replay. With them, it runs only when no path replay is selected or the
 * replay selects one of them.
 */
export function oracleReplayTest<TRegistration extends { skip: unknown }>(
  registration: TRegistration,
  ...properties: ReadonlyArray<string>
): TRegistration {
  const standsAside =
    properties.length === 0
      ? oracleReplayRequested()
      : oracleReplaySkips(...properties)
  // `skip` registers through the same API, so it has the registration's type.
  return standsAside ? (registration.skip as TRegistration) : registration
}

/**
 * The registration for a calibration witness. During a path replay of
 * `property`, the calibration variable selects a mutant that the main
 * property runs against, and the witness for that `fault` checks the
 * failure. The witness runs in ordinary runs and in that calibration replay.
 * It stands aside during every other path replay, where it has nothing to
 * check.
 */
export function oracleCalibrationTest<TRegistration extends { skip: unknown }>(
  registration: TRegistration,
  property: string,
  fault: string,
): TRegistration {
  const standsAside =
    oracleReplaySkips(property) ||
    (oracleReplayRequested() &&
      process.env[oracleEnvName(`CALIBRATION`)] !== fault)
  return standsAside ? (registration.skip as TRegistration) : registration
}

export { declareOracle } from './oracle-declaration.js'

/**
 * Registers the running test's route for the gap report, which counts a
 * verdict as a kill only on a reproducible route: a fixed seed, a fixed
 * history, or an enumerated case. A test that builds its fast-check options
 * when its file loads cannot register them there, so it calls this inside
 * the test: first, or, for a random campaign, in its predicate.
 */
export function oracleRoute(
  route:
    `fixed seed` | `fixed history` | `case` | `random seed` | `calibration`,
): void {
  globalThis.__oracleRoute?.(route)
}

/** Keeps ordinary CI bounded while allowing long randomized oracle campaigns. */
export function oracleRuns(baseRuns: number): number {
  return baseRuns * configuredReplay.multiplier
}

/**
 * Reseeds broad randomized properties when a campaign seed is supplied.
 * `examples` run first in every run, on top of the base runs. A site that
 * spreads these options and sets fast-check's `examples` itself runs them
 * inside the base runs instead, so they displace random histories.
 */
export function oraclePropertyOptions<TExample>(
  baseRuns: number,
  property: string | undefined,
  options: { examples: ReadonlyArray<TExample> },
): OracleRunParameters & { examples: Array<TExample> }
export function oraclePropertyOptions(
  baseRuns: number,
  property?: string,
): OracleRunParameters
export function oraclePropertyOptions<TExample>(
  baseRuns: number,
  property?: string,
  { examples }: { examples?: ReadonlyArray<TExample> } = {},
): OracleRunParameters & { examples?: Array<TExample> } {
  return randomParameters(
    oracleRuns(baseRuns),
    configuredReplay,
    property,
    examples,
  )
}
