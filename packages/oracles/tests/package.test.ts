import { describe, expect, it } from 'vitest'
import * as oracles from '../src/index'
import * as declaration from '../src/declaration'

// The public surface, as a consumer imports it. An added or removed export
// changes this list on purpose.
describe(`@tanstack/oracles`, () => {
  it(`exports the framework's parts, configuration, failure fidelity, and replay witness`, () => {
    expect(Object.keys(oracles).sort()).toEqual(
      [
        `OracleCheckpointFailure`,
        `OracleFailureReport`,
        `OracleViolation`,
        `assertRegisteredOracleProperty`,
        `atOracleCheckpoint`,
        `configureOracles`,
        `createOracleFailureFidelity`,
        `createOracleReach`,
        `declareOracle`,
        `differs`,
        `forwardCut`,
        `oracleCalibrationTest`,
        `oracleCampaignSeed`,
        `oracleProperty`,
        `oracleRandomParameters`,
        `oracleReplayRequested`,
        `oracleReplaySkips`,
        `oracleReplayReporter`,
        `oracleReplayTest`,
        `oracleRoute`,
        `oracleRuns`,
        `oraclePropertyOptions`,
        `pass`,
        `readOracleRunConfig`,
        `recordOracleFiniteReplay`,
        `recordOracleReplay`,
        `runOracleCampaign`,
        `scheduleFrom`,
        `useOracleClock`,
        `validateOraclePropertyRegistry`,
        `violation`,
        `withOracleFixedHistories`,
        `withinTurns`,
      ].sort(),
    )
  })

  it(`offers the main entry as ES modules only`, async () => {
    // The main entry imports Vitest, which refuses require(), so a CommonJS
    // condition would only advertise a build that cannot load.
    const { default: manifest } = await import(`../package.json`, {
      with: { type: `json` },
    })
    expect(Object.keys(manifest.exports[`.`])).toEqual([`import`])
    expect(manifest.main).toBe(manifest.module)
  })

  it(`exports only declareOracle from the browser-safe declaration entry`, () => {
    expect(Object.keys(declaration)).toEqual([`declareOracle`])
    expect(declaration.declareOracle).toBe(oracles.declareOracle)
  })
})
