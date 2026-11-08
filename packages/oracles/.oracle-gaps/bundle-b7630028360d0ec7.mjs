// dist/esm/oracle-property.js
import { AsyncLocalStorage } from 'node:async_hooks'
import { appendFileSync as appendFileSync2 } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import fc from 'fast-check'
import { describe, it, vi, expect } from 'vitest'

// dist/esm/oracle-environment.js
var envPrefix = `ORACLE`
function setOracleEnvPrefix(prefix) {
  envPrefix = prefix
}
function oracleEnvName(setting) {
  return `${envPrefix}_${setting}`
}

// dist/esm/oracle-replay-witness.js
import { appendFileSync } from 'node:fs'
import { defaultReportMessage, asyncDefaultReportMessage } from 'fast-check'
function witnessChannel(property, seed, path) {
  const channel = process.env[oracleEnvName(`REPLAY_WITNESS`)]
  return channel !== void 0 &&
    property === process.env[oracleEnvName(`PROPERTY`)] &&
    seed === Number(process.env[oracleEnvName(`SEED`)]) &&
    path === process.env[oracleEnvName(`PATH`)]
    ? channel
    : void 0
}
function appendWitness(channel, witness) {
  appendFileSync(
    channel,
    `${JSON.stringify(witness)}
`,
  )
}
function runWitness(property, details) {
  return {
    property,
    seed: details.seed,
    path: details.runConfiguration.path,
    numRuns: details.numRuns,
    failed: details.failed,
  }
}
function recordOracleReplay(property, details) {
  const channel = witnessChannel(
    property,
    details.seed,
    details.runConfiguration.path,
  )
  if (channel !== void 0) appendWitness(channel, runWitness(property, details))
}
function recordOracleFiniteReplay(property, { seed, path, failed }) {
  const channel = witnessChannel(property, seed, path)
  if (channel === void 0) return
  appendWitness(channel, { property, seed, path, numRuns: 1, failed })
}
function oracleReplayReporter(property, seed, path) {
  const channel = witnessChannel(property, seed, path)
  if (channel === void 0) return {}
  const record = (details) =>
    appendWitness(channel, runWitness(property, details))
  const rethrow = (details, message) => {
    if (message === void 0) return
    const error = new Error(message)
    Object.defineProperty(error, `cause`, {
      value: details.errorInstance,
      configurable: true,
      writable: true,
    })
    throw error
  }
  if (process.env[oracleEnvName(`REPLAY_WITNESS_MODE`)] === `sync`) {
    return {
      reporter: (details) => {
        record(details)
        rethrow(details, defaultReportMessage(details))
      },
    }
  }
  return {
    asyncReporter: async (details) => {
      record(details)
      rethrow(details, await asyncDefaultReportMessage(details))
    },
  }
}

