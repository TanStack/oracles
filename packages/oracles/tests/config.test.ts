import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertRegisteredOracleProperty,
  configureOracles,
  readOracleRunConfig,
} from '../src/index'

// `configureOracles` is process-wide, so each example starts from the default
// configuration and clears the environment it stubbed.
afterEach(() => {
  vi.unstubAllEnvs()
  configureOracles()
})

describe(`configureOracles`, () => {
  it(`names every replay variable under the configured prefix`, () => {
    configureOracles({ envPrefix: `ACME_ORACLE` })
    expect(
      readOracleRunConfig({
        ACME_ORACLE_SEED: `7`,
        ACME_ORACLE_PATH: `1:2`,
        ACME_ORACLE_PROPERTY: `a.b`,
        ACME_ORACLE_RUNS_MULTIPLIER: `3`,
      }),
    ).toEqual({
      multiplier: 3,
      campaignSeed: 7,
      replayPath: `1:2`,
      replayProperty: `a.b`,
    })
  })

  it(`stops reading the default prefix once another is configured`, () => {
    configureOracles({ envPrefix: `ACME_ORACLE` })
    expect(readOracleRunConfig({ ORACLE_SEED: `7` }).campaignSeed).toBe(
      undefined,
    )
  })

  it(`follows the configured prefix for replay selection`, async () => {
    vi.stubEnv(`ACME_ORACLE_SEED`, `1`)
    vi.stubEnv(`ACME_ORACLE_PATH`, `0`)
    vi.stubEnv(`ACME_ORACLE_PROPERTY`, `a.b`)
    vi.resetModules()
    const fresh = await import(`../src/index`)
    fresh.configureOracles({ envPrefix: `OTHER_ORACLE` })
    fresh.configureOracles({ envPrefix: `ACME_ORACLE` })
    expect(fresh.oracleReplayRequested()).toBe(true)
  })

  // Tests already stood aside, or did not, by the selection they read
  // (maintainer decision, 2026-11-08).
  it(`refuses a configuration that would change a replay selection already read`, async () => {
    vi.stubEnv(`ACME_ORACLE_SEED`, `1`)
    vi.stubEnv(`ACME_ORACLE_PATH`, `0`)
    vi.stubEnv(`ACME_ORACLE_PROPERTY`, `a.b`)
    vi.resetModules()
    const fresh = await import(`../src/index`)
    fresh.configureOracles({ envPrefix: `ACME_ORACLE` })
    expect(fresh.oracleReplayRequested()).toBe(true)
    expect(() => fresh.configureOracles({ envPrefix: `OTHER_ORACLE` })).toThrow(
      `would change the replay selection`,
    )
    expect(fresh.oracleReplayRequested()).toBe(true)
  })

  it(`accepts any property id without a registry`, () => {
    expect(() =>
      assertRegisteredOracleProperty(`anything.at.all`),
    ).not.toThrow()
  })

  it(`rejects a property outside the registry`, () => {
    configureOracles({ registry: [`a.b`] })
    expect(() => assertRegisteredOracleProperty(`a.b`)).not.toThrow()
    expect(() => assertRegisteredOracleProperty(`c.d`)).toThrow(
      `unknown oracle property: c.d`,
    )
  })

  it(`rejects a replay of a property outside the registry`, () => {
    configureOracles({ registry: [`a.b`] })
    expect(() =>
      readOracleRunConfig({
        ORACLE_SEED: `1`,
        ORACLE_PATH: `0`,
        ORACLE_PROPERTY: `c.d`,
      }),
    ).toThrow(`unknown oracle property: c.d`)
  })

  it(`rejects a duplicate registry entry`, () => {
    expect(() => configureOracles({ registry: [`a.b`, `a.b`] })).toThrow(
      `duplicate oracle property: a.b`,
    )
  })

  it(`rejects a retired variable that is set`, () => {
    configureOracles({ retiredVariables: [`OLD_ORACLE_SEED`] })
    expect(() => readOracleRunConfig({ OLD_ORACLE_SEED: `1` })).toThrow(
      `Retired oracle replay variables are set: OLD_ORACLE_SEED.`,
    )
  })

  it(`fails at configuration on a malformed replay environment`, () => {
    vi.stubEnv(`ORACLE_SEED`, `not-a-number`)
    expect(() => configureOracles()).toThrow(`ORACLE_SEED must be an integer`)
  })

  it(`keeps the previous configuration when a registry is rejected`, () => {
    configureOracles({ envPrefix: `ACME_ORACLE` })
    expect(() =>
      configureOracles({ envPrefix: `OTHER`, registry: [`a.b`, `a.b`] }),
    ).toThrow(`duplicate oracle property: a.b`)
    expect(readOracleRunConfig({ ACME_ORACLE_SEED: `4` }).campaignSeed).toBe(4)
  })

  it(`ignores a stray default-prefix variable in a project with its own prefix`, async () => {
    // SQL*Plus sets ORACLE_PATH; it must not break loading the package.
    vi.stubEnv(`ORACLE_PATH`, `/opt/sql`)
    vi.resetModules()
    const fresh = await import(`../src/index`)
    expect(() =>
      fresh.configureOracles({ envPrefix: `ACME_ORACLE` }),
    ).not.toThrow()
    expect(fresh.oracleRuns(2)).toBe(2)
  })

  it(`keeps the whole previous configuration when the replay environment is rejected`, () => {
    configureOracles({ envPrefix: `ACME_ORACLE`, registry: [`a.b`] })
    vi.stubEnv(`OTHER_ORACLE_SEED`, `not-a-number`)
    expect(() =>
      configureOracles({ envPrefix: `OTHER_ORACLE`, registry: [`c.d`] }),
    ).toThrow(`OTHER_ORACLE_SEED must be an integer`)
    expect(readOracleRunConfig({ ACME_ORACLE_SEED: `4` }).campaignSeed).toBe(4)
    expect(() => assertRegisteredOracleProperty(`a.b`)).not.toThrow()
    expect(() => assertRegisteredOracleProperty(`c.d`)).toThrow(
      `unknown oracle property: c.d`,
    )
  })

  it(`fails a first configuration that comes after oracles read the defaults`, async () => {
    vi.resetModules()
    const fresh = await import(`../src/index`)
    fresh.oracleRuns(1)
    expect(() => fresh.configureOracles({ envPrefix: `ACME_ORACLE` })).toThrow(
      `configureOracles must run before`,
    )
  })

  it(`rejects an empty prefix`, () => {
    expect(() => configureOracles({ envPrefix: `` })).toThrow(
      `envPrefix must be non-empty`,
    )
  })

  // "It never throws": a witness for a replay that the environment cannot
  // even describe records nothing.
  it(`never throws while recording a replay witness`, async () => {
    vi.stubEnv(`ORACLE_RUNS_MULTIPLIER`, `0`)
    vi.resetModules()
    const witness = await import(`../src/oracle-replay-witness`)
    expect(() =>
      witness.recordOracleFiniteReplay(`a.b`, {
        seed: 1,
        path: `0`,
        failed: false,
      }),
    ).not.toThrow()
  })
})
