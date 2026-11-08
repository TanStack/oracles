/**
 * Routes: which kind of campaign a test runs, for the gap report, which counts
 * a mutant's kill only on a reproducible route. Every runner and every
 * `oracleRoute` call uses one vocabulary:
 *
 * - `fixed seed`: a campaign whose seed was declared fixed: by
 *   `oracleFixedSeed`, by a runner's fixed-seed campaign, or by a replay
 *   environment's seed.
 * - `fixed history`: one written or recorded history, a path replay included.
 * - `case`: one enumerated history.
 * - `random seed`: any other campaign.
 * - `calibration`: a check of the property itself: a calibration, a probe
 *   calibration, or the determinism test.
 *
 * The first three are reproducible. A route never claims more than its
 * campaign has: where the framework cannot know that a seed is fixed, it says
 * `random seed`, which undercounts kills but never counts one it cannot
 * reproduce. A test registers its route before its campaign runs, and the
 * last registration wins.
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
 * The key under which parameters carry the seed they declared fixed. A
 * registered symbol: a spread keeps it, a second copy of this module reads
 * it, and fast-check ignores it. Rebuilding the parameters field by field,
 * a JSON round trip, or a structured clone drops it, and the parameters then
 * read as `random seed`.
 */
export const fixedSeedKey: unique symbol = Symbol.for(
  `@tanstack/oracles/fixed-seed`,
)

/**
 * Parameters that run with `seed`, declared fixed, so `oracleRouteOf` names
 * them `fixed seed`; the rest of `parameters` is kept. A seed set any other
 * way reads as `random seed`.
 */
export function oracleFixedSeed<TParameters extends object = object>(
  seed: number,
  parameters?: TParameters,
): TParameters & { seed: number; [fixedSeedKey]: number } {
  return { ...(parameters as TParameters), seed, [fixedSeedKey]: seed }
}

/** Registers the running test's route for the gap report. */
export function oracleRoute(route: OracleRoute): void {
  globalThis.__oracleRoute?.(route)
}

/**
 * The route of a campaign that runs with these fast-check parameters, the
 * one classifier every runner uses: `fixed history` with a seed and a path;
 * `fixed seed` when they carry the declaration of the seed they run with;
 * `random seed` otherwise. A test that runs its own campaign registers
 * `oracleRoute(oracleRouteOf(parameters))` with the parameters it passes.
 */
export function oracleRouteOf(parameters: {
  seed?: number
  path?: string
}): OracleRoute {
  if (parameters.seed === undefined) return `random seed`
  if (parameters.path !== undefined) return `fixed history`
  const declared = (parameters as { [fixedSeedKey]?: number })[fixedSeedKey]
  return parameters.seed === declared ? `fixed seed` : `random seed`
}