// dist/esm/oracle-config.js
var defaults = {
  prefix: `ORACLE`,
  registry: void 0,
  retired: [],
}
var settings = defaults
var configuredReplay
var configured = false
var readDefaults = false
function replayConfig() {
  if (configuredReplay === void 0) {
    if (!configured) readDefaults = true
    configuredReplay = readRunConfig(process.env, settings)
  }
  return configuredReplay
}
function configureOracles({
  envPrefix: envPrefix2 = `ORACLE`,
  registry: propertyIds,
  retiredVariables: retired = [],
} = {}) {
  if (envPrefix2 === ``) {
    throw new Error(`configureOracles: envPrefix must be non-empty`)
  }
  const candidate = {
    prefix: envPrefix2,
    registry:
      propertyIds === void 0
        ? void 0
        : validateOraclePropertyRegistry([...propertyIds]),
    retired: [...retired],
  }
  const replay = readRunConfig(process.env, candidate)
  const changesDefaults =
    candidate.prefix !== defaults.prefix ||
    candidate.registry !== void 0 ||
    candidate.retired.length > 0
  if (!configured && readDefaults && changesDefaults) {
    throw new Error(
      `configureOracles must run before oracles read their configuration: an oracle already read the defaults (prefix ${defaults.prefix}). Call it before importing the modules that define oracles.`,
    )
  }
  settings = candidate
  setOracleEnvPrefix(candidate.prefix)
  configuredReplay = replay
  configured = true
}
function validateOraclePropertyRegistry(properties) {
  const registered = /* @__PURE__ */ new Set()
  for (const property of properties) {
    if (registered.has(property)) {
      throw new Error(`duplicate oracle property: ${property}`)
    }
    registered.add(property)
  }
  return registered
}
function assertRegisteredOracleProperty(property) {
  assertRegisteredIn(settings, property)
}
function assertRegisteredIn(within, property) {
  if (within.registry !== void 0 && !within.registry.has(property)) {
    throw new Error(`unknown oracle property: ${property}`)
  }
}
function readOracleRunConfig(environment = process.env) {
  if (environment === process.env && !configured) readDefaults = true
  return readRunConfig(environment, settings)
}
function readRunConfig(environment, within) {
  const name = (setting) => `${within.prefix}_${setting}`
  const seedName = name(`SEED`)
  const pathName = name(`PATH`)
  const propertyName = name(`PROPERTY`)
  const multiplierName = name(`RUNS_MULTIPLIER`)
  const retired = within.retired.filter(
    (variable) => environment[variable] !== void 0,
  )
  if (retired.length > 0) {
    throw new Error(
      `Retired oracle replay variables are set: ${retired.join(`, `)}. Use ${seedName}, ${pathName}, and ${propertyName} to select a replay, and ${multiplierName} to scale run counts.`,
    )
  }
  const multiplierValue = environment[multiplierName] ?? `1`
  const multiplier = Number(multiplierValue)
  if (
    multiplierValue.trim() === `` ||
    !Number.isSafeInteger(multiplier) ||
    multiplier < 1
  ) {
    throw new Error(`${multiplierName} must be a positive integer`)
  }
  const seedValue = environment[seedName]
  const replayPath = environment[pathName]
  const replayProperty = environment[propertyName]
  if (seedValue === void 0) {
    if (replayPath !== void 0) {
      throw new Error(`${pathName} requires ${seedName}`)
    }
    if (replayProperty !== void 0) {
      throw new Error(`${propertyName} requires ${pathName}`)
    }
    return {
      multiplier,
      campaignSeed: void 0,
      replayPath: void 0,
      replayProperty: void 0,
    }
  }
  const campaignSeed = Number(seedValue)
  if (seedValue.trim() === `` || !Number.isSafeInteger(campaignSeed)) {
    throw new Error(`${seedName} must be an integer`)
  }
  if (replayPath === void 0) {
    if (replayProperty !== void 0) {
      throw new Error(`${propertyName} requires ${pathName}`)
    }
    return {
      multiplier,
      campaignSeed,
      replayPath: void 0,
      replayProperty: void 0,
    }
  }
  if (replayPath.trim() === ``) {
    throw new Error(`${pathName} must be non-empty`)
  }
  if (!/^\d+(?::\d+)*$/.test(replayPath)) {
    throw new Error(
      `${pathName} must contain colon-separated nonnegative integers`,
    )
  }
  if (replayProperty === void 0 || replayProperty.trim() === ``) {
    throw new Error(`${pathName} requires ${propertyName}`)
  }
  assertRegisteredIn(within, replayProperty)
  return { multiplier, campaignSeed, replayPath, replayProperty }
}
function oracleCampaignSeed(seed, property) {
  const selected = seed ?? Math.floor(Math.random() * 4294967296) - 2147483648
  console.info(
    `ORACLE_SEED ${JSON.stringify({ property: property ?? null, seed: selected })}`,
  )
  return selected
}
function oracleRandomParameters(numRuns, replay, property, examples) {
  return randomParameters(numRuns, replay, property, examples)
}
function randomParameters(numRuns, replay, property, examples) {
  if (property !== void 0) assertRegisteredOracleProperty(property)
  const { campaignSeed, replayPath, replayProperty } =
    typeof replay === `object`
      ? replay
      : {
          campaignSeed: replay,
          replayPath: void 0,
          replayProperty: void 0,
        }
  const selectedSeed = oracleCampaignSeed(campaignSeed, property)
  globalThis.__oracleRoute?.(
    property !== void 0 && replayPath !== void 0 && replayProperty === property
      ? `fixed history`
      : `random seed`,
  )
  const parameters =
    campaignSeed === void 0
      ? { numRuns, seed: selectedSeed }
      : {
          numRuns,
          seed: campaignSeed,
          // A path replays one recorded counterexample, so the replay runs
          // once. From a path with one segment, fast-check would otherwise
          // run `numRuns` histories that start at that index.
          ...(property !== void 0 &&
          replayPath !== void 0 &&
          replayProperty === property
            ? {
                numRuns: 1,
                path: replayPath,
                ...oracleReplayReporter(property, campaignSeed, replayPath),
              }
            : {}),
        }
  return examples === void 0
    ? parameters
    : withOracleFixedHistories(parameters, examples)
}
function withOracleFixedHistories(parameters, examples) {
  return {
    ...parameters,
    examples: [...examples],
    numRuns:
      parameters.path === void 0
        ? parameters.numRuns + examples.length
        : parameters.numRuns,
  }
}
function oracleReplayRequested() {
  return replayConfig().replayPath !== void 0
}
function oracleReplaySkips(...properties) {
  for (const property of properties) assertRegisteredOracleProperty(property)
  return (
    replayConfig().replayPath !== void 0 &&
    (replayConfig().replayProperty === void 0 ||
      !properties.includes(replayConfig().replayProperty))
  )
}
function oracleReplayTest(registration, ...properties) {
  const standsAside =
    properties.length === 0
      ? oracleReplayRequested()
      : oracleReplaySkips(...properties)
  return standsAside ? registration.skip : registration
}
function oracleCalibrationTest(registration, property, fault) {
  const standsAside =
    oracleReplaySkips(property) ||
    (oracleReplayRequested() &&
      process.env[oracleEnvName(`CALIBRATION`)] !== fault)
  return standsAside ? registration.skip : registration
}
function oracleRoute(route) {
  globalThis.__oracleRoute?.(route)
}
function oracleRuns(baseRuns) {
  return baseRuns * replayConfig().multiplier
}
function oraclePropertyOptions(baseRuns, property, { examples } = {}) {
  return randomParameters(
    oracleRuns(baseRuns),
    replayConfig(),
    property,
    examples,
  )
}

