// The main entry: the oracle framework for a Vitest project. Its parts are
// oracleProperty and its check, model, and history grammar (declared with
// declareOracle), createOracleReach for declared reach, runOracleCampaign for
// fixed and random campaigns, the configuration functions, failure fidelity,
// and the controlled clock. A browser or native module that only declares its
// parts imports `@tanstack/oracles/declaration` instead, which loads none of
// this entry's Node built-ins.
export * from './oracle-property.js'
export * from './oracle-reach.js'
export * from './oracle-campaign.js'
export * from './oracle-config.js'
export * from './oracle-failure-fidelity.js'
export * from './oracle-replay-witness.js'
export { declareOracle } from './oracle-declaration.js'
