// The browser-safe entry, `@tanstack/oracles/route`. It holds the route
// helpers, which import nothing: a module that runs in a browser or a native
// app registers its routes through it without loading the Node-only replay
// machinery of the main entry.
export { oracleFixedSeed, oracleRoute, oracleRouteOf } from './oracle-route.js'
export type { OracleRoute } from './oracle-route.js'