// dist/esm/oracle-property.js
var pass = { kind: `pass` }
function violation(checkpoint, difference, law, values) {
  return { kind: `violation`, checkpoint, difference, law, values }
}
function differs(
  checkpoint,
  law,
  actual,
  expected,
  difference = `the observed value differs from the owed value`,
) {
  return isDeepStrictEqual(actual, expected)
    ? void 0
    : violation(checkpoint, difference, law, { actual, expected })
}
function forwardCut(cuts, observed, from, same) {
  for (let index = from; index < cuts.length; index += 1)
    if (same(cuts[index], observed)) return index
  return -1
}
var nextTurn = () =>
  new Promise((resolve) =>
    typeof setImmediate === `function`
      ? setImmediate(resolve)
      : setTimeout(resolve, 0),
  )
function withinTurns(promise, turns) {
  const state = { settled: false }
  const done = promise.then(
    () => (state.settled = true),
    () => (state.settled = true),
  )
  const expiry = (async () => {
    for (let turn = 0; turn < turns && !state.settled; turn += 1)
      await nextTurn()
    return false
  })()
  return Promise.race([done, expiry])
}
function scheduleFrom(choices) {
  const pending = []
  const released = []
  let step = 0
  const settle = nextTurn
  const waitOne = async () => {
    if (pending.length === 0) return
    const queues = [...new Set(pending.map((task2) => task2.queue))]
    const choice = choices[step++]
    const at =
      choice === void 0
        ? 0
        : pending.findIndex(
            (task2) => task2.queue === queues[choice % queues.length],
          )
    const [task] = pending.splice(at, 1)
    released.push(task.label)
    task.release()
    await settle()
  }
  return {
    schedule: (
      promise,
      label = `task ${pending.length}`,
      queue = label.split(` `)[0],
    ) =>
      new Promise((resolve, reject) => {
        const held = Promise.resolve(promise)
        held.catch(() => {})
        pending.push({
          label,
          queue,
          release: () => void held.then(resolve, reject),
        })
      }),
    waitOne,
    waitIdle: async () => {
      await settle()
      while (pending.length > 0) await waitOne()
    },
    released: () => [...released],
  }
}
var OracleViolation = class extends Error {
  constructor() {
    super(...arguments)
    this.name = `OracleViolation`
  }
}
var probeWindows = new AsyncLocalStorage()
globalThis.__oracleProbe = (name, condition) => {
  const window = probeWindows.getStore()
  if (!window) return
  if (!window.open)
    throw new Error(
      `probe ${name} was called after its history ended. The driver must await the work it starts, so every probe call belongs to one history.`,
    )
  window.reached.add(name)
  if (condition) window.entered.add(name)
}
var agreementLaw = `reach agreement`
var stateName = (state) => (typeof state === `string` ? state : state.name)
function oracleProperty(options) {
  assertRegisteredOracleProperty(options.id)
  const { id, histories } = options
  if (Array.isArray(histories) && options.predict)
    throw new Error(
      `${id}: \`predict\` needs probe-bound states, which only a generated source declares.`,
    )
  recordRegistration(id, options.law, histories)
  const tests = Array.isArray(histories)
    ? enumeratedTests(options, histories)
    : generatedTests(options, histories)
  describe(id, () => {
    for (const test of tests)
      oracleReplayTest(it, ...test.replays)(
        test.name,
        () => {
          globalThis.__oracleRoute?.(test.route)
          return test.run()
        },
        options.timeout ?? 12e4,
      )
  })
}
function enumeratedTests(options, histories) {
  const spacing = Math.max(1, Math.ceil(histories.length / 8))
  const sampled = histories.filter((_, index) => index % spacing === 0)
  return [
    ...histories.map((history) => enumeratedTest(options, history)),
    ...calibrationTests(options, () =>
      histories.map((history) => ({
        name: options.label?.(history) ?? JSON.stringify(history),
        history,
      })),
    ),
    determinismTest(options, () =>
      sampled.map((history) => ({
        name: options.label?.(history) ?? JSON.stringify(history),
        history,
      })),
    ),
  ]
}
function enumeratedTest(options, history) {
  {
    const name = options.label?.(history) ?? JSON.stringify(history)
    return {
      name,
      route: `enumerated`,
      replays: [],
      run: async () => {
        const { verdict } = await runOne(options, history)
        if (verdict.kind === `violation`)
          throw failure(
            options,
            verdict,
            history,
            rerunByName(options.id, name),
          )
      },
    }
  }
}
var historyTrace
var clockSpin
var takeClockSpin = () => {
  const spin = clockSpin
  clockSpin = void 0
  return spin
}
function useOracleClock({ maxTimers = 1e3 } = {}) {
  const realTimeout = globalThis.setTimeout
  const realInterval = globalThis.setInterval
  vi.useFakeTimers({
    toFake: [
      `setTimeout`,
      `clearTimeout`,
      `setInterval`,
      `clearInterval`,
      `Date`,
    ],
  })
  let fired = 0
  const counted =
    (callback) =>
    (...args) => {
      fired += 1
      if (fired > maxTimers) {
        clockSpin ??= { at: historyTrace?.length ?? 0, maxTimers }
        return
      }
      callback(...args)
    }
  const fakeTimeout = globalThis.setTimeout
  const fakeInterval = globalThis.setInterval
  globalThis.setTimeout = (callback, ms, ...args) =>
    fakeTimeout(
      typeof callback === `function` ? counted(callback) : callback,
      ms,
      ...args,
    )
  globalThis.setInterval = (callback, ms, ...args) =>
    fakeInterval(
      typeof callback === `function` ? counted(callback) : callback,
      ms,
      ...args,
    )
  return {
    release: () => {
      vi.useRealTimers()
      globalThis.setTimeout = realTimeout
      globalThis.setInterval = realInterval
      if (historyTrace !== void 0) return
      const spin = takeClockSpin()
      if (!spin) return
      globalThis.__oracleVerdict?.({
        property: `useOracleClock`,
        law: `bounded clock`,
        checkpoint: `clock`,
      })
      throw new Error(
        `bounded clock: the controlled clock fired more than ${spin.maxTimers} timers: work that never goes quiet (raise maxTimers if a legal test needs more)`,
      )
    },
  }
}
async function recordTrace(driver, plan) {
  const observations = []
  const window = {
    reached: /* @__PURE__ */ new Set(),
    entered: /* @__PURE__ */ new Set(),
    open: true,
  }
  historyTrace = observations
  clockSpin = void 0
  try {
    await probeWindows.run(window, () =>
      driver(plan, (checkpoint, value) => {
        observations.push({ checkpoint, value })
      }),
    )
  } finally {
    historyTrace = void 0
  }
  window.open = false
  const spin = takeClockSpin()
  if (spin) observations.push({ checkpoint: `clock`, value: spin.at })
  observations.push({
    checkpoint: `probes`,
    value: {
      reached: [...window.reached].sort(),
      entered: [...window.entered].sort(),
    },
  })
  return observations
}
function planOf(options, history) {
  return options.resolve ? options.resolve(history) : history
}
function traceText(value) {
  return JSON.stringify(value, (_key, item) => {
    if (item === void 0) return `$undefined`
    if (typeof item === `bigint`) return `$bigint:${item}`
    if (item instanceof Map) return { $map: [...item] }
    if (item instanceof Set) return { $set: [...item] }
    if (item instanceof Error)
      return { $error: item.name, message: item.message }
    return item
  })
}
function determinismTest(options, histories) {
  return {
    name: `determinism`,
    route: `determinism`,
    replays: [],
    run: async () => {
      for (const { name, history } of histories()) {
        const plan = planOf(options, history)
        const [first, second] = [
          await recordTrace(options.driver, plan),
          await recordTrace(options.driver, plan),
        ]
        const length = Math.max(first.length, second.length)
        for (let index = 0; index < length; index += 1) {
          const [a, b] = [first[index], second[index]]
          const [textA, textB] = [traceText(a), traceText(b)]
          if (textA === textB) continue
          const error = new Error(
            [
              `${options.id}: two runs of "${name}" recorded different traces at observation ${index}${a ? ` ("${a.checkpoint}")` : ``}.`,
              `First run:  ${textA.slice(0, 2e3)}`,
              `Second run: ${textB.slice(0, 2e3)}`,
              `History: ${traceText(history)}`,
              `A driver records relations, such as before and after or same and different, instead of clock readings or random ids.`,
            ].join(`
`),
          )
          error.actual = b
          error.expected = a
          error.showDiff = true
          throw error
        }
      }
    },
  }
}
async function runOne(options, history, driver = options.driver, forced) {
  const plan = planOf(options, history)
  const { observations, driverError, probes, spin } = await recordGuarded(
    driver,
    plan,
    forced,
  )
  if (spin) {
    const { verdict, reached } = judge(
      options,
      plan,
      observations.slice(0, spin.at),
      void 0,
      probes,
    )
    const recorded =
      verdict.kind === `violation` &&
      observations
        .slice(0, spin.at)
        .some(({ checkpoint }) => checkpoint === verdict.checkpoint)
    return recorded
      ? { verdict, reached }
      : {
          verdict: violation(
            `clock`,
            `the controlled clock fired more than ${spin.maxTimers} timers in one history: work that never goes quiet (raise maxTimers if a legal history needs more)`,
            `bounded clock`,
          ),
          reached,
        }
  }
  return judge(options, plan, observations, driverError, probes)
}
async function recordGuarded(driver, plan, forced) {
  const observations = []
  const window = {
    reached: /* @__PURE__ */ new Set(),
    entered: /* @__PURE__ */ new Set(),
    open: true,
  }
  const close = () => {
    window.open = false
    if (forced) {
      window.reached.add(forced.probe)
      if (forced.entered) window.entered.add(forced.probe)
      else window.entered.delete(forced.probe)
    }
    return window
  }
  historyTrace = observations
  clockSpin = void 0
  const settle = () => {
    historyTrace = void 0
    const spin = takeClockSpin()
    return spin ? { spin } : {}
  }
  try {
    await probeWindows.run(window, () =>
      driver(plan, (checkpoint, value) => {
        observations.push({ checkpoint, value })
        globalThis.__oracleObserve?.(checkpoint, value)
      }),
    )
  } catch (error) {
    return {
      observations,
      driverError: { error },
      probes: close(),
      ...settle(),
    }
  }
  return { observations, probes: close(), ...settle() }
}
function judge(
  options,
  plan,
  observations,
  driverError,
  probes = {
    reached: /* @__PURE__ */ new Set(),
    entered: /* @__PURE__ */ new Set(),
  },
) {
  let expected
  let verdict
  let predicted = {}
  try {
    expected = options.model(plan, observations)
    verdict = options.check(plan, observations, expected)
    predicted = options.predict?.(plan) ?? {}
  } catch (error) {
    throw driverError ? driverError.error : error
  }
  if (driverError) {
    const recorded = observations.some(
      ({ checkpoint }) =>
        verdict.kind === `violation` && checkpoint === verdict.checkpoint,
    )
    if (verdict.kind === `pass` || !recorded) throw driverError.error
    verdict = { ...verdict, cause: driverError.error }
  }
  const reached = new Set(
    options.reached?.(plan, observations, expected) ??
      observations
        .filter((entry) => entry.checkpoint === `reach`)
        .map((entry) => String(entry.value)),
  )
  for (const [state, probe] of options.probes ?? []) {
    const predicts = predicted[state] === true
    const entered = probes.entered.has(probe)
    reached.delete(state)
    if (predicts && entered) reached.add(state)
    if (predicts === entered || verdict.kind === `violation`) continue
    verdict = violation(
      `states`,
      predicts
        ? `the model predicts that this history enters "${state}", but probe ${probe} ${probes.reached.has(probe) ? `was reached with a false condition` : `was never reached`}`
        : `probe ${probe} was entered, but the model predicts that this history does not enter "${state}"`,
      agreementLaw,
    )
  }
  return { verdict, reached }
}
var lawOf = (verdict) => verdict.law ?? verdict.checkpoint
function calibrationTests(options, candidates) {
  const { id } = options
  const forcedCalibrations = [...(options.probes ?? [])].flatMap(
    ([state, probe]) =>
      [true, false].map((entered) => ({
        name: `probe ${probe} forced ${entered ? `entered` : `not entered`} (state "${state}")`,
        law: agreementLaw,
        forced: { probe, entered },
      })),
  )
  return [...(options.calibrations ?? []), ...forcedCalibrations].map(
    (calibration) => ({
      name: `calibration: ${calibration.name}`,
      route: `forced` in calibration ? `probe calibration` : `calibration`,
      replays: [],
      run: async () => {
        const seen = []
        for (const { name, history } of candidates()) {
          const plan = planOf(options, history)
          if (`corrupt` in calibration) {
            const { observations, driverError, probes } = await recordGuarded(
              options.driver,
              plan,
            )
            const corrupted = calibration.corrupt(observations, plan)
            if (corrupted === void 0) continue
            if (
              driverError ||
              judge(options, plan, observations, void 0, probes).verdict
                .kind !== `pass`
            )
              continue
            const wrong = judge(
              options,
              plan,
              corrupted,
              void 0,
              probes,
            ).verdict
            if (wrong.kind === `violation` && lawOf(wrong) === calibration.law)
              return
            throw new Error(
              `${id}: calibration "${calibration.name}" corrupted the trace of "${name}", but the check ${wrong.kind === `pass` ? `passed it` : `reported law "${lawOf(wrong)}"`}. It must report law "${calibration.law}".`,
            )
          }
          const clean = await recordGuarded(options.driver, plan)
          if (
            clean.driverError ||
            judge(options, plan, clean.observations, void 0, clean.probes)
              .verdict.kind !== `pass`
          )
            continue
          const { verdict } =
            `forced` in calibration
              ? await runOne(
                  options,
                  history,
                  options.driver,
                  calibration.forced,
                )
              : await runOne(options, history, calibration.driver)
          if (verdict.kind === `pass`) continue
          if (lawOf(verdict) === calibration.law) return
          seen.push(`"${name}" reported law "${lawOf(verdict)}"`)
        }
        throw new Error(
          `${id}: calibration "${calibration.name}" found no history whose clean trace passes and where the check reports law "${calibration.law}"${seen.length ? `; ${seen.slice(0, 3).join(`, `)}` : ``}. Add a passing fixed or constructed history that reaches the state its wrong answer changes.`,
        )
      },
    }),
  )
}
function failure(options, verdict, history, rerun) {
  const { id, law } = options
  globalThis.__oracleVerdict?.({
    property: id,
    law: lawOf(verdict),
    checkpoint: verdict.checkpoint,
  })
  const error = new OracleViolation(
    [
      `${id} violated at checkpoint "${verdict.checkpoint}"${verdict.law ? ` (law: ${verdict.law})` : ``}.`,
      `Law: ${law.statement}`,
      `Difference: ${verdict.difference}`,
      `History: ${JSON.stringify(history)}`,
      `Authority: ${law.authority}`,
      `Known limits: ${law.limits}`,
      `Rerun: ${rerun}`,
    ].join(`
`),
    verdict.cause === void 0 ? void 0 : { cause: verdict.cause },
  )
  if (verdict.values) {
    error.actual = verdict.values.actual
    error.expected = verdict.values.expected
    error.showDiff = true
  }
  return error
}
function rerunByName(suite, name) {
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`)
  return `-t ${JSON.stringify(`^${escape(suite)}(?: | > )${escape(name)}$`)}`
}
function generatedTests(unbound, source) {
  const { id } = unbound
  const declaredStates = [...(source.states ?? []), ...(source.measured ?? [])]
  const probes = new Map(
    declaredStates.flatMap((state) =>
      typeof state === `string` ? [] : [[state.name, state.probe]],
    ),
  )
  if (probes.size > 0 !== (unbound.predict !== void 0))
    throw new Error(
      `${id}: a probe-bound state needs \`predict\`, and \`predict\` needs a probe-bound state. Declare the state as { name, probe }.`,
    )
  const options = probes.size > 0 ? { ...unbound, probes } : unbound
  const required = (source.states ?? []).map(stateName)
  const constructions = source.constructed ?? []
  const declared =
    source.states || source.measured
      ? new Set(declaredStates.map(stateName))
      : void 0
  const named = new Set(
    constructions.flatMap((construction) => construction.enters),
  )
  const unconstructed = required.filter((state) => !named.has(state))
  if (unconstructed.length > 0)
    throw new Error(
      `${id}: no constructed history enters ${unconstructed.join(`, `)}. A required state needs a constructed history; a state that is only counted belongs in \`measured\`.`,
    )
  const arbitrary =
    constructions.length === 0
      ? source.arbitrary
      : fc.oneof(
          { arbitrary: source.arbitrary, weight: constructions.length },
          ...constructions.map((construction) => ({
            arbitrary: source.arbitrary.map(construction.build),
            weight: 1,
          })),
        )
  for (const construction of constructions) {
    const undeclared = construction.enters.filter(
      (state) => declared !== void 0 && !required.includes(state),
    )
    if (undeclared.length > 0)
      throw new Error(
        `${id}: constructed history "${construction.name}" names undeclared states ${undeclared.join(`, `)}.`,
      )
  }
  const predicateFor = (constructionOf, counts) => {
    let firstKind
    const keeps = (kind) => (firstKind ??= kind) === kind
    return async (history) => {
      let outcome
      try {
        outcome = await runOne(options, history)
      } catch (error) {
        if (keeps(`setup`)) throw error
        return
      }
      const { verdict, reached } = outcome
      for (const state of reached) {
        if (declared !== void 0 && !declared.has(state))
          throw new Error(
            `${id}: a history entered "${state}", which the property does not declare.`,
          )
        counts.set(state, (counts.get(state) ?? 0) + 1)
      }
      if (verdict.kind === `pass`) {
        const construction = constructionOf.get(history)
        const missing =
          construction?.enters.filter((state) => !reached.has(state)) ?? []
        if (missing.length === 0 || !keeps(`constructed-reach`)) return
        throw new Error(
          `${id}: constructed history "${construction.name}" did not enter ${missing.join(`, `)}. A constructed history must reach every state it names.`,
        )
      }
      if (!keeps(`law:${lawOf(verdict)}`)) return
      throw failure(
        options,
        verdict,
        history,
        `${oracleEnvName(`PROPERTY`)}=${id} with the seed and path that fast-check reports`,
      )
    }
  }
  const examplesFor = (seed) => {
    const constructionOf = /* @__PURE__ */ new Map()
    const examples = constructions.map((construction, index) => {
      const [generated] = fc.sample(source.arbitrary, {
        seed: seed + index,
        numRuns: 1,
      })
      const history = construction.build(generated)
      if (!source.arbitrary.canShrinkWithoutContext(history))
        throw new Error(
          `${id}: constructed history "${construction.name}" built a history the arbitrary cannot generate. A constructed history must stay inside the generated language so that its failures shrink.`,
        )
      constructionOf.set(history, construction)
      return [history]
    })
    return { examples, constructionOf }
  }
  const runCampaign = async (name, seed, parameters) => {
    const { examples, constructionOf } = examplesFor(seed)
    const counts = new Map([...(declared ?? [])].map((state) => [state, 0]))
    await fc.assert(
      fc.asyncProperty(arbitrary, predicateFor(constructionOf, counts)),
      parameters(examples),
    )
    process.stdout.write(
      `${id} ${name} reach ${JSON.stringify(Object.fromEntries([...counts].sort(([a], [b]) => (a < b ? -1 : 1))))}
`,
    )
  }
  const fixedCampaigns = source.fixedSeeds.map((seed) => ({
    name: `fixed seed ${seed}`,
    route: `fixed seed`,
    replays: [],
    run: () =>
      runCampaign(`fixed seed ${seed}`, seed, (examples) =>
        withOracleFixedHistories(
          { numRuns: oracleRuns(source.runs), seed },
          examples,
        ),
      ),
  }))
  const randomCampaign = {
    name: `random seed`,
    route: `random seed`,
    replays: [id],
    run: () => {
      const parameters = oraclePropertyOptions(source.runs, id)
      return runCampaign(`random seed`, parameters.seed, (examples) =>
        withOracleFixedHistories(parameters, examples),
      )
    },
  }
  const fixedTests = (source.fixed ?? []).map((fixed) => ({
    name: `fixed history: ${fixed.name}`,
    route: `fixed history`,
    replays: [],
    run: async () => {
      if (!source.arbitrary.canShrinkWithoutContext(fixed.history))
        throw new Error(
          `${id}: fixed history "${fixed.name}" is not a history the arbitrary can generate. A fixed history must stay inside the generated language, or the property must declare the missing dimension as a limit.`,
        )
      const { verdict, reached } = await runOne(options, fixed.history)
      if (verdict.kind === `violation`)
        throw failure(
          options,
          verdict,
          fixed.history,
          rerunByName(id, `fixed history: ${fixed.name}`),
        )
      const missing = (fixed.enters ?? []).filter(
        (state) => !reached.has(state),
      )
      if (missing.length > 0)
        throw new Error(
          `${id}: fixed history "${fixed.name}" did not enter ${missing.join(`, `)}; it entered ${[...reached].sort().join(`, `) || `no declared state`}. A fixed history must reach every state it names.`,
        )
    },
  }))
  const namedHistories = () => {
    const { examples, constructionOf } = examplesFor(source.fixedSeeds[0] ?? 0)
    return [
      ...(source.fixed ?? []).map(({ name, history }) => ({
        name: `fixed history: ${name}`,
        history,
      })),
      ...examples.map(([history]) => ({
        name: `constructed history: ${constructionOf.get(history).name}`,
        history,
      })),
    ]
  }
  const determinism = determinismTest(options, () => [
    ...namedHistories(),
    ...fc
      .sample(source.arbitrary, { seed: source.fixedSeeds[0] ?? 0, numRuns: 3 })
      .map((history, index) => ({ name: `generated ${index}`, history })),
  ])
  const calibrations = calibrationTests(options, () => [
    ...namedHistories(),
    ...fc
      .sample(source.arbitrary, {
        seed: source.fixedSeeds[0] ?? 0,
        numRuns: 100,
      })
      .map((history, index) => ({ name: `sample ${index}`, history })),
  ])
  return [
    ...fixedCampaigns,
    randomCampaign,
    ...fixedTests,
    ...calibrations,
    determinism,
  ]
}
function recordRegistration(id, law, histories) {
  const manifest = process.env.ORACLE_MANIFEST
  if (manifest === void 0) return
  appendFileSync2(
    manifest,
    `${JSON.stringify({
      id,
      file: relativeTestFile(),
      owner: law.owner,
      authority: law.authority,
      histories: Array.isArray(histories)
        ? histories.length
        : { runs: histories.runs },
    })}
`,
  )
}
function relativeTestFile() {
  return expect.getState().testPath ?? `<test file>`
}

