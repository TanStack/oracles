import {
  assertRegisteredIn,
  changesReadSelection,
  defaultOracleSettings,
  installOracleSettings,
  oracleDefaultsRead,
  oracleSettings,
  readRunConfig,
  replayConfig,
} from './oracle-environment.js'
import { oracleReplayReporter } from './oracle-replay-witness.js'
import { oracleFixedSeed } from './oracle-route.js'
import type { fixedSeedKey } from './oracle-route.js'
import type {
  OracleReplayConfig,
  OracleSettings,
} from './oracle-environment.js'

type OracleEnvironment = Record<string, string | undefined>

export type { OracleReplayConfig } from './oracle-environment.js'

export { oracleFixedSeed, oracleRoute, oracleRouteOf } from './oracle-route.js'
export type { OracleRoute } from './oracle-route.js'

/**
 * The options of `configureOracles`, which a project calls once, before its
 * oracles run. Each is optional, and the defaults accept every property id
 * under the `ORACLE` prefix.
 */
export interface OracleConfigurationOptions {
  /**
   * The prefix of every oracle environment variable: `${envPrefix}_SEED`,
   * `${envPrefix}_PATH`, `${envPrefix}_PROPERTY`,
   * `${envPrefix}_RUNS_MULTIPLIER`, `${envPrefix}_CALIBRATION`,
   * `${envPrefix}_REPLAY_WITNESS`, and `${envPrefix}_REPLAY_WITNESS_MODE`. A project with its own prefix keeps its
   * variable names by passing it here.
   *
   * Three names stay fixed whatever the prefix, because tooling reads them
   * across projects rather than a project setting them: `ORACLE_MANIFEST`
   * (a collect-only run records each registration there), and the
   * `ORACLE_SEED` and `ORACLE_REACH` tags that campaigns print in their logs.
   * `runOracleCampaign` names its variables from the prefix its caller
   * passes, so a package's own campaigns stay apart from the project's
   * replay selection.
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

/**
 * Sets the environment prefix, the property registry, and the retired
 * variables for this process, and reads the replay environment under them. A
 * malformed replay environment throws here, so a project that configures its
 * oracles at import fails at import. Everything is checked before anything
 * changes: a call that throws leaves the previous configuration in place. A
 * project calls it before its oracles read their configuration; a first call
 * that changes the defaults after an oracle read them throws. Every read
 * counts: a replay selection, a registry check (an `oracleProperty`
 * registration makes one), and a variable name. Once an oracle read the
 * replay selection, a call that would change it throws (maintainer decision,
 * 2026-11-08); a later call that keeps it replaces the rest of the
 * configuration.
 */
export function configureOracles({
  envPrefix = `ORACLE`,
  registry: propertyIds,
  retiredVariables: retired = [],
}: OracleConfigurationOptions = {}): void {
  if (envPrefix === ``) {
    throw new Error(`configureOracles: envPrefix must be non-empty`)
  }
  const candidate: OracleSettings = {
    prefix: envPrefix,
    registry:
      propertyIds === undefined
        ? undefined
        : validateOraclePropertyRegistry([...propertyIds]),
    retired: [...retired],
  }
  const replay = readRunConfig(process.env, candidate)
  const changesDefaults =
    candidate.prefix !== defaultOracleSettings.prefix ||
    candidate.registry !== undefined ||
    candidate.retired.length > 0
  if (oracleDefaultsRead() && changesDefaults) {
    throw new Error(
      `configureOracles must run before oracles read their configuration: ` +
        `an oracle already read the defaults (prefix ${defaultOracleSettings.prefix}). ` +
        `Call it before importing the modules that define oracles.`,
    )
  }
  if (changesReadSelection(replay)) {
    throw new Error(
      `configureOracles would change the replay selection that oracles already read; ` +
        `tests stood aside, or ran, by that selection. Configure once, before any oracle runs.`,
    )
  }
  installOracleSettings(candidate, replay)
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
  assertRegisteredIn(oracleSettings(), property)
}

/**
 * The replay selection and run multiplier. Without an environment, the ones
 * the configuration read, which every replay condition uses; with one, that
 * environment's, read under the configuration in force. The result is a
 * frozen copy, so no caller can change what the replay conditions read.
 */
export function readOracleRunConfig(
  environment?: OracleEnvironment,
): Readonly<OracleReplayConfig & { multiplier: number }> {
  const { multiplier, campaignSeed, replayPath, replayProperty } =
    environment === undefined
      ? replayConfig()
      : readRunConfig(environment, oracleSettings())
  return Object.freeze({ multiplier, campaignSeed, replayPath, replayProperty })
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
  /** A seed declared fixed, which `oracleRouteOf` reads. */
  [fixedSeedKey]?: number
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
  // Building parameters registers no route: a caller may still change them.
  // A seed from the replay environment is declared fixed; a drawn one is not,
  // so `oracleRouteOf` names the route of what finally runs.
  const parameters: OracleRunParameters =
    campaignSeed === undefined
      ? { numRuns, seed: selectedSeed }
      : {
          ...oracleFixedSeed(campaignSeed),
          numRuns,
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
    : withOracleFixedHistories(parameters, examples)
}

/**
 * Run parameters with examples added. fast-check runs the examples first and
 * counts them in numRuns, so they come on top of the random runs: the
 * examples never displace one. A path replay runs one recorded history, which
 * can be an example.
 */
export function withOracleFixedHistories<
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
  return replayConfig().replayPath !== undefined
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
    replayConfig().replayPath !== undefined &&
    (replayConfig().replayProperty === undefined ||
      !properties.includes(replayConfig().replayProperty!))
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
    (oracleReplayRequested() && replayConfig().calibration !== fault)
  return standsAside ? (registration.skip as TRegistration) : registration
}

/** Keeps ordinary CI bounded while allowing long randomized oracle campaigns. */
export function oracleRuns(baseRuns: number): number {
  return baseRuns * replayConfig().multiplier
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
    replayConfig(),
    property,
    examples,
  )
}
