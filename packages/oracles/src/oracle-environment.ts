// The configuration in force: the prefix of the environment variables that
// select a replay and scale the run budgets, the property registry, and the
// retired replay variables. `configureOracles` replaces it whole, and the
// default prefix is `ORACLE`, so `ORACLE_SEED` selects a replay unless a
// project names another prefix.
//
// It is the only copy of the configuration and of the replay environment
// read under it. It lives in its own module so that the replay witness and
// the property constructor can read them without importing the
// configuration module, which imports them.

type OracleEnvironment = Record<string, string | undefined>

export type OracleSettings = {
  prefix: string
  registry: ReadonlySet<string> | undefined
  retired: ReadonlyArray<string>
}

export const defaultOracleSettings: OracleSettings = {
  prefix: `ORACLE`,
  registry: undefined,
  retired: [],
}

let settings = defaultOracleSettings
// Whether `configureOracles` has run, and whether something read the default
// configuration before it did: a first configuration that changes the
// defaults after that would leave the earlier read wrong.
let configured = false
let readDefaults = false

/**
 * The configuration in force. Every read goes through here, so a read before
 * the first configuration marks the defaults as read.
 */
export function oracleSettings(): OracleSettings {
  if (!configured) readDefaults = true
  return settings
}

/** Whether something read the defaults before any configuration. */
export function oracleDefaultsRead(): boolean {
  return !configured && readDefaults
}

/** Puts a checked configuration, and the replay environment read under it, in force. */
export function installOracleSettings(
  next: OracleSettings,
  replay: RunConfig,
): void {
  settings = next
  configuredReplay = replay
  configured = true
}

/** The name of one oracle environment variable, such as `SEED`. */
export function oracleEnvName(setting: string): string {
  return `${oracleSettings().prefix}_${setting}`
}

export type OracleReplayConfig = {
  campaignSeed: number | undefined
  replayPath: string | undefined
  replayProperty: string | undefined
}

// The replay environment under the current configuration: read by
// `configureOracles`, or, in a project that never configures, on first use.
// Nothing is read at import, so a stray variable under the default prefix
// (SQL*Plus sets `ORACLE_PATH`) cannot break a project with its own prefix.
let configuredReplay: RunConfig | undefined

// The replay environment as read: the replay selection, the run multiplier,
// the calibration variable, which selects a mutant during a replay, and the
// replay witness channel and mode.
export type RunConfig = OracleReplayConfig & {
  multiplier: number
  calibration: string | undefined
  witness: string | undefined
  witnessMode: string | undefined
}

/** The replay environment the configuration read, read now if none did. */
export function replayConfig(): RunConfig {
  return (configuredReplay ??= readRunConfig(process.env, oracleSettings()))
}

export function assertRegisteredIn(
  within: OracleSettings,
  property: string,
): void {
  if (within.registry !== undefined && !within.registry.has(property)) {
    throw new Error(`unknown oracle property: ${property}`)
  }
}

export function readRunConfig(
  environment: OracleEnvironment,
  within: OracleSettings,
): RunConfig {
  const name = (setting: string) => `${within.prefix}_${setting}`
  const seedName = name(`SEED`)
  const pathName = name(`PATH`)
  const propertyName = name(`PROPERTY`)
  const multiplierName = name(`RUNS_MULTIPLIER`)
  const retired = within.retired.filter(
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

  const calibration = environment[name(`CALIBRATION`)]
  const witness = environment[name(`REPLAY_WITNESS`)]
  const witnessMode = environment[name(`REPLAY_WITNESS_MODE`)]
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
      calibration,
      witness,
      witnessMode,
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
      calibration,
      witness,
      witnessMode,
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
  assertRegisteredIn(within, replayProperty)
  return {
    multiplier,
    calibration,
    witness,
    witnessMode,
    campaignSeed,
    replayPath,
    replayProperty,
  }
}
