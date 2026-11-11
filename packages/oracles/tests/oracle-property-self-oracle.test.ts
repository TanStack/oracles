/**
 * # The oracleProperty self-oracle
 *
 * `oracleProperty` makes promises to the people who write oracles with it.
 * This oracle checks them the way every other oracle checks production: it
 * writes synthetic properties, runs them under real Vitest in a child
 * process, and compares what Vitest reports with what an independent model
 * predicts. The laws, each judged per test or per probe:
 *
 * - `registration`: a property registers its campaigns, fixed histories, calibrations, and
 *   determinism test, and an enumerated property without a `label` gives
 *   distinct histories distinct test names, or fails to load when its id is not a registered
 *   oracle property, a required state has no constructed history, a constructed history names an
 *   undeclared state, a fixed or constructed history is one the arbitrary cannot take back (law
 *   `membership`), or `owns` is not a non-empty literal list of strings (the gap report reads it
 *   statically). When several of the named load errors apply, the declaration's shape reports
 *   first, in this order: an unregistered id, then `owns`, then `predict` on an enumerated source
 *   (only a generated source declares states), then a history that is not data (`data`). A load
 *   fails with its first error alone. This precedence is analyst-chosen (2026-11-10): no contract
 *   text or maintainer decision orders these errors. The source kind decides which checks reach the
 *   histories, so fixing the shape can remove a data error, and fixing the data error first can be
 *   wasted work.
 * - `verdict`: a test fails with a violation of law L exactly when its first
 *   failing history violates L, whatever values the history holds (a bigint,
 *   a Map, NaN, or -0 too). Within one history a driver error decides
 *   first, then a law violation, then a constructed history that misses its state; a driver error
 *   after a recorded violation becomes that violation's cause. A model must
 *   accept any prefix of a trace: one that throws on a trace a driver error or
 *   a clock spin cut short fails the history with an `OracleModelError` that
 *   names the model (maintainer decision, 2026-11-08).
 * - `shrink`: a campaign's reported failure keeps the kind and law of its first
 *   failure, and its counterexample still has them.
 * - `membership`: a fixed history, or the history a constructed history builds from the first fixed
 *   seed's sample (seed 0's when there is none), that the arbitrary cannot take back (`canShrinkWithoutContext` is false) fails
 *   the property's load, with an error that names the property, the history (a fixed history's
 *   index and name, or a constructed history's name), and the fix for a `.map` without an
 *   unmapper (maintainer decision, 2026-11-10, F20). A history outside the language is one such
 *   history; a history inside it whose arbitrary maps it, at the whole history or at an item,
 *   through a `.map` without an unmapper is another. The same arbitrary with an unmapper takes its
 *   histories back, and an arbitrary without an unmapper but with no fixed or constructed
 *   history loads and runs. A load fails at the first such history, fixed histories first, after
 *   every other load error of a generated source (analyst-chosen order, 2026-11-10). Registration
 *   builds the constructed histories when the file loads, so a `build` that throws there fails
 *   the load with an error that names the property and the constructed history and carries the
 *   build's error as its cause; constructed histories are built and checked in order.
 * - `reach`: a fixed or constructed history that does not enter a state it names fails, and
 *   a passing campaign reports how many of its histories entered each declared
 *   state, whether the property names reach itself or the driver records it. An enumerated
 *   source that declares `states` or `measured` registers a `reach` test after its histories:
 *   it fails when no enumerated history entered a required state, and otherwise reports how
 *   many entered each declared state. A history counts when it was judged, passing or
 *   violating its law; the reach test runs any history that no earlier test of the run judged,
 *   and one that fails before a verdict counts for nothing. A judged enumerated history that
 *   enters an undeclared state fails its test, before its law violation, as a campaign's
 *   history does (maintainer decision, 2026-11-10, F23: every enumerated history runs, so a
 *   required state needs no constructed history).
 * - `calibration`: a calibration uses the first candidate whose clean trace
 *   passes, and passes only when its wrong answer (a corrupted trace or a
 *   mutant driver) fails with the named law.
 * - `determinism`: the determinism test runs every fixed and constructed history
 *   and three generated ones, and fails for a driver whose trace changes,
 *   compared by their data encoding: `-0` is not `0`, and key order and
 *   Map and Set order count, which a check that iterates them can see.
 * - `agreement`: for a probe-bound state, a history whose `predict` says it
 *   enters the state while the history does not enter it, or does not enter
 *   it while the history does, violates law `reach agreement` at checkpoint
 *   `states`, after a driver error and a law violation and before a
 *   constructed history's missed state. A history enters the state when its
 *   probe was called with a truthy condition, and a probe is reached when it
 *   was called at all. A predicted entry that fails says why: the probe was
 *   never reached, or it was reached with a false condition. The state counts
 *   as reached only where the prediction and the entry agree, whatever the
 *   property's own reach reports. The property registers two forced-entry
 *   calibrations, which pass exactly when a candidate whose clean trace passes
 *   disagrees with the forced entry. A probe-bound state without `predict`, or
 *   `predict` without one, fails to load. A call after its history ended is an
 *   unhandled error of the run, one for each such call, also after a driver
 *   that threw, and a driver whose probe records differ between
 *   two runs fails the determinism test.
 * - `clock`: a driver on `useOracleClock` whose clock passes its bound fails
 *   that history under law `bounded clock` at checkpoint `clock`, ranked as
 *   a driver error is: a violation recorded before the spin still decides,
 *   and a driver error after it does not (maintainer decision, 2026-11-06),
 *   but it is kept as the cause of what decides, and it cuts the trace short
 *   even when it comes right after the spin.
 *   A model that throws on the trace cut at the spin is a model error, as
 *   above.
 * - `timeout`: a property's `timeout` limits every test it registers.
 * - `replay`: replaying a failing campaign's seed and path runs only that
 *   property's random campaign, starts from the counterexample itself, and
 *   reproduces it.
 * - `data`: observations and enumerated histories are a closed data domain
 *   (maintainer decision, 2026-11-08): primitives (with -0, NaN, the
 *   infinities, bigints, and undefined), dense arrays, plain objects with
 *   string keys, Maps, Sets, and Errors. A history whose driver observes
 *   anything else fails at once with an `OracleDataError` that names the
 *   value's path in the trace and its kind; an enumerated source holding
 *   such a history fails to load, naming the history's path.
 * - `names`: no test name holds this machine's paths, so names are the same
 *   on every machine (an Error in a history is named by its name and
 *   message, not its stack).
 * - `rerun`: a violation's printed rerun command, pasted into a POSIX shell,
 *   runs exactly that test, also when its name holds a shell's special
 *   characters and when the property sits inside another suite.
 * - `route`: each history runs under the route, in the one vocabulary of
 *   `oracle-route.ts`, of the campaign that runs it: a fixed-seed campaign
 *   `fixed seed`; the random campaign `random seed`, or `fixed seed` when a
 *   seed-only replay reseeds it (as the main child runs here do; a seedless
 *   child run, without `ORACLE_SEED`, shows `random seed`), or `fixed
 *   history` in a path replay; a fixed history `fixed history`; an enumerated
 *   history `case`; calibrations, probe calibrations, and the determinism test
 *   `calibration` (TanStack/oracles#1 coordinator decisions, 2026-11-08: a
 *   route describes the campaign that runs, in one vocabulary).
 * - `seed-log`: a random campaign logs exactly one `ORACLE_SEED` line for its
 *   property, the seed it runs, and no other test logs one; a replay tool
 *   reads that line.
 *
 * Authority: the contract in the header of `oracle-property.ts`, including
 * its state probes (user decision of 2026-11-04 adopting differential reach); the
 * maintainer decisions of 2026-11-03 on calibration candidates, failure
 * precedence, and determinism scope; the maintainer decision of 2026-11-06
 * that work which never goes quiet on a controlled clock fails its history; the maintainer
 * decision of 2026-11-10 (F20) that a fixed or constructed history the arbitrary cannot take back
 * fails at registration, naming the history and the fix; and the oracle rubric's replay
 * (ORC-007), calibration (ORC-006), and declared-reach (ORC-015) rules.
 *
 * Limits: synthetic properties with histories of one to three integers, held
 * as an array, a bigint-tagged object, or a Map, one or two per run. An
 * arbitrary maps its histories through at most one `.map` without an
 * unmapper, at the whole history or at each item; `.chain` and a filter are
 * not drawn, and a constructed history whose build leaves the language only
 * for some seeds is not drawn, so the run-time check of a later campaign's
 * constructed histories has no witness here. The model learns which histories a test ran from the
 * synthetic driver's log, and relies on fast-check running a campaign's examples
 * (its constructed histories) first, in order. A replay or rerun probe covers
 * every failing campaign but only the first violating fixed or enumerated history of each
 * property. The model learns an unlabelled enumerated history's test name
 * from the log, so it checks that names are distinct, not their text. A slow
 * spec's late probe calls and routes are not counted exactly: its driver runs
 * on after its test times out. That shrinking keeps a model error apart
 * from a setup error has no witness: no shrink in this language turns one
 * into the other. The gap report's observation hook,
 * `forwardCut`, and `differs` have no law here; `withinTurns` has its own
 * oracle. A counterexample of the `errors` form prints its Errors without
 * the items they hold, so the shrink and replay checks cannot read it back
 * and skip it. Only generated sources bind a probe, and only
 * `saw-0`; an enumerated source declares its states by name. A late probe is judged by whether the run reports it, not by which
 * test Vitest blames.
 */
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { oracleProperty, pass, violation } from '../src/index.js'
import {
  oddKinds,
  outerSuite,
  shellText,
  syntheticArbitrary,
  syntheticIds,
} from './oracle-property-self-oracle-fixture.js'
import type {
  OddKind,
  SyntheticHistory,
  SyntheticSpec,
} from './oracle-property-self-oracle-fixture.js'

// ---------------------------------------------------------------------------
// History: a suite of one or two synthetic property drafts
// ---------------------------------------------------------------------------
//
// A draft chooses a generated or enumerated source, how its declared states
// relate to its constructed histories and fixed histories (inside or outside the language),
// whether its driver varies between runs, how it reports reach, whether it is
// slow under a small timeout, and its calibrations.

const allStates = [`saw-0`, `saw-1`, `saw-2`]
const stateRoles = [`required`, `measured`, `undeclared`] as const
type StateRole = (typeof stateRoles)[number]
const calibrationKinds = [`right`, `wrong-law`, `no-op`, `driver`] as const
type Draft = {
  source:
    | { kind: `generated`; runs: number; seed: number }
    | { kind: `enumerated`; histories: ReadonlyArray<SyntheticHistory> }
  /** `exact` declares the constructed histories' states; the others break registration. */
  statesMode: `exact` | `extra` | `missing`
  constructed: Array<{ prefix: SyntheticHistory; enters: Array<string> }>
  fixed: Array<{ history: SyntheticHistory; enters: Array<string> | null }>
  /**
   * How a generated source's arbitrary maps its histories: not at all (only
   * a form maps, with an unmapper), through a `.map` with an unmapper, or
   * through one without, at the whole history or at each item.
   */
  arbitraryMap: `none` | `unmapper` | `no unmapper`
  mapAt: `history` | `item`
  /**
   * An enumerated source's declared states: each of `saw-0`, `saw-1`, and
   * `saw-2` is required, measured, or undeclared; null declares none, as a
   * plain list of histories does.
   */
  enumeratedStates: Array<StateRole> | null
  /** The first constructed history's build throws. */
  throwingBuild: boolean
  nondeterministic: boolean
  reachVia: `reached` | `observe`
  /** `slow`: 300 ms per history under a 100 ms timeout. */
  timing: `normal` | `slow`
  calibrations: Array<(typeof calibrationKinds)[number]>
  /** An id no oracle configuration registers. */
  unregistered: boolean
  /** How the driver calls the probe bound to `saw-0`; `none` binds no probe. */
  probe: `none` | `agree` | `always` | `never` | `unreached` | `late`
  overReport: boolean
  noisyProbe: boolean
  predictMode: `match` | `missing` | `extra`
  /** The `owns` option: absent, a literal list, a string, or a list with a non-string entry. */
  ownsMode: `none` | `list` | `empty` | `string` | `bad entry`
  clock: boolean
  form:
    `plain` | `bigint` | `map` | `lossy` | `error` | `errors` | `boxed` | `trap`
  sevenModel: boolean
  errorNoise: boolean
  throwOnSpin: boolean
  oddThrow: boolean
  zeroNoise: boolean
  orderNoise: boolean
  odd: OddKind | `none`
  liveNoise: boolean
  liveDate: boolean
  realmCheck: boolean
  snapshotCheck: boolean
  deepCheck: boolean
  domThrow: boolean
  emptyMessage: boolean
  labelStyle: `plain` | `shell` | `default`
  nested: boolean
  strictModel: boolean
}
// `seedless`: one more child run, without `ORACLE_SEED`, records the routes
// of each random campaign as an ordinary run draws its seed.
type Suite = { drafts: Array<Draft>; seedless: boolean }

// Outside the synthetic language: an item 5, or four items.
const outside = fc.oneof(
  fc.constantFrom(5).map(
    (item) => [item],
    (value) => {
      if (Array.isArray(value) && value.length === 1 && value[0] === 5) return 5
      throw new Error(`not [5]`)
    },
  ),
  fc.array(fc.integer({ min: 0, max: 2 }), { minLength: 4, maxLength: 4 }),
)
const insideOrOutside = (insideWeight: number) =>
  fc.oneof(
    { arbitrary: syntheticArbitrary, weight: insideWeight },
    { arbitrary: outside, weight: 1 },
  )
