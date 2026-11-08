/**
 * # One configuration decides every oracle read
 *
 * `configureOracles` sets the environment prefix and the property registry
 * for the process, and reads the replay environment under them. Its contract,
 * from `oracle-config.ts`:
 *
 * - Every later read uses that configuration: replay selection, the registry
 *   check, and the variable names that carry the prefix.
 * - The replay environment (the replay selection and the calibration
 *   variable) is read when the configuration is set, by each
 *   `configureOracles` call, or, in a project that never configures, on
 *   first use; reads in between do not read it again. A change to the
 *   environment after that does not change what any read reports.
 * - Once anything has read the replay selection, a `configureOracles` call
 *   that would change it throws and changes nothing: tests already stood
 *   aside, or did not, by the selection they read (maintainer decision,
 *   2026-11-08, finding R1b-1). A later call that keeps the selection
 *   replaces the rest of the configuration. So a test that stands aside during a path
 *   replay (`oracleReplayRequested`), a declared reach that skips its check
 *   during one (`createOracleReach`), `readOracleRunConfig()`, and a
 *   calibration witness, and the replay witness always agree. The object
 *   `readOracleRunConfig()` returns is the caller's: changing it changes no
 *   later read.
 * - A project configures before its oracles read their configuration. A
 *   first `configureOracles` that changes the defaults after an oracle read
 *   them throws, because the earlier read already used the defaults; a read
 *   is any of the reads above, including a registry check.
 *
 * History: up to six steps on a fresh copy of the modules. A step configures
 * (prefix `ORACLE` or `ACME`, with or without the registry `[a.b]`), changes
 * the environment (a path replay of `a.b` under one prefix or none, and the
 * calibration variable naming the fault under one prefix or none), or reads:
 * whether a path replay is requested, whether a declared reach skips its
 * check, whether `readOracleRunConfig()` reports a path, whether
 * `oracleRandomParameters` given it replays, whether a replay witness
 * attaches, whether a replay is still requested after the caller mutates the
 * object `readOracleRunConfig()` returned, whether `a.b` or `typo.id` is
 * registered (directly and through `oracleRandomParameters`), and whether a
 * calibration witness for `a.b` runs. The model keeps the configuration, the replay
 * selection it read, and whether a read came before the first configuration,
 * and owes each step's result. The driver records each step's result, or
 * that it threw. The check compares them step by step.
 *
 * Limits: one property id in the registry; replay selections that are valid
 * under their prefix; retired variables, run multipliers, and malformed
 * environments are owned by `config.test.ts`.
 */
import fc from 'fast-check'
import { vi } from 'vitest'
import { differs, oracleProperty, pass } from '../src/index.js'
import type { Observation } from '../src/index.js'

type Prefix = `ORACLE` | `ACME`
type Reader =
  | `replay requested`
  | `reach skips its check`
  | `a.b registered`
  | `typo.id registered`
  | `typo.id random parameters`
  | `calibration witness runs`
  | `run config replays`
  | `a.b random parameters replay`
  | `replay witness attaches`
  | `replay after mutating run config`
type Step =
  | { do: `configure`; prefix: Prefix; registry: boolean }
  | {
      do: `environment`
      replay: Prefix | `none`
      calibration: Prefix | `none`
    }
  | { do: `read`; reader: Reader }
type History = Array<Step>

const prefixes = [`ORACLE`, `ACME`] as const
const anyStep: fc.Arbitrary<Step> = fc.oneof(
  fc.record({
    do: fc.constant(`configure` as const),
    prefix: fc.constantFrom(...prefixes),
    registry: fc.boolean(),
  }),
  fc.record({
    do: fc.constant(`environment` as const),
    replay: fc.constantFrom(...prefixes, `none` as const),
    calibration: fc.constantFrom(...prefixes, `none` as const),
  }),
  fc.record({
    do: fc.constant(`read` as const),
    reader: fc.constantFrom<Reader>(
      `replay requested`,
      `reach skips its check`,
      `a.b registered`,
      `typo.id registered`,
      `typo.id random parameters`,
      `calibration witness runs`,
      `run config replays`,
      `a.b random parameters replay`,
      `replay witness attaches`,
      `replay after mutating run config`,
    ),
  }),
)
const history = fc.array(anyStep, { minLength: 1, maxLength: 6 })

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------
//
// `environment` holds the prefixes whose replay and calibration variables are
// set now; `read` is what the configuration read from it when it was set. A
// variable under a prefix is seen only by a configuration with that prefix.