// dist/esm/oracle-reach.js
function createOracleReach(
  property,
  states,
  { minimum = 1, fixedHistories = 0, replaying: replayOverride } = {},
) {
  if (!Number.isInteger(minimum) || minimum < 1) {
    throw new Error(`${property}: minimum must be an integer of at least 1`)
  }
  if (!Number.isInteger(fixedHistories) || fixedHistories < 0) {
    throw new Error(`${property}: fixedHistories must be a nonnegative integer`)
  }
  if (new Set(states).size !== states.length) {
    throw new Error(`${property}: a reach state is declared twice`)
  }
  const counts = new Map(states.map((state) => [state, 0]))
  const enteredByFixed = /* @__PURE__ */ new Set()
  let histories = 0
  let fixedBegun = 0
  let currentFixed = false
  let current = /* @__PURE__ */ new Set()
  const replaying =
    replayOverride ?? readOracleRunConfig().replayPath !== void 0
  return {
    /** Starts one generated history, or a fixed history's when `fixed`. */
    beginHistory({ fixed = false } = {}) {
      if (fixed) fixedBegun += 1
      currentFixed = fixed
      current = /* @__PURE__ */ new Set()
      histories += 1
    },
    /** The current history entered a declared state. */
    reach(state) {
      if (!counts.has(state)) {
        throw new Error(`${property}: undeclared reach state ${state}`)
      }
      if (histories === 0) {
        throw new Error(
          `${property}: reach(${state}) came before the first beginHistory()`,
        )
      }
      if (currentFixed) enteredByFixed.add(state)
      if (current.has(state)) return
      current.add(state)
      counts.set(state, counts.get(state) + 1)
    },
    /** How many histories entered each declared state. */
    counts() {
      return counts
    },
    /** Fails for each declared state that too few histories entered. */
    assertReached() {
      if (replaying) return
      if (fixedBegun < fixedHistories) {
        throw new Error(
          `${property}: only ${fixedBegun} of its ${fixedHistories} fixed histories ran, so a failure stopped the run inside the fixed examples`,
        )
      }
      const missed = [...counts]
        .filter(([, count]) => count < minimum)
        .map(([state, count]) => `${state} (${count})`)
      const unfixed =
        fixedHistories === 0
          ? []
          : states.filter((state) => !enteredByFixed.has(state))
      const failures = [
        ...(missed.length > 0
          ? [
              `${property}: generated histories reached these states fewer than ${minimum} times, so their laws were not enforced there: ${missed.join(`, `)}`,
            ]
          : []),
        ...(unfixed.length > 0
          ? [
              `${property}: its ${fixedHistories} fixed histories, the examples, did not enter these states, so their reach depends on the seed: ${unfixed.join(`, `)}`,
            ]
          : []),
      ]
      if (failures.length > 0)
        throw new Error(
          failures.join(`
`),
        )
    },
  }
}

