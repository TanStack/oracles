/**
 * Oracle properties: one constructor for an oracle's law, histories, model,
 * production driver, and check.
 *
 * An oracle file used to assemble these parts by hand: `declareOracle`, a loop
 * of `it` calls, assertions spread through the driver, and its own failure
 * text. `oracleProperty` takes the parts and does the mechanics that every
 * oracle shares, so an oracle file holds only the parts that state its law.
 * Cleanup stays with the driver: a driver releases what it created before it
 * returns or throws, so the framework never holds a production resource.
 *
 * The `ORC-` numbers below name rules of the oracle rubric that this framework
 * came from, TanStack DB's
 * https://github.com/TanStack/db/blob/main/docs/contributing/oracle-rubric.md.
 *
 * The parts keep their jobs separate (oracle rubric, ORC-003):
 *
 * - `law` states the promise, its authority, and its limits. A failure names it.
 * - `histories` is either an enumerated list, which runs in full (bounded
 *   exhaustiveness, glossary), or a generated source: a fast-check arbitrary
 *   with a run budget, fixed seeds, constructed histories, and fixed histories
 *   (below).
 * - `model` gives the expected result of a history and its recorded trace,
 *   without production. A model that answers from the history alone ignores
 *   the trace; a model of an environment the driver observes reads it, and
 *   reads only the inputs the driver recorded, never what production showed.
 * - `driver` runs one history through production and records public
 *   observations with `observe(checkpoint, value)`. It returns nothing, so it
 *   cannot decide a verdict. A
 *   production error that the law cares about is an observation the driver
 *   records. An error that escapes the driver is a setup error, unless the
 *   trace recorded before it already violates the law: then the violation is
 *   the failure, with the error as its cause, so a later crash cannot hide an
 *   earlier wrong observation. A check therefore judges the recorded
 *   checkpoints first and the trace's completeness last, and a model must
 *   accept any prefix of a trace: a driver error or a controlled-clock spin
 *   cuts a trace short, and a model that throws on the cut trace fails the
 *   history with an `OracleModelError` that names the model, a framework
 *   error that shrinks as its own kind (maintainer decision, 2026-11-08).
 * - `check` compares the observations with the model and returns a verdict.
 *   Only the check can report a violation of the law. A violation that gives
 *   the `actual` and `expected` values gets the test runner's usual diff;
 *   `differs` builds one from an exact comparison.
 *
 * Observations and enumerated histories are data (maintainer decision,
 * 2026-11-08): primitives, with -0, NaN, the infinities, bigints, and
 * undefined; arrays whose own keys are exactly their indices, each an
 * enumerable data property, and `length`; plain objects (a null prototype or
 * a realm's `Object.prototype`) whose own properties are enumerable data
 * properties with string keys; Maps and Sets without own properties; and
 * Errors with the native brand, as their name and message (data properties
 * on the Error or its prototype chain), their own enumerable data
 * properties, cause, and AggregateError `errors`, never their stack. No
 * prototype on the way may be a proxy. A driver converts anything else (a Date, a class
 * instance, a DOMException, a function) before it observes it: an
 * observation that is not data fails its history at once with an
 * `OracleDataError` naming the value's path, such as `observation 3
 * ("result") .reason: DOMException is not observation data`, and an
 * enumerated source holding a history that is not data fails to register.
 * Arrays, Maps, Sets, and Errors are recognized by their brands, so data from
 * another realm is data; an old-style Error (an Error prototype without the
 * native brand) is not. Reading a value never runs its getters or a proxy's
 * traps. Data deeper or larger than the framework can encode fails as a
 * framework limit, never as data that is not data. A failure report prints a generated history even when it is
 * not data, through Node's inspection; names and comparisons never do.
 *
 * Each history is one test, named by `label`, or, without one, by the
 * history's data encoding, which is its JSON text for JSON data and the same
 * on every machine. A violation fails it with an `OracleViolation` that
 * names the property, the law, the checkpoint, the difference, the history
 * in that encoding, and the command that reruns that history: a `-t` pattern
 * that matches the test's full name, its enclosing suites' names included,
 * escaped because Vitest reads `-t` as a regular expression, and quoted for a
 * POSIX shell, so it pastes as printed. Every observation is
 * also offered to `globalThis.__oracleObserve` when a harness installs one,
 * so the gap report can tell an output the check does not compare from one
 * that never changed.
 *
 * A generated source runs one test per fixed seed and one random test, with
 * the same arbitrary, check, and budget (ORC-007). The random test reads the
 * replay variables through `oraclePropertyOptions`, and every test stands
 * aside during another property's path replay.
 *
 * - **Reach** names the states a history entered. By default the driver
 *   reports them with `observe("reach", state)`. A state that only the model
 *   can name, such as "a failure while the seed is active", comes from
 *   `reached(history, trace, expected)` instead. Each campaign prints how many
 *   histories entered each declared state, including none (ORC-015).
 * - A **state probe** binds a declared state, written `{ name, probe }` in
 *   `states` or `measured`, to a production probe. The function where
 *   production decides whether it enters that state guards the probe with
 *   `const probing = typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production'`
 *   and calls `probing && globalThis.__oracleProbe?.('package#name', condition)`
 *   (maintainer decision, 2026-11-08); `condition` is truthy when
 *   production enters it. The framework collects the calls each history makes
 *   inside that history's async context, and never shows them to the model or
 *   the check. Two laws read them. A probe is **reached** in a history when
 *   it was called at all, whatever its condition. A probe-bound state is
 *   **entered** in a history when its probe was called with a truthy
 *   condition. `predict(plan)` says, from the plan alone, whether the history
 *   enters each probe-bound state. A history whose prediction disagrees with
 *   its entries, in either direction, violates law `reach agreement` at
 *   checkpoint `states`, after a driver error and the check's own violation,
 *   so it shrinks and replays like any violation. A predicted entry that does
 *   not happen says why: its probe was never reached, or it was reached with a
 *   false condition, which need different fixes. A probe-bound state counts as
 *   reached only where the prediction and the entry agree, whatever `reached`
 *   or the driver's `reach` records say. Two calibrations per probe force its
 *   entry to be true and to be false; the check must reject both. The
 *   determinism test compares the probe calls each run makes. A call that
 *   arrives after its history's driver settled throws where it happens: the
 *   driver must await the work it starts.
 * - A **constructed history** is built from a generated history so that it
 *   reaches states that the laws need, and it names those declared states.
 *   Every campaign runs every constructed history once as an example, and a
 *   constructed history that does not enter a named state fails. Only
 *   constructed histories make reach required: a state that random histories
 *   reach is measured, never gated. So every state in `states` must be named
 *   by a constructed history, and a state the property only measures is
 *   declared in `measured` instead (ORC-015). Half of a campaign's generated
 *   histories are also constructed, so the histories after each required
 *   state are explored, not visited once.
 * - A **fixed history** is a named history, such as a fixed regression. It may
 *   name the states it `enters`, which its run must reach. Fixed and
 *   constructed histories must be histories the arbitrary can take back
 *   (`canShrinkWithoutContext`), so they shrink like generated ones and cannot
 *   cover a dimension that the grammar lacks; such a dimension belongs in the
 *   grammar, or in the property's stated limits. The property checks this when
 *   it registers, for every fixed history and for the constructed histories
 *   built from the first fixed seed (or seed 0 when there is none), so a
 *   constructed history's `build` runs when the test file loads. It fails to
 *   load naming the history, and a `build` that throws there fails to load
 *   naming its constructed history
 *   (maintainer decision, 2026-11-10); a campaign checks the constructed
 *   histories its own seed builds. In fast-check 4, a `.map` without an
 *   unmapper, at the whole history or anywhere inside it, takes no value
 *   back, so a history inside the language fails too until its `.map` gets
 *   an unmapper.
 * - **Resolution.** A history can name its actions indirectly, such as "settle
 *   the second active transaction". `resolve(history)` turns it into the plan
 *   of concrete actions that the driver runs and that the model and check read.
 *   The plan holds actions, never expected observations, so the driver still
 *   decides nothing. A history shrinks before resolution, so every shrunk
 *   history still resolves to a legal plan.
 * - **Calibration.** A `calibration` names a wrong answer and the law that
 *   must reject it: a `corrupt` function that alters a recorded trace, as an
 *   observation mutant does, or a mutant `driver`, such as production set up
 *   wrongly. The calibration test finds a history where the corruption
 *   applies and the clean trace passes (it skips a candidate whose clean trace
 *   fails), and requires the check to report that law for the corrupted one
 *   (rubric, ORC-006).
 * - **Determinism.** A `determinism` test runs some histories twice and
 *   requires the same trace: every fixed and constructed history of a generated
 *   source and three generated histories, or up to eight evenly spaced
 *   enumerated histories. Two runs are compared by their observations' data
 *   encodings, so `-0` and `0`, key order, and Map and Set order count, as a
 *   check that iterates them can see. A trace
 *   that differs between runs of one history breaks replay, shrinking, and the gap
 *   report's comparison, so a driver records relations (before and after,
 *   same or different id) rather than clock readings or random ids.
 * - **Shrinking keeps the failure.** A violation can name the law it broke.
 *   Once a history fails one way, a setup error, a constructed history that
 *   missed its state, or
 *   one law, a smaller history that fails another way counts as passing, so
 *   the reported counterexample still shows the first failure (ORC-010).
 *   Within one history a driver error decides first, then a law violation,
 *   then a constructed history that missed its state.
 * - **Bounded clock.** A driver that runs on `useOracleClock` has virtual
 *   timers and `Date`; macrotask turns stay real. The clock fires at most
 *   `maxTimers` timers (1,000 by default) in one history. Past that it stops
 *   firing them, and the history fails under law `bounded clock` at
 *   checkpoint `clock`: work that never goes quiet on a controlled clock is
 *   a defect (maintainer decision, 2026-11-06). The spin ranks as a driver
 *   error does, by where it happens: only a violation at a checkpoint
 *   recorded before it still decides, and a driver error after it does not.
 *
 * `oracle-property-self-oracle.test.ts` checks these promises the way an
 * oracle checks production: it runs synthetic properties under real Vitest
 * and compares what Vitest reports with an independent model.
 *
 * The `oracle/no-unit-test` lint rule treats an `oracleProperty` call as an
 * oracle test whose parts are its arguments, when its options are an object
 * literal with a `check`. The property is its own declaration.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { appendFileSync } from 'node:fs'
import { inspect, isDeepStrictEqual, types } from 'node:util'
import fc from 'fast-check'
import { describe, expect, it, vi } from 'vitest'
import {
  assertRegisteredOracleProperty,
  oraclePropertyOptions,
  oracleReplayTest,
  oracleRuns,
  withOracleFixedHistories,
} from './oracle-config.js'
import { oracleEnvName } from './oracle-environment.js'
import { oracleFixedSeed, oracleRoute, oracleRouteOf } from './oracle-route.js'
import type { OracleRoute } from './oracle-route.js'

/** A law and where it comes from. */
export interface OracleLaw {
  /** The promise, stated so that a reader could predict an observation. */
  statement: string
  /** The contract document and section, or the maintainer decision. */
  authority: string
  /** What this property does not establish. */
  limits: string
}