type Result = boolean | `threw`

function owedResults(steps: History): Array<Result> {
  let prefix: Prefix = `ORACLE`
  let registry = false
  let configured = false
  let readBefore = false
  type Environment = { replay: Prefix | `none`; calibration: Prefix | `none` }
  let environment: Environment = { replay: `none`, calibration: `none` }
  let read: Environment | undefined
  let selectionRead = false
  const readEnvironment = () => (read ??= environment)
  const replaySelected = () => {
    selectionRead = true
    return readEnvironment().replay === prefix
  }
  return steps.map((step): Result => {
    if (step.do === `environment`) {
      environment = { replay: step.replay, calibration: step.calibration }
      return true
    }
    if (step.do === `configure`) {
      const changesDefaults = step.prefix !== `ORACLE` || step.registry
      if (!configured && readBefore && changesDefaults) return `threw`
      // The selection this configuration would read, against the one read.
      if (
        selectionRead &&
        (environment.replay === step.prefix) !== (read!.replay === prefix)
      )
        return `threw`
      prefix = step.prefix
      registry = step.registry
      configured = true
      read = environment
      return true
    }
    if (!configured) readBefore = true
    switch (step.reader) {
      // The witness channel is set with the replay, and a returned run
      // configuration is the caller's copy, so these all read the selection.
      case `replay requested`:
      case `reach skips its check`:
      case `run config replays`:
      case `a.b random parameters replay`:
      case `replay witness attaches`:
      case `replay after mutating run config`:
        return replaySelected()
      case `a.b registered`:
        return true
      case `typo.id registered`:
      case `typo.id random parameters`:
        return !registry
      case `calibration witness runs`:
        // It stands aside during a path replay unless the calibration
        // variable, under the configured prefix, names its fault.
        return !replaySelected() || readEnvironment().calibration === prefix
    }
  })
}

// ---------------------------------------------------------------------------
// Production driver
// ---------------------------------------------------------------------------
//
// Each history gets fresh modules, so no configuration carries over, and an
// environment with no replay or calibration variable under either prefix.

const variables = prefixes.flatMap((prefix) =>
  [`SEED`, `PATH`, `PROPERTY`, `CALIBRATION`, `REPLAY_WITNESS`].map(
    (name) => `${prefix}_${name}`,
  ),
)

async function driveConfiguration(
  steps: History,
  observe: (checkpoint: string, value: unknown) => void,
) {
  const saved = Object.fromEntries(
    variables.map((name) => [name, process.env[name]]),
  )
  const setEnvironment = (
    replay: Prefix | `none`,
    calibration: Prefix | `none`,
  ) => {
    for (const name of variables) delete process.env[name]
    if (calibration !== `none`)
      process.env[`${calibration}_CALIBRATION`] = `fault`
    if (replay === `none`) return
    process.env[`${replay}_SEED`] = `1`
    process.env[`${replay}_PATH`] = `0`
    process.env[`${replay}_PROPERTY`] = `a.b`
    // The reporter is only built, never run, so nothing is written here.
    process.env[`${replay}_REPLAY_WITNESS`] = `unused-witness-channel`
  }
  const info = vi.spyOn(console, `info`).mockImplementation(() => {})
  try {
    setEnvironment(`none`, `none`)
    vi.resetModules()
    const config = await import(`../src/oracle-config.js`)
    const { createOracleReach } = await import(`../src/oracle-reach.js`)
    const witness = await import(`../src/oracle-replay-witness.js`)
    const registration = { skip: `skipped` }
    const read: Record<Reader, () => boolean> = {
      'replay requested': () => config.oracleReplayRequested(),
      'reach skips its check': () => {
        // A reach whose one state no history entered fails its check unless
        // it skips it.
        const reach = createOracleReach(`a.b`, [`state`])
        try {
          reach.assertReached()
          return true
        } catch {
          return false
        }
      },
      'a.b registered': () =>
        accepts(() => config.assertRegisteredOracleProperty(`a.b`)),
      'typo.id registered': () =>
        accepts(() => config.assertRegisteredOracleProperty(`typo.id`)),
      'typo.id random parameters': () =>
        accepts(() => config.oracleRandomParameters(1, undefined, `typo.id`)),
      'calibration witness runs': () =>
        config.oracleCalibrationTest(registration, `a.b`, `fault`) ===
        registration,
      'run config replays': () =>
        config.readOracleRunConfig().replayPath !== undefined,
      'replay witness attaches': () =>
        Object.keys(witness.oracleReplayReporter(`a.b`, 1, `0`)).length > 0,
      'replay after mutating run config': () => {
        const run = config.readOracleRunConfig() as { replayPath?: string }
        try {
          run.replayPath = undefined
        } catch {
          // A frozen copy refuses the change.
        }
        return config.oracleReplayRequested()
      },
      'a.b random parameters replay': () =>
        config.oracleRandomParameters(1, config.readOracleRunConfig(), `a.b`)
          .path !== undefined,
    }
    for (const [index, current] of steps.entries()) {
      let result: Result
      if (current.do === `environment`) {
        setEnvironment(current.replay, current.calibration)
        result = true
      } else if (current.do === `configure`) {
        result = accepts(() =>
          config.configureOracles({
            envPrefix: current.prefix,
            ...(current.registry ? { registry: [`a.b`] } : {}),
          }),
        )
          ? true
          : `threw`
      } else result = read[current.reader]()
      observe(`step ${index}`, result)
    }
  } finally {
    info.mockRestore()
    for (const name of variables)
      if (saved[name] === undefined) delete process.env[name]
      else process.env[name] = saved[name]
  }
}