// dist/esm/oracle-campaign.js
async function runOracleCampaign(
  prefix,
  states,
  run,
  { fixedSeed = 20261022 } = {},
) {
  const seedText = process.env[`${prefix}_SEED`]
  const path = process.env[`${prefix}_PATH`]
  const seed = seedText === void 0 ? void 0 : Number(seedText)
  if (
    seedText !== void 0 &&
    (seedText.trim() === `` || !Number.isSafeInteger(seed))
  ) {
    throw new Error(`${prefix}_SEED must be an integer`)
  }
  if (path !== void 0 && (seed === void 0 || !/^\d+(?::\d+)*$/.test(path)))
    throw new Error(`${prefix}_PATH requires a seed and numeric shrink path`)
  const campaigns =
    seed === void 0
      ? [
          { name: `fixed`, parameters: { seed: fixedSeed } },
          { name: `random`, parameters: {} },
        ]
      : [
          {
            name: `replay`,
            parameters: path === void 0 ? { seed } : { seed, path, numRuns: 1 },
          },
        ]
  for (const campaign of campaigns) {
    const reach = createOracleReach(prefix, states, {
      replaying: path !== void 0,
    })
    const parameters = {
      ...campaign.parameters,
      seed: oracleCampaignSeed(campaign.parameters.seed, prefix),
    }
    globalThis.__oracleRoute?.(
      campaign.name === `random` ? `random seed` : `fixed seed`,
    )
    try {
      await run(reach, parameters)
      reach.assertReached()
    } finally {
      console.info(
        `ORACLE_REACH ${JSON.stringify({
          property: prefix,
          campaign: campaign.name,
          seed: parameters.seed,
          minimum: path === void 0 ? 1 : null,
          counts: Object.fromEntries(reach.counts()),
        })}`,
      )
    }
  }
}