/** One recorded public fact, at the checkpoint where the contract owes it. */
export interface Observation {
  checkpoint: string
  value: unknown
}

/** The check's judgment of one history. */
export type Verdict =
  | { kind: `pass` }
  | {
      kind: `violation`
      checkpoint: string
      difference: string
      /** The law broken, which shrinking preserves. Defaults to the checkpoint. */
      law?: string
      /** The observed and owed values, which the failure shows as a diff. */
      values?: { actual: unknown; expected: unknown }
      /** A driver error that came after the violated checkpoint. */
      cause?: unknown
    }

export const pass: Verdict = { kind: `pass` }

export function violation(
  checkpoint: string,
  difference: string,
  law?: string,
  values?: { actual: unknown; expected: unknown },
): Verdict {
  return { kind: `violation`, checkpoint, difference, law, values }
}

/**
 * One exact comparison: a violation of `law` at `checkpoint` when `actual` is
 * not deep-equal to `expected`, with both values attached so the failure
 * shows a diff; otherwise undefined, so comparisons chain as
 * `return differs(...) ?? differs(...) ?? pass`. Two data values are equal
 * when they are the same data, whatever order their object keys and Map and
 * Set entries come in: undefined-versus-absent fields and `-0` count, and a
 * prototype does not, so data from another realm equals data built here.
 * Values outside the data domain compare by Node's `isDeepStrictEqual`.
 */
export function differs(
  checkpoint: string,
  law: string,
  actual: unknown,
  expected: unknown,
  difference = `the observed value differs from the owed value`,
): Verdict | undefined {
  return sameData(actual, expected)
    ? undefined
    : violation(checkpoint, difference, law, { actual, expected })
}

function sameData(actual: unknown, expected: unknown): boolean {
  try {
    return (
      encodeData(actual, ``, `compared`, true, false) ===
      encodeData(expected, ``, `compared`, true, false)
    )
  } catch (error) {
    // Only a value outside the domain compares by isDeepStrictEqual; a
    // framework limit is reported as such.
    if (!(error instanceof OracleDataError)) throw error
    return isDeepStrictEqual(actual, expected)
  }
}

/**
 * History checking against allowed cuts.
 * A model can often name, in order, the states an observer may see after a
 * step without fixing which of them it sees: a publication may skip a state
 * but never go back to an earlier one. `forwardCut` returns the index of the
 * first cut at or after `from` that equals `observed`, or -1 when the
 * observation is no allowed state ahead of `from`. The caller keeps the
 * returned index as the next `from`.
 */
export function forwardCut<TState>(
  cuts: ReadonlyArray<TState>,
  observed: TState,
  from: number,
  same: (allowed: TState, observed: TState) => boolean,
): number {
  for (let index = from; index < cuts.length; index += 1)
    if (same(cuts[index]!, observed)) return index
  return -1
}

/**
 * Logical time for drivers. A driver that
 * must not hang when production never settles a promise waits with
 * `withinTurns(promise, turns)`: it resolves `true` as soon as the promise
 * settles, or `false` once `turns` event-loop turns pass without it settling.
 * A promise that had already settled when `withinTurns` was called settled
 * in time, even with zero turns. `turns` is a nonnegative integer; any other
 * number counts no turns, so `withinTurns` throws when called with one. The
 * bound counts turns, not milliseconds, so a loaded machine cannot turn a
 * slow but legal settlement into a timeout. It cannot
 * wait for work that production schedules on a delayed timer; a driver for
 * such work controls that timer.
 */
/**
 * One event-loop turn. `setTimeout(0)` waits at least a millisecond in Node,
 * which made schedule-heavy histories mostly idle; `setImmediate` yields the
 * same turn without that clamp. A browser has no `setImmediate`.
 */
const nextTurn = () =>
  new Promise<void>((resolve) =>
    typeof setImmediate === `function`
      ? setImmediate(resolve)
      : setTimeout(resolve, 0),
  )

export function withinTurns(
  promise: Promise<unknown>,
  turns: number,
): Promise<boolean> {
  if (!Number.isInteger(turns) || turns < 0)
    throw new Error(
      `withinTurns: ${turns} turns counts no turns; a number of turns is a nonnegative integer`,
    )
  // An object, so the loop reads the flag that the callbacks set.
  const state = { settled: false }
  const done = promise.then(
    () => (state.settled = true),
    () => (state.settled = true),
  )
  const expiry = (async () => {
    for (let turn = 0; turn < turns && !state.settled; turn += 1)
      await nextTurn()
    // The settlement callbacks of a promise that settled by the deadline,
    // or before the call, run before this one.
    await undefined
    return state.settled
  })()
  return Promise.race([done, expiry])
}