function accepts(run: () => unknown): boolean {
  try {
    run()
    return true
  } catch {
    return false
  }
}

function checkConfiguration(
  steps: History,
  trace: ReadonlyArray<Observation>,
  owed: Array<Result>,
) {
  for (const [index, result] of owed.entries()) {
    const seen = trace.find(({ checkpoint }) => checkpoint === `step ${index}`)
    const law =
      steps[index]!.do === `configure` ? `configure first` : `one configuration`
    const verdict = differs(`step ${index}`, law, seen?.value, result)
    if (verdict) return verdict
  }
  return pass
}

// The states where these laws matter, each built by a constructed history.
const lateConfiguration = `a configuration after a registry read`
const environmentAfterConfiguration = `an environment change after configuration`
const prefixedCalibration = `a calibration witness under another prefix`
const selectionChange = `a configuration that would change a read selection`

oracleProperty<History, Array<Result>>({
  id: `self-oracle.configuration`,
  law: {
    statement: `Every oracle read uses the one configuration in force, the replay environment is read once under it, and a first configureOracles that changes the defaults after any read throws.`,
    authority: `the configureOracles contract in packages/oracles/src/oracle-config.ts (read once at configuration or first use; configure before oracles read)`,
    limits: `One registered id; valid replay selections; retired variables, multipliers, and malformed environments are left to config.test.ts.`,
    owner: `oracleProperty framework`,
  },
  histories: {
    arbitrary: history,
    runs: 100,
    fixedSeeds: [20261108],
    states: [
      lateConfiguration,
      environmentAfterConfiguration,
      prefixedCalibration,
      selectionChange,
    ],
    fixed: [
      // A registry check at module load once passed against the empty
      // default registry, and the configuration that followed was accepted.
      {
        name: `a registry check before configuration`,
        history: [
          { do: `read`, reader: `typo.id random parameters` },
          { do: `configure`, prefix: `ORACLE`, registry: true },
        ],
        enters: [lateConfiguration],
      },
      // A declared reach once read the live environment while replay
      // selection kept the configured one, so they disagreed.
      {
        name: `run configuration read after the environment changed`,
        history: [
          { do: `configure`, prefix: `ORACLE`, registry: false },
          { do: `environment`, replay: `ORACLE`, calibration: `none` },
          { do: `read`, reader: `run config replays` },
          { do: `read`, reader: `a.b random parameters replay` },
        ],
        enters: [environmentAfterConfiguration],
      },
      {
        name: `a replay witness after the environment changed`,
        history: [
          { do: `environment`, replay: `ORACLE`, calibration: `none` },
          { do: `configure`, prefix: `ORACLE`, registry: false },
          { do: `environment`, replay: `none`, calibration: `none` },
          { do: `read`, reader: `a.b random parameters replay` },
          { do: `read`, reader: `replay witness attaches` },
        ],
        enters: [environmentAfterConfiguration],
      },
      // A reconfiguration after tests read the selection once replaced it.
      {
        name: `a reconfiguration that would change a read selection`,
        history: [
          { do: `read`, reader: `replay requested` },
          { do: `environment`, replay: `ORACLE`, calibration: `none` },
          { do: `configure`, prefix: `ORACLE`, registry: false },
          { do: `read`, reader: `reach skips its check` },
        ],
        enters: [selectionChange],
      },
      {
        name: `a mutated run configuration`,
        history: [
          { do: `environment`, replay: `ORACLE`, calibration: `none` },
          { do: `configure`, prefix: `ORACLE`, registry: false },
          { do: `read`, reader: `replay after mutating run config` },
        ],
      },
      {
        name: `a calibration variable set after configuration`,
        history: [
          { do: `environment`, replay: `ORACLE`, calibration: `none` },
          { do: `configure`, prefix: `ORACLE`, registry: false },
          { do: `environment`, replay: `ORACLE`, calibration: `ORACLE` },
          { do: `read`, reader: `calibration witness runs` },
        ],
        enters: [environmentAfterConfiguration],
      },
      {
        name: `a replay set after configuration`,
        history: [
          { do: `configure`, prefix: `ORACLE`, registry: false },
          { do: `environment`, replay: `ORACLE`, calibration: `ORACLE` },
          { do: `read`, reader: `replay requested` },
          { do: `read`, reader: `reach skips its check` },
        ],
        enters: [environmentAfterConfiguration],
      },
    ],
    constructed: [
      {
        name: selectionChange,
        enters: [selectionChange],
        build: (generated): History => [
          { do: `read`, reader: `replay requested` },
          { do: `environment`, replay: `ORACLE`, calibration: `none` },
          { do: `configure`, prefix: `ORACLE`, registry: false },
          ...generated.slice(0, 3),
        ],
      },
      {
        name: lateConfiguration,
        enters: [lateConfiguration],
        build: (generated) => [
          { do: `read`, reader: `typo.id random parameters` },
          { do: `configure`, prefix: `ORACLE`, registry: true },
          ...generated.slice(0, 4),
        ],
      },
      {
        name: environmentAfterConfiguration,
        enters: [environmentAfterConfiguration],
        build: (generated) => [
          { do: `configure`, prefix: `ORACLE`, registry: false },
          { do: `environment`, replay: `ORACLE`, calibration: `ORACLE` },
          { do: `read`, reader: `reach skips its check` },
          ...generated.slice(0, 3),
        ],
      },
      {
        name: prefixedCalibration,
        enters: [prefixedCalibration],
        build: (generated) => [
          { do: `environment`, replay: `ACME`, calibration: `ACME` },
          { do: `configure`, prefix: `ACME`, registry: true },
          { do: `read`, reader: `calibration witness runs` },
          ...generated.slice(0, 3),
        ],
      },
    ],
  },
  model: owedResults,
  reached: (steps, _trace, owed) => {
    const reached: Array<string> = []
    let configured: Prefix | undefined
    let registryRead = false
    // The selection a read saw, and the one a configuration would read.
    let replayIn: Prefix | `none` = `none`
    let prefix: Prefix = `ORACLE`
    let seen: boolean | undefined
    for (const [index, step] of steps.entries()) {
      if (step.do === `environment`) replayIn = step.replay
      if (
        step.do === `read` &&
        ![
          `a.b registered`,
          `typo.id registered`,
          `typo.id random parameters`,
        ].includes(step.reader)
      )
        seen ??= replayIn === prefix
      if (
        step.do === `configure` &&
        seen !== undefined &&
        (replayIn === step.prefix) !== seen
      )
        reached.push(selectionChange)
      if (step.do === `configure` && owed[index] !== `threw`) {
        prefix = step.prefix
        if (seen !== undefined) seen = replayIn === prefix
      }
      if (step.do === `read`) {
        if (configured === undefined && step.reader.startsWith(`typo.id`))
          registryRead = true
        if (step.reader === `calibration witness runs` && configured === `ACME`)
          reached.push(prefixedCalibration)
      }
      if (step.do === `environment` && configured !== undefined)
        reached.push(environmentAfterConfiguration)
      if (step.do !== `configure`) continue
      if (configured === undefined && registryRead && step.registry)
        reached.push(lateConfiguration)
      if (owed[index] !== `threw`) configured = step.prefix
    }
    return reached
  },
  driver: driveConfiguration,
  check: checkConfiguration,
})
