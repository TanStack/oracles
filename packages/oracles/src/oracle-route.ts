/**
 * Routes: which kind of campaign a test runs, for the gap report, which counts
 * a mutant's kill only on a reproducible route. Every runner and every
 * `oracleRoute` call uses one vocabulary:
 *
 * - `fixed seed`: a campaign whose seed is fixed in code, or comes from the
 *   replay environment without a path (a reseeded campaign).
 * - `fixed history`: one written or recorded history, a path replay included.
 * - `case`: one enumerated history.
 * - `random seed`: a campaign whose seed the framework drew, or one that
 *   names no seed, so fast-check draws it.
 * - `calibration`: a check of the property itself: a calibration, a probe
 *   calibration, or the determinism test.
 *
 * The first three are reproducible. A test registers its route before its
 * campaign runs, and the last registration wins.
 *
 * This module imports nothing, so the browser-safe `./declaration` entry
 * exports it, and a module bundled into a browser or a native webview can
 * register its routes.
 */
export type OracleRoute =
  `fixed seed` | `fixed history` | `case` | `random seed` | `calibration`

declare global {
  // Installed by the gap report's test setup, absent otherwise. Each
  // registered test reports its route before it runs.
  var __oracleRoute: ((route: OracleRoute) => void) | undefined
}

/**
 * The key under which the options builders record a seed they drew. A
 * registered symbol, so it survives a spread and a second copy of this module
 * reads it, and fast-check ignores it.
 */
export const drawnSeedKey: unique symbol = Symbol.for(
  `@tanstack/oracles/drawn-seed`,
)

/** Registers the running test's route for the gap report. */
export function oracleRoute(route: OracleRoute): void {
  globalThis.__oracleRoute?.(route)
}

/**
 * The route of a campaign that runs with these fast-check parameters:
 * `fixed history` with a path; `random seed` when they name no seed, or the
 * seed an options builder drew for them; `fixed seed` otherwise, as for a
 * seed the caller set. A test that runs its own campaign registers
 * `oracleRoute(oracleRouteOf(parameters))` with the parameters it passes.
 */
export function oracleRouteOf(parameters: {
  seed?: number
  path?: string
}): OracleRoute {
  if (parameters.path !== undefined) return `fixed history`
  const drawn = (parameters as { [drawnSeedKey]?: number })[drawnSeedKey]
  return parameters.seed === undefined || parameters.seed === drawn
    ? `random seed`
    : `fixed seed`
}