// dist/esm/oracle-failure-fidelity.js
var OracleCheckpointFailure = class extends Error {
  constructor(law, checkpoint, cause) {
    super(`${law} at ${checkpoint}: ${String(cause)}`, { cause })
    this.law = law
    this.checkpoint = checkpoint
    this.name = `OracleCheckpointFailure`
  }
}
function atOracleCheckpoint(law, checkpoint, compare) {
  try {
    return compare()
  } catch (error) {
    throw new OracleCheckpointFailure(law, checkpoint, error)
  }
}
function primaryFingerprint(error) {
  if (error instanceof AggregateError && error.errors.length > 0)
    return primaryFingerprint(error.errors[0])
  if (error instanceof OracleCheckpointFailure)
    return JSON.stringify([`comparison`, error.law, error.checkpoint])
  return JSON.stringify([
    `unmarked`,
    typeof error,
    error instanceof Error ? error.name : null,
    error instanceof Error ? error.message : String(error),
  ])
}
var OracleFailureReport = class extends AggregateError {
  constructor(original, reduced, nonReproducing) {
    super([], `Oracle reduction reproduced the original failure`, {
      cause: original.error,
    })
    this.original = original
    this.reduced = reduced
    this.nonReproducing = nonReproducing
    Object.defineProperties(this, {
      errors: {
        get: () => [
          original.error,
          ...(reduced.error === original.error ? [] : [reduced.error]),
          ...nonReproducing.map((failure2) => failure2.error),
        ],
      },
      message: {
        get: () =>
          `Oracle reduction reproduced the original failure ${original.fingerprint}
Original trace: ${original.trace}
Reduced trace: ${reduced.trace}` +
          (nonReproducing.length
            ? `
Non-reproducing reductions: ${nonReproducing.map((failure2) => failure2.fingerprint).join(`; `)}`
            : ``),
      },
    })
    this.name = `OracleFailureReport`
  }
}
function createOracleFailureFidelity(
  describeHistory = (history) => JSON.stringify(history),
) {
  let original
  let reduced
  const nonReproducing = []
  return {
    async run(history, body) {
      const trace = describeHistory(history)
      try {
        await body()
      } catch (error) {
        const failure2 = {
          fingerprint: primaryFingerprint(error),
          trace,
          error,
        }
        original ??= failure2
        if (failure2.fingerprint !== original.fingerprint) {
          nonReproducing.push(failure2)
          return
        }
        reduced = failure2
        throw new OracleFailureReport(original, failure2, nonReproducing)
      }
    },
    async assert(campaign) {
      try {
        await campaign()
      } catch (error) {
        if (original === void 0 || reduced === void 0) throw error
        const report = new OracleFailureReport(
          original,
          reduced,
          nonReproducing,
        )
        throw new AggregateError(
          [error, report],
          `${String(error)}
${report.message}`,
          { cause: error },
        )
      }
    },
  }
}

// dist/esm/oracle-declaration.js
function declareOracle(_parts) {}
export {
  OracleCheckpointFailure,
  OracleFailureReport,
  OracleViolation,
  assertRegisteredOracleProperty,
  atOracleCheckpoint,
  configureOracles,
  createOracleFailureFidelity,
  createOracleReach,
  declareOracle,
  differs,
  forwardCut,
  oracleCalibrationTest,
  oracleCampaignSeed,
  oracleProperty,
  oraclePropertyOptions,
  oracleRandomParameters,
  oracleReplayReporter,
  oracleReplayRequested,
  oracleReplaySkips,
  oracleReplayTest,
  oracleRoute,
  oracleRuns,
  pass,
  readOracleRunConfig,
  recordOracleFiniteReplay,
  recordOracleReplay,
  runOracleCampaign,
  scheduleFrom,
  useOracleClock,
  validateOraclePropertyRegistry,
  violation,
  withOracleFixedHistories,
  withinTurns,
}
