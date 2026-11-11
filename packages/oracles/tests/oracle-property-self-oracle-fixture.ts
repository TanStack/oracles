/**
 * Synthetic properties for the oracleProperty self-oracle.
 *
 * `syntheticProperty(spec)` registers one `oracleProperty` whose parts are
 * small enough that the self-oracle's own model can predict every outcome.
 * A history is a list of one to three integers:
 *
 * - `0`, `1`, `2` are ordinary items; a history that holds `k` reaches the
 *   state `saw-k`.
 * - `3` and `4` violate the laws `three` and `four`. The check reports the
 *   first of them in the history.
 * - `6` makes the driver throw right after it records that item.
 * - `7`, in a `clock` spec, makes the driver arm a timer that re-arms itself
 *   at 0 ms and then advance the controlled clock by a second: work that
 *   never goes quiet. Elsewhere it is an ordinary item.
 *
 * A constructed history builds its history as its prefix followed by a generated history,
 * cut to three items. The driver appends every history it runs, with the running test's name, to
 * the file named by SELF_ORACLE_LOG, so the self-oracle knows which
 * histories each campaign ran. A `nondeterministic` spec also records, last, a
 * counter that changes on every run. A spec reports reach through the
 * property's `reached` part or, as the framework's default, through the
 * driver's `observe("reach", state)`. A `slow` spec's driver takes about
 * 300 ms per history, so a small `timeout` fails every test that runs one.
 * A spec with a `probe` binds `saw-0` to the production probe `synthetic#saw-0`
 * and predicts that a history enters it when it holds a 0. The driver calls
 * that probe first, with a condition: `agree` calls it with `true` when the
 * history holds a 0 and `false` otherwise, `always` calls it with `true` in
 * every history, `never` calls it with `false` in every history, `unreached`
 * never calls it, and `late` calls it as `agree` does and once more, with
 * `true`, from a timer that it starts as it returns or throws and does not
 * await, so the call always comes after the history ended. A `late` spec's
 * file waits after its last test, so the last history's call still lands
 * inside the run. With `overReport`, the spec also reports `saw-0`
 * as reached in every history, so only the agreement can keep its count
 * right. `predict` is passed when the spec binds a probe, unless
 * `predictMode` is `missing`; with `extra` it is passed although no state is
 * bound.
 *
 * A history's `form` is how the property holds its items: as the array
 * itself, as `{ items, tag: 1n }` (a bigint, which JSON cannot print), or as
 * `new Map([["items", items]])` (which JSON prints as `{}`), or, `lossy`,
 * as the array with each 1 held as `NaN` and each 2 as `-0` (which JSON
 * prints as `null` and `0`), or, `error`, as `{ items, failure }` with an
 * Error, whose stack names this machine's paths. Three more forms hold the
 * items where only an Error's data tells histories apart: `errors`, one
 * Error per item (0: an Error; 1: a `SyntheticFault`, a subclass named
 * same name and message; 2: an Error with a cause; any other k: an Error
 * whose `code` is k); `boxed`, a `SyntheticBox` instance holding the items
 * and an Error; and `trap`, `{ items }` with an enumerable getter that
 * throws. The arbitrary,
 * constructed and fixed histories, and every part use that form; the log
 * records the items. An enumerated spec labels its histories as
 * `items a | b`, or, with `labelStyle` `shell`, adds a shell's special
 * characters to that label, or, with `default`, passes no label. A `nested`
 * spec registers its property inside `describe(outerSuite)`. A
 * `strictModel` spec's model throws when the trace holds fewer items than
 * the history, as a model that indexes the trace would. A `zeroNoise` spec
 * records, last, `-0` and `0` on alternate runs: values that JSON text cannot
 * tell apart but an exact comparison can. An `orderNoise` spec records, last,
 * an object whose keys come in a different order on alternate runs, which a
 * check that iterates it can tell apart. An `odd` spec records, first, at
 * checkpoint `odd`, `{ reason }` holding a value of its kind: `domain`, data
 * of every kind the domain holds (a null-prototype object, a Map, a Set, an
 * Error with a cause, a code, and AggregateError errors, -0, NaN, the
 * infinities, a bigint, undefined), or one value outside it (a cycle, a
 * sparse array, an accessor, a symbol key, a class instance, a function, a
 * symbol, a DOMException, a typed array, a Date, a sparse array with an
 * extra key, an array with an extra key, an array with an accessor or a
 * hidden index, a Map or a Set with an own property, an Error whose name is
 * an own getter or whose message is a getter on its prototype, a revoked
 * proxy, an object with a custom prototype, an instance of an anonymous
 * class, a key with a dot holding a function, an Error or an object whose
 * prototype is a proxy, or an old-style Error without the native brand). A
 * `deep` value is data 20,000 links deep, past the framework's encoding
 * limit. `domain` holds data from
 * another realm too, and `shared` holds an array of shared references 23
 * levels deep, which is data, quick to check, and large to print. An
 * `emptyMessage` spec records, last, `new Error()` and `new Error('')` on
 * alternate runs, which are the same data. A `liveNoise` spec observes one
 * live array and Map at two checkpoints and changes them in between, with a
 * first value that alternates between runs; a `liveDate` spec observes a live
 * array and then puts a Date in it; a `realmCheck` spec observes a list from
 * another realm, which its check compares with `differs`; a `domThrow`
 * spec's 6 throws a DOMException. Every getter in these values
 * throws, so a getter that runs fails its history with an error that is not
 * a data error. An
 * `errorNoise` spec records, last, an Error whose `requestId` alternates
 * between runs. A `sevenModel` spec's model throws on any trace that holds an
 * item 7, cut short or not. A `throwOnSpin` spec's driver throws right after
 * a 7 spins its clock, recording nothing more. An `oddThrow` spec's 6 throws
 * a null-prototype object with a `message`, which has no string form. The
 * fixture records
 * the route registered through `__oracleRoute` when each history runs, in
 * the log beside it.
 *
 * An enumerated spec with `enumeratedStates` passes its histories as
 * `{ enumerated, states, measured }`; without it, as a plain list.
 *
 * A slow spec's reach test starts only after every slow driver run that the
 * file started has finished, so each history's late judgment arrives first.
 *
 * A `throwingBuild` spec's first constructed history throws
 * `synthetic build failed` from its build. An `arbitraryMap` spec maps its
 * arbitrary through an identity `.map`, with or without an unmapper, at the
 * whole history or at each item.
 *
 * The synthetic ids come from a fixed pool, which this fixture registers with
 * `configureOracles`. The framework's own id, `self-oracle.framework`, is
 * registered beside them, so the self-oracle's registration law can reject an
 * id outside the registry.
 */
import { appendFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import fc from 'fast-check'
import { afterAll, beforeEach, describe, expect, vi } from 'vitest'
import {
  configureOracles,
  differs,
  oracleProperty,
  pass,
  useOracleClock,
  violation,
} from '../src/index.js'
import type { Calibration, EnumeratedHistories } from '../src/index.js'

export const syntheticIds = [
  `self-oracle.synthetic-0`,
  `self-oracle.synthetic-1`,
  `self-oracle.synthetic-2`,
  `self-oracle.synthetic-3`,
] as const

// Every fixture and self-test property must be registered; `self-oracle.unregistered`
// is not, so a spec that names it fails to load.
configureOracles({
  registry: [...syntheticIds, `self-oracle.framework`],
})

export type SyntheticHistory = ReadonlyArray<number>

/** The kinds an `odd` spec records: in the data domain, or one outside it. */
export const oddKinds = [
  `domain`,
  `cycle`,
  `sparse`,
  `accessor`,
  `symbol-key`,
  `class`,
  `function`,
  `symbol`,
  `dom-exception`,
  `typed-array`,
  `date`,
  `array-holes-and-key`,
  `array-key`,
  `array-accessor`,
  `array-hidden`,
  `map-key`,
  `set-key`,
  `error-name-getter`,
  `error-message-getter`,
  `proxy`,
  `custom-prototype`,
  `anonymous-class`,
  `dotted-key`,
  `shared`,
  `deep`,
  `proxy-prototype-error`,
  `proxy-object-prototype`,
  `old-error`,
  `proxy-constructor`,
] as const
export type OddKind = (typeof oddKinds)[number]

/** The suite a `nested` spec registers its property in. */
export const outerSuite = `outer (nested)`

/** The extra text a `shell` label carries: a shell expands or ends at each. */
export const shellText = `$HOME \`true\` 'q' "q" \\`

export type SyntheticSpec = {
  id: (typeof syntheticIds)[number]
  source:
    | { kind: `generated`; runs: number; seed: number }
    | { kind: `enumerated`; histories: ReadonlyArray<SyntheticHistory> }
  /** Required states; each must be entered by a constructed history. */
  states: ReadonlyArray<string>
  constructed: ReadonlyArray<{
    name: string
    prefix: SyntheticHistory
    enters: ReadonlyArray<string>
  }>
  fixed: ReadonlyArray<{
    name: string
    history: SyntheticHistory
    enters?: ReadonlyArray<string>
  }>
  /**
   * A `.map` the arbitrary applies, with or without an unmapper, to the whole
   * history or to each item; absent, only a form maps, with an unmapper.
   */
  arbitraryMap?: { unmapper: boolean; at: `history` | `item` }
  /** An enumerated source's required and measured states; absent, a plain list. */
  enumeratedStates?: {
    states: ReadonlyArray<string>
    measured: ReadonlyArray<string>
    /** Adds a generated source's `constructed`, or binds the first declared state to a probe. */
    enumeratedShape?: `extra key` | `probe state`
  }
  /** The first constructed history's build throws `synthetic build failed`. */
  throwingBuild?: boolean
  nondeterministic: boolean
  calibrations: ReadonlyArray<{
    name: string
    kind: `right` | `wrong-law` | `no-op` | `driver`
  }>
  /** `observe`: the driver reports reach itself, the framework's default. */
  reachVia: `reached` | `observe`
  /** Each history takes about 300 ms; with `timeout`, tests outlive it. */
  slow?: boolean
  timeout?: number
  /** Registers under an id no oracle configuration knows. */
  unregistered?: boolean
  /** How the driver calls the probe bound to `saw-0`; absent, no probe. */
  probe?: `agree` | `always` | `never` | `unreached` | `late`
  /** Reports `saw-0` as reached in every history. */
  overReport?: boolean
  /** Calls an unbound probe on every run, entering it on every other one, so only determinism sees it. */
  noisyProbe?: boolean
  /** `missing` omits `predict` for a bound probe; `extra` passes it unbound. */
  predictMode?: `missing` | `extra`
  /** The `owns` option as the gap report reads it: a list, an empty list, a string, or a list with a non-string entry. */
  ownsMode?: `list` | `empty` | `string` | `bad entry`
  /** Runs every history on a controlled clock, where a 7 spins it. */
  clock?: boolean
  /** How the property holds a history's items; the array itself when absent. */
  form?: `bigint` | `map` | `lossy` | `error` | `errors` | `boxed` | `trap`
  /** An enumerated label with shell characters, no label at all, or one that names a framework test for the first history. */
  labelStyle?: `shell` | `default` | `reserved-reach` | `reserved-determinism`
  /** Registers the property inside `describe(outerSuite)`. */
  nested?: boolean
  /** Records -0 and 0 on alternate runs, last. */
  zeroNoise?: boolean
  /** Records an object whose key order alternates between runs, last. */
  orderNoise?: boolean
  /** Records a fresh function named `tool` on every run, last. */
  /** What the driver records first, at checkpoint `odd`, as `{ reason }`. */
  odd?: OddKind
  /** A model that throws on a trace with fewer items than the history. */
  strictModel?: boolean
  /** A model that throws on any trace holding an item 7. */
  sevenModel?: boolean
  /** Records an Error whose requestId alternates between runs, last. */
  errorNoise?: boolean
  /** Records, last, an Error with no message and one with '' on alternate runs: the same data. */
  emptyMessage?: boolean
  /** On a controlled clock, throws right after a 7 spins it. */
  throwOnSpin?: boolean
  /** A 6 throws a null-prototype object instead of an Error. */
  oddThrow?: boolean
  /** A 6 throws a DOMException instead of an Error. */
  domThrow?: boolean
  /** Observes a live array and Map at two checkpoints, changing them between. */
  liveNoise?: boolean
  /** Observes a live array, then puts a Date in it. */
  liveDate?: boolean
  /** Observes a list from another realm, which the check compares with differs. */
  realmCheck?: boolean
  /** Observes an object, then changes it; the check compares what was observed. */
  snapshotCheck?: boolean
  /** The check compares two equal lists 20,000 links deep with differs. */
  deepCheck?: boolean
}

/** One item of the synthetic language, mostly an ordinary one. */
const syntheticItem: fc.Arbitrary<number> = fc.oneof(
  { arbitrary: fc.integer({ min: 0, max: 2 }), weight: 6 },
  { arbitrary: fc.constantFrom(3, 4, 6, 7), weight: 1 },
)
const historyOf = (item: fc.Arbitrary<number>) =>
  fc.array(item, { minLength: 1, maxLength: 3 })
/** The synthetic language: one to three items, mostly ordinary ones. */
export const syntheticArbitrary: fc.Arbitrary<SyntheticHistory> =
  historyOf(syntheticItem)
const same = (item: number) => item
// An unmapper sees any value; the item arbitrary judges whether it is an item.
const unmapItem = (value: unknown) => value as number

/**
 * A spec's arbitrary: the language, with an item `.map` when the spec maps
 * items, then a history `.map` when it holds a form or maps whole histories.
 * Each map is the identity on items, so the language stays the same; only an
 * unmapper decides whether a fixed or constructed history can be taken back.
 */
function arbitraryOf(spec: SyntheticSpec): fc.Arbitrary<Formed> {
  const map = spec.arbitraryMap
  const language =
    map?.at === `item`
      ? historyOf(
          map.unmapper
            ? syntheticItem.map(same, unmapItem)
            : syntheticItem.map(same),
        )
      : syntheticArbitrary
  if (spec.form === undefined && map?.at !== `history`) return language
  const form = formOf(spec)
  return map?.at === `history` && !map.unmapper
    ? language.map(form)
    : language.map(form, (value) => itemsOf(spec)(value))
}

const allStates = [`saw-0`, `saw-1`, `saw-2`]
// The clock a `clock` spec's driver runs on. A 7's spin would fire about a
// thousand timers in its second.
const controlledClock = () => useOracleClock({ maxTimers: 100 })
const syntheticProbe = `synthetic#saw-0`
let nonce = 0
let zeroes = 0
let orders = 0
let requests = 0
let empties = 0
let lives = 0

/** An Error subclass with the name and message of a plain Error. */
class SyntheticFault extends Error {
  override name = `SyntheticFault`
}
/** A class instance that holds a history's items and an Error. */
class SyntheticBox {
  constructor(
    readonly items: SyntheticHistory,
    readonly failure: Error,
  ) {}
}
const errorOf = (item: number): Error =>
  item === 0
    ? new Error(`synthetic`)
    : item === 1
      ? new SyntheticFault(`synthetic`)
      : item === 2
        ? new Error(`synthetic`, { cause: new Error(`inner`) })
        : Object.assign(new Error(`synthetic`), { code: item })
const itemOf = (failure: unknown): number => {
  if (failure instanceof SyntheticFault) return 1
  if (!(failure instanceof Error)) throw new Error(`not an errors-form item`)
  if (failure.cause !== undefined) return 2
  const { code } = failure as { code?: number }
  return code ?? 0
}
let noise = 0
// The route registered for the running test, as the gap report reads it.
let route: string | undefined
globalThis.__oracleRoute = (registered) => {
  route = registered
}
beforeEach(() => {
  route = undefined
})
// Every slow driver run this file started. A slow spec's histories time out
// and their judgments arrive late; its reach test starts only after every
// one of them arrived, so the order is fixed whatever the machine's load.
const slowRuns = new Set<Promise<void>>()
beforeEach(async ({ task }) => {
  if (task.name !== `reach` || slowRuns.size === 0) return
  await Promise.allSettled([...slowRuns])
  // The judgment follows the driver on microtasks, which run before a turn.
  await new Promise((resolve) => setImmediate(resolve))
})
/** A slow spec's driver, whose runs the reach test waits for. */
const trackedSlow =
  (driver: ReturnType<typeof syntheticDriver>): typeof driver =>
  (formed, observe) => {
    const running = driver(formed, observe)
    slowRuns.add(running)
    return running
  }

/** The property's form of a history, and the items it holds. */
type Formed = unknown
const formOf =
  (spec: SyntheticSpec) =>
  (items: SyntheticHistory): Formed =>
    spec.form === `bigint`
      ? { items, tag: 1n }
      : spec.form === `map`
        ? new Map([[`items`, items]])
        : spec.form === `lossy`
          ? items.map((item) => (item === 1 ? NaN : item === 2 ? -0 : item))
          : spec.form === `error`
            ? { items, failure: new Error(`synthetic failure`) }
            : spec.form === `errors`
              ? items.map(errorOf)
              : spec.form === `boxed`
                ? new SyntheticBox(
                    items,
                    Object.assign(new Error(`synthetic failure`), {
                      code: `E`,
                    }),
                  )
                : spec.form === `trap`
                  ? {
                      items,
                      get trap(): never {
                        throw new Error(`a getter that throws`)
                      },
                    }
                  : items
const itemsOf =
  (spec: SyntheticSpec) =>
  (history: Formed): SyntheticHistory => {
    if (spec.form === `bigint`) {
      const formed = history as { items?: unknown; tag?: unknown } | null
      if (formed?.tag === 1n && Array.isArray(formed.items))
        return formed.items as SyntheticHistory
      throw new Error(`not a bigint-form history`)
    }
    if (spec.form === `map`) {
      if (history instanceof Map && Array.isArray(history.get(`items`)))
        return history.get(`items`) as SyntheticHistory
      throw new Error(`not a map-form history`)
    }
    if (spec.form === `error`) {
      const formed = history as { items?: unknown; failure?: unknown } | null
      if (formed?.failure instanceof Error && Array.isArray(formed.items))
        return formed.items as SyntheticHistory
      throw new Error(`not an error-form history`)
    }
    if (spec.form === `errors`) {
      if (!Array.isArray(history)) throw new Error(`not an errors-form history`)
      return (history as ReadonlyArray<unknown>).map(itemOf)
    }
    if (spec.form === `boxed`) {
      if (history instanceof SyntheticBox) return history.items
      throw new Error(`not a boxed history`)
    }
    if (spec.form === `trap`) {
      const formed = history as { items?: unknown } | null
      if (Array.isArray(formed?.items)) return formed.items as SyntheticHistory
      throw new Error(`not a trap-form history`)
    }
    if (spec.form === `lossy`) {
      const held = history as ReadonlyArray<number>
      if (!Array.isArray(held) || held.some((item) => item === 1 || item === 2))
        throw new Error(`not a lossy-form history`)
      return held.map((item) =>
        Number.isNaN(item) ? 1 : Object.is(item, -0) ? 2 : item,
      )
    }
    return history as SyntheticHistory
  }

const enteredStates = (history: SyntheticHistory) =>
  allStates.filter((state) => history.includes(Number(state.slice(4))))
const reachedStates = (spec: SyntheticSpec) => (history: SyntheticHistory) =>
  spec.overReport
    ? [...new Set([...enteredStates(history), `saw-0`])]
    : enteredStates(history)

/**
 * The condition the synthetic driver passes to the probe for this history, or
 * undefined when it makes no call.
 */
const probeCondition = (
  spec: SyntheticSpec,
  history: SyntheticHistory,
): boolean | undefined => {
  switch (spec.probe) {
    case `always`:
      return true
    case `never`:
      return false
    case `agree`:
    case `late`:
      return history.includes(0)
    default:
      return undefined
  }
}

// A list 20,000 links deep: data, beyond the framework's encoding depth.
const deepList = () => {
  let deep: unknown = null
  for (let link = 0; link < 20_000; link += 1) deep = { next: deep }
  return deep
}

const ranGetter = (): never => {
  throw new Error(`a getter ran while the value was read as data`)
}
// Proxy traps that throw, so a trap that runs fails its history with an
// error that is not a data error.
const trapsThatRan: ProxyHandler<object> = {
  getPrototypeOf: ranGetter,
  getOwnPropertyDescriptor: ranGetter,
  ownKeys: ranGetter,
  get: ranGetter,
  has: ranGetter,
}
/** An old-style error: an Error prototype, without the native brand. */
function OldError(this: { message: string }, message: string) {
  this.message = message
}
OldError.prototype = Object.create(Error.prototype) as object

/** An Error subclass whose message is a getter on its prototype. */
class MessageGetterFault extends Error {
  override get message(): string {
    return ranGetter()
  }
}

/** A fresh value of an odd kind, the same data on every run. */
function oddValue(kind: OddKind): unknown {
  switch (kind) {
    case `domain`: {
      const bare = Object.assign(Object.create(null) as object, { a: 1 })
      const failure = Object.assign(
        new Error(`synthetic`, { cause: new Error(`inner`) }),
        { code: `E_SYNTHETIC` },
      )
      return {
        bare,
        map: new Map<unknown, unknown>([
          [`k`, 1],
          [2n, [undefined]],
        ]),
        set: new Set([-0, NaN]),
        failure,
        many: new AggregateError([new Error(`one`)], `many`),
        numbers: [Infinity, -Infinity, -0, NaN, 3n, undefined, null],
        // Data from another realm is data by its brand.
        realm: runInNewContext(
          `({ list: [1], map: new Map([[1, 2]]), set: new Set([3]), failure: new Error("x"), plain: { a: 1 } })`,
        ) as unknown,
      }
    }
    case `cycle`: {
      const loop: { self?: unknown } = {}
      loop.self = loop
      return loop
    }
    case `sparse`: {
      const holes: Array<number> = new Array<number>(2)
      holes[1] = 1
      return holes
    }
    case `accessor`:
      return {
        get x() {
          return 1
        },
      }
    case `symbol-key`:
      return { [Symbol(`k`)]: 1 }
    case `class`:
      return new SyntheticBox([0], new Error(`synthetic`))
    case `function`:
      return () => undefined
    case `symbol`:
      return Symbol(`odd`)
    case `dom-exception`:
      return new DOMException(`aborted`, `AbortError`)
    case `typed-array`:
      return new Uint8Array([1])
    case `date`:
      return new Date(0)
    // A getter that would run, or a trap, throws an error that is not a
    // data error, so the oracle sees a getter that ran.
    case `array-holes-and-key`: {
      const holes: Array<number> = new Array<number>(3)
      holes[0] = 1
      holes[2] = 3
      return Object.assign(holes, { x: 1 })
    }
    case `array-key`:
      return Object.assign([1], { x: 1 })
    case `array-accessor`:
      return Object.defineProperty([0], 0, { get: ranGetter, enumerable: true })
    case `array-hidden`:
      return Object.defineProperty([0], 0, { value: 0, enumerable: false })
    case `map-key`:
      return Object.assign(new Map([[1, 2]]), { meta: 1 })
    case `set-key`:
      return Object.assign(new Set([1]), { meta: 1 })
    case `error-name-getter`:
      return Object.defineProperty(new Error(`synthetic`), `name`, {
        get: ranGetter,
        enumerable: false,
      })
    case `error-message-getter`:
      return new MessageGetterFault()
    case `proxy`: {
      const { proxy, revoke } = Proxy.revocable({}, {})
      revoke()
      return proxy
    }
    case `custom-prototype`:
      return Object.create({ k: 1 }) as object
    case `anonymous-class`:
      return new (class {})()
    case `dotted-key`:
      return { 'a.b': { c: () => undefined } }
    case `deep`:
      return deepList()
    case `proxy-prototype-error`:
      return Object.setPrototypeOf(
        new Error(`synthetic`),
        new Proxy(Error.prototype, trapsThatRan),
      ) as unknown
    case `proxy-object-prototype`:
      return Object.create(new Proxy(Object.prototype, trapsThatRan)) as object
    case `proxy-constructor`: {
      // A prototype whose constructor is a proxy whose traps throw.
      const prototype = {
        constructor: new Proxy(function Synthetic() {}, trapsThatRan),
      }
      return Object.create(prototype) as object
    }
    case `old-error`:
      return new (OldError as unknown as new (message: string) => object)(
        `synthetic`,
      )
    case `shared`: {
      // Shared references 23 levels deep: small to check, large to print.
      let shared: unknown = 0
      for (let level = 0; level < 23; level += 1) shared = [shared, shared]
      return shared
    }
  }
}

/** A `late` spec's probe call, which arrives after its history ended. */
function lateProbe() {
  const probing =
    typeof process === `undefined`
      ? false
      : process.env.NODE_ENV !== `production`
  probing && globalThis.__oracleProbe?.(`synthetic#saw-0`, true)
}

/**
 * The synthetic driver. `mutant` records a 3 in place of the first item, the
 * wrong answer a driver calibration supplies.
 */
function syntheticDriver(spec: SyntheticSpec, mutant = false) {
  return async (
    formed: Formed,
    observe: (checkpoint: string, value: unknown) => void,
  ) => {
    const history = itemsOf(spec)(formed)
    const log = process.env.SELF_ORACLE_LOG
    if (log)
      appendFileSync(
        log,
        `${JSON.stringify({ id: spec.id, test: expect.getState().currentTestName ?? ``, history, route: route ?? null })}\n`,
      )
    if (spec.odd) observe(`odd`, { reason: oddValue(spec.odd) })
    if (spec.slow) await new Promise((resolve) => setTimeout(resolve, 300))
    // The probe form production uses, guarded in the probing function.
    const probing =
      typeof process === `undefined`
        ? false
        : process.env.NODE_ENV !== `production`
    const condition = probeCondition(spec, history)
    if (condition !== undefined)
      probing && globalThis.__oracleProbe?.(`synthetic#saw-0`, condition)
    if (spec.noisyProbe)
      probing &&
        globalThis.__oracleProbe?.(`synthetic#noise`, noise++ % 2 === 0)
    if (spec.reachVia === `observe`)
      for (const state of reachedStates(spec)(history)) observe(`reach`, state)
    // A real timer first: a clock that an earlier history released must have
    // given the real timers back, or this history never goes on.
    if (spec.clock) await new Promise((resolve) => setTimeout(resolve, 1))
    const clock = spec.clock ? controlledClock() : undefined
    try {
      for (const [index, item] of history.entries()) {
        observe(`item ${index}`, mutant && index === 0 ? 3 : item)
        if (item === 6)
          throw spec.oddThrow
            ? // A thrown value that is no Error and cannot become a string.
              Object.assign(Object.create(null) as object, {
                message: `synthetic driver failed at item ${index}`,
              })
            : spec.domThrow
              ? new DOMException(`synthetic driver failed at item ${index}`)
              : new Error(`synthetic driver failed at item ${index}`)
        if (item === 7 && clock) {
          const spin = () => {
            setTimeout(spin, 0)
          }
          spin()
          await vi.advanceTimersByTimeAsync(1000)
          // The driver fails right after the spin, observing nothing more.
          if (spec.throwOnSpin)
            throw new Error(
              `synthetic driver failed after the spin at item ${index}`,
            )
        }
      }
    } finally {
      clock?.release()
      // Production work the driver does not await, calling its probe after
      // its history, whether the driver returns or throws.
      if (spec.probe === `late` && history.includes(0)) setTimeout(lateProbe, 0)
    }
    // Last, so a comparison of only the first observations misses it.
    if (spec.nondeterministic) observe(`nonce`, nonce++)
    if (spec.liveNoise) {
      // What each observe call saw differs between runs; the final state
      // does not.
      const seen = lives++ % 2
      const live = { list: [seen], map: new Map([[`k`, seen]]) }
      observe(`live a`, live)
      live.list[0] = 9
      live.map.set(`k`, 9)
      observe(`live b`, live)
    }
    if (spec.liveDate) {
      const live: Array<unknown> = [0]
      observe(`live`, live)
      live.push(new Date(0))
    }
    if (spec.realmCheck)
      observe(`realm`, runInNewContext(`[1, { a: 2 }, new Map([[1, 2]])]`))
    if (spec.snapshotCheck) {
      const seen = { n: 1 }
      observe(`snapshot`, seen)
      seen.n = 2
    }
    if (spec.zeroNoise) observe(`nonce`, zeroes++ % 2 === 0 ? -0 : 0)
    if (spec.orderNoise)
      observe(`nonce`, orders++ % 2 === 0 ? { a: 1, b: 2 } : { b: 2, a: 1 })
    if (spec.emptyMessage)
      observe(`nonce`, empties++ % 2 === 0 ? new Error() : new Error(``))
    if (spec.errorNoise)
      observe(
        `nonce`,
        Object.assign(new Error(`request failed`), { requestId: requests++ }),
      )
  }
}

function syntheticCheck(
  history: SyntheticHistory,
  trace: ReadonlyArray<{ checkpoint: string; value: unknown }>,
) {
  // `history` is the items of a history in any form.
  for (const { checkpoint, value } of trace) {
    // Only items carry the law; a nonce is not an item.
    if (!checkpoint.startsWith(`item`)) continue
    if (value === 3) return violation(checkpoint, `item is 3`, `three`)
    if (value === 4) return violation(checkpoint, `item is 4`, `four`)
  }
  const items = trace.filter(({ checkpoint }) => checkpoint.startsWith(`item`))
  if (items.length !== history.length)
    return violation(
      `trace`,
      `${items.length} of ${history.length} items recorded`,
      `trace`,
    )
  return pass
}

function syntheticCalibrations(
  spec: SyntheticSpec,
): Array<Calibration<Formed, Formed>> {
  return spec.calibrations.map(
    ({ name, kind }): Calibration<Formed, Formed> => {
      // A mutant driver records a 3 in place of the first item.
      if (kind === `driver`)
        return { name, law: `three`, driver: syntheticDriver(spec, true) }
      return {
        name,
        law: kind === `wrong-law` ? `four` : `three`,
        corrupt: (trace) => {
          const at = trace.findIndex(({ checkpoint }) =>
            checkpoint.startsWith(`item`),
          )
          if (at < 0) return undefined
          if (kind === `no-op`) return [...trace]
          return trace.map((entry, index) =>
            index === at ? { ...entry, value: 3 } : entry,
          )
        },
      }
    },
  )
}

// `owns`, the literal list the gap report reads, in the shape the spec names.
const ownsOf = (spec: SyntheticSpec) =>
  spec.ownsMode === undefined
    ? {}
    : {
        owns:
          spec.ownsMode === `list`
            ? [`src/x.ts`]
            : spec.ownsMode === `empty`
              ? []
              : spec.ownsMode === `string`
                ? (`src/x.ts` as unknown as Array<string>)
                : [`src/x.ts`, 3 as unknown as string],
      }

/**
 * An enumerated source's declaration. A malformed one is what plain
 * JavaScript, or a cast, can pass: a generated source's `constructed`, or a
 * probe-bound state.
 */
function declaredEnumerated(
  enumerated: Array<Formed>,
  {
    enumeratedShape,
    states,
    measured,
  }: NonNullable<SyntheticSpec[`enumeratedStates`]>,
): EnumeratedHistories<Formed> {
  if (enumeratedShape === `extra key`)
    return { enumerated, states, measured, constructed: [] } as never
  if (enumeratedShape === `probe state`) {
    const [bound] = [...states, ...measured]
    const bind = (state: string) =>
      (state === bound
        ? { name: state, probe: syntheticProbe }
        : state) as unknown as string
    return {
      enumerated,
      states: states.map(bind),
      measured: measured.map(bind),
    }
  }
  return { enumerated, states, measured }
}

export function syntheticProperty(spec: SyntheticSpec): void {
  const id = spec.unregistered ? `self-oracle.unregistered` : spec.id
  const form = formOf(spec)
  const items = itemsOf(spec)
  const parts = {
    model: spec.strictModel
      ? (history: Formed, trace: ReadonlyArray<{ checkpoint: string }>) => {
          const recorded = trace.filter(({ checkpoint }) =>
            checkpoint.startsWith(`item`),
          ).length
          if (recorded < items(history).length)
            throw new TypeError(
              `the strict model read item ${recorded}, which the trace does not hold`,
            )
          return undefined
        }
      : spec.sevenModel
        ? (
            _history: Formed,
            trace: ReadonlyArray<{ checkpoint: string; value: unknown }>,
          ) => {
            if (
              trace.some(
                ({ checkpoint, value }) =>
                  checkpoint.startsWith(`item`) && value === 7,
              )
            )
              throw new TypeError(`the seven model cannot read a 7`)
            return undefined
          }
        : () => undefined,
    // Without `reached`, the framework counts the driver's `reach` records.
    ...(spec.reachVia === `reached`
      ? { reached: (history: Formed) => reachedStates(spec)(items(history)) }
      : {}),
    ...((spec.probe && spec.predictMode !== `missing`) ||
    spec.predictMode === `extra`
      ? {
          predict: (history: Formed) => ({
            'saw-0': items(history).includes(0),
          }),
        }
      : {}),
    driver: spec.slow
      ? trackedSlow(syntheticDriver(spec))
      : syntheticDriver(spec),
    calibrations: syntheticCalibrations(spec),
    check: (
      history: Formed,
      trace: ReadonlyArray<{ checkpoint: string; value: unknown }>,
    ) => {
      // Data from another realm is the same data as data built here.
      const realm = trace.find(({ checkpoint }) => checkpoint === `realm`)
      // What was observed, not what the driver changed it to afterwards.
      const snapshot = trace.find(({ checkpoint }) => checkpoint === `snapshot`)
      return (
        (spec.deepCheck
          ? differs(`deep`, `deep`, deepList(), deepList())
          : undefined) ??
        (snapshot &&
          differs(`snapshot`, `snapshot`, snapshot.value, { n: 1 })) ??
        (realm &&
          differs(`realm`, `realm`, realm.value, [
            1,
            { a: 2 },
            new Map([[1, 2]]),
          ])) ??
        syntheticCheck(items(history), trace)
      )
    },
    ...(spec.timeout !== undefined ? { timeout: spec.timeout } : {}),
    ...ownsOf(spec),
  }
  const law = {
    statement: `A synthetic history holds no 3 and no 4.`,
    authority: `the oracleProperty self-oracle's synthetic specification`,
    limits: `Synthetic; histories of one to three integers.`,
  }
  // The last history's late probe call comes after its test; the file waits
  // for it, so the run still reports it.
  if (spec.probe === `late`)
    afterAll(() => new Promise((resolve) => setTimeout(resolve, 50)))
  const register = () => {
    if (spec.source.kind === `enumerated`) {
      const enumerated = spec.source.histories.map(form)
      const first = JSON.stringify(spec.source.histories[0])
      oracleProperty({
        id,
        law,
        histories: spec.enumeratedStates
          ? declaredEnumerated(enumerated, spec.enumeratedStates)
          : enumerated,
        // A label with `|`, which a rerun command must escape.
        ...(spec.labelStyle === `default`
          ? {}
          : {
              label: (history: Formed) =>
                spec.labelStyle?.startsWith(`reserved-`) &&
                JSON.stringify(items(history)) === first
                  ? spec.labelStyle.slice(`reserved-`.length)
                  : `items ${items(history).join(` | `)}${spec.labelStyle === `shell` ? ` ${shellText}` : ``}`,
            }),
        ...parts,
      })
      return
    }
    // With a probe, `saw-0` is a probe-bound state wherever it is declared.
    const declare = (state: string) =>
      spec.probe && state === `saw-0`
        ? { name: state, probe: syntheticProbe }
        : state
    const arbitrary = arbitraryOf(spec)
    oracleProperty({
      id,
      law,
      histories: {
        arbitrary,
        states: spec.states.map(declare),
        measured: allStates
          .filter((state) => !spec.states.includes(state))
          .map(declare),
        runs: spec.source.runs,
        fixedSeeds: [spec.source.seed],
        constructed: spec.constructed.map(({ name, prefix, enters }, at) => ({
          name,
          enters,
          // A constructed history extends a generated history, so its histories
          // depend on the campaign's seed, as real constructed histories do.
          build: (generated: Formed) => {
            if (at === 0 && spec.throwingBuild)
              throw new Error(`synthetic build failed`)
            return form([...prefix, ...items(generated)].slice(0, 3))
          },
        })),
        fixed: spec.fixed.map((fixed) => ({
          ...fixed,
          history: form(fixed.history),
        })),
      },
      ...parts,
    })
  }
  if (spec.nested) describe(outerSuite, register)
  else register()
}
