// The prefix of the environment variables that select a replay and scale the
// run budgets. `configureOracles` sets it, and the default is `ORACLE`, so
// `ORACLE_SEED` selects a replay unless a project names another prefix.
//
// It lives in its own module so that the replay witness and the property
// constructor can name their variables without importing the configuration,
// which imports them.
let envPrefix = `ORACLE`

export function setOracleEnvPrefix(prefix: string): void {
  envPrefix = prefix
}

/** The name of one oracle environment variable, such as `SEED`. */
export function oracleEnvName(setting: string): string {
  return `${envPrefix}_${setting}`
}
