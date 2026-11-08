// The configuration in force: the prefix of the environment variables that
// select a replay and scale the run budgets, the property registry, and the
// retired replay variables. `configureOracles` replaces it whole, and the
// default prefix is `ORACLE`, so `ORACLE_SEED` selects a replay unless a
// project names another prefix.
//
// It is the only copy of the configuration. It lives in its own module so
// that the replay witness and the property constructor can read it without
// importing the configuration module, which imports them.

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

/** Puts a checked configuration in force. */
export function installOracleSettings(next: OracleSettings): void {
  settings = next
  configured = true
}

/** The name of one oracle environment variable, such as `SEED`. */
export function oracleEnvName(setting: string): string {
  return `${oracleSettings().prefix}_${setting}`
}