/**
 * A schedule as plain data. `scheduleFrom(choices)` orders promises the way
 * fast-check's `fc.scheduler()` does, with the same method names, but its
 * decisions are a list of numbers in the history. A task belongs to a queue
 * (its label's text before the first space, unless `queue` names one), and a
 * queue releases its tasks in the order they were scheduled, as a storage
 * engine completes one store's operations in order. At each step the schedule
 * releases the oldest task of queue `choices[step] % queues`, counting the
 * queues that have a pending task in the order they first did, and the oldest
 * task overall once the choices run out. A choice is a nonnegative integer:
 * any other number names no queue, so `scheduleFrom` throws when it is called
 * with one. A history that holds the choices replays exactly, shrinks
 * like any array, can be a fixed or constructed history, and prints as JSON; a
 * `fc.scheduler()` value does none of these (it is consumed as it runs, its
 * clones do not reproduce, and it is never a member of its own language).
 */
export interface DataScheduler {
  /** A promise that settles like `promise`, once the schedule releases it. */
  schedule: <T>(
    promise: Promise<T> | T,
    label?: string,
    queue?: string,
  ) => Promise<T>
  /** Releases one pending task and waits for its continuations. */
  waitOne: () => Promise<void>
  /** Releases tasks until none is pending, including ones they schedule. */
  waitIdle: () => Promise<void>
  /** The labels of released tasks, in release order. */
  released: () => ReadonlyArray<string>
}

