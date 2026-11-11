// The main entry: the oracle framework for a Vitest project. Its parts are
// oracleProperty, which takes an oracle's check, model, history grammar, and
// owned code, the configuration functions, failure fidelity, and the
// controlled clock. A browser or native module that only registers its
// routes imports `@tanstack/oracles/route` instead, which loads none of this
// entry's Node built-ins.
export * from './oracle-property.js'
export * from './oracle-config.js'
export * from './oracle-failure-fidelity.js'
export * from './oracle-replay-witness.js'
