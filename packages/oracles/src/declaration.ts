// The browser-safe entry, `@tanstack/oracles/declaration`. It holds
// declareOracle, which has no run-time effect, and the route helpers, which
// import nothing: a module that runs in a browser or a native app declares its
// oracle's parts and registers its routes through it without loading the
// Node-only replay machinery of the main entry.
export { declareOracle } from './oracle-declaration.js'
export { oracleRoute, oracleRouteOf } from './oracle-route.js'
export type { OracleRoute } from './oracle-route.js'