export function scheduleFrom(choices: ReadonlyArray<number>): DataScheduler {
  // findIndex visits a hole as undefined, which names no queue too.
  const misfit = choices.findIndex(
    (choice) => !Number.isInteger(choice) || choice < 0,
  )
  if (misfit >= 0)
    throw new Error(
      `scheduleFrom: choice ${String(choices[misfit])} names no queue; a choice is a nonnegative integer`,
    )
  const pending: Array<{ label: string; queue: string; release: () => void }> =
    []
  const released: Array<string> = []
  let step = 0
  // Continuations of a released task run on microtasks; one macrotask turn
  // lets them finish, and lets them schedule further tasks.
  const settle = nextTurn
  const waitOne = async () => {
    if (pending.length === 0) return
    const queues = [...new Set(pending.map((task) => task.queue))]
    const choice = choices[step++]
    const at =
      choice === undefined
        ? 0
        : pending.findIndex(
            (task) => task.queue === queues[choice % queues.length],
          )
    const [task] = pending.splice(at, 1)
    released.push(task!.label)
    task!.release()
    await settle()
  }
  return {
    schedule: <T>(
      promise: Promise<T> | T,
      label = `task ${pending.length}`,
      queue = label.split(` `)[0]!,
    ) =>
      new Promise<T>((resolve, reject) => {
        // The schedule owns the promise from here: a rejection waits for its
        // release without counting as unhandled, then reaches the caller.
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

/**
 * The check found a history whose observations the law does not allow.
 * `actual` and `expected` are the fields Vitest reads to print a diff.
 */
export class OracleViolation extends Error {
  override name = `OracleViolation`
  actual?: unknown
  expected?: unknown
  showDiff?: boolean
}

/**
 * A model threw on a trace that a driver error or a controlled-clock spin cut
 * short. Models must accept any prefix of a trace, so this is the model's
 * defect, not a verdict about production. Its `cause` is the model's error,
 * and `driverError` the driver's, often production's own crash, which its
 * message also quotes.
 */
export class OracleModelError extends Error {
  override name = `OracleModelError`
  driverError?: unknown
}

/**
 * A history built from a generated one so that it reaches the states the
 * laws need. The driver reports reached states with `observe("reach", state)`.
 */
export interface ConstructedHistory<THistory> {
  name: string
  enters: ReadonlyArray<string>
  build: (generated: THistory) => THistory
}

/**
 * A declared state: its name, or its name and the production probe that marks
 * it (`package#name`). A probe-bound state's reach is the agreement between
 * the property's `predict` and the probe's entries.
 */
export type DeclaredState = string | { name: string; probe: string }

export interface GeneratedHistories<THistory> {
  arbitrary: fc.Arbitrary<THistory>
  /**
   * The declared states the laws depend on (ORC-015). Each must be named by a
   * constructed history, so every campaign reaches it. Each campaign reports
   * how many histories entered each one, including none.
   */
  states?: ReadonlyArray<DeclaredState>
  /**
   * States that are counted but not required. A reached state outside
   * `states` and `measured` fails, so a misspelled state cannot pass unseen.
   */
  measured?: ReadonlyArray<DeclaredState>
  /** The base run budget of each campaign, scaled by the run multiplier. */
  runs: number
  /** One fixed-seed campaign per seed, beside the random campaign. */
  fixedSeeds: ReadonlyArray<number>
  constructed?: ReadonlyArray<ConstructedHistory<THistory>>
  fixed?: ReadonlyArray<FixedHistory<THistory>>
}

/** A named fixed history, such as a fixed regression, and the states it must enter. */
export interface FixedHistory<THistory> {
  name: string
  history: THistory
  enters?: ReadonlyArray<string>
}

/** A wrong answer and the law that must reject it (ORC-006). */
export type Calibration<THistory, TPlan> = {
  name: string
  /** The law the check must report. */
  law: string
} & (
  | {
      /** A corrupted copy of the trace, or undefined when nothing applies. */
      corrupt: (
        trace: ReadonlyArray<Observation>,
        plan: TPlan,
      ) => ReadonlyArray<Observation> | undefined
    }
  | {
      /** A mutant driver, such as production configured wrongly. */
      driver: OraclePropertyOptions<THistory, unknown, TPlan>[`driver`]
    }
)

export interface OraclePropertyOptions<THistory, TExpected, TPlan = THistory> {
  /** A stable identifier, used in failures, the manifest, and replay. */
  id: string
  law: OracleLaw
  /** Every legal history in a fixed order, or a generated source. */
  histories: ReadonlyArray<THistory> | GeneratedHistories<THistory>
  /** A short, unique test name for an enumerated history. */
  label?: (history: THistory) => string
  /** The plan of concrete actions; required when Plan is not History. */
  resolve?: (history: THistory) => TPlan
  model: (plan: TPlan, trace: ReadonlyArray<Observation>) => TExpected
  /** The states the history entered. Defaults to the trace's `reach` values. */
  reached?: (
    plan: TPlan,
    trace: ReadonlyArray<Observation>,
    expected: TExpected,
  ) => Iterable<string>
  driver: (
    plan: TPlan,
    observe: (checkpoint: string, value: unknown) => void,
  ) => Promise<void> | void
  check: (
    plan: TPlan,
    observations: ReadonlyArray<Observation>,
    expected: TExpected,
  ) => Verdict
  calibrations?: ReadonlyArray<Calibration<THistory, TPlan>>
  /**
   * Whether the history enters each probe-bound state, from the plan alone:
   * a prediction never sees the trace, so it cannot follow production.
   */
  predict?: (plan: TPlan) => Readonly<Record<string, boolean>>
  /** Each registered test's limit in milliseconds; 120 seconds by default. */
  timeout?: number
  /**
   * The production code this oracle owns: a source path relative to the
   * package (`src/x.ts`), or one of its functions (`src/x.ts#run`,
   * `src/x.ts#Class.method`), whose static call tree it then owns. The gap
   * report reads this list statically, so it must be a non-empty literal
   * list of literal strings; an empty list, or any other value, fails
   * registration (maintainer decision, 2026-11-10: `oracleProperty` takes
   * `owns`).
   */
  owns?: ReadonlyArray<string>
}

declare global {
  // Installed by the gap report's test setup, absent otherwise.
  var __oracleObserve:
    ((checkpoint: string, value: unknown) => void) | undefined
  // Production probes call this in development builds; see `probes`.
  var __oracleProbe: ((name: string, condition: unknown) => void) | undefined
  // Installed by the gap report's test setup, absent otherwise. It receives
  // every law violation the framework raises, so a mutant's kill is
  // classified by the law that rejected it rather than by its message.
  var __oracleVerdict:
    | ((verdict: { property: string; law: string; checkpoint: string }) => void)
    | undefined
}

/** The probe calls one history made: which probes it reached and which it entered. */
interface ProbeRecord {
  reached: ReadonlySet<string>
  entered: ReadonlySet<string>
}
/** A history's probe record, open until its driver settles. */
interface ProbeWindow {
  reached: Set<string>
  entered: Set<string>
  open: boolean
}
const probeWindows = new AsyncLocalStorage<ProbeWindow>()
// Outside any history, such as in an ordinary test, a probe does nothing. A
// call that arrives after its history's driver settled throws where it
// arrives: the driver did not await work that production started.
// Installed when this module loads, so a production probe always finds it.
// The package marks itself side-effect free: a consumer that imports anything
// from the main entry evaluates this module, which is what the probe needs.
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

/** A calibration's forced entry: the probe is reached, and its entry is forced to the stated value. */
interface ForcedProbe {
  probe: string
  entered: boolean
}
const agreementLaw = `reach agreement`

/** A property's options with the probes its declared states bind, by state. */
type BoundOptions<THistory, TExpected, TPlan> = OraclePropertyOptions<
  THistory,
  TExpected,
  TPlan
> & { probes?: ReadonlyMap<string, string> }

const stateName = (state: DeclaredState) =>
  typeof state === `string` ? state : state.name

/** A Vitest test or suite, as far as its full name needs. */
interface NamedTask {
  name: string
  suite?: NamedTask
}

/** One test that a property registers. */
interface PropertyTest {
  name: string
  /**
   * The test's route, which the gap report reads to tell a reproducible kill
   * from a random-only one or a framework check (`__oracleRoute`).
   */
  route: OracleRoute
  /** Runs the test; `task` is Vitest's record of it, for its full name. */
  run: (task: NamedTask) => Promise<void>
  /** Path replays this test runs during; empty stands aside during every one. */
  replays: ReadonlyArray<string>
}

export function oracleProperty<THistory, TExpected, TPlan = THistory>(
  options: OraclePropertyOptions<THistory, TExpected, TPlan>,
): void {
  // Every source names a registered property, so its replay and manifest
  // entries exist; an enumerated source has no random campaign to check it.
  assertRegisteredOracleProperty(options.id)
  const { id, histories, owns } = options
  if (
    owns !== undefined &&
    !(
      Array.isArray(owns) &&
      owns.length > 0 &&
      owns.every((entry) => typeof entry === `string`)
    )
  )
    throw new Error(
      `${id}: \`owns\` must be a non-empty literal list of strings, which the gap report reads statically.`,
    )
  if (Array.isArray(histories) && options.predict)
    throw new Error(
      `${id}: \`predict\` needs probe-bound states, which only a generated source declares.`,
    )
  recordRegistration(id, options.law, histories)
  // The tests are built as data first, so every one registers unconditionally
  // (oracle/no-disabled).
  const tests = Array.isArray(histories)
    ? enumeratedTests(options, histories as ReadonlyArray<THistory>)
    : generatedTests(options, histories as GeneratedHistories<THistory>)
  describe(id, () => {
    for (const test of tests)
      oracleReplayTest(it, ...test.replays)(
        test.name,
        ({ task }) => {
          oracleRoute(test.route)
          return test.run(task)
        },
        options.timeout ?? 120_000,
      )
  })
}

function enumeratedTests<THistory, TExpected, TPlan>(
  options: OraclePropertyOptions<THistory, TExpected, TPlan>,
  histories: ReadonlyArray<THistory>,
): Array<PropertyTest> {
  const spacing = Math.max(1, Math.ceil(histories.length / 8))
  // Every enumerated history is data; one that is not fails registration.
  const named = histories.map((history, index) => {
    const text = encodeData(history, `history ${index}`, `history`)
    return { name: options.label?.(history) ?? text, history }
  })
  return [
    ...named.map(({ name, history }) => enumeratedTest(options, name, history)),
    ...calibrationTests(options, () => named),
    determinismTest(options, () =>
      named.filter((_, index) => index % spacing === 0),
    ),
  ]
}

function enumeratedTest<THistory, TExpected, TPlan>(
  options: OraclePropertyOptions<THistory, TExpected, TPlan>,
  name: string,
  history: THistory,
): PropertyTest {
  return {
    name,
    route: `case`,
    replays: [],
    run: async (task) => {
      const { verdict } = await runOne(options, history)
      if (verdict.kind === `violation`)
        throw failure(options, verdict, history, rerunOf(task))
    },
  }
}

// The running history's trace, and where in it a controlled clock passed its
// bound (see `useOracleClock`).
let historyTrace: Array<Observation> | undefined
let clockSpin: { at: number; maxTimers: number } | undefined
/** The running history's spin, if its clock passed its bound; clears it. */
const takeClockSpin = () => {
  const spin = clockSpin
  clockSpin = undefined
  return spin
}

/**
 * Runs the rest of a driver's history on a controlled clock: timers and
 * `Date` are virtual, and macrotask turns (`setImmediate`) and microtasks
 * stay real, so in-memory work finishes between clock steps. The clock fires
 * at most `maxTimers` timers in the history; past that it stops firing them,
 * which ends a storm of timers that never goes quiet, and the history fails
 * under law `bounded clock`. Raise `maxTimers` for a legal history that needs
 * more. Call `release` in the driver's `finally`. Outside an
 * `oracleProperty` history, no history reports the spin, so `release`
 * reports the verdict itself and throws.
 */
export function useOracleClock({
  maxTimers = 1000,
}: { maxTimers?: number } = {}): {
  release: () => void
} {
  // The timers the clock replaces. Vitest's own restore would leave the
  // counting wrappers below in place.
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
    <TArgs extends Array<unknown>>(callback: (...args: TArgs) => void) =>
    (...args: TArgs) => {
      fired += 1
      if (fired > maxTimers) {
        clockSpin ??= { at: historyTrace?.length ?? 0, maxTimers }
        return
      }
      callback(...args)
    }
  const fakeTimeout = globalThis.setTimeout
  const fakeInterval = globalThis.setInterval
  globalThis.setTimeout = ((
    callback: unknown,
    ms?: number,
    ...args: Array<unknown>
  ) =>
    fakeTimeout(
      typeof callback === `function`
        ? counted(callback as (...a: Array<unknown>) => void)
        : (callback as () => void),
      ms,
      ...args,
    )) as typeof setTimeout
  globalThis.setInterval = ((
    callback: unknown,
    ms?: number,
    ...args: Array<unknown>
  ) =>
    fakeInterval(
      typeof callback === `function`
        ? counted(callback as (...a: Array<unknown>) => void)
        : (callback as () => void),
      ms,
      ...args,
    )) as typeof setInterval
  return {
    release: () => {
      vi.useRealTimers()
      globalThis.setTimeout = realTimeout
      globalThis.setInterval = realInterval
      if (historyTrace !== undefined) return
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

/**
 * Everything a deterministic driver repeats in one run of a history: its
 * trace, where a controlled clock passed its bound, and its probe calls. A
 * driver error ends the determinism test with that error.
 */
async function repeatedRecord<TPlan>(
  driver: (
    plan: TPlan,
    observe: (checkpoint: string, value: unknown) => void,
  ) => Promise<void> | void,
  plan: TPlan,
): Promise<Array<{ checkpoint: string; text: string }>> {
  // What each observe call saw, encoded when it was observed.
  const texts: Array<string> = []
  const { observations, driverError, probes, spin } = await recordGuarded(
    driver,
    plan,
    undefined,
    texts,
  )
  if (driverError) throw driverError.error
  return [
    ...observations.map(({ checkpoint }, index) => ({
      checkpoint,
      text: texts[index]!,
    })),
    ...(spin ? [{ checkpoint: `clock`, text: String(spin.at) }] : []),
    {
      checkpoint: `probes`,
      text: encodeData(
        {
          reached: [...probes.reached].sort(),
          entered: [...probes.entered].sort(),
        },
        `probes`,
        `observation`,
      ),
    },
  ]
}

/** The plan a history resolves to; a history is its own plan by default. */
function planOf<THistory, TExpected, TPlan>(
  options: OraclePropertyOptions<THistory, TExpected, TPlan>,
  history: THistory,
): TPlan {
  return options.resolve
    ? options.resolve(history)
    : (history as unknown as TPlan)
}

/**
 * A value outside the data domain, in an observation or an enumerated
 * history. Its message names the value's path in the trace and its kind.
 */
export class OracleDataError extends Error {
  override name = `OracleDataError`
}

/**
 * The encoding of a value in the data domain (maintainer decision,
 * 2026-11-08): primitives, with -0, NaN, the infinities, bigints, and
 * undefined; dense arrays; plain objects (a null prototype or a realm's
 * `Object.prototype`) whose own properties are enumerable data properties
 * with string keys; Maps and Sets without own properties; and Errors, as
 * their name and message (each a data property on the Error or its
 * prototype chain), their own enumerable data properties, cause, and
 * AggregateError `errors`, never their stack. An array is data when its own
 * keys are exactly its indices, each an enumerable data property, and
 * `length`. Arrays, Maps, Sets, and Errors are recognized by their brands,
 * so data from another realm is data. Two values have the same encoding
 * exactly when they are the same data: key order and Map and Set order
 * count, -0 is not 0, and an object's prototype is not data. JSON data
 * encodes as its JSON text.
 *
 * Reading a value never runs its code: only own property descriptors,
 * prototypes, and internal slots are read, never a getter, and a proxy is
 * not data. Anything else throws an `OracleDataError` that names `where` and
 * the value's path, a key that is not an identifier quoted. With `build`
 * false, the value is only checked; shared subtrees are read once either
 * way.
 */
function encodeData(
  value: unknown,
  where: string,
  what: string,
  build = true,
  ordered = true,
): string {
  const open = new Set<object>()
  const done = new Map<object, string>()
  const fail = (path: string, kind: string): never => {
    throw new OracleDataError(
      `${where}${path === `` ? `` : ` ${path.trimStart()}`}: ${kind} is not ${what} data`,
    )
  }
  const at = (path: string, key: string) =>
    /^[A-Za-z_$][\w$]*$/.test(key)
      ? `${path}.${key}`
      : `${path}[${JSON.stringify(key)}]`
  const descriptor = Object.getOwnPropertyDescriptor
  const prototypeOf = Object.getPrototypeOf as (object: object) => object | null
  // A data property's value; a hidden one only where `hidden` allows.
  const data = (property: PropertyDescriptor, path: string, hidden = false) => {
    if (!(`value` in property)) return fail(path, `an accessor`)
    if (!property.enumerable && !hidden) return fail(path, `a hidden property`)
    return property.value as unknown
  }
  // A data property on the object or its prototype chain, which holds no
  // proxy by the time this is called.
  const inherited = (object: object, key: string, path: string): unknown => {
    for (
      let holder = object as object | null;
      holder;
      holder = prototypeOf(holder)
    ) {
      const property = descriptor(holder, key)
      if (property) return data(property, path, true)
    }
    return undefined
  }
  // A realm's `Object.prototype`: no prototype, and Object's own methods.
  const objectPrototype = (prototype: object | null) =>
    prototype !== null &&
    prototypeOf(prototype) === null &&
    typeof descriptor(prototype, `hasOwnProperty`)?.value === `function`
  // A prototype's constructor, read as data; a proxy is never read.
  const constructorOf = (prototype: object | null): unknown => {
    const constructor: unknown =
      prototype && descriptor(prototype, `constructor`)?.value
    return typeof constructor === `function` && types.isProxy(constructor)
      ? `proxy`
      : constructor
  }
  // A realm's prototype for the constructor named `name`.
  const intrinsic = (prototype: object | null, name: string) => {
    const constructor = constructorOf(prototype)
    return (
      prototype !== null &&
      objectPrototype(prototypeOf(prototype)) &&
      typeof constructor === `function` &&
      descriptor(constructor, `name`)?.value === name
    )
  }
  // How an object outside the domain is named.
  const named = (prototype: object | null): string => {
    const constructor = constructorOf(prototype)
    if (constructor === `proxy`) return `an instance of a proxied class`
    if (typeof constructor !== `function`)
      return `an object with a custom prototype`
    const name: unknown = descriptor(constructor, `name`)?.value
    return typeof name === `string` && name !== ``
      ? name
      : `an instance of an anonymous class`
  }
  // Encodings in order, or sorted where order is not compared.
  const joined = (parts: Array<string>) =>
    (ordered ? parts : parts.sort()).join(`,`)
  const fields = (
    object: object,
    path: string,
    apart: ReadonlyArray<string> = [],
    hidden: ReadonlyArray<string> = [],
  ) =>
    joined(
      Reflect.ownKeys(object)
        .filter((key) => !apart.includes(key as string))
        .map((key) => {
          if (typeof key === `symbol`) return fail(path, `a symbol key`)
          const place = at(path, key)
          const text = encode(
            data(descriptor(object, key)!, place, hidden.includes(key)),
            place,
          )
          return build ? `${JSON.stringify(key)}:${text}` : ``
        }),
    )
  const container = (item: object, path: string): string => {
    if (types.isProxy(item)) return fail(path, `a proxy`)
    const prototype = prototypeOf(item)
    // No proxy on the prototype chain, so walking it runs no trap.
    for (let holder = prototype; holder; holder = prototypeOf(holder))
      if (types.isProxy(holder))
        return fail(path, `an object with a proxy prototype`)
    if (Array.isArray(item)) {
      if (!intrinsic(prototype, `Array`)) return fail(path, named(prototype))
      const length = descriptor(item, `length`)!.value as number
      const extra = Reflect.ownKeys(item)[length + 1]
      if (extra !== undefined)
        return typeof extra === `symbol`
          ? fail(path, `a symbol key`)
          : fail(at(path, extra), `a property on an array`)
      const items: Array<string> = []
      for (let index = 0; index < length; index += 1) {
        const property = descriptor(item, String(index))
        if (!property) return fail(path, `a sparse array`)
        const place = `${path}[${index}]`
        items.push(encode(data(property, place), place))
      }
      return build ? `[${items.join(`,`)}]` : ``
    }
    if (types.isMap(item) || types.isSet(item)) {
      const kind = types.isMap(item) ? `Map` : `Set`
      if (!intrinsic(prototype, kind)) return fail(path, named(prototype))
      const [key] = Reflect.ownKeys(item)
      if (key !== undefined)
        return typeof key === `symbol`
          ? fail(path, `a symbol key`)
          : fail(at(path, key), `a property on a ${kind}`)
      const members = types.isMap(item)
        ? [...Map.prototype.entries.call(item)].map(
            ([entryKey, entry], index) => {
              const keyText = encode(entryKey, `${path} map key ${index}`)
              const entryText = encode(entry, `${path} map value ${index}`)
              return build ? `${keyText}=>${entryText}` : ``
            },
          )
        : [...Set.prototype.values.call(item)].map((entry, index) =>
            encode(entry, `${path} set item ${index}`),
          )
      return build ? `${kind}{${joined(members)}}` : ``
    }
    if (types.isNativeError(item)) {
      if (typeof DOMException === `function` && item instanceof DOMException)
        return fail(path, `DOMException`)
      const name = encode(
        inherited(item, `name`, at(path, `name`)),
        at(path, `name`),
      )
      const message = encode(
        inherited(item, `message`, at(path, `message`)),
        at(path, `message`),
      )
      const own = fields(
        item,
        path,
        [`stack`, `name`, `message`],
        [`cause`, `errors`],
      )
      return build ? `Error(${name},${message}){${own}}` : ``
    }
    if (item instanceof Error)
      return fail(path, `an old-style Error without the native brand`)
    if (prototype !== null && !objectPrototype(prototype))
      return fail(path, named(prototype))
    const own = fields(item, path)
    return build ? `{${own}}` : ``
  }
  const encode = (item: unknown, path: string): string => {
    if (typeof item === `string`) return build ? JSON.stringify(item) : ``
    if (typeof item === `number`)
      return build ? (Object.is(item, -0) ? `-0` : String(item)) : ``
    if (typeof item === `bigint`) return build ? `${item}n` : ``
    if (item === null || item === undefined || typeof item === `boolean`)
      return build ? String(item) : ``
    if (typeof item !== `object`) return fail(path, `a ${typeof item}`)
    if (open.has(item)) return fail(path, `a cycle`)
    const known = done.get(item)
    if (known !== undefined) return known
    open.add(item)
    let text: string
    try {
      text = container(item, path)
    } catch (error) {
      // A framework limit is not a verdict about the value.
      if (error instanceof OracleDataError || error instanceof RangeError)
        throw error
      // An exotic object that throws while it is read is not data.
      return fail(path, `an object that cannot be read`)
    }
    open.delete(item)
    done.set(item, text)
    return text
  }
  try {
    return encode(value, ``)
  } catch (error) {
    // A stack or a string too large for the engine: data that is too deep
    // or too large for the framework, which is not a property of the data.
    if (error instanceof RangeError)
      throw new Error(
        `${where}: the value is deeper or larger than the framework's encoding limit`,
        { cause: error },
      )
    throw error
  }
}

// A copy of data as it was when it was observed, with its prototypes, its
// brands, and its own properties; a shared reference stays shared. Only data
// is copied: the observe call checked it first.
function snapshotOf(
  value: unknown,
  copies = new Map<object, unknown>(),
): unknown {
  if (typeof value !== `object` || value === null) return value
  const known = copies.get(value)
  if (known !== undefined) return known
  const copy = Object.setPrototypeOf(
    Array.isArray(value)
      ? []
      : types.isMap(value)
        ? new Map()
        : types.isSet(value)
          ? new Set()
          : types.isNativeError(value)
            ? Object.defineProperty(new Error(), `stack`, { value: undefined })
            : {},
    Object.getPrototypeOf(value) as object | null,
  ) as object
  copies.set(value, copy)
  if (types.isMap(value))
    for (const [key, entry] of Map.prototype.entries.call(value))
      Map.prototype.set.call(
        copy,
        snapshotOf(key, copies),
        snapshotOf(entry, copies),
      )
  if (types.isSet(value))
    for (const entry of Set.prototype.values.call(value))
      Set.prototype.add.call(copy, snapshotOf(entry, copies))
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === `length`) continue
    const property = Object.getOwnPropertyDescriptor(value, key)!
    Object.defineProperty(
      copy,
      key,
      `value` in property
        ? { ...property, value: snapshotOf(property.value, copies) }
        : property,
    )
  }
  return copy
}

// A value as report text, which never throws and is never a name or a
// comparison: its data encoding, or, for a value that is not data, Node's
// inspection on one line without stack frames, which name this machine's
// files. At most 2,000 characters.
function reportText(value: unknown): string {
  try {
    return encodeData(value, ``, `report`).slice(0, 2000)
  } catch {
    try {
      return (
        inspect(value, { depth: 6, breakLength: Infinity })
          .split(`\n`)
          // A frame's text goes; the brace an Error's properties open after
          // its last frame stays.
          .map((line) => line.replace(/^\s+(?:at |\.\.\. ).*?( \{)?$/, `$1`))
          .filter(Boolean)
          .join(` `)
          .slice(0, 2000)
      )
    } catch {
      return Object.prototype.toString.call(value)
    }
  }
}

function determinismTest<THistory, TExpected, TPlan>(
  options: BoundOptions<THistory, TExpected, TPlan>,
  histories: () => ReadonlyArray<{ name: string; history: THistory }>,
): PropertyTest {
  return {
    name: `determinism`,
    route: `calibration`,
    replays: [],
    run: async () => {
      for (const { name, history } of histories()) {
        const plan = planOf(options, history)
        const [first, second] = [
          await repeatedRecord(options.driver, plan),
          await repeatedRecord(options.driver, plan),
        ]
        const length = Math.max(first.length, second.length)
        for (let index = 0; index < length; index += 1) {
          const [a, b] = [first[index], second[index]]
          const [textA, textB] = [
            a ? `${a.checkpoint} ${a.text}` : `nothing`,
            b ? `${b.checkpoint} ${b.text}` : `nothing`,
          ]
          if (textA === textB) continue
          const error = new Error(
            [
              `${options.id}: two runs of "${name}" recorded different traces at observation ${index}${a ? ` ("${a.checkpoint}")` : ``}.`,
              `First run:  ${textA.slice(0, 2000)}`,
              `Second run: ${textB.slice(0, 2000)}`,
              `History: ${reportText(history)}`,
              `A driver records relations, such as before and after or same and different, instead of clock readings or random ids.`,
            ].join(`\n`),
          ) as Error & {
            actual?: unknown
            expected?: unknown
            showDiff?: boolean
          }
          error.actual = b
          error.expected = a
          error.showDiff = true
          throw error
        }
      }
    },
  }
}

/** Runs one history: the driver records, the model predicts, the check judges. */
async function runOne<THistory, TExpected, TPlan>(
  options: BoundOptions<THistory, TExpected, TPlan>,
  history: THistory,
  driver: OraclePropertyOptions<
    THistory,
    TExpected,
    TPlan
  >[`driver`] = options.driver,
  forced?: ForcedProbe,
): Promise<{ verdict: Verdict; reached: Set<string> }> {
  const plan = planOf(options, history)
  const { observations, driverError, probes, spin } = await recordGuarded(
    driver,
    plan,
    forced,
  )
  // A spin ranks as a driver error does, by where it happens: the trace is
  // judged up to it, and a driver error after it does not decide. A trace it
  // cut short that the model or check cannot read leaves the spin to decide,
  // as a driver error does.
  if (spin) {
    const cut = observations.slice(0, spin.at)
    const clock = violation(
      `clock`,
      `the controlled clock fired more than ${spin.maxTimers} timers in one history: work that never goes quiet (raise maxTimers if a legal history needs more)`,
      `bounded clock`,
    )
    // A spin cuts the trace short when anything follows it, an observation
    // or a driver error; after the last observation with no error, it cuts
    // nothing, and an error judging that whole trace is the parts' own. A
    // driver error after the spin does not decide, but is kept as the cause
    // of what does.
    const cutShort = spin.at < observations.length || driverError !== undefined
    const kept = (decided: Verdict): Verdict =>
      driverError && decided.kind === `violation`
        ? { ...decided, cause: driverError.error }
        : decided
    let judged: { verdict: Verdict; reached: Set<string> }
    try {
      judged = judge(
        options,
        plan,
        cut,
        undefined,
        probes,
        cutShort ? `a clock spin` : undefined,
        driverError,
      )
    } catch (error) {
      if (error instanceof OracleModelError || !cutShort) throw error
      return { verdict: kept(clock), reached: new Set() }
    }
    const { verdict, reached } = judged
    const recorded =
      verdict.kind === `violation` &&
      cut.some(({ checkpoint }) => checkpoint === verdict.checkpoint)
    return { verdict: kept(recorded ? verdict : clock), reached }
  }
  return judge(options, plan, observations, driverError, probes)
}

/** Runs the driver and keeps an error that escapes it beside the trace. */
async function recordGuarded<TPlan>(
  driver: (
    plan: TPlan,
    observe: (checkpoint: string, value: unknown) => void,
  ) => Promise<void> | void,
  plan: TPlan,
  forced?: ForcedProbe,
  // When given, each observation's encoding as it was observed.
  texts?: Array<string>,
): Promise<{
  observations: Array<Observation>
  driverError?: { error: unknown }
  probes: ProbeRecord
  spin?: { at: number; maxTimers: number }
}> {
  const observations: Array<Observation> = []
  // The first observation that is not data fails the history at once, also
  // when the driver catches the error its observe call throws.
  let dataError: unknown
  const window: ProbeWindow = {
    reached: new Set(),
    entered: new Set(),
    open: true,
  }
  const close = (): ProbeRecord => {
    window.open = false
    // A forced entry is a call with that condition, so the probe is reached.
    if (forced) {
      window.reached.add(forced.probe)
      if (forced.entered) window.entered.add(forced.probe)
      else window.entered.delete(forced.probe)
    }
    return window
  }
  historyTrace = observations
  clockSpin = undefined
  const settle = () => {
    historyTrace = undefined
    const spin = takeClockSpin()
    return spin ? { spin } : {}
  }
  let driverError: { error: unknown } | undefined
  try {
    await probeWindows.run(window, () =>
      driver(plan, (checkpoint, value) => {
        if (dataError !== undefined) throw dataError
        const where = `observation ${observations.length} (${JSON.stringify(checkpoint)})`
        try {
          // Checked, and encoded only for the determinism test.
          const text = encodeData(
            value,
            where,
            `observation`,
            texts !== undefined,
          )
          texts?.push(text)
        } catch (error) {
          dataError = error
          throw error
        }
        // What this call saw: a later change to the value cannot change the
        // verdict.
        const seen = snapshotOf(value)
        observations.push({ checkpoint, value: seen })
        globalThis.__oracleObserve?.(checkpoint, seen)
      }),
    )
  } catch (error) {
    driverError = { error }
  }
  const probes = close()
  const settled = settle()
  if (dataError !== undefined) throw dataError
  return {
    observations,
    ...(driverError ? { driverError } : {}),
    probes,
    ...settled,
  }
}

/** The model predicts and the check judges a recorded trace. */
function judge<THistory, TExpected, TPlan>(
  options: BoundOptions<THistory, TExpected, TPlan>,
  plan: TPlan,
  observations: ReadonlyArray<Observation>,
  driverError?: { error: unknown },
  probes: ProbeRecord = { reached: new Set(), entered: new Set() },
  // What cut the trace short, when something other than a driver error did,
  // and a driver error that came after that cut, which a model error carries.
  cutBy?: string,
  later?: { error: unknown },
): { verdict: Verdict; reached: Set<string> } {
  let expected: TExpected
  let verdict: Verdict
  let predicted: Readonly<Record<string, boolean>> = {}
  try {
    expected = options.model(plan, observations)
  } catch (error) {
    const cut = driverError ? `a driver error` : cutBy
    if (cut === undefined) throw error
    // Any thrown value, an Error or not, as text, which never throws.
    const carried = driverError ?? later
    const thrown =
      carried === undefined
        ? ``
        : ` The driver's error: ${reportText(carried.error)}`
    const modelError = new OracleModelError(
      `${options.id}: the model threw on a trace that ${cut} cut short after ${observations.length} observations. A model must accept any prefix of a trace.${thrown}`,
      { cause: error },
    )
    if (carried) modelError.driverError = carried.error
    throw modelError
  }
  try {
    verdict = options.check(plan, observations, expected)
    predicted = options.predict?.(plan) ?? {}
  } catch (error) {
    // A partial trace the model or check cannot read is still a setup error.
    throw driverError ? driverError.error : error
  }
  if (driverError) {
    // Only a violation at a checkpoint the driver recorded before it threw
    // outranks the error; one about the missing rest of the trace does not.
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
  // Agreement: the model's prediction and the probes' entries name the same
  // probe-bound states. Only an agreed entry counts as reach.
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

const lawOf = (verdict: Extract<Verdict, { kind: `violation` }>) =>
  verdict.law ?? verdict.checkpoint

/**
 * One test per calibration. It tries candidate histories in order until the
 * wrong answer applies, and requires the check to report the named law.
 */
function calibrationTests<THistory, TExpected, TPlan>(
  options: BoundOptions<THistory, TExpected, TPlan>,
  candidates: () => ReadonlyArray<{ name: string; history: THistory }>,
): Array<PropertyTest> {
  const { id } = options
  // Each probe-bound state also gets two forced-entry calibrations.
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
      route: `calibration`,
      replays: [],
      run: async () => {
        const seen: Array<string> = []
        for (const { name, history } of candidates()) {
          const plan = planOf(options, history)
          if (`corrupt` in calibration) {
            const { observations, driverError, probes, spin } =
              await recordGuarded(options.driver, plan)
            const corrupted = calibration.corrupt(observations, plan)
            if (corrupted === undefined) continue
            // A calibration is meaningful only where the true trace passes, so
            // a candidate whose clean trace fails, whose driver throws, or
            // whose clock spins is skipped; that history fails in its own
            // test.
            if (
              driverError ||
              spin ||
              judge(options, plan, observations, undefined, probes).verdict
                .kind !== `pass`
            )
              continue
            const wrong = judge(
              options,
              plan,
              corrupted,
              undefined,
              probes,
            ).verdict
            if (wrong.kind === `violation` && lawOf(wrong) === calibration.law)
              return
            throw new Error(
              `${id}: calibration "${calibration.name}" corrupted the trace of "${name}", but the check ${wrong.kind === `pass` ? `passed it` : `reported law "${lawOf(wrong)}"`}. It must report law "${calibration.law}".`,
            )
          }
          // The real driver's trace of the candidate must pass first.
          const clean = await recordGuarded(options.driver, plan)
          if (
            clean.driverError ||
            clean.spin ||
            judge(options, plan, clean.observations, undefined, clean.probes)
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

function failure<THistory>(
  options: { id: string; law: OracleLaw },
  verdict: Extract<Verdict, { kind: `violation` }>,
  history: THistory,
  rerun: string,
): OracleViolation {
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
      `History: ${reportText(history)}`,
      `Authority: ${law.authority}`,
      `Known limits: ${law.limits}`,
      `Rerun: ${rerun}`,
    ].join(`\n`),
    verdict.cause === undefined ? undefined : { cause: verdict.cause },
  )
  if (verdict.values) {
    error.actual = verdict.values.actual
    error.expected = verdict.values.expected
    error.showDiff = true
  }
  return error
}

/**
 * The command that reruns exactly one test: a Vitest `-t` pattern that
 * matches its full name, the names of its suites and its own, in a POSIX
 * shell's single quotes. Vitest 4 matches `-t` against those names joined by
 * a space, Vitest 5 joined by ` > `, so the pattern accepts either between
 * them.
 */
function rerunOf(task: NamedTask): string {
  const names: Array<string> = []
  for (let at: NamedTask | undefined = task; at; at = at.suite)
    names.unshift(at.name)
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`)
  const pattern = `^${names.map(escape).join(`(?: | > )`)}$`
  return `-t '${pattern.replace(/'/g, `'\\''`)}'`
}

/**
 * A fixed or constructed history whose arbitrary's `canShrinkWithoutContext`
 * is false, so fast-check could not shrink it. fast-check 4 answers false
 * without saying why: for a history outside the language, and for every value
 * of a `.map` without an unmapper or of a `.chain`.
 */
const untakeable = (id: string, history: string) =>
  new Error(
    `${id}: ${history} a history the arbitrary cannot take back (its \`canShrinkWithoutContext\` is false), so its failures could not shrink. Either the arbitrary cannot generate it, or the history passes through a combinator that cannot map it back. \`.map\` needs an unmapper (its second argument). \`fc.constant\`/\`fc.constantFrom\` take back only primitives or the same object reference, so build objects with \`fc.record\`/\`fc.tuple\` over primitive leaves. \`.chain\`, \`fc.func\`, and \`fc.commands\` cannot take a value back.`,
  )

function generatedTests<THistory, TExpected, TPlan>(
  unbound: OraclePropertyOptions<THistory, TExpected, TPlan>,
  source: GeneratedHistories<THistory>,
): Array<PropertyTest> {
  const { id } = unbound
  const declaredStates = [...(source.states ?? []), ...(source.measured ?? [])]
  const probes = new Map(
    declaredStates.flatMap((state) =>
      typeof state === `string` ? [] : [[state.name, state.probe] as const],
    ),
  )
  if (probes.size > 0 !== (unbound.predict !== undefined))
    throw new Error(
      `${id}: a probe-bound state needs \`predict\`, and \`predict\` needs a probe-bound state. Declare the state as { name, probe }.`,
    )
  const options: BoundOptions<THistory, TExpected, TPlan> =
    probes.size > 0 ? { ...unbound, probes } : unbound
  const required = (source.states ?? []).map(stateName)
  const constructions = source.constructed ?? []
  const declared =
    source.states || source.measured
      ? new Set(declaredStates.map(stateName))
      : undefined
  const named = new Set(
    constructions.flatMap((construction) => construction.enters),
  )
  const unconstructed = required.filter((state) => !named.has(state))
  if (unconstructed.length > 0)
    throw new Error(
      `${id}: no constructed history enters ${unconstructed.join(`, `)}. A required state needs a constructed history; a state that is only counted belongs in \`measured\`.`,
    )
  // Generated histories, half of them constructed. A constructed history
  // shrinks through its generated input, as a mapped arbitrary does.
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
      (state) => declared !== undefined && !required.includes(state),
    )
    if (undeclared.length > 0)
      throw new Error(
        `${id}: constructed history "${construction.name}" names undeclared states ${undeclared.join(`, `)}.`,
      )
  }

  // Each campaign gets a fresh predicate: its first failure fixes the kind
  // that shrinking must keep, a setup error, a constructed history that missed
  // its state, or one law. A
  // smaller history that fails some other way counts as passing. It counts
  // the histories that entered each state.
  const predicateFor = (
    constructionOf: Map<THistory, ConstructedHistory<THistory>>,
    counts: Map<string, number>,
  ) => {
    let firstKind: string | undefined
    const keeps = (kind: string) => (firstKind ??= kind) === kind
    return async (history: THistory) => {
      let outcome: Awaited<ReturnType<typeof runOne>>
      try {
        outcome = await runOne(options, history)
      } catch (error) {
        if (
          keeps(
            error instanceof OracleModelError
              ? `model`
              : error instanceof OracleDataError
                ? `data`
                : `setup`,
          )
        )
          throw error
        return
      }
      const { verdict, reached } = outcome
      for (const state of reached) {
        if (declared !== undefined && !declared.has(state))
          throw new Error(
            `${id}: a history entered "${state}", which the property does not declare.`,
          )
        counts.set(state, (counts.get(state) ?? 0) + 1)
      }
      // A law violation outranks a constructed history that missed its state.
      if (verdict.kind === `pass`) {
        const construction = constructionOf.get(history)
        const missing =
          construction?.enters.filter((state) => !reached.has(state)) ?? []
        if (missing.length === 0 || !keeps(`constructed-reach`)) return
        throw new Error(
          `${id}: constructed history "${construction!.name}" did not enter ${missing.join(`, `)}. A constructed history must reach every state it names.`,
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
  // Each campaign runs every constructed history, built from histories its own
  // seed draws.
  // fast-check passes example inputs by reference, which identifies them.
  // At registration, an error from sampling or building names its
  // constructed history: it would otherwise fail the file's load unnamed.
  const examplesFor = (seed: number, registering = false) => {
    const constructionOf = new Map<THistory, ConstructedHistory<THistory>>()
    const examples = constructions.map((construction, index) => {
      let history: THistory
      try {
        const [generated] = fc.sample(source.arbitrary, {
          seed: seed + index,
          numRuns: 1,
        })
        history = construction.build(generated!)
      } catch (error) {
        if (!registering) throw error
        throw new Error(
          `oracleProperty ${id}: constructed history "${construction.name}" threw while it was built for registration: ${error instanceof Error ? error.message : reportText(error)}`,
          { cause: error },
        )
      }
      if (!source.arbitrary.canShrinkWithoutContext(history))
        throw untakeable(id, `constructed history "${construction.name}" built`)
      constructionOf.set(history, construction)
      return [history] as [THistory]
    })
    return { examples, constructionOf }
  }
  // Registration checks every fixed history, then the constructed histories
  // built from the first fixed seed (or seed 0 when there is none), so a
  // history that cannot shrink fails the load rather than a full run.
  for (const [index, fixed] of (source.fixed ?? []).entries())
    if (!source.arbitrary.canShrinkWithoutContext(fixed.history))
      throw untakeable(id, `fixed history ${index} ("${fixed.name}") is`)
  examplesFor(source.fixedSeeds[0] ?? 0, true)

  // A campaign reports its reach counts after it passes; a failing campaign
  // reports its counterexample instead.
  const runCampaign = async (
    name: string,
    seed: number,
    parameters: (
      examples: Array<[THistory]>,
    ) => Parameters<typeof fc.assert>[1],
  ) => {
    const { examples, constructionOf } = examplesFor(seed)
    const counts = new Map<string, number>(
      [...(declared ?? [])].map((state) => [state, 0]),
    )
    await fc.assert(
      fc.asyncProperty(arbitrary, predicateFor(constructionOf, counts)),
      parameters(examples),
    )
    // Vitest hides console output from a passing test; stdout reaches the log.
    process.stdout.write(
      `${id} ${name} reach ${JSON.stringify(Object.fromEntries([...counts].sort(([a], [b]) => (a < b ? -1 : 1))))}\n`,
    )
  }
  const fixedCampaigns = source.fixedSeeds.map((seed): PropertyTest => ({
    name: `fixed seed ${seed}`,
    route: `fixed seed`,
    replays: [],
    run: () => {
      const parameters = oracleFixedSeed(seed, {
        numRuns: oracleRuns(source.runs),
      })
      oracleRoute(oracleRouteOf(parameters))
      return runCampaign(`fixed seed ${seed}`, seed, (examples) =>
        withOracleFixedHistories(parameters, examples),
      )
    },
  }))
  // The random campaign picks its seed itself, so a replay of that seed
  // rebuilds the same constructed histories, which the replay path counts.
  const randomCampaign: PropertyTest = {
    name: `random seed`,
    route: `random seed`,
    replays: [id],
    run: () => {
      // One call selects and logs the seed; a replay reads that log line.
      const parameters = oraclePropertyOptions(source.runs, id)
      // A path replay runs one recorded history, a seed from the replay
      // environment reseeds the campaign, and a drawn seed is random.
      oracleRoute(oracleRouteOf(parameters))
      return runCampaign(`random seed`, parameters.seed!, (examples) =>
        withOracleFixedHistories(parameters, examples),
      )
    },
  }
  const fixedTests = (source.fixed ?? []).map((fixed): PropertyTest => ({
    name: `fixed history: ${fixed.name}`,
    route: `fixed history`,
    replays: [],
    run: async (task) => {
      const { verdict, reached } = await runOne(options, fixed.history)
      if (verdict.kind === `violation`)
        throw failure(options, verdict, fixed.history, rerunOf(task))
      const missing = (fixed.enters ?? []).filter(
        (state) => !reached.has(state),
      )
      if (missing.length > 0)
        throw new Error(
          `${id}: fixed history "${fixed.name}" did not enter ${missing.join(`, `)}; it entered ${[...reached].sort().join(`, `) || `no declared state`}. A fixed history must reach every state it names.`,
        )
    },
  }))
  // Fixed histories and the constructed histories of the first fixed seed (or
  // seed 0), so these checks are reproducible. Registration built them once to
  // check them; they are built again when a test runs, like a
  // campaign's.
  const namedHistories = () => {
    const { examples, constructionOf } = examplesFor(source.fixedSeeds[0] ?? 0)
    return [
      ...(source.fixed ?? []).map(({ name, history }) => ({
        name: `fixed history: ${name}`,
        history,
      })),
      ...examples.map(([history]) => ({
        name: `constructed history: ${constructionOf.get(history)!.name}`,
        history,
      })),
    ]
  }
  // Determinism also covers three generated histories, so a property whose
  // driver varies is caught even without fixed or constructed histories.
  const determinism = determinismTest(options, () => [
    ...namedHistories(),
    ...fc
      .sample(source.arbitrary, { seed: source.fixedSeeds[0] ?? 0, numRuns: 3 })
      .map((history, index) => ({ name: `generated ${index}`, history })),
  ])
  // A calibration also tries a fixed sample of generated histories.
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

// A collect-only run (ORACLE_MANIFEST set) records each registration, so the
// committed manifest can be generated without running any history.
function recordRegistration(
  id: string,
  law: OracleLaw,
  histories: ReadonlyArray<unknown> | { runs: number },
): void {
  const manifest = process.env.ORACLE_MANIFEST
  if (manifest === undefined) return
  appendFileSync(
    manifest,
    `${JSON.stringify({
      id,
      file: relativeTestFile(),
      authority: law.authority,
      histories: Array.isArray(histories)
        ? histories.length
        : { runs: (histories as { runs: number }).runs },
    })}\n`,
  )
}

// `expect.getState()` names the test file while it is collected and run.
function relativeTestFile(): string {
  return expect.getState().testPath ?? `<test file>`
}