const draft: fc.Arbitrary<Draft> = fc.record({
  source: fc.oneof(
    fc.record({
      kind: fc.constant(`generated` as const),
      runs: fc.integer({ min: 2, max: 3 }),
      seed: fc.integer({ min: 1, max: 999 }),
    }),
    fc.record({
      kind: fc.constant(`enumerated` as const),
      histories: fc.uniqueArray(syntheticArbitrary, {
        minLength: 1,
        maxLength: 4,
        selector: (history) => history.join(`,`),
      }),
    }),
  ),
  statesMode: fc.oneof(
    { arbitrary: fc.constant(`exact` as const), weight: 6 },
    {
      arbitrary: fc.constantFrom(`extra` as const, `missing` as const),
      weight: 1,
    },
  ),
  constructed: fc.array(
    fc.record({ prefix: insideOrOutside(6), enters: fc.subarray(allStates) }),
    { maxLength: 2 },
  ),
  fixed: fc.array(
    fc.record({
      history: insideOrOutside(4),
      enters: fc.option(fc.subarray(allStates), { freq: 2 }),
    }),
    { maxLength: 2 },
  ),
  // Rare: a `.map` with or without an unmapper, which decides whether the
  // arbitrary can take a fixed or constructed history back.
  arbitraryMap: fc.oneof(
    { arbitrary: fc.constant(`none` as const), weight: 8 },
    {
      arbitrary: fc.constantFrom(`unmapper` as const, `no unmapper` as const),
      weight: 2,
    },
  ),
  mapAt: fc.constantFrom(`history` as const, `item` as const),
  // The role of each state in an enumerated source's declaration.
  enumeratedStates: fc.oneof(
    { arbitrary: fc.constant(null), weight: 3 },
    {
      arbitrary: fc.tuple<Array<StateRole>>(
        ...allStates.map(() =>
          fc.oneof(
            {
              arbitrary: fc.constantFrom(
                `required` as const,
                `measured` as const,
              ),
              weight: 4,
            },
            { arbitrary: fc.constant(`undeclared` as const), weight: 1 },
          ),
        ),
      ),
      weight: 2,
    },
  ),
  throwingBuild: fc.oneof(
    { arbitrary: fc.constant(false), weight: 9 },
    { arbitrary: fc.constant(true), weight: 1 },
  ),
  nondeterministic: fc.oneof(
    { arbitrary: fc.constant(false), weight: 4 },
    { arbitrary: fc.constant(true), weight: 1 },
  ),
  reachVia: fc.oneof(
    { arbitrary: fc.constant(`reached` as const), weight: 3 },
    { arbitrary: fc.constant(`observe` as const), weight: 1 },
  ),
  timing: fc.oneof(
    { arbitrary: fc.constant(`normal` as const), weight: 12 },
    { arbitrary: fc.constant(`slow` as const), weight: 1 },
  ),
  calibrations: fc.array(fc.constantFrom(...calibrationKinds), {
    maxLength: 3,
  }),
  // Rare: a property under an id no oracle configuration registers.
  unregistered: fc.oneof(
    { weight: 9, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
  probe: fc.oneof(
    { weight: 5, arbitrary: fc.constant(`none` as const) },
    { weight: 2, arbitrary: fc.constant(`agree` as const) },
    {
      weight: 2,
      arbitrary: fc.constantFrom(
        `always` as const,
        `never` as const,
        `unreached` as const,
        `late` as const,
      ),
    },
  ),
  overReport: fc.oneof(
    { weight: 4, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
  noisyProbe: fc.oneof(
    { weight: 9, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
  predictMode: fc.oneof(
    { weight: 12, arbitrary: fc.constant(`match` as const) },
    {
      weight: 1,
      arbitrary: fc.constantFrom(`missing` as const, `extra` as const),
    },
  ),
  // `owns` is read statically by the gap report, so it must be a literal list of strings.
  ownsMode: fc.oneof(
    { weight: 6, arbitrary: fc.constant(`none` as const) },
    { weight: 4, arbitrary: fc.constant(`list` as const) },
    {
      weight: 1,
      arbitrary: fc.constantFrom(
        `empty` as const,
        `string` as const,
        `bad entry` as const,
      ),
    },
  ),
  // A property whose driver runs on the framework's controlled clock.
  clock: fc.oneof(
    { weight: 3, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
  // How the property holds a history: values JSON cannot print or tell apart.
  form: fc.oneof(
    { weight: 6, arbitrary: fc.constant(`plain` as const) },
    {
      weight: 1,
      arbitrary: fc.constantFrom(
        `bigint` as const,
        `map` as const,
        `lossy` as const,
        `error` as const,
        `errors` as const,
        `boxed` as const,
        `trap` as const,
      ),
    },
  ),
  // An enumerated property's labels.
  labelStyle: fc.oneof(
    { weight: 4, arbitrary: fc.constant(`plain` as const) },
    {
      weight: 1,
      arbitrary: fc.constantFrom(`shell` as const, `default` as const),
    },
  ),
  zeroNoise: fc.oneof(
    { weight: 9, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
  orderNoise: fc.oneof(
    { weight: 9, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
  emptyMessage: fc.oneof(
    { weight: 9, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
  odd: fc.oneof(
    { weight: 10, arbitrary: fc.constant(`none` as const) },
    { weight: 1, arbitrary: fc.constant(`domain` as const) },
    { weight: 2, arbitrary: fc.constantFrom(...oddKinds.slice(1)) },
  ),
  nested: fc.oneof(
    { weight: 4, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
  strictModel: fc.oneof(
    { weight: 3, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
  sevenModel: fc.oneof(
    { weight: 5, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
  errorNoise: fc.oneof(
    { weight: 9, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
  throwOnSpin: fc.oneof(
    { weight: 5, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
  oddThrow: fc.oneof(
    { weight: 7, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
  domThrow: fc.oneof(
    { weight: 7, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
  liveNoise: fc.oneof(
    { weight: 9, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
  liveDate: fc.oneof(
    { weight: 9, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
  realmCheck: fc.oneof(
    { weight: 9, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
  snapshotCheck: fc.oneof(
    { weight: 9, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
  deepCheck: fc.oneof(
    { weight: 12, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
})
const suite: fc.Arbitrary<Suite> = fc.record({
  drafts: fc.array(draft, { minLength: 1, maxLength: 2 }),
  seedless: fc.oneof(
    { weight: 5, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
})

// ---------------------------------------------------------------------------
// Resolution: ids, names, and declared states
// ---------------------------------------------------------------------------
//
// Each draft gets a pooled id, and its constructed histories, fixed histories, and calibrations get
// names. `statesMode` decides the declared states: exactly the states the
// constructed histories enter, one more (a state without a constructed history), or one fewer (a
// constructed history that names an undeclared state). An enumerated draft has no
// constructed or fixed histories.

type Plan = { specs: Array<SyntheticSpec>; seedless: boolean }

function resolveSuite({ drafts, seedless }: Suite): Plan {
  return {
    seedless,
    specs: drafts.map((d, index) => {
      const generated = d.source.kind === `generated`
      const constructed = generated
        ? d.constructed.map((construction, at) => ({
            name: `constructed-${at}`,
            ...construction,
          }))
        : []
      const entered = [
        ...new Set(constructed.flatMap((construction) => construction.enters)),
      ].sort()
      const unused = allStates.filter((state) => !entered.includes(state))
      const states =
        d.statesMode === `extra` && unused.length
          ? [...entered, unused[0]!]
          : d.statesMode === `missing` && entered.length
            ? entered.slice(1)
            : entered
      return {
        id: syntheticIds[index]!,
        source: d.source,
        states,
        constructed,
        fixed: generated
          ? d.fixed.map((fixedHistory, at) => ({
              name: `fixed-${at}`,
              history: fixedHistory.history,
              ...(fixedHistory.enters ? { enters: fixedHistory.enters } : {}),
            }))
          : [],
        ...(generated && d.arbitraryMap !== `none`
          ? {
              arbitraryMap: {
                unmapper: d.arbitraryMap === `unmapper`,
                at: d.mapAt,
              },
            }
          : {}),
        ...(!generated && d.enumeratedStates
          ? {
              enumeratedStates: {
                states: allStates.filter(
                  (_, at) => d.enumeratedStates![at] === `required`,
                ),
                measured: allStates.filter(
                  (_, at) => d.enumeratedStates![at] === `measured`,
                ),
              },
            }
          : {}),
        ...(generated && d.throwingBuild && d.constructed.length > 0
          ? { throwingBuild: true }
          : {}),
        nondeterministic: d.nondeterministic,
        reachVia: d.reachVia,
        ...(d.unregistered ? { unregistered: true } : {}),
        ...(generated && d.probe !== `none` ? { probe: d.probe } : {}),
        ...(d.overReport ? { overReport: true } : {}),
        ...(d.noisyProbe ? { noisyProbe: true } : {}),
        ...(d.predictMode !== `match` ? { predictMode: d.predictMode } : {}),
        ...(d.ownsMode !== `none` ? { ownsMode: d.ownsMode } : {}),
        ...(d.timing === `slow` ? { slow: true, timeout: 100 } : {}),
        ...(d.clock ? { clock: true } : {}),
        // fast-check cannot print a history whose getter throws, so only an
        // enumerated source holds one.
        ...(d.form !== `plain` && (d.form !== `trap` || !generated)
          ? { form: d.form }
          : {}),
        // A seven model with calibrations would need the model's error in
        // each candidate's clean check; it is drawn without them.
        ...(d.sevenModel &&
        !d.strictModel &&
        d.calibrations.length === 0 &&
        (!generated || d.probe === `none`)
          ? { sevenModel: true }
          : {}),
        ...(d.errorNoise ? { errorNoise: true } : {}),
        ...(d.throwOnSpin ? { throwOnSpin: true } : {}),
        ...(d.oddThrow ? { oddThrow: true } : {}),
        ...(d.domThrow && !d.oddThrow ? { domThrow: true } : {}),
        ...(d.liveNoise ? { liveNoise: true } : {}),
        ...(d.liveDate ? { liveDate: true } : {}),
        ...(d.realmCheck ? { realmCheck: true } : {}),
        ...(d.snapshotCheck ? { snapshotCheck: true } : {}),
        // A deep check is drawn without a clock, a model that throws,
        // calibrations, or probes, whose own failures it would cut across.
        ...(d.deepCheck &&
        !d.clock &&
        !d.strictModel &&
        !d.sevenModel &&
        d.calibrations.length === 0 &&
        (!generated || d.probe === `none`)
          ? { deepCheck: true }
          : {}),
        ...(d.zeroNoise ? { zeroNoise: true } : {}),
        ...(d.orderNoise ? { orderNoise: true } : {}),
        // An odd observation fails a history at once; it is drawn without
        // probes or a slow driver, whose counts it would cut short.
        ...(d.odd !== `none` &&
        !(d.timing === `slow`) &&
        (!generated || d.probe === `none`)
          ? {
              odd: d.odd,
              // Checking a large shared value is quick; encoding it at every
              // observation was not.
              ...(d.odd === `shared` ? { timeout: 5_000 } : {}),
            }
          : {}),
        ...(d.emptyMessage ? { emptyMessage: true } : {}),
        ...(!generated && d.labelStyle !== `plain`
          ? { labelStyle: d.labelStyle }
          : {}),
        ...(d.nested ? { nested: true } : {}),
        ...(d.strictModel ? { strictModel: true } : {}),
        calibrations: d.calibrations.map((kind, at) => ({
          name: `cal-${at}`,
          kind,
        })),
      }
    }),
  }
}

// ---------------------------------------------------------------------------
// Model: what Vitest should report for each synthetic property
// ---------------------------------------------------------------------------
//
// The synthetic laws are simple enough to state directly: the first 3, 4, or
// 6 in a history decides it (law `three`, law `four`, or a driver error), and
// a history reaches `saw-k` when it holds k. The model reads the synthetic
// driver's log only to learn which histories a test ran; it never reads what
// Vitest reported. From the predicted failures it also owes the probes: a
// replay of every campaign it predicts to fail, and a rerun of each property's
// first predicted violation among its fixed or enumerated histories.

type Kind =
  | `pass`
  | `violation`
  | `setup`
  | `fixed-reach`
  | `constructed-reach`
  | `enumerated-reach`
  | `undeclared-state`
  | `determinism`
  | `calibration-passed`
  | `calibration-wrong-law`
  | `calibration-none`
  | `timeout`
  | `model-not-total`
  | `data`
  | `limit`
type Outcome = {
  kind: Kind
  law?: `three` | `four` | `reach agreement` | `bounded clock`
  /** A violation whose driver threw afterwards carries that error. */
  cause?: `driver`
  /** The checkpoint a framework-made violation names. */
  checkpoint?: string
  /** For a predicted entry that did not happen: whether the probe was called. */
  diagnosis?: `never-reached` | `false-condition`
  /** For a data error: the value's path and its kind. */
  dataPath?: string
  dataKind?: string
}
type LogEntry = {
  id: string
  test: string
  history: SyntheticHistory
  /** The route registered for the test when the history ran. */
  route: string | null
}

const allowed = (item: number) => [0, 1, 2, 3, 4, 6, 7].includes(item)
const member = (history: SyntheticHistory) =>
  history.length >= 1 && history.length <= 3 && history.every(allowed)
// A constructed history builds its history from its prefix followed by a generated history, cut to
// three items; generated items are always allowed.
const constructedMember = (prefix: SyntheticHistory) =>
  prefix.length >= 1 && prefix.slice(0, 3).every(allowed)
// The arbitrary takes a history back when the history is in its language and
// no `.map` on the history's way lacks an unmapper: in fast-check 4, a `.map`
// without one answers `canShrinkWithoutContext` with false for every value, at
// the whole history or at an item inside it.
const takesBack = (spec: SyntheticSpec, inLanguage: boolean) =>
  inLanguage && spec.arbitraryMap?.unmapper !== false
// The fix a membership load error names (maintainer decision, 2026-11-10, F20).
const mapFix = `\`.map\` needs an unmapper (its second argument). \`fc.constant\`/\`fc.constantFrom\` take back only primitives or the same object reference, so build objects with \`fc.record\`/\`fc.tuple\` over primitive leaves. \`.chain\`, \`fc.func\`, and \`fc.commands\` cannot take a value back.`
// What a synthetic constructed history's throwing build throws.
const buildFailure = `synthetic build failed`
// A 7 on a controlled clock spins it: past the clock's bound, the history
// fails under law `bounded clock` at checkpoint `clock`, ranked as a driver
// error is, by where it happens. A violation recorded before it still decides;
// a driver error after it does not. A strict model throws on a trace that a
// stop cut short, before the history's last item: a model that is not
// prefix-total, which fails the history as a model error.
const clockOutcome: Outcome = {
  kind: `violation`,
  law: `bounded clock`,
  checkpoint: `clock`,
}
// A model that throws on the trace it is given: a strict model on a trace a
// stop cut before the last item, a seven model on a trace holding an item 7.
// On a trace a driver error cut short, that is a model error that carries
// the driver's error; on a trace a spin cut short (items or other
// observations follow the spin), a model error; on a whole trace, the
// model's own error, a setup error.
function verdictOf(history: SyntheticHistory, spec: SyntheticSpec): Outcome {
  const clock = spec.clock === true
  const stops = (item: number) => item === 6 || (clock && item === 7)
  const stopAt = history.findIndex(stops)
  // The driver throws at a 6, or, after a spin, at a later 6 or, in a
  // throwOnSpin spec, right after the spin. Such an error is kept as the
  // cause of whatever decides the history.
  const driverThrows =
    stopAt >= 0 &&
    (history[stopAt] === 6 ||
      spec.throwOnSpin === true ||
      history.slice(stopAt + 1).includes(6))
  const carried = driverThrows ? { cause: `driver` as const } : {}
  const judgedItems = stopAt >= 0 ? history.slice(0, stopAt + 1) : history
  const modelThrows = spec.strictModel
    ? stopAt >= 0 && stopAt < history.length - 1
    : spec.sevenModel === true && judgedItems.includes(7)
  if (modelThrows) {
    if (history[stopAt] === 6)
      return { kind: `model-not-total`, cause: `driver` }
    const trailing =
      spec.nondeterministic ||
      spec.zeroNoise === true ||
      spec.orderNoise === true ||
      spec.errorNoise === true
    // A spin cuts the trace when anything follows it: an observation, or a
    // driver error.
    if (
      stopAt >= 0 &&
      (stopAt < history.length - 1 || trailing || driverThrows)
    )
      return { kind: `model-not-total`, ...carried }
    return { kind: `setup` }
  }
  // A check that compares data past the encoding limit fails as that limit,
  // after a driver error, which decides first.
  if (spec.deepCheck)
    return history.includes(6) ? { kind: `setup` } : { kind: `limit` }
  for (const [at, item] of history.entries()) {
    if (item === 3 || item === 4)
      return {
        kind: `violation`,
        law: item === 3 ? `three` : `four`,
        ...(history.slice(at + 1).some(stops) ? carried : {}),
      }
    if (item === 6) return { kind: `setup` }
    if (clock && item === 7) return { ...clockOutcome, ...carried }
  }
  return { kind: `pass` }
}
const statesOf = (history: SyntheticHistory) =>
  allStates.filter((state) => history.includes(Number(state.slice(4))))
const reaches = (
  spec: SyntheticSpec,
  history: SyntheticHistory,
  states: ReadonlyArray<string>,
) => states.every((state) => reachedOf(spec, history).includes(state))
// Model law for a probe-bound `saw-0`: the model predicts entry when the
// history holds a 0. The synthetic driver calls its probe by its mode (the
// fixture says how), with a condition. A history enters the state when the
// probe is called with a truthy condition; the probe is reached when it is
// called at all. A disagreement violates `reach agreement` once the history has
// no driver error and no law violation of its own.
const agreementLaw = `reach agreement`
const syntheticProbe = `synthetic#saw-0`
const predictsZero = (history: SyntheticHistory) => history.includes(0)
// The condition of the driver's call in this history, or undefined when it
// makes no call.
const callFor = (spec: SyntheticSpec, history: SyntheticHistory) => {
  switch (spec.probe) {
    case `always`:
      return true
    case `never`:
      return false
    case `agree`:
    case `late`:
      return predictsZero(history)
    default:
      return undefined
  }
}
// A forced calibration forces entry, and a forced entry is a call with that
// condition, so it is reached.
const reachedFor = (
  spec: SyntheticSpec,
  history: SyntheticHistory,
  forced?: boolean,
) => forced !== undefined || callFor(spec, history) !== undefined
const enteredFor = (
  spec: SyntheticSpec,
  history: SyntheticHistory,
  forced?: boolean,
) => forced ?? callFor(spec, history) === true
function judged(
  spec: SyntheticSpec,
  history: SyntheticHistory,
  forced?: boolean,
): Outcome {
  const verdict = verdictOf(history, spec)
  if (verdict.kind !== `pass` || !spec.probe) return verdict
  const predicts = predictsZero(history)
  if (enteredFor(spec, history, forced) === predicts) return verdict
  // A predicted entry that did not happen says whether the probe was called.
  return {
    kind: `violation`,
    law: agreementLaw,
    checkpoint: `states`,
    ...(predicts
      ? {
          diagnosis: reachedFor(spec, history, forced)
            ? `false-condition`
            : `never-reached`,
        }
      : {}),
  }
}
// A probe-bound `saw-0` counts only where prediction and entry agree. An
// over-reporting spec claims `saw-0` in every history; only the agreement can
// take that claim back.
const reachedOf = (spec: SyntheticSpec, history: SyntheticHistory) =>
  [
    ...new Set([...statesOf(history), ...(spec.overReport ? [`saw-0`] : [])]),
  ].filter(
    (state) =>
      !spec.probe ||
      state !== `saw-0` ||
      (predictsZero(history) && enteredFor(spec, history)),
  )
const forcedCalibrationNames = (spec: SyntheticSpec) =>
  spec.probe
    ? [true, false].map(
        (entered) =>
          `calibration: probe ${syntheticProbe} ${entered ? `forced entered` : `forced not entered`} (state "saw-0")`,
      )
    : []
// An enumerated history's test name. An unlabelled one is named by the
// framework; the model learns that name from the log, which records the name
// of the test that ran each history.
const frameworkTest = (name: string) =>
  name === `determinism` || name === `reach` || name.startsWith(`calibration:`)
function enumeratedName(
  spec: SyntheticSpec,
  history: SyntheticHistory,
  logged: ReadonlyArray<LogEntry>,
): string {
  if (spec.labelStyle !== `default`)
    return `items ${history.join(` | `)}${spec.labelStyle === `shell` ? ` ${shellText}` : ``}`
  const ran = logged.find(
    (entry) =>
      entry.id === spec.id &&
      JSON.stringify(entry.history) === JSON.stringify(history) &&
      !frameworkTest(entry.test.slice(spec.id.length + 3)),
  )
  return ran
    ? ran.test.slice(spec.id.length + 3)
    : `(never ran) ${JSON.stringify(history)}`
}
const isCampaign = (name: string) =>
  name.startsWith(`fixed seed`) || name === `random seed`

// Model law for an enumerated source's declared states: every history runs,
// so each required state must be entered by at least one of them, and the
// `reach` test counts, for each declared state, the histories that entered
// it. A history counts when it was judged, passing or violating a law; one
// whose driver, model, or data failed before a verdict enters nothing. A
// judged history that enters an undeclared state fails its own test, before
// its law violation, as a campaign's history does.
const declaredOf = (spec: SyntheticSpec) =>
  spec.enumeratedStates && [
    ...spec.enumeratedStates.states,
    ...spec.enumeratedStates.measured,
  ]
const judgedKind = (outcome: Outcome) =>
  outcome.kind === `pass` || outcome.kind === `violation`
const enumeratedReach = (
  spec: SyntheticSpec,
  histories: ReadonlyArray<SyntheticHistory>,
  judgedHistory: (history: SyntheticHistory) => boolean,
): { outcome: Outcome; counts: Record<string, number> } => {
  const counts = Object.fromEntries(
    [...declaredOf(spec)!]
      .sort()
      .map((state) => [
        state,
        histories.filter(
          (history) =>
            judgedHistory(history) && reachedOf(spec, history).includes(state),
        ).length,
      ]),
  )
  const missed = spec.enumeratedStates!.states.some(
    (state) => counts[state] === 0,
  )
  return { outcome: { kind: missed ? `enumerated-reach` : `pass` }, counts }
}

// Where an odd value outside the domain fails, and how its kind is named.
// The odd observation is a history's first, at checkpoint `odd`.
// The data kinds: `domain`, and `shared`, shared references that are data.
const inDomain = (odd: OddKind) => odd === `domain` || odd === `shared`
const oddFailures: Record<
  Exclude<OddKind, `domain` | `shared` | `deep`>,
  [string, string]
> = {
  'proxy-prototype-error': [`.reason`, `an object with a proxy prototype`],
  'proxy-object-prototype': [`.reason`, `an object with a proxy prototype`],
  'old-error': [`.reason`, `an old-style Error without the native brand`],
  'proxy-constructor': [`.reason`, `an instance of a proxied class`],
  cycle: [`.reason.self`, `a cycle`],
  sparse: [`.reason`, `a sparse array`],
  accessor: [`.reason.x`, `an accessor`],
  'symbol-key': [`.reason`, `a symbol key`],
  class: [`.reason`, `SyntheticBox`],
  function: [`.reason`, `a function`],
  symbol: [`.reason`, `a symbol`],
  'dom-exception': [`.reason`, `DOMException`],
  'typed-array': [`.reason`, `Uint8Array`],
  date: [`.reason`, `Date`],
  'array-holes-and-key': [`.reason`, `a sparse array`],
  'array-key': [`.reason.x`, `a property on an array`],
  'array-accessor': [`.reason[0]`, `an accessor`],
  'array-hidden': [`.reason[0]`, `a hidden property`],
  'map-key': [`.reason.meta`, `a property on a Map`],
  'set-key': [`.reason.meta`, `a property on a Set`],
  'error-name-getter': [`.reason.name`, `an accessor`],
  'error-message-getter': [`.reason.message`, `an accessor`],
  proxy: [`.reason`, `a proxy`],
  'custom-prototype': [`.reason`, `an object with a custom prototype`],
  'anonymous-class': [`.reason`, `an instance of an anonymous class`],
  'dotted-key': [`.reason["a.b"].c`, `a function`],
}
const dataOutcome = (spec: SyntheticSpec): Outcome | undefined => {
  if (spec.odd === undefined || inDomain(spec.odd)) return undefined
  // Data deeper than the framework encodes fails as a framework limit.
  if (spec.odd === `deep`) return { kind: `limit` }
  const [path, dataKind] = oddFailures[spec.odd]
  return { kind: `data`, dataPath: `observation 0 ("odd") ${path}`, dataKind }
}
// The forms an enumerated history may not hold: a class instance, and an
// accessor; the first history fails registration.
const historyFailures: Partial<
  Record<NonNullable<SyntheticSpec[`form`]>, string>
> = {
  boxed: `history 0: SyntheticBox is not history data`,
  trap: `history 0 .trap: an accessor is not history data`,
}

type SpecExpectation =
  | {
      loads: false
      /** Text the load error holds, and, for a membership error, the fix it names too. */
      loadError?: string
      loadFix?: string
      /** The message of the load error's cause. */
      loadCause?: string
      /** A constructed history's build threw at registration. */
      buildError?: boolean
      dataError?: boolean
      /** Which history failed law `membership`. */
      membership?: `fixed` | `constructed`
      /** Whether that history is in the language, so only a `.map` without an unmapper failed it. */
      unmapped?: boolean
    }
  | {
      loads: true
      tests: Map<string, Outcome>
      /** Histories a passing determinism test must run, each twice. */
      determinismRuns?: number
      /** For each passing campaign, the histories entering each state. */
      reach: Map<string, Record<string, number>>
      /** Campaigns owed a replay probe, and the test owed a rerun probe. */
      replays: Array<string>
      rerun?: string
    }

function predictSpec(
  spec: SyntheticSpec,
  logged: ReadonlyArray<LogEntry>,
): SpecExpectation {
  const ran = (test: string) =>
    logged
      .filter(
        (entry) =>
          entry.id === spec.id && entry.test === `${spec.id} > ${test}`,
      )
      .map((entry) => entry.history)
  const tests = new Map<string, Outcome>()
  const generated = spec.source.kind === `generated`
  // Every source, enumerated or generated, must name a registered property.
  if (spec.unregistered) return { loads: false }
  // Load errors report the declaration's shape first (law `registration`), in
  // the order oracleProperty checks it: `owns`, then a `predict` on an
  // enumerated source. `owns` must be a literal list of strings, which the gap
  // report reads.
  if (
    spec.ownsMode === `empty` ||
    spec.ownsMode === `string` ||
    spec.ownsMode === `bad entry`
  )
    return {
      loads: false,
      loadError: `${spec.id}: \`owns\` must be a non-empty literal list of strings`,
    }
  if (!generated && spec.predictMode === `extra`)
    return {
      loads: false,
      loadError: `${spec.id}: \`predict\` needs probe-bound states, which only a generated source declares.`,
    }
  const historyFailure =
    spec.source.kind === `enumerated` && spec.form
      ? historyFailures[spec.form]
      : undefined
  if (historyFailure)
    return { loads: false, loadError: historyFailure, dataError: true }
  // `predict` and a probe-bound state come together, and only a generated
  // source declares states.
  if (
    (spec.probe && spec.predictMode === `missing`) ||
    (!spec.probe && spec.predictMode === `extra`)
  )
    return { loads: false }
  if (generated) {
    const declared = new Set(spec.states)
    const entered = new Set(
      spec.constructed.flatMap((construction) => construction.enters),
    )
    if (
      spec.states.some((state) => !entered.has(state)) ||
      [...entered].some((state) => !declared.has(state))
    )
      return { loads: false }
    // A fixed or constructed history that the arbitrary cannot take back
    // fails the load (law `membership`), fixed histories first, naming the
    // property, the history, and the fix.
    const fixedAt = spec.fixed.findIndex(
      (fixedHistory) => !takesBack(spec, member(fixedHistory.history)),
    )
    if (fixedAt >= 0)
      return {
        loads: false,
        loadError: `${spec.id}: fixed history ${fixedAt} ("${spec.fixed[fixedAt]!.name}")`,
        loadFix: mapFix,
        membership: `fixed`,
        unmapped: member(spec.fixed[fixedAt]!.history),
      }
    // Registration then builds each constructed history in order: a build
    // that throws names its constructed history and carries its error.
    for (const [at, construction] of spec.constructed.entries()) {
      if (at === 0 && spec.throwingBuild)
        return {
          loads: false,
          loadError: `oracleProperty ${spec.id}: constructed history "${construction.name}" threw while it was built for registration: ${buildFailure}`,
          loadCause: buildFailure,
          buildError: true,
        }
      if (!takesBack(spec, constructedMember(construction.prefix)))
        return {
          loads: false,
          loadError: `${spec.id}: constructed history "${construction.name}"`,
          loadFix: mapFix,
          membership: `constructed`,
          unmapped: constructedMember(construction.prefix),
        }
    }
  }
  const names =
    spec.source.kind === `enumerated`
      ? spec.source.histories.map((history) =>
          enumeratedName(spec, history, logged),
        )
      : [
          `fixed seed ${spec.source.seed}`,
          `random seed`,
          ...spec.fixed.map(
            (fixedHistory) => `fixed history: ${fixedHistory.name}`,
          ),
        ]
  const all = [
    ...names,
    ...(declaredOf(spec) ? [`reach`] : []),
    ...spec.calibrations.map(({ name }) => `calibration: ${name}`),
    ...forcedCalibrationNames(spec),
    `determinism`,
  ]
  // A slow driver outlives the 100 ms limit in every test that runs a
  // history, and every test runs at least one.
  // A driver that observes a value outside the data domain fails every
  // history at once.
  const data = dataOutcome(spec)
  // Every history fails before a verdict, so an enumerated source's reach
  // test, which runs the histories no test judged, counts none.
  if (data && spec.source.kind === `enumerated` && declaredOf(spec)) {
    for (const name of all) tests.set(name, data)
    const { outcome, counts } = enumeratedReach(
      spec,
      spec.source.histories,
      () => false,
    )
    tests.set(`reach`, outcome)
    return {
      loads: true,
      tests,
      reach: new Map(outcome.kind === `pass` ? [[`enumerated`, counts]] : []),
      replays: [],
    }
  }
  if (data) {
    for (const name of all) tests.set(name, data)
    return {
      loads: true,
      tests,
      reach: new Map(),
      replays: names.filter(isCampaign),
    }
  }
  if (spec.slow) {
    for (const name of all) tests.set(name, { kind: `timeout` })
    return { loads: true, tests, reach: new Map(), replays: [] }
  }
  // A calibration needs a candidate whose clean trace passes; it skips the
  // others (maintainer decision, 2026-11-03). Every history has an item, so
  // the corruption applies to every candidate.
  const calibrate = (name: string, kind: (typeof calibrationKinds)[number]) => {
    const used = ran(`calibration: ${name}`).find(
      (history) => judged(spec, history).kind === `pass`,
    )
    if (!used) return { kind: `calibration-none` } as Outcome
    if (kind === `right` || kind === `driver`)
      return { kind: `pass` } as Outcome
    return {
      kind: kind === `no-op` ? `calibration-passed` : `calibration-wrong-law`,
    } as Outcome
  }
  // A generated property's determinism test also runs three generated
  // histories (maintainer decision, 2026-11-03), so a nondeterministic driver
  // fails it even without fixed or constructed histories.
  const determinism = (): Outcome => {
    const histories = ran(`determinism`).filter((_, at) => at % 2 === 0)
    // An unbound probe that enters on every other run changes only the probe
    // records a run keeps, which the determinism test also compares.
    const varies =
      spec.nondeterministic ||
      spec.noisyProbe === true ||
      spec.zeroNoise === true ||
      spec.orderNoise === true ||
      spec.errorNoise === true ||
      spec.liveNoise === true
    // A driver error ends the determinism test: at a 6, or right after a
    // spin in a throwOnSpin spec.
    const throwsIn = (history: SyntheticHistory) =>
      history.includes(6) ||
      (spec.clock === true && spec.throwOnSpin === true && history.includes(7))
    for (const history of histories) {
      if (throwsIn(history)) return { kind: `setup` }
      if (varies) return { kind: `determinism` }
    }
    if (varies && generated) return { kind: `determinism` }
    return { kind: `pass` }
  }
  // A driver error decides a history first, then a law violation, then a
  // constructed history that misses a state it names (maintainer decision,
  // 2026-11-03). A campaign runs its constructed histories first, in order.
  const campaign = (test: string): Outcome => {
    for (const [at, history] of ran(test).entries()) {
      const { cause: _shrinkable, ...verdict } = judged(spec, history)
      if (verdict.kind !== `pass`) return verdict
      const construction = spec.constructed[at]
      if (construction && !reaches(spec, history, construction.enters))
        return { kind: `constructed-reach` }
    }
    return { kind: `pass` }
  }
  if (spec.source.kind === `enumerated`) {
    const declared = declaredOf(spec)
    for (const history of spec.source.histories) {
      const verdict = verdictOf(history, spec)
      tests.set(
        enumeratedName(spec, history, logged),
        declared &&
          judgedKind(verdict) &&
          reachedOf(spec, history).some((state) => !declared.includes(state))
          ? { kind: `undeclared-state` }
          : verdict,
      )
    }
    if (declared)
      tests.set(
        `reach`,
        enumeratedReach(spec, spec.source.histories, (history) =>
          judgedKind(verdictOf(history, spec)),
        ).outcome,
      )
  } else {
    tests.set(names[0]!, campaign(names[0]!))
    tests.set(`random seed`, campaign(`random seed`))
    for (const fixedHistory of spec.fixed) {
      const verdict = judged(spec, fixedHistory.history)
      tests.set(
        `fixed history: ${fixedHistory.name}`,
        verdict.kind !== `pass`
          ? verdict
          : !reaches(spec, fixedHistory.history, fixedHistory.enters ?? [])
            ? { kind: `fixed-reach` }
            : { kind: `pass` },
      )
    }
  }
  for (const { name, kind } of spec.calibrations)
    tests.set(`calibration: ${name}`, calibrate(name, kind))
  // A forced-probe calibration needs a candidate whose clean trace passes and
  // whose prediction differs from the forced probe; the check must then report
  // reach agreement.
  for (const [at, name] of forcedCalibrationNames(spec).entries()) {
    const forced = at === 0
    tests.set(
      name,
      ran(name).some(
        (history) =>
          judged(spec, history).kind === `pass` &&
          predictsZero(history) !== forced,
      )
        ? { kind: `pass` }
        : { kind: `calibration-none` },
    )
  }
  tests.set(`determinism`, determinism())
  // A passing campaign counts, for every declared and measured state, the
  // histories it ran that entered it.
  const reach = new Map<string, Record<string, number>>()
  if (
    spec.source.kind === `enumerated` &&
    declaredOf(spec) &&
    tests.get(`reach`)!.kind === `pass`
  )
    reach.set(
      `enumerated`,
      enumeratedReach(spec, spec.source.histories, (history) =>
        judgedKind(verdictOf(history, spec)),
      ).counts,
    )
  for (const name of names.filter(isCampaign))
    if (tests.get(name)!.kind === `pass`)
      reach.set(
        name,
        Object.fromEntries(
          allStates.map((state) => [
            state,
            ran(name).filter((history) =>
              reachedOf(spec, history).includes(state),
            ).length,
          ]),
        ),
      )
  // A campaign that fails inside fast-check reports a seed and path to replay.
  const replays = names.filter(
    (name) =>
      isCampaign(name) &&
      [
        `violation`,
        `setup`,
        `constructed-reach`,
        `model-not-total`,
        `limit`,
      ].includes(tests.get(name)!.kind),
  )
  const rerun = names.find(
    (name) => !isCampaign(name) && tests.get(name)!.kind === `violation`,
  )
  return {
    loads: true,
    tests,
    reach,
    replays,
    ...(rerun ? { rerun } : {}),
    ...(generated
      ? { determinismRuns: spec.fixed.length + spec.constructed.length + 3 }
      : {}),
  }
}

function suiteModel(
  plan: Plan,
  trace: ReadonlyArray<{ checkpoint: string; value: unknown }>,
) {
  const run = trace.find(({ checkpoint }) => checkpoint === `run`)?.value as
    SuiteRun | undefined
  const logged = run?.log ?? []
  return new Map(plan.specs.map((spec) => [spec.id, predictSpec(spec, logged)]))
}

// A late spec calls its probe again, unawaited, after every run of a history
// holding a 0, also when its driver threw, and each such call throws: one
// unhandled error per run the log records. A slow spec's driver runs on
// after its test timed out, so its calls may land after the run ended; they
// count at most once each.
const lateCalls = (plan: Plan, logged: ReadonlyArray<LogEntry>) => {
  let min = 0
  let max = 0
  for (const spec of plan.specs) {
    if (spec.probe !== `late`) continue
    const calls = logged.filter(
      (entry) => entry.id === spec.id && entry.history.includes(0),
    ).length
    max += calls
    if (!spec.slow) min += calls
  }
  return { min, max }
}

// The route of the campaign each test runs. Every child run sets a
// seed-only replay (ORACLE_SEED), which reseeds the random campaign; a path
// replay of it runs one recorded history.
function owedRoute(name: string, replay = false): string {
  if (name.startsWith(`fixed seed`)) return `fixed seed`
  if (name === `random seed`) return replay ? `fixed history` : `fixed seed`
  if (name.startsWith(`fixed history:`)) return `fixed history`
  if (
    name.startsWith(`calibration:`) ||
    name === `determinism` ||
    name === `reach`
  )
    return `calibration`
  return `case`
}

// The self-oracle's own reach: states of the framework that its laws are
// about. Each fixed history names the state it witnesses, so every one is reached on
// every run; campaigns count them.
const frameworkStates = [
  `registration-error`,
  `campaign-violation`,
  `campaign-setup-failure`,
  `replay-probe`,
  `rerun-probe`,
  `cause-attached`,
  `constructed-reach-failure`,
  `fixed-reach-failure`,
  `fixed-membership-failure`,
  `constructed-membership-failure`,
  `unmapped-history-load-error`,
  `item-unmapped-load-error`,
  `unmapper-history-loads`,
  `unmapped-arbitrary-loads`,
  `constructed-build-load-error`,
  `calibration-applied`,
  `calibration-rejected`,
  `calibration-skipped-candidate`,
  `determinism-caught`,
  `observed-reach`,
  `timeout`,
  `random-campaign`,
  `agreement-violation`,
  `agreement-never-reached`,
  `agreement-false-condition`,
  `reached-not-entered`,
  `forced-probe-calibration-applied`,
  `late-probe-error`,
  `over-reported-reach`,
  `clock-violation`,
  `bigint-history-violation`,
  `unlabelled-enumerated`,
  `map-history`,
  `shell-label-rerun`,
  `nested-rerun`,
  `strict-model-cut-short`,
  `late-probe-after-driver-error`,
  `replayed-route`,
  `lossy-history`,
  `seedless-route`,
  `error-history`,
  `model-not-total`,
  `errors-history`,
  `history-out-of-domain`,
  `observation-out-of-domain`,
  `observation-in-domain`,
  `equal-data-repeats`,
  `history-reported`,
  `live-value`,
  `realm-compared`,
  `snapshot-judged`,
  `dom-thrown-value`,
  `encoding-limit`,
  `uncut-spin-model-error`,
  `driver-error-carried`,
  `driver-error-after-spin`,
  `odd-thrown-value`,
  `enumerated-reach-counted`,
  `enumerated-reach-failure`,
  `enumerated-undeclared-state`,
  `enumerated-reach-reruns`,
] as const

function frameworkReach(
  plan: Plan,
  trace: ReadonlyArray<{ checkpoint: string; value: unknown }>,
  expected: ReturnType<typeof suiteModel>,
): Iterable<string> {
  const reached = new Set<string>()
  const run = trace.find(({ checkpoint }) => checkpoint === `run`)?.value as
    SuiteRun | undefined
  for (const spec of plan.specs) {
    const owed = expected.get(spec.id)!
    if (!owed.loads) {
      reached.add(`registration-error`)
      if (owed.dataError) reached.add(`history-out-of-domain`)
      if (owed.buildError) reached.add(`constructed-build-load-error`)
      if (owed.membership === `fixed`) reached.add(`fixed-membership-failure`)
      if (owed.membership === `constructed`)
        reached.add(`constructed-membership-failure`)
      // A history in the language that only a `.map` without an unmapper
      // keeps the arbitrary from taking back.
      if (owed.unmapped) {
        reached.add(`unmapped-history-load-error`)
        if (spec.arbitraryMap?.at === `item`)
          reached.add(`item-unmapped-load-error`)
      }
      continue
    }
    const named = spec.fixed.length + spec.constructed.length > 0
    if (spec.arbitraryMap?.unmapper === true && named)
      reached.add(`unmapper-history-loads`)
    if (spec.arbitraryMap?.unmapper === false && !named)
      reached.add(`unmapped-arbitrary-loads`)
    if (spec.odd && inDomain(spec.odd)) reached.add(`observation-in-domain`)
    if (spec.emptyMessage) reached.add(`equal-data-repeats`)
    if (spec.liveDate) reached.add(`live-value`)
    if (spec.realmCheck) reached.add(`realm-compared`)
    if (spec.snapshotCheck) reached.add(`snapshot-judged`)
    if (spec.domThrow && [...owed.tests.values()].some(({ cause }) => cause))
      reached.add(`dom-thrown-value`)
    if ([...owed.tests.values()].some(({ kind }) => kind === `limit`))
      reached.add(`encoding-limit`)
    if (
      spec.form === `boxed` &&
      spec.source.kind === `generated` &&
      [...owed.tests].some(
        ([name, outcome]) =>
          name.startsWith(`fixed history:`) && outcome.kind === `violation`,
      )
    )
      reached.add(`history-reported`)
    for (const [name, outcome] of owed.tests) {
      if (outcome.kind === `data`) reached.add(`observation-out-of-domain`)
      if (isCampaign(name) && outcome.kind === `violation`)
        reached.add(`campaign-violation`)
      if (isCampaign(name) && outcome.kind === `setup`)
        reached.add(`campaign-setup-failure`)
      if (outcome.cause) reached.add(`cause-attached`)
      if (outcome.kind === `timeout`) reached.add(`timeout`)
      if (outcome.kind === `model-not-total`) reached.add(`model-not-total`)
      if (outcome.kind === `model-not-total` && outcome.cause === `driver`)
        reached.add(`driver-error-carried`)
      if (outcome.law === `bounded clock` && outcome.cause === `driver`)
        reached.add(`driver-error-after-spin`)
      if (spec.oddThrow && outcome.cause === `driver`)
        reached.add(`odd-thrown-value`)
      if (
        outcome.kind === `setup` &&
        spec.sevenModel &&
        spec.clock &&
        name.startsWith(`fixed history:`)
      )
        reached.add(`uncut-spin-model-error`)
      if (name === `random seed`) reached.add(`random-campaign`)
      if (outcome.kind === `determinism`) reached.add(`determinism-caught`)
      if (outcome.law === agreementLaw) reached.add(`agreement-violation`)
      if (outcome.law === `bounded clock`) reached.add(`clock-violation`)
      if (outcome.diagnosis === `never-reached`)
        reached.add(`agreement-never-reached`)
      if (outcome.diagnosis === `false-condition`)
        reached.add(`agreement-false-condition`)
      if (
        forcedCalibrationNames(spec).includes(name) &&
        outcome.kind === `pass`
      )
        reached.add(`forced-probe-calibration-applied`)
      const failure = {
        'constructed-reach': `constructed-reach-failure`,
        'fixed-reach': `fixed-reach-failure`,
        'enumerated-reach': `enumerated-reach-failure`,
        'undeclared-state': `enumerated-undeclared-state`,
        'calibration-passed': `calibration-rejected`,
        'calibration-wrong-law': `calibration-rejected`,
      }[outcome.kind as string]
      if (failure) reached.add(failure)
      if (name.startsWith(`calibration:`) && outcome.kind === `pass`)
        reached.add(`calibration-applied`)
      if (
        name === `reach` &&
        outcome.kind === `pass` &&
        (spec.enumeratedStates?.states.length ?? 0) > 0
      )
        reached.add(`enumerated-reach-counted`)
      if (name.startsWith(`calibration:`)) {
        const tried = (run?.log ?? []).filter(
          (entry) =>
            entry.id === spec.id && entry.test === `${spec.id} > ${name}`,
        )
        if (tried.length > 1) reached.add(`calibration-skipped-candidate`)
      }
    }
    if (spec.reachVia === `observe` && owed.reach.size > 0)
      reached.add(`observed-reach`)
  }
  if (lateCalls(plan, run?.log ?? []).max > 0) reached.add(`late-probe-error`)
  for (const spec of plan.specs) {
    const owed = expected.get(spec.id)!
    if (!owed.loads) continue
    const logged = (run?.log ?? []).filter((entry) => entry.id === spec.id)
    if (
      spec.form === `bigint` &&
      [...owed.tests.values()].some((outcome) => outcome.kind === `violation`)
    )
      reached.add(`bigint-history-violation`)
    if (spec.labelStyle === `default`) {
      reached.add(`unlabelled-enumerated`)
      if (spec.form === `map`) reached.add(`map-history`)
      if (spec.form === `lossy`) reached.add(`lossy-history`)
      if (spec.form === `error`) reached.add(`error-history`)
      if (spec.form === `errors`) reached.add(`errors-history`)
    }
    // The reach test ran a history that no earlier test judged.
    if (logged.some(({ test }) => test === `${spec.id} > reach`))
      reached.add(`enumerated-reach-reruns`)
    if (
      spec.strictModel &&
      logged.some(({ history }) => {
        const stopAt = history.findIndex(
          (item) => item === 6 || (spec.clock === true && item === 7),
        )
        return stopAt >= 0 && stopAt < history.length - 1
      })
    )
      reached.add(`strict-model-cut-short`)
    if (
      spec.probe === `late` &&
      logged.some(
        ({ test, history }) =>
          test === `${spec.id} > determinism` &&
          history.includes(0) &&
          history.includes(6),
      )
    )
      reached.add(`late-probe-after-driver-error`)
  }
  for (const { checkpoint, value } of trace) {
    const probe = value as ProbeRun
    const spec = plan.specs.find((candidate) => candidate.id === probe.id)
    if (checkpoint === `rerun` && spec?.labelStyle === `shell`)
      reached.add(`shell-label-rerun`)
    if (checkpoint === `rerun` && spec?.nested) reached.add(`nested-rerun`)
    if (checkpoint === `replay` && (probe.routes?.length ?? 0) > 0)
      reached.add(`replayed-route`)
  }
  // A history whose probe is reached without entering the state passes the
  // agreement wherever the model predicts no entry, so the state is reached.
  for (const spec of plan.specs)
    if (
      spec.probe &&
      expected.get(spec.id)!.loads &&
      (run?.log ?? []).some(
        (entry) =>
          entry.id === spec.id &&
          reachedFor(spec, entry.history) &&
          !enteredFor(spec, entry.history),
      )
    )
      reached.add(`reached-not-entered`)
  for (const spec of plan.specs)
    if (spec.overReport && spec.probe && expected.get(spec.id)!.loads)
      reached.add(`over-reported-reach`)
  if (trace.some(({ checkpoint }) => checkpoint === `replay`))
    reached.add(`replay-probe`)
  const seedless = trace.find(({ checkpoint }) => checkpoint === `seedless`)
  if (
    seedless &&
    Object.values(seedless.value as Record<string, Array<unknown>>).some(
      (routes) => routes.length > 0,
    )
  )
    reached.add(`seedless-route`)
  if (trace.some(({ checkpoint }) => checkpoint === `rerun`))
    reached.add(`rerun-probe`)
  return reached
}

// ---------------------------------------------------------------------------
// Production driver: real Vitest in a child process
// ---------------------------------------------------------------------------
//
// The driver writes each spec to its own test file in a fresh directory
// under tests/, runs Vitest once over them with the self-oracle reporter, and
// records each file's load errors, each test's state and failure (with the
// cause fast-check attaches), each passing campaign's printed reach counts, and
// the synthetic driver's log. Then it probes:
// - replay: for every failing campaign with a reported seed and path, Vitest runs
//   all the files again with that replay selected and its own log, which
//   shows the history the replay started from;
// - rerun: for each property's first failure that printed a rerun command,
//   Vitest runs that file with the command's `-t` pattern.
// Child runs fix the random campaign's seed (a seed without a path reseeds the
// campaign and selects no replay), so a child run records the same facts every time.

type ReportedError = { name?: string; message?: string; cause?: ReportedError }
type ReportedTest = {
  name: string
  state: string
  errors: Array<ReportedError>
  console: string
}
type ReportedFile = {
  file: string
  errors: Array<ReportedError>
  tests: Array<ReportedTest>
}
type Report = {
  files: Array<ReportedFile>
  stdout: string
  unhandled: Array<ReportedError>
}
type Failure = {
  kind: Kind | `other`
  dataPath?: string
  dataKind?: string
  law?: string
  checkpoint?: string
  diagnosis?: `never-reached` | `false-condition`
  cause?: `driver`
  counterexample?: string
  seed?: number
  path?: string
  rerun?: string
  /** Whether a law's failure prints the history's items. */
  showsHistory?: boolean
  /** Whether a model error quotes this machine's paths. */
  machinePath?: boolean
}
type SuiteRun = {
  files: Record<
    string,
    {
      loaded: boolean
      /** The file's load errors, by message. */
      loadErrors: Array<string>
      /** Each load error's cause, by message. */
      loadCauses: Array<string>
      tests: Array<{
        name: string
        state: string
        failure?: Failure
        /** Seeds of the `ORACLE_SEED` lines the test logged for its property. */
        seedLogs: Array<number>
      }>
      reach: Record<string, Record<string, number>>
    }
  >
  log: Array<LogEntry>
  /** The run's unhandled errors, by message. */
  unhandled: Array<string>
}
type ProbeRun = {
  id: string
  /** The probed test: a campaign for replay, a fixed or enumerated history for rerun. */
  target: string
  original: Failure
  /** Each test's state in the probe run, by property id and name. */
  states: Array<[string, string, string]>
  /** The probed test's failure in the probe run. */
  failure?: Failure
  /** Histories the replayed random campaign ran, in order. */
  ran?: Array<SyntheticHistory>
  /** The routes those histories ran under. */
  routes?: Array<string | null>
}

const here = dirname(fileURLToPath(import.meta.url))
const packageDirectory = dirname(here)
const vitest = join(
  dirname(createRequire(import.meta.url).resolve(`vitest/package.json`)),
  `vitest.mjs`,
)
let runCount = 0

function classify(error: ReportedError | undefined): Failure {
  if (!error) return { kind: `other` }
  const outer = error.message ?? ``
  // Only fast-check's wrapper carries the framework's failure as its cause;
  // the framework's own errors may carry a driver error as theirs.
  const inner =
    outer.startsWith(`Property failed`) && error.cause ? error.cause : error
  const text = inner.message ?? ``
  const seed = /seed: (-?\d+)/.exec(outer)?.[1]
  const path = /path: "([\d:]+)"/.exec(outer)?.[1]
  const counterexample = /Counterexample: (.*)/.exec(outer)?.[1]
  // The rerun command as printed, to be pasted into a shell.
  const rerun = /^Rerun: (-t .*)$/m.exec(text)?.[1]
  const history = /^History: (.*)$/m.exec(text)?.[1]
  const law = /\(law: ([^)]+)\)/.exec(text)?.[1]
  const checkpoint = /violated at checkpoint "([^"]+)"/.exec(text)?.[1]
  const diagnosis = /was never reached/.test(text)
    ? (`never-reached` as const)
    : /was reached with a false condition/.test(text)
      ? (`false-condition` as const)
      : undefined
  // A violation carries the driver's error as its cause; a model error
  // carries it in its message.
  const cause =
    (inner.name === `OracleViolation` &&
      (inner.cause?.message ?? ``).includes(`synthetic driver failed`)) ||
    (inner.name === `OracleModelError` &&
      text.includes(`synthetic driver failed`))
      ? (`driver` as const)
      : undefined
  // A data error names the value's path, then its kind.
  const data = /^(.*): (.*) is not (?:observation|history) data$/.exec(text)
  const kind: Kind | `other` =
    inner.name === `OracleDataError`
      ? `data`
      : text.includes(`the framework's encoding limit`)
        ? `limit`
        : inner.name === `OracleModelError`
          ? `model-not-total`
          : inner.name === `OracleViolation`
            ? `violation`
            : /timed out in \d+ms/.test(text) ||
                /timed out in \d+ms/.test(outer)
              ? `timeout`
              : text.includes(`did not enter`) &&
                  text.includes(`: fixed history "`)
                ? `fixed-reach`
                : text.includes(`did not enter`) &&
                    text.includes(`: constructed history "`)
                  ? `constructed-reach`
                  : text.includes(`no enumerated history entered`)
                    ? `enumerated-reach`
                    : text.includes(`which the property does not declare`)
                      ? `undeclared-state`
                      : text.includes(`two runs of`)
                        ? `determinism`
                        : text.includes(`but the check passed it`)
                          ? `calibration-passed`
                          : text.includes(`but the check reported law`)
                            ? `calibration-wrong-law`
                            : text.includes(`found no history`)
                              ? `calibration-none`
                              : text.includes(`synthetic driver failed`) ||
                                  text.includes(`cannot read a 7`)
                                ? `setup`
                                : `other`
  return {
    kind,
    // A model error that quotes a machine path, such as an inspected stack.
    ...(inner.name === `OracleModelError` && text.includes(packageDirectory)
      ? { machinePath: true }
      : {}),
    ...(law ? { law } : {}),
    ...(checkpoint ? { checkpoint } : {}),
    ...(diagnosis ? { diagnosis } : {}),
    ...(inner.name === `OracleDataError` && data
      ? { dataPath: data[1], dataKind: data[2] }
      : {}),
    ...(cause ? { cause } : {}),
    ...(seed !== undefined ? { seed: Number(seed) } : {}),
    ...(path !== undefined ? { path } : {}),
    ...(counterexample !== undefined ? { counterexample } : {}),
    ...(rerun !== undefined ? { rerun } : {}),
    // Only whether it shows the items: a report may print machine paths.
    ...(history !== undefined
      ? {
          // The items, with every brace an inspected Error opens closed.
          showsHistory:
            history.includes(`items`) &&
            history.split(`{`).length === history.split(`}`).length,
        }
      : {}),
  }
}

// One shell word.
const shellWord = (word: string) => `'${word.replace(/'/g, `'\\''`)}'`

function runVitest(
  directory: string,
  files: Array<string>,
  env: Record<string, string>,
  // Shell text appended to the command, which then runs in /bin/sh, as a
  // pasted rerun command does.
  shellTail?: string,
  // Without a seed, the random campaigns draw theirs, as in an ordinary run.
  seeded = true,
): Report {
  const report = join(directory, `report-${runCount++}.json`)
  // The child reads the default `ORACLE` variables, so none of the parent's
  // oracle variables may leak into it.
  const childEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith(`ORACLE_`)),
  )
  const argv = [
    vitest,
    `run`,
    `--coverage.enabled=false`,
    `--typecheck.enabled=false`,
    `--reporter=${join(here, `oracle-property-self-oracle-reporter.mjs`)}`,
    // Each child scans only its own generated directory. The generated
    // directory sits outside `tests/`, so the package's default run never
    // collects a generated spec.
    `--dir=${directory}`,
    ...files,
  ]
  const run = spawnSync(
    shellTail === undefined ? process.execPath : `/bin/sh`,
    shellTail === undefined
      ? argv
      : [
          `-c`,
          `${[process.execPath, ...argv].map(shellWord).join(` `)} ${shellTail}`,
        ],
    {
      cwd: packageDirectory,
      env: {
        ...childEnv,
        ...(seeded ? { ORACLE_SEED: `20251103` } : {}),
        ...env,
        SELF_ORACLE_REPORT: report,
      },
      encoding: `utf8`,
      timeout: 240_000,
      maxBuffer: 64 * 1024 * 1024,
    },
  )
  if (run.error) throw run.error
  if (!existsSync(report))
    throw new Error(
      `the child Vitest run wrote no report:\n${run.stdout}\n${run.stderr}`,
    )
  // The framework prints reach counts straight to stdout, past Vitest's
  // console capture, so they arrive in the child's own output.
  const { files: reported, unhandled } = JSON.parse(
    readFileSync(report, `utf8`),
  ) as { files: Array<ReportedFile>; unhandled?: Array<ReportedError> }
  return { files: reported, stdout: run.stdout, unhandled: unhandled ?? [] }
}

// A test's name within its property, without a nested spec's outer suite.
const unnested = (name: string) =>
  name.startsWith(`${outerSuite} > `) ? name.slice(outerSuite.length + 3) : name
const short = (id: string, name: string) =>
  unnested(name).replace(`${id} > `, ``)
const readLog = (log: string): Array<LogEntry> =>
  existsSync(log)
    ? readFileSync(log, `utf8`)
        .trim()
        .split(`\n`)
        .filter(Boolean)
        .map((line) => {
          const entry = JSON.parse(line) as LogEntry
          return { ...entry, test: unnested(entry.test) }
        })
    : []
// The items of a counterexample that fast-check printed, in any form: the
// first bracketed list of integers, where the lossy form's `Number.NaN` is a
// 1 and its `-0` a 2.
const item = String.raw`(?:-?\d+|Number\.NaN)`
const counterexampleItems = (text: string): SyntheticHistory | null => {
  const list = new RegExp(String.raw`\[(${item}(?:,${item})*)?\]`).exec(text)
  if (!list) return null
  return (list[1] ?? ``)
    .split(`,`)
    .filter(Boolean)
    .map((token) =>
      token === `Number.NaN` ? 1 : token === `-0` ? 2 : Number(token),
    )
}
const statesIn = (report: Report, plan: Plan, files: Array<string>) =>
  plan.specs.flatMap((spec, index) =>
    (report.files.find((file) => file.file === files[index])?.tests ?? []).map(
      (test): [string, string, string] => [
        spec.id,
        short(spec.id, test.name),
        test.state,
      ],
    ),
  )

async function driveSuite(
  plan: Plan,
  observe: (checkpoint: string, value: unknown) => void,
) {
  const directory = join(
    packageDirectory,
    `.self-oracle-${process.pid}-${runCount++}`,
  )
  mkdirSync(directory, { recursive: true })
  try {
    const log = join(directory, `log.jsonl`)
    const files = plan.specs.map((spec, index) => {
      const file = join(directory, `spec-${index}-oracle.test.ts`)
      writeFileSync(
        file,
        `import { syntheticProperty } from ${JSON.stringify(join(here, `oracle-property-self-oracle-fixture.ts`))}\nsyntheticProperty(${JSON.stringify(spec)})\n`,
      )
      return file
    })
    const report = runVitest(directory, files, { SELF_ORACLE_LOG: log })
    const run: SuiteRun = {
      files: {},
      log: readLog(log),
      unhandled: report.unhandled.map((error) => error.message ?? ``),
    }
    for (const [index, spec] of plan.specs.entries()) {
      const reported = report.files.find((file) => file.file === files[index])
      // A passing campaign prints `<id> <campaign> reach {...}`.
      const reach: Record<string, Record<string, number>> = {}
      for (const line of report.stdout.split(`\n`)) {
        const match =
          /^(\S+) (fixed seed -?\d+|random seed|enumerated) reach (\{.*\})$/.exec(
            line,
          )
        if (match?.[1] === spec.id)
          reach[match[2]!] = JSON.parse(match[3]!) as Record<string, number>
      }
      run.files[spec.id] = {
        loaded: reported !== undefined && reported.errors.length === 0,
        loadErrors: (reported?.errors ?? []).map(
          (error) => error.message ?? ``,
        ),
        loadCauses: (reported?.errors ?? []).map(
          (error) => error.cause?.message ?? ``,
        ),
        tests: (reported?.tests ?? []).map((test) => ({
          name: short(spec.id, test.name),
          state: test.state,
          ...(test.state === `failed`
            ? { failure: classify(test.errors[0]) }
            : {}),
          seedLogs: test.console
            .split(`\n`)
            .filter((line) =>
              line.startsWith(
                `ORACLE_SEED {"property":${JSON.stringify(spec.id)},`,
              ),
            )
            .map(
              (line) =>
                (
                  JSON.parse(line.slice(`ORACLE_SEED `.length)) as {
                    seed: number
                  }
                ).seed,
            ),
        })),
        reach,
      }
    }
    observe(`run`, run)
    if (plan.seedless) {
      const seedlessLog = join(directory, `seedless-${runCount}.jsonl`)
      runVitest(
        directory,
        files,
        { SELF_ORACLE_LOG: seedlessLog },
        undefined,
        false,
      )
      const logged = readLog(seedlessLog)
      // The routes each random campaign ran under: the same whatever seed it
      // drew, so this observation repeats.
      observe(
        `seedless`,
        Object.fromEntries(
          plan.specs.map((spec) => [
            spec.id,
            [
              ...new Set(
                logged
                  .filter((entry) => entry.test === `${spec.id} > random seed`)
                  .map((entry) => entry.route),
              ),
            ].sort(),
          ]),
        ),
      )
    }
    for (const spec of plan.specs) {
      for (const campaign of run.files[spec.id]!.tests) {
        if (!isCampaign(campaign.name) || campaign.failure?.path === undefined)
          continue
        const replayLog = join(directory, `replay-${runCount}.jsonl`)
        const replay = runVitest(directory, files, {
          ORACLE_SEED: String(campaign.failure.seed),
          ORACLE_PATH: campaign.failure.path,
          ORACLE_PROPERTY: spec.id,
          SELF_ORACLE_LOG: replayLog,
        })
        const index = plan.specs.indexOf(spec)
        const random = replay.files
          .find((file) => file.file === files[index])
          ?.tests.find((test) => test.name.endsWith(`random seed`))
        const replayed = readLog(replayLog).filter(
          (entry) => entry.test === `${spec.id} > random seed`,
        )
        observe(`replay`, {
          id: spec.id,
          target: campaign.name,
          original: campaign.failure,
          states: statesIn(replay, plan, files),
          ...(random?.state === `failed`
            ? { failure: classify(random.errors[0]) }
            : {}),
          ran: replayed.map((entry) => entry.history),
          routes: replayed.map((entry) => entry.route),
        } satisfies ProbeRun)
      }
      const target = run.files[spec.id]!.tests.find(
        (test) => test.failure?.rerun !== undefined,
      )
      if (!target) continue
      const index = plan.specs.indexOf(spec)
      const rerun = runVitest(
        directory,
        [files[index]!],
        {},
        target.failure!.rerun,
      )
      const ran = rerun.files[0]?.tests.find((test) => test.state === `failed`)
      observe(`rerun`, {
        id: spec.id,
        target: target.name,
        original: target.failure!,
        states: statesIn(rerun, plan, files),
        ...(ran ? { failure: classify(ran.errors[0]) } : {}),
      } satisfies ProbeRun)
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

// ---------------------------------------------------------------------------
// Check
// ---------------------------------------------------------------------------
//
// For each property: it loads exactly when the model says so; it registers
// exactly the owed tests; each test passes, or fails with the owed kind, law,
// and cause; a campaign's counterexample still violates the owed law; a passing
// determinism test ran every history it owes; and each passing campaign printed
// the owed reach counts. Then the probes: the replays and reruns the model
// owes all happened; in each, every other test stood aside; the probed test
// failed again the same way; and a replay started from the counterexample
// itself, as a direct replay must, and reported the same one.

const lawOfTest = (name: string) =>
  name.startsWith(`calibration:`)
    ? `calibration`
    : name === `determinism`
      ? `determinism`
      : name === `reach`
        ? `reach`
        : isCampaign(name)
          ? `shrink`
          : `verdict`
const lawOfKind = (kind: string, name: string) =>
  kind === `timeout`
    ? `timeout`
    : kind === `data` || kind === `limit`
      ? `data`
      : kind === `model-not-total`
        ? `verdict`
        : kind.endsWith(`reach`) || kind === `undeclared-state`
          ? `reach`
          : lawOfTest(name)

function checkSuite(
  plan: Plan,
  trace: ReadonlyArray<{ checkpoint: string; value: unknown }>,
  expected: ReturnType<typeof suiteModel>,
) {
  const run = trace.find(({ checkpoint }) => checkpoint === `run`)?.value as
    SuiteRun | undefined
  if (!run) return violation(`run`, `the driver recorded no run`, `trace`)
  const probes = trace
    .filter(
      ({ checkpoint }) => checkpoint === `replay` || checkpoint === `rerun`,
    )
    .map(({ checkpoint, value }) => ({
      checkpoint,
      probe: value as ProbeRun,
    }))
  for (const spec of plan.specs) {
    const owed = expected.get(spec.id)!
    const seen = run.files[spec.id]!
    if (!owed.loads) {
      const law = owed.membership ? `membership` : `registration`
      if (seen.loaded)
        return violation(
          `run`,
          `${spec.id} loaded, but its id is unregistered, a required state has no constructed history, a constructed history names an undeclared state, a fixed or constructed history is one the arbitrary cannot take back, \`owns\` is not a non-empty literal list of strings, or a history is not data`,
          law,
        )
      const owedText = [owed.loadError, owed.loadFix].filter(
        (text) => text !== undefined,
      )
      if (
        owedText.length > 0 &&
        !seen.loadErrors.some(
          (message, at) =>
            owedText.every((text) => message.includes(text)) &&
            (owed.loadCause === undefined ||
              seen.loadCauses[at] === owed.loadCause),
        )
      )
        return violation(
          `run`,
          `${spec.id} failed to load with ${JSON.stringify(seen.loadErrors)}, owed ${JSON.stringify(owedText)}`,
          owed.membership ? law : `data`,
          { actual: seen.loadErrors, expected: owedText },
        )
      continue
    }
    if (!seen.loaded)
      return violation(`run`, `${spec.id} failed to load`, `registration`)
    const placed = seen.tests.find((test) =>
      test.name.includes(packageDirectory),
    )
    if (placed)
      return violation(
        `run`,
        `${spec.id} named a test with this machine's path: ${JSON.stringify(placed.name.slice(0, 300))}`,
        `names`,
      )
    const names = [...owed.tests.keys()].sort()
    const seenNames = seen.tests.map((test) => test.name).sort()
    if (JSON.stringify(names) !== JSON.stringify(seenNames))
      return violation(
        `run`,
        `${spec.id} registered ${JSON.stringify(seenNames)}, owed ${JSON.stringify(names)}`,
        `registration`,
        { actual: seenNames, expected: names },
      )
    for (const test of seen.tests) {
      const outcome = owed.tests.get(test.name)!
      const failure = test.failure
      const observedKind =
        test.state === `passed` ? `pass` : (failure?.kind ?? `other`)
      if (
        observedKind !== outcome.kind ||
        (outcome.law !== undefined && failure?.law !== outcome.law) ||
        (outcome.checkpoint !== undefined &&
          failure?.checkpoint !== outcome.checkpoint) ||
        failure?.diagnosis !== outcome.diagnosis ||
        failure?.dataPath !== outcome.dataPath ||
        failure?.dataKind !== outcome.dataKind ||
        (!isCampaign(test.name) && failure?.cause !== outcome.cause)
      )
        return violation(
          `run`,
          `${spec.id} "${test.name}" ${test.state} as ${JSON.stringify(failure ?? null)}, owed ${JSON.stringify(outcome)}`,
          lawOfKind(
            outcome.kind === `pass` ? observedKind : outcome.kind,
            test.name,
          ),
          { actual: failure ?? { kind: `pass` }, expected: outcome },
        )
      // A model error quotes the driver's error without this machine's paths.
      if (failure?.machinePath)
        return violation(
          `run`,
          `${spec.id} "${test.name}" reported a model error that quotes this machine's paths`,
          `verdict`,
        )
      // A law's failure prints the history it ran, also a generated one that
      // is not data.
      if (
        spec.form === `boxed` &&
        failure?.kind === `violation` &&
        failure.showsHistory !== true
      )
        return violation(
          `run`,
          `${spec.id} "${test.name}" printed a History line that does not show the history`,
          `verdict`,
        )
      // A random campaign selects its seed once and logs that selection once;
      // a failing campaign's reported seed is the logged one.
      const owedSeedLogs = test.name === `random seed` ? 1 : 0
      if (test.seedLogs.length !== owedSeedLogs)
        return violation(
          `run`,
          `${spec.id} "${test.name}" logged ${test.seedLogs.length} ORACLE_SEED lines, owed ${owedSeedLogs}`,
          `seed-log`,
          { actual: test.seedLogs, expected: owedSeedLogs },
        )
      if (
        failure?.seed !== undefined &&
        test.name === `random seed` &&
        test.seedLogs[0] !== failure.seed
      )
        return violation(
          `run`,
          `${spec.id} "${test.name}" logged seed ${test.seedLogs[0]} but ran seed ${failure.seed}`,
          `seed-log`,
          { actual: failure.seed, expected: test.seedLogs[0] },
        )
      if (
        test.name === `determinism` &&
        test.state === `passed` &&
        owed.determinismRuns !== undefined
      ) {
        const runs = run.log.filter(
          (entry) =>
            entry.id === spec.id && entry.test === `${spec.id} > determinism`,
        ).length
        if (runs !== 2 * owed.determinismRuns)
          return violation(
            `run`,
            `${spec.id} determinism ran ${runs / 2} histories, owed ${owed.determinismRuns}`,
            `determinism`,
          )
      }
      if (failure?.counterexample && outcome.law) {
        const shrunk = counterexampleItems(failure.counterexample)
        // A counterexample of Errors prints without its items; it is not
        // read back.
        if (shrunk && judged(spec, shrunk).law !== outcome.law)
          return violation(
            `run`,
            `${spec.id} "${test.name}" reported counterexample ${failure.counterexample}, which does not violate law ${outcome.law}`,
            `shrink`,
          )
      }
    }
    for (const [campaign, counts] of owed.reach)
      if (JSON.stringify(seen.reach[campaign]) !== JSON.stringify(counts))
        return violation(
          `run`,
          `${spec.id} "${campaign}" printed reach ${JSON.stringify(seen.reach[campaign] ?? null)}, owed ${JSON.stringify(counts)}`,
          `reach`,
          { actual: seen.reach[campaign], expected: counts },
        )
    for (const campaign of owed.replays)
      if (
        !probes.some(
          ({ checkpoint, probe }) =>
            checkpoint === `replay` &&
            probe.id === spec.id &&
            probe.target === campaign,
        )
      )
        return violation(
          `replay`,
          `${spec.id} "${campaign}" failed but was never replayed`,
          `replay`,
        )
    if (
      owed.rerun &&
      !probes.some(
        ({ checkpoint, probe }) =>
          checkpoint === `rerun` && probe.id === spec.id,
      )
    )
      return violation(
        `rerun`,
        `${spec.id} "${owed.rerun}" printed no rerun command`,
        `rerun`,
      )
  }
  // In a run without a seed, every history of a random campaign runs under
  // `random seed`, and a loaded campaign runs at least one.
  const seedless = trace.find(({ checkpoint }) => checkpoint === `seedless`)
    ?.value as Record<string, Array<string | null>> | undefined
  if (seedless)
    for (const spec of plan.specs) {
      const owedRoutes =
        expected.get(spec.id)!.loads &&
        spec.source.kind === `generated` &&
        !spec.slow
          ? [`random seed`]
          : []
      if (JSON.stringify(seedless[spec.id]) !== JSON.stringify(owedRoutes))
        return violation(
          `seedless`,
          `${spec.id}: an ordinary run's random campaign ran under ${JSON.stringify(seedless[spec.id])}, owed ${JSON.stringify(owedRoutes)}`,
          `route`,
          { actual: seedless[spec.id], expected: owedRoutes },
        )
    }
  // Each late probe call surfaces as an unhandled error of the run.
  const late = run.unhandled.filter((message) =>
    message.includes(`was called after its history ended`),
  ).length
  const owedLate = lateCalls(plan, run.log)
  if (late < owedLate.min || late > owedLate.max)
    return violation(
      `run`,
      `the run reported ${late} late probe calls, owed ${owedLate.min === owedLate.max ? owedLate.min : `${owedLate.min} to ${owedLate.max}`}`,
      `agreement`,
      { actual: late, expected: owedLate },
    )
  // Every history runs under its test's route.
  for (const spec of plan.specs) {
    if (!expected.get(spec.id)!.loads || spec.slow) continue
    for (const entry of run.log.filter(({ id }) => id === spec.id)) {
      const name = entry.test.slice(spec.id.length + 3)
      if (entry.route !== owedRoute(name))
        return violation(
          `run`,
          `${spec.id} "${name}" ran ${JSON.stringify(entry.history)} under route ${JSON.stringify(entry.route)}, owed ${JSON.stringify(owedRoute(name))}`,
          `route`,
          { actual: entry.route, expected: owedRoute(name) },
        )
    }
  }
  for (const { checkpoint, probe } of probes) {
    const probed = checkpoint === `replay` ? `random seed` : probe.target
    const others = probe.states.filter(
      ([id, name]) => !(id === probe.id && name === probed),
    )
    if (others.some(([, , state]) => state !== `skipped`))
      return violation(
        checkpoint,
        `${probe.id} ${checkpoint} of "${probe.target}": other tests ran: ${JSON.stringify(others.filter(([, , state]) => state !== `skipped`))}`,
        checkpoint,
      )
    if (!probe.failure)
      return violation(
        checkpoint,
        `${probe.id} ${checkpoint} of "${probe.target}": "${probed}" did not fail again`,
        checkpoint,
      )
    if (
      probe.failure.kind !== probe.original.kind ||
      probe.failure.law !== probe.original.law
    )
      return violation(
        checkpoint,
        `${probe.id}: reproduced ${JSON.stringify(probe.failure)}, first failure ${JSON.stringify(probe.original)}`,
        checkpoint,
      )
    if (checkpoint !== `replay`) continue
    const replayRoute = owedRoute(`random seed`, true)
    if (probe.routes?.some((route) => route !== replayRoute))
      return violation(
        checkpoint,
        `${probe.id}: the replay ran under routes ${JSON.stringify(probe.routes)}, owed ${JSON.stringify(replayRoute)}`,
        `route`,
        { actual: probe.routes, expected: replayRoute },
      )
    if (probe.failure.counterexample !== probe.original.counterexample)
      return violation(
        checkpoint,
        `${probe.id}: replay counterexample ${probe.failure.counterexample}, "${probe.target}" ${probe.original.counterexample}`,
        `replay`,
      )
    // fast-check walks the recorded path through the shrink tree without
    // running the property, so a direct replay runs the counterexample first.
    const counterexample = counterexampleItems(probe.original.counterexample!)
    if (
      counterexample &&
      JSON.stringify(probe.ran?.[0]) !== JSON.stringify(counterexample)
    )
      return violation(
        checkpoint,
        `${probe.id}: the replay first ran ${JSON.stringify(probe.ran?.[0] ?? null)}, not the counterexample ${JSON.stringify(counterexample)}`,
        `replay`,
      )
  }
  return pass
}

// ---------------------------------------------------------------------------
// Property
// ---------------------------------------------------------------------------
//
// Fixed histories replay the regressions the framework has had and witness every
// framework state the laws are about; each names the state it witnesses.

const generatedDraft = (overrides: Partial<Draft>): Draft => ({
  source: { kind: `generated`, runs: 2, seed: 7 },
  statesMode: `exact`,
  constructed: [],
  fixed: [],
  arbitraryMap: `none`,
  mapAt: `history`,
  enumeratedStates: null,
  throwingBuild: false,
  nondeterministic: false,
  reachVia: `reached`,
  timing: `normal`,
  calibrations: [],
  unregistered: false,
  probe: `none`,
  overReport: false,
  noisyProbe: false,
  predictMode: `match`,
  ownsMode: `none`,
  clock: false,
  form: `plain`,
  zeroNoise: false,
  sevenModel: false,
  errorNoise: false,
  throwOnSpin: false,
  oddThrow: false,
  domThrow: false,
  liveNoise: false,
  liveDate: false,
  realmCheck: false,
  snapshotCheck: false,
  deepCheck: false,
  orderNoise: false,
  odd: `none`,
  emptyMessage: false,
  labelStyle: `plain`,
  nested: false,
  strictModel: false,
  ...overrides,
})
const fixedHistory = (
  name: string,
  enters: Array<(typeof frameworkStates)[number]>,
  ...drafts: Array<Draft>
) => ({ name, enters, history: { drafts, seedless: false } })
const seedlessHistory = (
  name: string,
  enters: Array<(typeof frameworkStates)[number]>,
  ...drafts: Array<Draft>
) => ({ name, enters, history: { drafts, seedless: true } })
const at = (history: SyntheticHistory) => ({ history, enters: null })

oracleProperty({
  id: `self-oracle.framework`,
  law: {
    statement: `oracleProperty registers, fails, shrinks, replays, reruns, calibrates, times out, and checks determinism, membership, and reach as its contract states.`,
    authority: `packages/oracles/src/oracle-property.ts header; maintainer decisions of 2026-11-03; oracle rubric ORC-006, ORC-007, ORC-015`,
    limits: `Synthetic properties with histories of one to three integers, one or two per run; real Vitest child processes; one rerun probe per property.`,
  },
  histories: {
    arbitrary: suite,
    states: [],
    measured: frameworkStates,
    runs: 3,
    fixedSeeds: [1],
    fixed: [
      fixedHistory(`a rerun command escapes a label with |`, [`rerun-probe`], {
        ...generatedDraft({}),
        source: {
          kind: `enumerated`,
          histories: [
            [3, 1],
            [3, 2],
          ],
        },
      }),
      fixedHistory(
        `a clock that never goes quiet fails its history under bounded clock`,
        [`clock-violation`],
        generatedDraft({ clock: true, fixed: [at([7])] }),
      ),
      fixedHistory(
        `a violation recorded before the clock spins still decides`,
        [`campaign-violation`],
        generatedDraft({
          clock: true,
          constructed: [{ prefix: [3, 7], enters: [] }],
        }),
      ),
      fixedHistory(
        `a driver error after the clock spins does not decide`,
        [`clock-violation`],
        generatedDraft({ clock: true, fixed: [at([7, 6])] }),
      ),
      fixedHistory(
        `a driver error after a violation is the violation's cause`,
        [`cause-attached`],
        generatedDraft({ fixed: [at([3, 6])] }),
      ),
      fixedHistory(
        `shrinking keeps the first failure's law`,
        [`campaign-violation`, `replay-probe`],
        generatedDraft({ constructed: [{ prefix: [4, 3], enters: [] }] }),
      ),
      fixedHistory(
        `a replayed campaign failure reproduces its path`,
        [`replay-probe`],
        generatedDraft({
          constructed: [{ prefix: [1, 3], enters: [`saw-1`] }],
        }),
      ),
      fixedHistory(
        `shrinking keeps a setup error a setup error`,
        [`campaign-setup-failure`],
        generatedDraft({ constructed: [{ prefix: [6], enters: [] }] }),
      ),
      fixedHistory(
        `the determinism test rejects a nondeterministic driver`,
        [`determinism-caught`],
        generatedDraft({ nondeterministic: true, fixed: [at([0])] }),
      ),
      fixedHistory(
        `the determinism test also samples generated histories`,
        [`determinism-caught`],
        generatedDraft({ nondeterministic: true }),
      ),
      fixedHistory(
        `a required state needs a constructed history`,
        [`registration-error`],
        generatedDraft({
          statesMode: `extra`,
          constructed: [{ prefix: [0], enters: [`saw-0`] }],
        }),
      ),
      // An enumerated source has no random campaign, which is where an id was
      // checked before; registration itself must check it.
      fixedHistory(
        `an unregistered enumerated property fails to load`,
        [`registration-error`],
        {
          ...generatedDraft({}),
          source: { kind: `enumerated`, histories: [[0], [1]] },
          unregistered: true,
        },
      ),
      fixedHistory(
        `a calibration skips a candidate whose clean trace fails`,
        [`calibration-skipped-candidate`, `calibration-applied`],
        generatedDraft({ fixed: [at([3]), at([0])], calibrations: [`right`] }),
      ),
      // A spin fails its history, so its trace is no clean candidate, though
      // every observation in it passes the check.
      fixedHistory(
        `a calibration skips a candidate whose clock spins`,
        [`calibration-skipped-candidate`, `calibration-applied`],
        generatedDraft({
          clock: true,
          fixed: [at([7]), at([0])],
          calibrations: [`right`, `driver`],
        }),
      ),
      fixedHistory(
        `calibrations need the named law`,
        [`calibration-applied`, `calibration-rejected`],
        generatedDraft({
          fixed: [at([0])],
          calibrations: [`right`, `wrong-law`, `no-op`],
        }),
      ),
      fixedHistory(
        `a mutant driver calibration`,
        [`calibration-applied`],
        generatedDraft({ fixed: [at([0])], calibrations: [`driver`] }),
      ),
      fixedHistory(
        `a law violation outranks a constructed history that misses its state`,
        [`campaign-violation`],
        generatedDraft({
          constructed: [{ prefix: [3, 0, 0], enters: [`saw-1`] }],
        }),
      ),
      fixedHistory(
        `a constructed history must enter the states it names`,
        [`constructed-reach-failure`],
        generatedDraft({
          constructed: [{ prefix: [0, 0, 0], enters: [`saw-1`] }],
        }),
      ),
      fixedHistory(
        `a fixed history must enter the states it names`,
        [`fixed-reach-failure`],
        generatedDraft({ fixed: [{ history: [0], enters: [`saw-1`] }] }),
      ),
      fixedHistory(
        `a fixed history outside the language fails to load`,
        [`fixed-membership-failure`],
        generatedDraft({ fixed: [at([5])] }),
      ),
      fixedHistory(
        `a constructed history outside the language fails to load`,
        [`constructed-membership-failure`],
        generatedDraft({ constructed: [{ prefix: [5], enters: [] }] }),
      ),
      // The load error names the history by its index, so the second fixed
      // history is named, and before the constructed history.
      fixedHistory(
        `the first fixed history the arbitrary cannot take back fails the load before a constructed one`,
        [`fixed-membership-failure`],
        generatedDraft({
          fixed: [at([0]), at([5])],
          constructed: [{ prefix: [5], enters: [] }],
        }),
      ),
      // Agents lost full runs to this: a history inside the language that a
      // `.map` without an unmapper cannot take back failed only at run time.
      fixedHistory(
        `a fixed history through a .map without an unmapper fails to load`,
        [`fixed-membership-failure`, `unmapped-history-load-error`],
        generatedDraft({ arbitraryMap: `no unmapper`, fixed: [at([0])] }),
      ),
      fixedHistory(
        `a constructed history through an item .map without an unmapper fails to load`,
        [
          `constructed-membership-failure`,
          `unmapped-history-load-error`,
          `item-unmapped-load-error`,
        ],
        generatedDraft({
          arbitraryMap: `no unmapper`,
          mapAt: `item`,
          form: `bigint`,
          constructed: [{ prefix: [0], enters: [`saw-0`] }],
        }),
      ),
      // Registration builds constructed histories when the file loads, so a
      // build that throws there must name its history, not fail unnamed.
      fixedHistory(
        `a constructed history whose build throws at registration fails to load, naming it`,
        [`registration-error`, `constructed-build-load-error`],
        generatedDraft({
          throwingBuild: true,
          constructed: [
            { prefix: [0], enters: [`saw-0`] },
            { prefix: [5], enters: [] },
          ],
        }),
      ),
      fixedHistory(
        `histories through a .map with an unmapper load and run`,
        [`unmapper-history-loads`],
        generatedDraft({
          arbitraryMap: `unmapper`,
          mapAt: `item`,
          form: `bigint`,
          fixed: [at([0])],
          constructed: [{ prefix: [1], enters: [`saw-1`] }],
        }),
      ),
      fixedHistory(
        `an arbitrary through a .map without an unmapper loads without fixed or constructed histories`,
        [`unmapped-arbitrary-loads`],
        generatedDraft({ arbitraryMap: `no unmapper` }),
      ),
      fixedHistory(
        `reach the driver records counts like reach the property names`,
        [`observed-reach`],
        generatedDraft({
          reachVia: `observe`,
          constructed: [{ prefix: [0, 0, 0], enters: [`saw-0`] }],
        }),
      ),
      fixedHistory(
        `an agreeing state probe passes and its forced calibrations apply`,
        [`forced-probe-calibration-applied`],
        generatedDraft({ probe: `agree`, fixed: [at([0]), at([1])] }),
      ),
      fixedHistory(
        `a probe entered without the prediction violates reach agreement`,
        [`agreement-violation`],
        generatedDraft({ probe: `always`, fixed: [at([1])] }),
      ),
      fixedHistory(
        `a predicted state reached with a false condition violates reach agreement`,
        [`agreement-violation`, `agreement-false-condition`],
        generatedDraft({
          probe: `never`,
          constructed: [{ prefix: [0], enters: [`saw-0`] }],
        }),
      ),
      fixedHistory(
        `a predicted state whose probe is never reached violates reach agreement`,
        [`agreement-violation`, `agreement-never-reached`],
        generatedDraft({
          probe: `unreached`,
          constructed: [{ prefix: [0], enters: [`saw-0`] }],
        }),
      ),
      fixedHistory(
        `a probe reached with a false condition is not entered`,
        [`reached-not-entered`],
        generatedDraft({ probe: `agree`, fixed: [at([1])] }),
      ),
      fixedHistory(
        `a law violation outranks a probe that disagrees`,
        [`campaign-violation`],
        generatedDraft({ probe: `always`, fixed: [at([3])] }),
      ),
      fixedHistory(
        `only agreement counts a probe-bound state as reached`,
        [`over-reported-reach`, `fixed-reach-failure`],
        generatedDraft({
          probe: `agree`,
          overReport: true,
          fixed: [{ history: [1], enters: [`saw-0`] }],
        }),
      ),
      fixedHistory(
        `a probe-bound state needs predict`,
        [`registration-error`],
        generatedDraft({ probe: `agree`, predictMode: `missing` }),
      ),
      fixedHistory(
        `owns given as an empty list fails to load`,
        [`registration-error`],
        generatedDraft({ ownsMode: `empty` }),
      ),
      fixedHistory(
        `owns given as a string fails to load`,
        [`registration-error`],
        generatedDraft({ ownsMode: `string` }),
      ),
      fixedHistory(
        `owns with a non-string entry fails to load`,
        [`registration-error`],
        generatedDraft({ ownsMode: `bad entry` }),
      ),
      fixedHistory(
        `a literal owns list loads`,
        [],
        generatedDraft({ ownsMode: `list` }),
      ),
      fixedHistory(
        `predict needs a probe-bound state`,
        [`registration-error`],
        generatedDraft({ predictMode: `extra` }),
      ),
      fixedHistory(
        `predict on an enumerated source fails to load`,
        [`registration-error`],
        {
          ...generatedDraft({ predictMode: `extra` }),
          source: { kind: `enumerated`, histories: [[0]] },
        },
      ),
      fixedHistory(
        `an owns error outranks a predict error on an enumerated source`,
        [`registration-error`],
        {
          ...generatedDraft({ ownsMode: `bad entry`, predictMode: `extra` }),
          source: { kind: `enumerated`, histories: [[0]] },
        },
      ),
      // The CI counterexample of d8adfee (random seed 471115903, path
      // `1:0:0:0:0:0:2`), replayed field for field: an enumerated source under
      // `predict` whose only history is a class instance. Both load errors
      // hold, and the declaration's shape is the one that decides.
      fixedHistory(
        `a predict error on an enumerated source outranks a history that is not data`,
        [`registration-error`],
        generatedDraft({
          source: { kind: `enumerated`, histories: [[0]] },
          nondeterministic: true,
          probe: `agree`,
          predictMode: `extra`,
          clock: true,
          form: `boxed`,
          odd: `cycle`,
          sevenModel: true,
          errorNoise: true,
        }),
      ),
      fixedHistory(
        `the determinism test compares the probes a driver records`,
        [`determinism-caught`],
        generatedDraft({ noisyProbe: true, fixed: [at([1])] }),
      ),
      fixedHistory(
        `a probe called after its history ended is an error`,
        [`late-probe-error`],
        generatedDraft({ probe: `late`, fixed: [at([0])] }),
      ),
      fixedHistory(
        `a violation in a history holding a bigint fails under its law`,
        [`bigint-history-violation`, `rerun-probe`],
        generatedDraft({ form: `bigint`, fixed: [at([3])] }),
      ),
      fixedHistory(
        `an unlabelled enumerated property names Map histories apart`,
        [`unlabelled-enumerated`, `map-history`],
        {
          ...generatedDraft({ form: `map`, labelStyle: `default` }),
          source: { kind: `enumerated`, histories: [[0], [1]] },
        },
      ),
      fixedHistory(
        `an enumerated source counts the histories that entered each declared state`,
        [`enumerated-reach-counted`],
        {
          ...generatedDraft({
            enumeratedStates: [`required`, `measured`, `measured`],
          }),
          source: { kind: `enumerated`, histories: [[0], [0, 1], [2]] },
        },
      ),
      fixedHistory(
        `an enumerated source fails when no history enters a required state`,
        [`enumerated-reach-failure`],
        {
          ...generatedDraft({
            enumeratedStates: [`measured`, `measured`, `required`],
          }),
          source: { kind: `enumerated`, histories: [[0], [1]] },
        },
      ),
      // A violating history still counts: it was judged.
      fixedHistory(
        `a violating enumerated history counts toward a required state, and its rerun stands the reach test aside`,
        [`enumerated-reach-counted`, `rerun-probe`],
        {
          ...generatedDraft({
            enumeratedStates: [`measured`, `required`, `measured`],
          }),
          source: { kind: `enumerated`, histories: [[3, 1], [0]] },
        },
      ),
      fixedHistory(
        `an enumerated history that enters an undeclared state fails before its violation`,
        [`enumerated-undeclared-state`],
        {
          ...generatedDraft({
            enumeratedStates: [`required`, `undeclared`, `measured`],
          }),
          source: { kind: `enumerated`, histories: [[0], [3, 1], [2]] },
        },
      ),
      // A driver error leaves its history unjudged; the reach test runs it
      // again and counts nothing for it.
      fixedHistory(
        `the reach test runs a history no earlier test judged and counts nothing for it`,
        [`enumerated-reach-reruns`, `enumerated-reach-counted`],
        {
          ...generatedDraft({
            enumeratedStates: [`required`, `measured`, `undeclared`],
          }),
          source: { kind: `enumerated`, histories: [[6, 0], [0]] },
        },
      ),
      fixedHistory(
        `an unlabelled enumerated property of bigint histories loads and fails`,
        [`unlabelled-enumerated`, `bigint-history-violation`, `rerun-probe`],
        {
          ...generatedDraft({ form: `bigint`, labelStyle: `default` }),
          source: { kind: `enumerated`, histories: [[3, 1], [0]] },
        },
      ),
      fixedHistory(
        `an unlabelled enumerated property names -0 and 0 apart`,
        [`unlabelled-enumerated`, `lossy-history`],
        {
          ...generatedDraft({ form: `lossy`, labelStyle: `default` }),
          source: { kind: `enumerated`, histories: [[0], [2], [1]] },
        },
      ),
      // A spin after the last observation cuts nothing: a model that throws
      // there has its own error, a setup error.
      // A driver that fails right after a spin observes nothing more, yet
      // the trace is cut short, and its error is kept.
      fixedHistory(
        `a driver error right after a spin is kept as the spin's cause`,
        [`driver-error-after-spin`, `clock-violation`],
        generatedDraft({ clock: true, throwOnSpin: true, fixed: [at([7])] }),
      ),
      fixedHistory(
        `a model that throws on a trace a driver error cut right after a spin is a model error`,
        [`driver-error-carried`, `model-not-total`],
        generatedDraft({
          clock: true,
          throwOnSpin: true,
          sevenModel: true,
          fixed: [at([1, 7])],
        }),
      ),
      fixedHistory(
        `a model error quotes a thrown value that has no string form`,
        [`odd-thrown-value`, `driver-error-carried`],
        generatedDraft({
          strictModel: true,
          oddThrow: true,
          fixed: [at([3, 6, 1])],
        }),
      ),
      fixedHistory(
        `a model that throws on an uncut trace with a spin is a setup error`,
        [`uncut-spin-model-error`],
        generatedDraft({ clock: true, sevenModel: true, fixed: [at([1, 7])] }),
      ),
      fixedHistory(
        `unlabelled histories of Errors that differ only in their data are named apart`,
        [`unlabelled-enumerated`, `errors-history`],
        {
          ...generatedDraft({ form: `errors`, labelStyle: `default` }),
          source: { kind: `enumerated`, histories: [[0], [1], [2], [3]] },
        },
      ),
      fixedHistory(
        `an enumerated history holding a class instance fails to load, naming its path`,
        [`registration-error`, `history-out-of-domain`],
        {
          ...generatedDraft({ form: `boxed`, labelStyle: `default` }),
          source: { kind: `enumerated`, histories: [[0], [1]] },
        },
      ),
      // A label names the test, but the history must still be data.
      fixedHistory(
        `a labelled enumerated history holding a class instance fails to load`,
        [`registration-error`, `history-out-of-domain`],
        {
          ...generatedDraft({ form: `boxed` }),
          source: { kind: `enumerated`, histories: [[0], [1]] },
        },
      ),
      fixedHistory(
        `an enumerated history holding an accessor fails to load, naming its path`,
        [`registration-error`, `history-out-of-domain`],
        {
          ...generatedDraft({ form: `trap`, labelStyle: `default` }),
          source: { kind: `enumerated`, histories: [[0], [1]] },
        },
      ),
      fixedHistory(
        `the determinism test tells an Error's data apart`,
        [`determinism-caught`],
        generatedDraft({ errorNoise: true, fixed: [at([0])] }),
      ),
      seedlessHistory(
        `an ordinary run's random campaign runs under random seed`,
        [`seedless-route`],
        generatedDraft({}),
      ),
      fixedHistory(
        `an unlabelled history holding an Error is named without its stack`,
        [`unlabelled-enumerated`, `error-history`],
        {
          ...generatedDraft({ form: `error`, labelStyle: `default` }),
          source: { kind: `enumerated`, histories: [[0], [1]] },
        },
      ),
      fixedHistory(
        `the determinism test tells key orders apart`,
        [`determinism-caught`],
        generatedDraft({ orderNoise: true, fixed: [at([0])] }),
      ),
      fixedHistory(
        `data of every kind the domain holds is observed and repeats`,
        [`observation-in-domain`],
        generatedDraft({ odd: `domain`, fixed: [at([0]), at([3])] }),
      ),
      fixedHistory(
        `data past the framework's encoding depth fails as a framework limit`,
        [`encoding-limit`],
        generatedDraft({ odd: `deep`, fixed: [at([0])] }),
      ),
      fixedHistory(
        `the determinism test compares what each observe call saw`,
        [`determinism-caught`],
        generatedDraft({ liveNoise: true, fixed: [at([0])] }),
      ),
      fixedHistory(
        `a live value that later holds a Date was data when observed`,
        [`live-value`],
        generatedDraft({ liveDate: true, fixed: [at([0])] }),
      ),
      fixedHistory(
        `the check judges what was observed, not a later change`,
        [`snapshot-judged`],
        generatedDraft({ snapshotCheck: true, fixed: [at([0]), at([3])] }),
      ),
      fixedHistory(
        `differs on data past the encoding limit reports the limit`,
        [`encoding-limit`],
        generatedDraft({ deepCheck: true, fixed: [at([0])] }),
      ),
      fixedHistory(
        `differs takes data from another realm for the same data`,
        [`realm-compared`],
        generatedDraft({ realmCheck: true, fixed: [at([0]), at([3])] }),
      ),
      fixedHistory(
        `a model error quotes a thrown DOMException without its stack`,
        [`dom-thrown-value`, `driver-error-carried`],
        generatedDraft({
          strictModel: true,
          domThrow: true,
          fixed: [at([3, 6, 1])],
        }),
      ),
      fixedHistory(
        `a large shared observation is checked without printing it`,
        [`observation-in-domain`],
        generatedDraft({ odd: `shared`, fixed: [at([0])] }),
      ),
      fixedHistory(
        `an Error without a message and one with '' are the same data`,
        [`equal-data-repeats`],
        generatedDraft({ emptyMessage: true, fixed: [at([0])] }),
      ),
      // A generated history need not be data, and a failure still prints it.
      fixedHistory(
        `a violation prints a generated history that is not data`,
        [`history-reported`],
        generatedDraft({ form: `boxed`, fixed: [at([3])] }),
      ),
      ...oddKinds
        .filter((odd) => !inDomain(odd) && odd !== `deep`)
        .map((odd) =>
          fixedHistory(
            `an observed ${odd} fails the history, naming its path`,
            [`observation-out-of-domain`],
            generatedDraft({ odd, fixed: [at([0])] }),
          ),
        ),
      fixedHistory(
        `the determinism test tells -0 from 0`,
        [`determinism-caught`],
        generatedDraft({ zeroNoise: true, fixed: [at([0])] }),
      ),
      fixedHistory(
        `a rerun command survives a shell`,
        [`shell-label-rerun`, `rerun-probe`],
        {
          ...generatedDraft({ labelStyle: `shell` }),
          source: { kind: `enumerated`, histories: [[3, 1], [0]] },
        },
      ),
      fixedHistory(
        `a rerun command finds a property inside another suite`,
        [`nested-rerun`, `rerun-probe`],
        generatedDraft({ nested: true, fixed: [at([3])] }),
      ),
      fixedHistory(
        `a model that throws on a trace a spin cut short is a model error`,
        [`strict-model-cut-short`, `model-not-total`],
        generatedDraft({ clock: true, strictModel: true, fixed: [at([7, 1])] }),
      ),
      // A violation recorded before the driver error is not hidden as a
      // setup error: the model that cannot read the rest is named.
      fixedHistory(
        `a model that throws on a trace a driver error cut short is a model error`,
        [`strict-model-cut-short`, `model-not-total`, `driver-error-carried`],
        generatedDraft({ strictModel: true, fixed: [at([3, 6, 1])] }),
      ),
      // A campaign reports a model error as one, and its replay reproduces
      // it. (fast-check removes only leading items here, so no shrink of a
      // model error reaches a plain driver error.)
      fixedHistory(
        `a campaign reports and replays a model error`,
        [`model-not-total`, `replay-probe`],
        generatedDraft({
          strictModel: true,
          constructed: [{ prefix: [3, 6, 1], enters: [] }],
        }),
      ),
      fixedHistory(
        `a probe called after a throwing driver's history ended is an error`,
        [`late-probe-after-driver-error`, `late-probe-error`],
        generatedDraft({ probe: `late`, fixed: [at([0, 6])] }),
      ),
      fixedHistory(
        `a property timeout limits every test it registers`,
        [`timeout`],
        generatedDraft({ timing: `slow`, fixed: [at([0])] }),
      ),
    ],
  },
  resolve: resolveSuite,
  model: suiteModel,
  reached: frameworkReach,
  driver: driveSuite,
  check: checkSuite,
  // Each history spawns one to five child Vitest runs.
  timeout: 600_000,
})
