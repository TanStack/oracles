// The browser-safe entry, `@tanstack/oracles/declaration`. It holds only
// declareOracle, which has no run-time effect: a module that runs in a browser
// or a native app declares its oracle's parts through it without loading the
// Node-only replay machinery of the main entry.
export { declareOracle } from './oracle-declaration.js'
