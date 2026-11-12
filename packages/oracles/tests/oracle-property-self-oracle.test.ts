/**
 * # The oracleProperty self-oracle
 *
 * `oracleProperty` makes promises to the people who write oracles with it.
 * This oracle checks them the way every other oracle checks production: it
 * writes synthetic properties, runs them under real Vitest in a child
 * process, and compares what Vitest reports with what an independent model
 * predicts. The laws, each judged per test or per probe:
 *
 * - `registration`: a property registers its campaigns' units, fixed histories, calibrations, and
 *   determinism tests, exactly: for each fixed seed N, `fixed seed N: <name>` for each constructed
 *   history and then `fixed seed N: generated`; `random seed: <name>` for each constructed history
 *   and then `random seed: generated`; `fixed history: <name>` for each fixed history; one test per
 *   calibration; and, for a generated source, `determinism: fixed history: <name>`,
 *   `determinism: constructed history: <name>`, and `determinism: generated 0` to `2`. An
 *   enumerated source keeps one `determinism` test. An enumerated property without a `label` gives
 *   distinct histories distinct test names. A property fails to load when its id is not a registered
 *   oracle property, a required state has no constructed history, a constructed history names an
 *   undeclared state, a fixed or constructed history is one the arbitrary cannot take back (law
 *   `membership`), or `owns` is not a non-empty literal list of strings (the gap report reads it
 *   statically). When several of the named load errors apply, the declaration's shape reports
 *   first, in this order: an unregistered id, then `owns`, then `predict` on an enumerated source
 *   (only a generated source declares states), then a history that is not data (`data`). A load
 *   fails with its first error alone. This precedence is analyst-chosen (2026-11-10): no contract
 *   text or maintainer decision orders these errors. The source kind decides which checks reach the
 *   histories, so fixing the shape can remove a data error, and fixing the data error first can be
 *   wasted work. A generated source also fails to load when two of its tests would share a name: a
 *   constructed history named `generated`, two constructed histories of one name, or two fixed
 *   histories of one name (maintainer decision, 2026-11-11, option D). These come after its state
 *   checks and before law `membership`, in that order (analyst-chosen, 2026-11-11).
 * - `units` (maintainer decision, 2026-11-11, option D): a campaign's units run exactly the
 *   histories that the campaign ran, each in its own test. The constructed unit of history k, for
 *   seed S, runs one history: the construction built from the arbitrary's sample at seed S + k.
 *   The `generated` unit runs the stream that `fc.sample` draws from the property's arbitrary, with
 *   its constructed weighting, at seed S, for the property's `runs`. The model draws these with
 *   fast-check itself, never through the framework. A unit that fails ran that stream up to its
 *   first failure, then its shrinks. The random units of a property run the one seed it logged: the
 *   seed of the replay environment in a seeded run, and a drawn seed in a seedless run.
 * - `verdict`: a test fails with a violation of law L exactly when its first
 *   failing history violates L, whatever values the history holds (a bigint,
 *   a Map, NaN, or -0 too). Within one history a driver error decides
 *   first, then a law violation, then a constructed history that misses its state; a driver error
 *   after a recorded violation becomes that violation's cause. A model must
 *   accept any prefix of a trace: one that throws on a trace a driver error or
 *   a clock spin cut short fails the history with an `OracleModelError` that
 *   names the model (maintainer decision, 2026-11-08).
 * - `shrink`: a unit's reported failure keeps the kind and law of its own first
 *   failure, and its counterexample still has them. Each unit decides its own first
 *   failure: a failure in one unit does not change another unit's outcome.
 * - `shrink budget`: a campaign whose first failure is judged in time reports
 *   that failure's kind and law, with a counterexample that replays, before
 *   its timeout, however long shrinking would take: it starts no shrink run
 *   once half its timeout has passed, so a run shorter than half the timeout
 *   still ends in time (maintainer decision, 2026-11-11, F31; the half is
 *   analyst-chosen). A path replay runs its counterexample and shrinks no
 *   further, so it reports the counterexample it replays. A `timeout` of 0
 *   or less is no timeout, as Vitest reads it, so it sets no budget: a
 *   constructed history's failure then shrinks to the counterexample that
 *   fast-check's shrinking without a limit reaches over the language.
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
 *   each passing unit reports how many of its histories entered each declared
 *   state, whether the property names reach itself or the driver records it. A unit that
 *   fails or times out prints no reach line, so the sum of a campaign's unit lines counts
 *   only passing units. An enumerated
 *   source that declares `states` or `measured` registers a `reach` test after its histories:
 *   it fails when no enumerated history entered a required state, and otherwise reports how
 *   many entered each declared state. A history counts when it was judged, passing or
 *   violating its law. The reach test reuses what each history's test recorded, and runs again
 *   only a history whose own test never started in the run: in a full run it runs none. A
 *   history whose test started and failed before a verdict (a driver, model, or data error, or
 *   a timeout) counts for nothing; a judgment that arrives after its test timed out is not
 *   recorded. A history the reach test runs that enters an undeclared state fails the reach
 *   test. An enumerated source fails to load when its object holds keys other than
 *   `enumerated`, `states`, and `measured`, when it declares a state as anything but a name,
 *   or when a `label` names a history `reach` or `determinism`, the framework's own tests. A judged enumerated history that
 *   enters an undeclared state fails its test, before its law violation, as a campaign's
 *   history does (maintainer decision, 2026-11-10, F23: every enumerated history runs, so a
 *   required state needs no constructed history). Run alone, under a `-t` pattern that selects
 *   only it, the reach test judges every history itself and owes the same outcome and counts.
 * - `calibration`: a bound calibration runs only its selected history. Its clean
 *   run must pass and enter the history's declared states, then its wrong answer
 *   must fail under exactly the named law. An observation mutant uses one driver
 *   call; a driver mutant uses two fresh builds and plans from the same seed.
 *   Invalid selectors fail registration before any driver runs. These are the
 *   maintainer-approved history-binding contract (2026-11-11). During migration,
 *   unbound calibrations retain candidate search. Rejection ranks recorded law
 *   violations and bounded-clock violations identically on bound/unbound paths.
 *   Required difference text is contained; a pattern matches the difference,
 *   after the designated law. Empty requirements fail registration.
 *   Named construction inputs are stable under reorder and vary across the
 *   finite ordinary/astral name families declared here; no universal collision
 *   freedom is claimed. Forced premises are judged from declared input origins
 *   and author-built callback inputs, never the framework's selected driver log.
 *   Callback errors retain calibration/history context and cause. Both forced
 *   premises independently select fixed or constructed originals; only omitted
 *   entered selectors infer a unique construction. Equal data never permits
 *   substituting another named original. Registration warns once per
 *   property/process without dropping tests, and collect-only stays silent.
 *   Every receiving child preserves that warning and each unbound name once;
 *   neither property order nor name order changes that promise.
 *   Every real child must finish with a complete report and no unmodeled
 *   unhandled errors, including replay and registration-only children.
 *   Each authored calibration selects independently, including bound/unbound
 *   mixtures. Extra own or inherited metadata on a fixed declaration cannot
 *   change its selected source kind. A mutant may record a wrong value, then
 *   spin and optionally throw: that earlier violation still decides.
 * - `determinism`: every fixed, constructed, and sampled generated history
 *   has its own determinism unit, which runs it twice and fails if its trace changes,
 *   compared by their data encoding: `-0` is not `0`, and key order and
 *   Map and Set order count, which a check that iterates them can see.
 * - `campaign budget`: each passing constructed unit runs one example, and
 *   each passing generated unit runs its authored sample count. A wholly
 *   passing lane retains their sum: runs plus constructions, independently
 *   in ordinary/seedless and fixed/random lanes. Children discard parent replay
 *   settings under both prefixes, so their multiplier is one. Path replay runs
 *   one history; failures, shrinking, and timeouts owe no fixed call count.
 * - `host RNG scope`: importing the synthetic fixture in the outer owner
 *   preserves the supplied host draw, which actual seed selection uses.
 *   Marked receiving children separately repeat under the same host input.
 *   Forwarding wrappers can consume that draw more than once. This law
 *   promises no function identity, call count, seed arithmetic or entropy distribution.
 *   The forwarding state requires the actual wrapper to run during seed selection.
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
 * - `timeout`: a property's `timeout` limits every test it registers, each unit
 *   on its own.
 * - `replay`: a failing campaign unit prints a replay command: the seed, the
 *   path, the property, and `${prefix}_UNIT` naming the random unit of the same
 *   name (`random seed: <name>`), under the configured prefix, then that unit's
 *   `-t` pattern (maintainer decisions, 2026-11-11, Q3 and Q4). A failing random
 *   unit's violation prints the same command as its rerun line. Run as printed,
 *   the command runs only that random unit, starts from the counterexample
 *   itself, and reproduces it; every other test stands aside.
 * - `replay-config`: the replay environment is read in a fixed order of
 *   errors: a retired variable (whose message names `${prefix}_UNIT` beside the
 *   seed, path, and property), then `PATH requires SEED`, `PROPERTY requires
 *   PATH`, a seed that is not an integer, an empty or malformed path, `PATH
 *   requires PROPERTY`, and an unregistered property; `${prefix}_UNIT requires
 *   ${prefix}_PROPERTY` comes after all of them (maintainer decision,
 *   2026-11-11, Q3). A malformed environment fails every spec file's load with
 *   its first error. In a path replay of a generated source, `PATH` without
 *   `UNIT` fails that property's load with "`${prefix}_PATH` of a generated
 *   source requires `${prefix}_UNIT`" (Q4), and a `UNIT` that names no random
 *   unit of the replayed property fails its load, an enumerated property's
 *   included. A `UNIT` that names a random unit runs only that unit, from the
 *   path, and every other test stands aside. These replay errors come after
 *   every declaration error of the property (analyst-chosen, 2026-11-11).
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
 *   characters and when the property sits inside another suite. A failing
 *   fixed-seed unit prints `Rerun: -t` with its own pattern, which runs only
 *   that unit, also beside a unit whose name extends its name.
 * - `route`: each history runs under the route, in the one vocabulary of
 *   `oracle-route.ts`, of the campaign that runs it, each unit keeping its
 *   campaign's route: a fixed-seed unit
 *   `fixed seed`; a random unit `random seed`, or `fixed seed` when a
 *   seed-only replay reseeds it (as the main child runs here do; a seedless
 *   child run, without `ORACLE_SEED`, shows `random seed`), or `fixed
 *   history` in a path replay; a fixed history `fixed history`; an enumerated
 *   history `case`; calibrations, probe calibrations, and the determinism test
 *   `calibration`, and so do the determinism units (TanStack/oracles#1 coordinator decisions, 2026-11-08: a
 *   route describes the campaign that runs, in one vocabulary).
 * - `seed-log`: a property logs exactly one `ORACLE_SEED` line, in its first
 *   random unit, and no other test logs one; every random unit runs that seed
 *   (maintainer decision, 2026-11-11, Q2: one seed per property per process). A
 *   replay tool reads that line.
 *
 * Authority: the contract in the header of `oracle-property.ts`, including
 * its state probes (user decision of 2026-11-04 adopting differential reach); the
 * maintainer decisions of 2026-11-03 on calibration candidates, failure
 * precedence, and determinism scope; the maintainer decision of 2026-11-06
 * that work which never goes quiet on a controlled clock fails its history; the maintainer
 * decision of 2026-11-10 (F20) that a fixed or constructed history the arbitrary cannot take back
 * fails at registration, naming the history and the fix; and the oracle rubric's replay
 * (ORC-007), calibration (ORC-006), and declared-reach (ORC-015) rules; the
 * maintainer decision of 2026-11-11 (F27) that a calibration can require its
 * violation's difference; the maintainer decision of 2026-11-11 (F31) that
 * a law violation is reported before the timeout, however slow shrinking would be;
 * and the maintainer decisions of 2026-11-11 on shardable units (option D of
 * the e2e speed plan, with Q2: one seed per property per process, Q3: a
 * `${prefix}_UNIT` variable that requires `${prefix}_PROPERTY`, and Q4: a path
 * replay of a generated source without `UNIT` fails at registration, and
 * every replay line names its unit).
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
 * logical `saw-0`, alpha-renamed to saw-0, toString, constructor, or __proto__
 * at the fixture's public state boundary. The model uses logical integer reach
 * and translates only printed names; the production probe id is unchanged.
 * Resolution may require history identity, and generated boxed histories have
 * private slots; each resolve returns a fresh plan. A separate invocation log
 * checks exactly one resolution per driver execution, including discarded plans. An enumerated source declares its states by name. A late probe is judged by whether the run reports it, not by which
 * test Vitest blames. A slow-shrink spec is slow only in its campaigns and only on histories
 * that hold a 4, so one slow history at most comes before a campaign's first failure. Whether a
 * campaign's shrinking was cut is not observed. Under a timeout, how far a campaign shrinks is
 * not judged (maintainer decision, 2026-11-11). Only without a timeout does the model owe a
 * counterexample, so only there does a framework that never shrinks fail: fast-check's shrink without a limit of a constructed history in the array form,
 * computed by the model's own fast-check run. A counterexample under a budget depends on the
 * machine's speed, so a seed-only rerun can report another one; a path replay reports the same.
 * A driver that leaves fake timers installed that fake `performance` freezes the deadline; no
 * history leaves them.
 * The units law reads only the prefix of a failing unit's log up to its first failure, and
 * no unit of a slow spec, whose driver runs on after its test timed out. A replay environment is
 * drawn with path `0` and the first spec's property only, and its unit is the first random unit
 * of that spec or a missing one. A custom prefix applies to every spec of a suite. Only one fixed
 * unit's `-t` rerun is probed per property, and only the determinism of a generated source is
 * split into units. An error's raw `stack` is not observed: Vitest reprints a failure's stack
 * header from its message.
 * A calibration's required difference is drawn only as four texts and
 * four patterns, including the empty ones, judged against the difference a wrong answer
 * reports, `item k is 3`, where k is the first item or a `driver-last` candidate's last item. A
 * pattern with the global or sticky flag is not drawn. A difference that is not text is drawn
 * only as a number. A calibration's failure message is judged by its kind, not by its text.
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
  CalibrationDifference,
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
const calibrationKinds = [
  `right`,
  `wrong-law`,
  `no-op`,
  `driver`,
  `driver-last`,
  `driver-spin`,
  `driver-spin-throws`,
  `clock`,
  `corrupt-throws`,
  `judge-throws`,
  `judge-driver-throws`,
  `inapplicable`,
  `throws`,
] as const
const calibrationDifferences = [
  `text match`,
  `text mismatch`,
  `pattern match`,
  `pattern mismatch`,
  `later text`,
  `later pattern`,
] as const
type CalibrationDraft = {
  kind: (typeof calibrationKinds)[number]
  difference: CalibrationDifference | `none`
  /** Absent inherits the property default; null explicitly retains search. */
  history?: SyntheticSpec[`calibrationHistory`] | null
}
type Draft = {
  source:
    | { kind: `generated`; runs: number; seed: number }
    | { kind: `enumerated`; histories: ReadonlyArray<SyntheticHistory> }
  /** `exact` declares the constructed histories' states; the others break registration. */
  statesMode: `exact` | `extra` | `missing`
  constructed: Array<{ prefix: SyntheticHistory; enters: Array<string> }>
  fixed: Array<{
    history: SyntheticHistory
    enters: Array<string> | null
    /** Unrelated declaration metadata, never a history construction. */
    buildMetadata?: `own` | `inherited`
  }>
  /**
   * How the constructed histories are named: by index; with names that
   * extend each other (`c`, `c.1`), which a `-t` pattern without its `$`
   * anchor cannot tell apart; with the first named `generated`; or all with
   * one name. The last two break registration.
   */
  constructedNames: `indexed` | `prefixed` | `generated` | `duplicate`
  /** `duplicate` gives every fixed history one name, which breaks registration. */
  fixedNames: `indexed` | `duplicate`
  /** A second fixed seed, ten times the first, whose text the first's extends. */
  secondSeed: boolean
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
  /**
   * `slow`: 300 ms per history under a 100 ms timeout. `slow shrink`: 2 s on
   * each history that holds a 4 in a campaign, under a 5 s timeout.
   */
  timing: `normal` | `slow` | `slow shrink`
  /** A normal-timing spec's `timeout`: the default, 0, or -1 (both no timeout). */
  timeoutMode: `default` | `zero` | `negative`
  calibrations: Array<CalibrationDraft | (typeof calibrationKinds)[number]>
  numberDifference: boolean
  extraReach: boolean | `calibration`
  calibrationNames: `indexed` | `varied` | `astral`
  warningProbe: boolean
  calibrationHistory: NonNullable<SyntheticSpec[`calibrationHistory`]> | null
  isolatedPlans: boolean
  /** Resolution requires the original history identity and returns a fresh plan. */
  identityHistories: boolean
  /** Alpha-renames logical saw-0 at the fixture's public boundary. */
  probeName: `saw-0` | `toString` | `constructor` | `__proto__`
  probeBinding:
    | `unbound`
    | `empty`
    | `inferred`
    | `explicit`
    | `no-absence`
    | `null-entered`
    | `null-binding`
    | `false-binding`
    | `zero-binding`
  probeEntered: NonNullable<SyntheticSpec[`probeEntered`]>
  probeNotEntered: NonNullable<SyntheticSpec[`probeNotEntered`]>
  duplicateHistoryNames: boolean
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
  labelStyle:
    `plain` | `shell` | `default` | `reserved-reach` | `reserved-determinism`
  /** An enumerated declaration that adds a generated source's key, or a probe-bound state. */
  enumeratedShape: `ok` | `extra key` | `probe state`
  nested: boolean
  strictModel: boolean
}
// `seedless`: one more child run, without `ORACLE_SEED`, records the routes
// of each random campaign as an ordinary run draws its seed.
type Suite = {
  drafts: Array<Draft>
  seedless: boolean
  /** A controlled host draw, independent of the framework's seed selection. */
  seedlessDraw?: number
  /** Exercise equivalent warning-name presentations across repeated drives. */
  permuteWarnings?: boolean
  /** A controlled outer host draw, checked independently from receiving children. */
  hostRngDraw?: 0.25 | 0.75
  /** Equivalent outer-host wrappers; alternate one/two forwards across drives. */
  hostRngForwarding?: 1 | 2 | `alternate`
  /** Omission preserves the default prefix of existing fixed histories. */
  prefix?: Prefix
  /** A separately received replay environment; omission means ordinary execution. */
  environment?: ReplayEnvironment | null
}
type Prefix = `ORACLE` | `SYNTH_ORACLE`
type ReplayEnvironment = {
  retired: boolean
  seed: `absent` | `valid` | `invalid`
  path: `absent` | `valid` | `empty` | `malformed`
  property: `absent` | `first` | `empty` | `unregistered`
  /** The first random unit of the first spec, or a unit no spec has. */
  unit: `absent` | `named` | `missing`
}

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
const probeSelector = fc.oneof(
  fc.record({ fixed: fc.constantFrom(`fixed-0`, `fixed-1`, `missing`) }),
  fc.record({
    constructed: fc.constantFrom(`constructed-0`, `constructed-1`, `missing`),
  }),
)
// Selection belongs to each calibration. The property default remains useful
// for migrations; an explicit null chooses search beside selected neighbors.
const calibrationSelector = fc.oneof(
  fc.record({
    fixed: fc.constantFrom(`fixed-0`, `fixed-1`, `unknown`, `missing`),
  }),
  fc.record({
    constructed: fc.constantFrom(
      `constructed-0`,
      `constructed-1`,
      `unknown`,
      `missing`,
    ),
  }),
  fc.record({
    enumerated: fc.oneof(
      fc.integer({ min: -1, max: 4 }),
      fc.constant(1.5),
      fc.constantFrom(`items 0 | 1`, `items 0 | 1 ${shellText}`, `[0,1]`),
    ),
  }),
)
const draft: fc.Arbitrary<Draft> = fc.record({
  probeEntered: probeSelector,
  probeNotEntered: probeSelector,
  calibrationHistory: fc.option(
    fc.oneof(
      fc.record({
        fixed: fc.constantFrom(`fixed-0`, `fixed-1`, `unknown`, `missing`),
      }),
      fc.record({
        constructed: fc.constantFrom(`constructed-0`, `unknown`, `missing`),
      }),
      fc.record({
        enumerated: fc.oneof(
          fc.integer({ min: -1, max: 4 }),
          fc.constant(1.5),
          fc.constantFrom(`items 0 | 1`, `items 0 | 1 ${shellText}`, `[0,1]`),
        ),
      }),
    ),
    { freq: 20 },
  ),
  isolatedPlans: fc.boolean(),
  identityHistories: fc.boolean(),
  probeName: fc.constantFrom(`saw-0`, `toString`, `constructor`, `__proto__`),
  probeBinding: fc.oneof(
    { weight: 20, arbitrary: fc.constant(`unbound` as const) },
    {
      weight: 1,
      arbitrary: fc.constantFrom(
        `empty` as const,
        `inferred` as const,
        `explicit` as const,
        `no-absence` as const,
        `null-entered` as const,
        `null-binding` as const,
        `false-binding` as const,
        `zero-binding` as const,
      ),
    },
  ),
  duplicateHistoryNames: fc.boolean(),
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
    fc.record(
      {
        history: insideOrOutside(4),
        enters: fc.option(fc.subarray(allStates), { freq: 2 }),
        buildMetadata: fc.option(
          fc.constantFrom(`own` as const, `inherited` as const),
          { nil: undefined, freq: 8 },
        ),
      },
      { requiredKeys: [`history`, `enters`] },
    ),
    { maxLength: 2 },
  ),
  // Names that extend each other are common; names that break registration
  // are rare.
  constructedNames: fc.oneof(
    { arbitrary: fc.constant(`indexed` as const), weight: 6 },
    { arbitrary: fc.constant(`prefixed` as const), weight: 3 },
    {
      arbitrary: fc.constantFrom(`generated` as const, `duplicate` as const),
      weight: 1,
    },
  ),
  fixedNames: fc.oneof(
    { arbitrary: fc.constant(`indexed` as const), weight: 9 },
    { arbitrary: fc.constant(`duplicate` as const), weight: 1 },
  ),
  secondSeed: fc.oneof(
    { arbitrary: fc.constant(false), weight: 4 },
    { arbitrary: fc.constant(true), weight: 1 },
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
    {
      arbitrary: fc.constantFrom(`slow` as const, `slow shrink` as const),
      weight: 2,
    },
  ),
  timeoutMode: fc.oneof(
    { arbitrary: fc.constant(`default` as const), weight: 2 },
    {
      arbitrary: fc.constantFrom(`zero` as const, `negative` as const),
      weight: 1,
    },
  ),
  // A calibration may require its violation's difference, matching or not.
  calibrations: fc.array(
    fc.oneof(
      fc.constantFrom(...calibrationKinds),
      fc.record(
        {
          kind: fc.constantFrom(...calibrationKinds),
          history: fc.option(fc.option(calibrationSelector, { nil: null }), {
            nil: undefined,
            freq: 4,
          }),
          difference: fc.oneof(
            // Rare: an empty difference fails the whole property's load.
            { weight: 9, arbitrary: fc.constant(`none` as const) },
            {
              weight: 9,
              arbitrary: fc.constantFrom(...calibrationDifferences),
            },
            {
              weight: 1,
              arbitrary: fc.constantFrom(
                `empty text` as const,
                `empty pattern` as const,
              ),
            },
          ),
        },
        { requiredKeys: [`kind`, `difference`] },
      ),
    ),
    { maxLength: 3 },
  ),
  extraReach: fc.oneof(
    { weight: 30, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
    { weight: 1, arbitrary: fc.constant(`calibration` as const) },
  ),
  calibrationNames: fc.constantFrom(`indexed`, `varied`, `astral`),
  warningProbe: fc.oneof(
    { weight: 30, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
  numberDifference: fc.oneof(
    { weight: 5, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
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
    { weight: 8, arbitrary: fc.constant(`plain` as const) },
    {
      weight: 2,
      arbitrary: fc.constantFrom(`shell` as const, `default` as const),
    },
    {
      weight: 1,
      arbitrary: fc.constantFrom(
        `reserved-reach` as const,
        `reserved-determinism` as const,
      ),
    },
  ),
  enumeratedShape: fc.oneof(
    { weight: 8, arbitrary: fc.constant(`ok` as const) },
    {
      weight: 1,
      arbitrary: fc.constantFrom(`extra key` as const, `probe state` as const),
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
const replayEnvironment: fc.Arbitrary<ReplayEnvironment> = fc.record({
  retired: fc.oneof(
    { weight: 5, arbitrary: fc.constant(false) },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
  seed: fc.constantFrom(
    `absent` as const,
    `valid` as const,
    `invalid` as const,
  ),
  path: fc.constantFrom(
    `absent` as const,
    `valid` as const,
    `empty` as const,
    `malformed` as const,
  ),
  property: fc.constantFrom(
    `absent` as const,
    `first` as const,
    `empty` as const,
    `unregistered` as const,
  ),
  unit: fc.constantFrom(
    `absent` as const,
    `named` as const,
    `missing` as const,
  ),
})
const cleanHostDraw = 0.5000000016298145
const suite: fc.Arbitrary<Suite> = fc.record(
  {
    drafts: fc.array(draft, { minLength: 1, maxLength: 2 }),
    seedless: fc.oneof(
      { weight: 5, arbitrary: fc.constant(false) },
      { weight: 1, arbitrary: fc.constant(true) },
    ),
    seedlessDraw: fc.option(fc.constantFrom(0.5, cleanHostDraw), {
      nil: undefined,
      freq: 8,
    }),
    hostRngDraw: fc.option(fc.constantFrom(0.25 as const, 0.75 as const), {
      nil: undefined,
      freq: 24,
    }),
    hostRngForwarding: fc.option(
      fc.constantFrom(1 as const, 2 as const, `alternate` as const),
      {
        nil: undefined,
        freq: 24,
      },
    ),
    prefix: fc.oneof(
      { weight: 3, arbitrary: fc.constant(`ORACLE` as const) },
      { weight: 1, arbitrary: fc.constant(`SYNTH_ORACLE` as const) },
    ),
    environment: fc.oneof(
      { weight: 10, arbitrary: fc.constant(null) },
      { weight: 1, arbitrary: replayEnvironment },
    ),
    permuteWarnings: fc.option(fc.boolean(), { nil: undefined, freq: 12 }),
  },
  { requiredKeys: [`drafts`, `seedless`] },
)

// ---------------------------------------------------------------------------
// Resolution: ids, names, and declared states
// ---------------------------------------------------------------------------
//
// Each draft gets a pooled id, and its constructed histories, fixed histories, and calibrations get
// names. `statesMode` decides the declared states: exactly the states the
// constructed histories enter, one more (a state without a constructed history), or one fewer (a
// constructed history that names an undeclared state). An enumerated draft has no
// constructed or fixed histories.

type Plan = {
  specs: Array<SyntheticSpec>
  seedless: boolean
  seedlessDraw?: number
  permuteWarnings?: boolean
  hostRngDraw?: 0.25 | 0.75
  hostRngForwarding?: 1 | 2 | `alternate`
  prefix: Prefix
  environment: ReplayEnvironment | null
}

// A constructed history's name under the draft's naming.
const constructedName = (names: Draft[`constructedNames`], at: number) =>
  names === `prefixed`
    ? at === 0
      ? `c`
      : `c.${at}`
    : names === `generated` && at === 0
      ? `generated`
      : names === `duplicate`
        ? `constructed`
        : `constructed-${at}`

function resolveSuite({
  drafts,
  seedless,
  seedlessDraw,
  permuteWarnings,
  hostRngDraw,
  hostRngForwarding,
  prefix = `ORACLE`,
  environment = null,
}: Suite): Plan {
  return {
    seedless,
    ...(seedlessDraw === undefined ? {} : { seedlessDraw }),
    ...(permuteWarnings ? { permuteWarnings: true } : {}),
    ...(hostRngDraw === undefined ? {} : { hostRngDraw }),
    ...(hostRngForwarding === undefined ? {} : { hostRngForwarding }),
    prefix,
    environment,
    specs: drafts.map((d, index) => {
      const generated = d.source.kind === `generated`
      const hasBinding =
        (d.probe !== `none` &&
          d.probeBinding !== `unbound` &&
          d.probeBinding !== `empty`) ||
        d.calibrations.some((calibration) =>
          typeof calibration === `string`
            ? d.calibrationHistory !== null
            : calibration.history === undefined
              ? d.calibrationHistory !== null
              : calibration.history !== null,
        )
      const constructed = generated
        ? d.constructed.map((construction, at) => ({
            name:
              d.duplicateHistoryNames && hasBinding
                ? `constructed-0`
                : constructedName(d.constructedNames, at),
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
        ...(generated && d.secondSeed ? { secondSeed: true } : {}),
        states,
        constructed,
        fixed: generated
          ? d.fixed.map((fixedHistory, at) => ({
              name:
                d.duplicateHistoryNames && hasBinding
                  ? `fixed-0`
                  : d.fixedNames === `duplicate`
                    ? `fixed`
                    : `fixed-${at}`,
              history: fixedHistory.history,
              ...(fixedHistory.enters ? { enters: fixedHistory.enters } : {}),
              ...(fixedHistory.buildMetadata
                ? { buildMetadata: fixedHistory.buildMetadata }
                : {}),
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
                // A probe-bound state needs a declared state to bind.
                ...(d.enumeratedShape === `extra key` ||
                (d.enumeratedShape === `probe state` &&
                  d.enumeratedStates.some((role) => role !== `undeclared`))
                  ? { enumeratedShape: d.enumeratedShape }
                  : {}),
              },
            }
          : {}),
        ...(generated && d.throwingBuild && d.constructed.length > 0
          ? { throwingBuild: true }
          : {}),
        nondeterministic: d.nondeterministic,
        reachVia: d.reachVia,
        ...(d.unregistered ? { unregistered: true } : {}),
        ...(d.numberDifference ? { numberDifference: true } : {}),
        ...(generated && d.probe !== `none` ? { probe: d.probe } : {}),
        ...(d.overReport ? { overReport: true } : {}),
        ...(d.noisyProbe ? { noisyProbe: true } : {}),
        ...(d.predictMode !== `match` ? { predictMode: d.predictMode } : {}),
        ...(d.ownsMode !== `none` ? { ownsMode: d.ownsMode } : {}),
        ...(d.timing === `slow` ? { slow: true, timeout: 100 } : {}),
        ...(d.timing === `slow shrink`
          ? { slowShrink: true, timeout: 5_000 }
          : {}),
        ...(d.timing === `normal` && d.timeoutMode !== `default`
          ? { timeout: d.timeoutMode === `zero` ? 0 : -1 }
          : {}),
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
        ...(d.extraReach &&
        (generated ||
          (d.enumeratedStates !== null && d.extraReach === `calibration`))
          ? { extraReach: d.extraReach }
          : {}),
        ...(d.warningProbe ? { warningProbe: true } : {}),
        calibrationNames: d.calibrationNames,
        ...(d.calibrationHistory
          ? { calibrationHistory: d.calibrationHistory }
          : {}),
        ...(d.isolatedPlans ? { isolatedPlans: true } : {}),
        ...(d.identityHistories ? { identityHistories: true } : {}),
        probeName: d.probeName,
        ...(d.probeBinding !== `unbound`
          ? { probeBinding: d.probeBinding }
          : {}),
        probeEntered: d.probeEntered,
        probeNotEntered: d.probeNotEntered,
        ...(d.duplicateHistoryNames ? { duplicateHistoryNames: true } : {}),
        calibrations: (d.calibrationNames === `indexed`
          ? d.calibrations
          : Array.from({ length: 16 }, () => d.calibrations[0]).filter(
              (item) => item !== undefined,
            )
        ).map((entry, at) => {
          const { kind, difference, history } =
            typeof entry === `string`
              ? { kind: entry, difference: `none` as const, history: undefined }
              : entry
          return {
            name:
              d.calibrationNames === `astral`
                ? `drops ${String.fromCodePoint(0x1f600 + at)}`
                : d.calibrationNames === `varied`
                  ? `named calibration ${at}`
                  : `cal-${at}`,
            kind,
            ...(difference === `none` ? {} : { difference }),
            ...(history === undefined ? {} : { history }),
          }
        }),
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
  | `calibration-wrong-difference`
  | `calibration-odd-difference`
  | `calibration-none`
  | `calibration-clean`
  | `calibration-reach`
  | `calibration-inapplicable`
  | `timeout`
  | `model-not-total`
  | `data`
  | `limit`
type Outcome = {
  kind: Kind
  law?: `three` | `four` | `reach agreement` | `bounded clock`
  /** A violation whose driver threw afterwards carries that error. */
  cause?: `driver`
  /** The exact finite driver error a violation carries. */
  causeMessage?: string
  /** The checkpoint a framework-made violation names. */
  checkpoint?: string
  /** For a predicted entry that did not happen: whether the probe was called. */
  diagnosis?: `never-reached` | `false-condition`
  /** For a data error: the value's path and its kind. */
  dataPath?: string
  dataKind?: string
  /** A campaign's owed counterexample, where the model knows it. */
  counterexample?: SyntheticHistory
}
type LogEntry = {
  id: string
  test: string
  history: SyntheticHistory
  /** The route registered for the test when the history ran. */
  route: string | null
  origin?: string
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
  const driverThrowAt = history.findIndex(
    (item) => item === 6 || (clock && spec.throwOnSpin === true && item === 7),
  )
  const carried = driverThrows
    ? {
        cause: `driver` as const,
        causeMessage:
          history[driverThrowAt] === 7
            ? `synthetic driver failed after the spin at item ${driverThrowAt}`
            : `synthetic driver failed at item ${driverThrowAt}`,
      }
    : {}
  // A model-not-total error wraps the judgment error, while retaining the
  // driver error separately. Its inner cause does not use violation shape.
  const modelCarried = driverThrows ? { cause: `driver` as const } : {}
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
      return { kind: `model-not-total`, ...modelCarried }
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
        checkpoint: `item ${at}`,
        ...(history.slice(at + 1).some(stops) ? carried : {}),
      }
    if (item === 6) return { kind: `setup` }
    if (clock && item === 7) return { ...clockOutcome, ...carried }
  }
  return { kind: `pass` }
}
// A spec without a timeout: Vitest reads 0 or less as none, so a campaign
// has no shrink budget.
const unbudgeted = (spec: SyntheticSpec) =>
  spec.timeout !== undefined && spec.timeout <= 0
// The kind a shrink must keep, as the framework classifies a failure.
const shrinkKind = (spec: SyntheticSpec, history: SyntheticHistory) => {
  const outcome = judged(spec, history)
  return outcome.kind === `pass`
    ? undefined
    : outcome.kind === `violation`
      ? `law:${outcome.law}`
      : outcome.kind
}
// The model shrinks only items in the array form, without a `.map` or an
// observation outside the data domain.
const shrinkModelled = (spec: SyntheticSpec) =>
  spec.form === undefined &&
  spec.arbitraryMap === undefined &&
  dataOutcome(spec) === undefined &&
  spec.deepCheck !== true
// Shrinking without a limit, as fast-check searches after a failure: from
// the example, the first smaller history in the arbitrary's shrink tree that
// fails the example's way becomes the next one, until none does.
function unboundedShrink(
  spec: SyntheticSpec,
  example: SyntheticHistory,
): SyntheticHistory | undefined {
  if (!shrinkModelled(spec)) return undefined
  const first = shrinkKind(spec, example)
  let current = new fc.Value<SyntheticHistory>(example, undefined)
  for (;;) {
    let next: fc.Value<SyntheticHistory> | undefined
    for (const candidate of syntheticArbitrary.shrink(
      current.value,
      current.context,
    ))
      if (shrinkKind(spec, candidate.value) === first) {
        next = candidate
        break
      }
    if (next === undefined) return current.value
    current = next
  }
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
  if (
    spec.extraReach === true &&
    (verdict.kind === `pass` || verdict.kind === `violation`) &&
    (spec.source.kind === `generated` || spec.enumeratedStates)
  )
    return { kind: `undeclared-state` }
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
          `calibration: probe ${syntheticProbe} ${entered ? `forced entered` : `forced not entered`} (state "${spec.probeName ?? `saw-0`}")`,
      )
    : []
// An enumerated history's test name. An unlabelled one is named by the
// framework; the model learns that name from the log, which records the name
// of the test that ran each history.
const frameworkTest = (name: string) =>
  name.startsWith(`determinism`) ||
  name === `reach` ||
  name.startsWith(`calibration:`)
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
// The candidates a calibration tries, in order (the contract's rule): an
// enumerated source's histories; or a generated source's fixed histories,
// its constructed histories built from the first fixed seed (constructed
// history k from seed + k), and 100 histories sampled with that seed. A `.map`
// draws no randomness, so a spec's form samples the same items.
const calibrationCandidates = (
  spec: SyntheticSpec,
): ReadonlyArray<SyntheticHistory> => {
  if (spec.source.kind === `enumerated`) return spec.source.histories
  const { seed } = spec.source
  return [
    ...spec.fixed.map(({ history }) => history),
    ...spec.constructed.map(({ prefix }, at) =>
      [
        ...prefix,
        ...fc
          .sample(syntheticArbitrary, { seed: seed + at, numRuns: 1 })[0]!
          .map((item) => (spec.isolatedPlans ? item % 3 : item)),
      ].slice(0, 3),
    ),
    ...fc.sample(syntheticArbitrary, { seed, numRuns: 100 }),
  ]
}
// Model law `units`. A synthetic constructed history is its prefix followed by
// a generated history, cut to three items; the generated history is the
// arbitrary's sample at the seed it is built from.
const constructedAt = (
  spec: SyntheticSpec,
  prefix: SyntheticHistory,
  seed: number,
) =>
  [
    ...prefix,
    ...fc
      .sample(syntheticArbitrary, { seed, numRuns: 1 })[0]!
      .map((item) => (spec.isolatedPlans ? item % 3 : item)),
  ].slice(0, 3)
// The seed every seeded child run gives the random units (`${prefix}_SEED`).
const childSeed = 20251103
const fixedSeedsOf = (spec: SyntheticSpec): Array<number> =>
  spec.source.kind === `generated`
    ? [spec.source.seed, ...(spec.secondSeed ? [spec.source.seed * 10] : [])]
    : []
// A campaign's units, in order: one per constructed history, then `generated`.
const unitNames = (spec: SyntheticSpec) => [
  ...spec.constructed.map(({ name }) => name),
  `generated`,
]
const fixedUnit = (seed: number, name: string) => `fixed seed ${seed}: ${name}`
const randomUnit = (name: string) => `random seed: ${name}`
// The unit a campaign test runs: its seed (undefined for a random unit) and
// its name within the campaign.
const unitOf = (test: string): { seed?: number; name: string } | undefined => {
  const fixed = /^fixed seed (-?\d+): (.*)$/.exec(test)
  if (fixed) return { seed: Number(fixed[1]), name: fixed[2]! }
  const random = /^random seed: (.*)$/.exec(test)
  return random ? { name: random[1]! } : undefined
}
// The histories a unit draws at `seed`, in order: a constructed unit its one
// construction, built from seed + its index; the `generated` unit the stream
// that fast-check samples from the property's arbitrary with its constructed
// weighting (each constructed history weighs 1, and the language weighs their
// count) for `runs` draws. Drawn with fast-check itself, never the framework.
// The weighting restates how production composes its arbitrary, which the
// design of option D authorizes the model to state (design-c-d.md, law
// `units`: "the property's arbitrary (with its constructed weighting)"). It
// is that composition, not a contract promise: the header promises only that
// half of a campaign's generated histories are constructed, and a change to
// the composition must change this model with it.
function unitStream(
  spec: SyntheticSpec,
  seed: number,
  name: string,
): Array<SyntheticHistory> {
  if (spec.source.kind !== `generated`) return []
  const at = spec.constructed.findIndex(
    (construction) => construction.name === name,
  )
  if (at >= 0)
    return [constructedAt(spec, spec.constructed[at]!.prefix, seed + at)]
  const weighted =
    spec.constructed.length === 0
      ? syntheticArbitrary
      : fc.oneof(
          { arbitrary: syntheticArbitrary, weight: spec.constructed.length },
          ...spec.constructed.map(({ prefix }) => ({
            arbitrary: syntheticArbitrary.map((items) =>
              [
                ...prefix,
                ...items.map((item) => (spec.isolatedPlans ? item % 3 : item)),
              ].slice(0, 3),
            ),
            weight: 1,
          })),
        )
  return fc.sample(weighted, { seed, numRuns: spec.source.runs })
}
// The history each determinism unit runs twice: a generated source's fixed
// histories, its constructed histories built from the first fixed seed, and
// three samples at that seed.
function determinismUnits(spec: SyntheticSpec): Map<string, SyntheticHistory> {
  const [seed] = fixedSeedsOf(spec)
  if (seed === undefined) return new Map()
  return new Map([
    ...spec.fixed.map(
      ({ name, history }) =>
        [`determinism: fixed history: ${name}`, history] as const,
    ),
    ...spec.constructed.map(
      ({ name, prefix }, at) =>
        [
          `determinism: constructed history: ${name}`,
          constructedAt(spec, prefix, seed + at),
        ] as const,
    ),
    ...fc
      .sample(syntheticArbitrary, { seed, numRuns: 3 })
      .map((history, k) => [`determinism: generated ${k}`, history] as const),
  ])
}
// What a required difference holds, stated apart from the fixture's values:
// text by containment, a pattern by a match anywhere. The empty ones never
// register.
const differenceHolds: Record<
  CalibrationDifference,
  (difference: string) => boolean
> = {
  'text match': (difference) => difference.includes(`is 3`),
  'text mismatch': (difference) => difference.includes(`is 4`),
  'pattern match': (difference) => /^item \d is 3$/.test(difference),
  'pattern mismatch': (difference) => /^item \d is 4$/.test(difference),
  'later text': (difference) => difference.includes(`item 2 is 3`),
  'later pattern': (difference) => difference.startsWith(`item 2 `),
  'empty text': () => true,
  'empty pattern': () => true,
}
// The difference a wrong answer reports for a clean candidate.
const mutatedDifference = (
  kind: (typeof calibrationKinds)[number],
  history: SyntheticHistory,
) => `item ${kind === `driver-last` ? history.length - 1 : 0} is 3`
const emptyDifference = (difference: CalibrationDifference | undefined) =>
  difference === `empty text` || difference === `empty pattern`

const driverCalibration = (
  kind: SyntheticSpec[`calibrations`][number][`kind`],
) =>
  [
    `driver`,
    `driver-last`,
    `driver-spin`,
    `driver-spin-throws`,
    `throws`,
    `clock`,
    `judge-driver-throws`,
  ].includes(kind)
// Binding is authored input, not an observation of the framework's selection.
// Explicit unbound entries remain distinct from inheritance of the default.
const bindingOf = (
  spec: SyntheticSpec,
  calibration: SyntheticSpec[`calibrations`][number],
) =>
  calibration.history === undefined
    ? spec.calibrationHistory
    : (calibration.history ?? undefined)
const bindingsOf = (spec: SyntheticSpec) =>
  spec.calibrations
    .map((calibration) => bindingOf(spec, calibration))
    .filter((binding) => binding !== undefined)
const unboundCalibrationNames = (spec: SyntheticSpec) => [
  ...spec.calibrations
    .filter((calibration) => !bindingOf(spec, calibration))
    .map(({ name }) => name),
  ...(!spec.probeBinding || spec.probeBinding === `empty`
    ? forcedCalibrationNames(spec).map((name) =>
        name.slice(`calibration: `.length),
      )
    : []),
]
const registeredSpec = (spec: SyntheticSpec, context: ChildContext) =>
  context.kind === `binding-reordered`
    ? {
        ...spec,
        calibrations: [
          { name: `unrelated calibration`, kind: `right` as const },
          ...[...spec.calibrations].reverse(),
        ],
      }
    : spec
const propertyWarnings = (warnings: ReadonlyArray<string>, id: string) =>
  warnings.filter((warning) => warning.startsWith(`${id}:`))
const unattributedWarnings = (
  warnings: ReadonlyArray<string>,
  ids: ReadonlyArray<string>,
) =>
  warnings.filter((warning) => !ids.some((id) => warning.startsWith(`${id}:`)))
// Decode the actual rendered list, without consulting expected names. The
// finite name grammar includes inner quotes in forced-control state labels,
// but no name contains the list delimiter `", "`. Malformed lists stay raw.
const warningParts = (warning: string) => {
  const match =
    /^(.*?: calibrations )"(.*)"( have no history binding;.*)$/s.exec(warning)
  return match
    ? { prefix: match[1]!, names: match[2]!.split(`", "`), suffix: match[3]! }
    : undefined
}
const renderWarning = (
  parts: NonNullable<ReturnType<typeof warningParts>>,
  names: ReadonlyArray<string>,
) =>
  `${parts.prefix}${names.map((name) => `"${name}"`).join(`, `)}${parts.suffix}`
const semanticWarning = (warning: string) => {
  const parts = warningParts(warning)
  return parts ? renderWarning(parts, [...parts.names].sort()) : warning
}
const reversedWarning = (warning: string) => {
  const parts = warningParts(warning)
  return parts ? renderWarning(parts, [...parts.names].reverse()) : warning
}
const warningMismatch = (
  spec: SyntheticSpec,
  warnings: ReadonlyArray<string>,
  collectOnly: boolean,
) => {
  const unbound = collectOnly ? [] : unboundCalibrationNames(spec)
  const own = propertyWarnings(warnings, spec.id)
  if (own.length !== (unbound.length ? 1 : 0)) return true
  if (own.length === 0) return false
  const actual = warningParts(own[0]!)?.names
  return (
    actual === undefined ||
    JSON.stringify([...actual].sort()) !== JSON.stringify([...unbound].sort())
  )
}
const boundTest = (spec: SyntheticSpec, name: string) => {
  const calibration = spec.calibrations.find(
    (entry) => name === `calibration: ${entry.name}`,
  )
  return calibration
    ? bindingOf(spec, calibration) !== undefined
    : Boolean(
        spec.probeBinding &&
        spec.probeBinding !== `empty` &&
        forcedCalibrationNames(spec).includes(name),
      )
}
type BuildEntry = {
  id: string
  test: string
  name: string
  generated: SyntheticHistory
  history: SyntheticHistory
}
// Named enumeration selectors refer to the label the author supplied, not
// merely the underlying items. The selector string domain below includes
// authored items labels (plain/shell) and one plain-JSON default label.
// Other forms' encoded default labels are outside that string domain.
const authoredEnumerationLabel = (
  spec: SyntheticSpec,
  history: SyntheticHistory,
): string | undefined => {
  if (spec.labelStyle === `default`)
    return spec.form === undefined ? JSON.stringify(history) : undefined
  if (
    spec.duplicateHistoryNames &&
    bindingsOf(spec).some(
      (binding) =>
        `enumerated` in binding && typeof binding.enumerated === `string`,
    ) &&
    spec.source.kind === `enumerated`
  )
    return `items ${spec.source.histories[0]!.join(` | `)}`
  if (
    spec.labelStyle?.startsWith(`reserved-`) &&
    spec.source.kind === `enumerated` &&
    JSON.stringify(history) === JSON.stringify(spec.source.histories[0])
  )
    return spec.labelStyle.slice(`reserved-`.length)
  return `items ${history.join(` | `)}${spec.labelStyle === `shell` ? ` ${shellText}` : ``}`
}
const authoredInput = (
  spec: SyntheticSpec,
  test: string,
  binding: NonNullable<SyntheticSpec[`calibrationHistory`]>,
  builds: ReadonlyArray<BuildEntry>,
): SyntheticHistory | undefined => {
  if (`fixed` in binding)
    return spec.fixed.find(({ name }) => name === binding.fixed)?.history
  if (`enumerated` in binding && spec.source.kind === `enumerated`)
    return spec.source.histories.find((history, index) =>
      typeof binding.enumerated === `number`
        ? index === binding.enumerated
        : authoredEnumerationLabel(spec, history) === binding.enumerated,
    )
  if (`constructed` in binding) {
    const construction = spec.constructed.find(
      ({ name }) => name === binding.constructed,
    )
    const input = builds.find(
      (entry) =>
        entry.id === spec.id &&
        entry.test === `${spec.id} > ${test}` &&
        entry.name === binding.constructed,
    )
    if (construction && input)
      return [
        ...construction.prefix,
        ...input.generated.map((item) =>
          spec.isolatedPlans ? item % 3 : item,
        ),
      ].slice(0, 3)
  }
  return undefined
}
// Resolve from authored declarations, never from the driver-selected input.
// A unique state declaration is insufficient if another construction shares
// its name: every selected name must identify exactly one original.
const selectedControlBinding = (spec: SyntheticSpec, forced: boolean) =>
  forced
    ? (spec.probeNotEntered ?? { fixed: `fixed-0` })
    : spec.probeBinding === `explicit`
      ? (spec.probeEntered ?? { constructed: `constructed-0` })
      : {
          constructed:
            spec.constructed.find(({ enters }) => enters.includes(`saw-0`))
              ?.name ?? `missing`,
        }
const selectedControls = (spec: SyntheticSpec, forced: boolean) => {
  const binding = selectedControlBinding(spec, forced)
  return `fixed` in binding
    ? spec.fixed.filter(({ name }) => name === binding.fixed)
    : spec.constructed.filter(({ name }) => name === binding.constructed)
}
const authoredOrigin = (
  spec: SyntheticSpec,
  binding: NonNullable<SyntheticSpec[`calibrationHistory`]>,
): string | undefined => {
  if (`fixed` in binding) return `fixed:${binding.fixed}`
  if (`constructed` in binding) return `constructed:${binding.constructed}`
  if (spec.source.kind !== `enumerated`) return undefined
  const index = spec.source.histories.findIndex((history, at) =>
    typeof binding.enumerated === `number`
      ? at === binding.enumerated
      : authoredEnumerationLabel(spec, history) === binding.enumerated,
  )
  return index < 0 ? undefined : `enumerated:${index}`
}

const isCampaign = (name: string) => unitOf(name) !== undefined

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
// The reach test run alone runs every history itself, in order: a judged
// one that enters an undeclared state fails it first.
const reachAloneOutcome = (spec: SyntheticSpec, full: Outcome): Outcome =>
  spec.source.kind === `enumerated` &&
  // A driver that observes a value outside the data domain judges nothing.
  dataOutcome(spec) === undefined &&
  spec.source.histories.some(
    (history) =>
      judgedKind(verdictOf(history, spec)) &&
      reachedOf(spec, history).some(
        (state) => !declaredOf(spec)!.includes(state),
      ),
  )
    ? { kind: `undeclared-state` }
    : full
const judgedKind = (outcome: Outcome) =>
  outcome.kind === `pass` || outcome.kind === `violation`
const enumeratedReach = (
  spec: SyntheticSpec,
  histories: ReadonlyArray<SyntheticHistory>,
  judgedHistory: (history: SyntheticHistory) => boolean,
): { outcome: Outcome; counts: Record<string, number> } => {
  const counts = Object.fromEntries(
    [...declaredOf(spec)!].map((state) => [
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
      /** A calibration requires a difference that the empty difference holds. */
      emptyDifference?: boolean
      /** An enumerated declaration with a foreign key or a probe-bound state. */
      shapeError?: boolean
      /** A label that names a framework test. */
      reservedLabel?: boolean
      dataError?: boolean
      /** A generated declaration would register two tests under one name. */
      nameError?: boolean
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
      /** The input of each generated determinism unit, repeated twice. */
      determinism: Map<string, SyntheticHistory>
      /** Unit streams derived independently from authored histories and a seed. */
      streams: Map<string, Array<SyntheticHistory>>
      /** The first failing fixed-seed unit whose exact rerun is owed. */
      unitRerun?: string
      /** For each passing campaign, the histories entering each state. */
      reach: Map<string, Record<string, number>>
      /** Campaigns owed a replay probe, and the test owed a rerun probe. */
      replays: Array<string>
      rerun?: string
    }

function predictSpec(
  spec: SyntheticSpec,
  logged: ReadonlyArray<LogEntry>,
  builds: ReadonlyArray<BuildEntry> = [],
  // The full ordinary run supplies only history/name association. Filtered
  // children's own logs still determine every invocation and outcome.
  nameLog: ReadonlyArray<LogEntry> = logged,
  randomSeed = childSeed,
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
  // An enumerated declaration takes only its own keys, and states by name.
  if (spec.enumeratedStates?.enumeratedShape)
    return {
      loads: false,
      loadError:
        spec.enumeratedStates.enumeratedShape === `extra key`
          ? `${spec.id}: an enumerated source takes \`enumerated\`, \`states\`, and \`measured\`; \`constructed\``
          : `${spec.id}: an enumerated source declares its states by name`,
      shapeError: true,
    }
  const historyFailure =
    spec.source.kind === `enumerated` && spec.form
      ? historyFailures[spec.form]
      : undefined
  if (historyFailure)
    return { loads: false, loadError: historyFailure, dataError: true }
  // A label may not name a framework test: its rerun would select both.
  if (
    spec.labelStyle === `reserved-reach` ||
    spec.labelStyle === `reserved-determinism`
  )
    return {
      loads: false,
      loadError: `${spec.id}: label "${spec.labelStyle.slice(`reserved-`.length)}" names a framework test`,
      reservedLabel: true,
    }
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
    // Every unit and determinism test is named by its history, so two
    // histories of one name, or a constructed history named like the
    // generated unit, would give two tests one name.
    const twice = (names: Array<string>) =>
      names.find((name, at) => names.indexOf(name) !== at)
    const constructedNames = spec.constructed.map(({ name }) => name)
    const nameError = constructedNames.includes(`generated`)
      ? `${spec.id}: constructed history "generated" has the name of a campaign's generated unit`
      : twice(constructedNames) !== undefined
        ? `${spec.id}: two constructed histories are named "${twice(constructedNames)}"`
        : twice(spec.fixed.map(({ name }) => name)) !== undefined
          ? `${spec.id}: two fixed histories are named "${twice(spec.fixed.map(({ name }) => name))}"`
          : undefined
    if (nameError)
      return { loads: false, loadError: nameError, nameError: true }
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
  // Calibration declaration checks precede requirement checks; resolving a
  // selected history comes last. This diagnostic order is analyst-chosen,
  // like the earlier shape checks, rather than a new product guarantee.
  if (
    spec.probeBinding &&
    spec.probeBinding !== `empty` &&
    (!spec.probe ||
      [`no-absence`, `null-binding`, `false-binding`, `zero-binding`].includes(
        spec.probeBinding,
      ) ||
      (spec.probeBinding === `inferred` &&
        spec.constructed.filter(({ enters }) => enters.includes(`saw-0`))
          .length !== 1))
  )
    return { loads: false, loadError: `calibration history selector` }
  const empty = spec.calibrations.find(({ difference }) =>
    emptyDifference(difference),
  )
  if (empty)
    return {
      loads: false,
      loadError: `${spec.id}: calibration "${empty.name}" requires difference`,
      emptyDifference: true,
    }
  // The synthetic namespace is deliberately small: names identify the fixed
  // or constructed index; enumerated names state their items. This model judges
  // selection independently of the framework's resolver.
  const selectedDeclaration = (
    binding: NonNullable<SyntheticSpec[`calibrationHistory`]>,
  ) =>
    `fixed` in binding
      ? spec.fixed.find(({ name }) => name === binding.fixed)
      : `constructed` in binding
        ? spec.constructed.find(({ name }) => name === binding.constructed)
        : spec.source.kind === `enumerated`
          ? spec.source.histories.find((history, index) =>
              typeof binding.enumerated === `number`
                ? index === binding.enumerated
                : authoredEnumerationLabel(spec, history) ===
                  binding.enumerated,
            )
          : undefined
  const duplicateSelection = (
    binding: NonNullable<SyntheticSpec[`calibrationHistory`]>,
  ) =>
    `fixed` in binding
      ? spec.fixed.filter(({ name }) => name === binding.fixed).length > 1
      : `constructed` in binding
        ? spec.constructed.filter(({ name }) => name === binding.constructed)
            .length > 1
        : typeof binding.enumerated === `string` &&
            spec.source.kind === `enumerated`
          ? spec.source.histories.filter(
              (history) =>
                authoredEnumerationLabel(spec, history) === binding.enumerated,
            ).length > 1
          : false
  if (
    bindingsOf(spec).some(
      (binding) =>
        !selectedDeclaration(binding) ||
        duplicateSelection(binding) ||
        (spec.source.kind === `enumerated`
          ? !(`enumerated` in binding)
          : `enumerated` in binding),
    )
  )
    return { loads: false, loadError: `calibration history selector` }
  if (
    spec.probeBinding &&
    spec.probeBinding !== `empty` &&
    (spec.probeBinding === `null-entered` ||
      selectedControls(spec, true).length !== 1 ||
      selectedControls(spec, false).length !== 1)
  )
    return { loads: false, loadError: `calibration history selector` }
  // Each campaign unit's histories in this run: a fixed seed's units at that
  // seed, and the random units at the child run's seed.
  const streams = new Map<string, Array<SyntheticHistory>>([
    ...fixedSeedsOf(spec).flatMap((seed) =>
      unitNames(spec).map(
        (name) =>
          [fixedUnit(seed, name), unitStream(spec, seed, name)] as const,
      ),
    ),
    ...(generated
      ? unitNames(spec).map(
          (name) =>
            [randomUnit(name), unitStream(spec, randomSeed, name)] as const,
        )
      : []),
  ])
  const determinismOf = determinismUnits(spec)
  const names =
    spec.source.kind === `enumerated`
      ? spec.source.histories.map((history) =>
          enumeratedName(spec, history, nameLog),
        )
      : [
          ...streams.keys(),
          ...spec.fixed.map(
            (fixedHistory) => `fixed history: ${fixedHistory.name}`,
          ),
        ]
  const all = [
    ...names,
    ...(declaredOf(spec) ? [`reach`] : []),
    ...spec.calibrations.map(({ name }) => `calibration: ${name}`),
    ...forcedCalibrationNames(spec),
    ...(generated ? determinismOf.keys() : [`determinism`]),
  ]
  const loaded = { determinism: determinismOf, streams }
  // A slow driver outlives the 100 ms limit in every test that runs a
  // history, and every test runs at least one.
  // A driver that observes a value outside the data domain fails every
  // history at once.
  const data = dataOutcome(spec)
  // Every history fails before a verdict, so an enumerated source's reach
  // test counts none.
  if (data && spec.source.kind === `enumerated` && declaredOf(spec)) {
    for (const name of all)
      tests.set(
        name,
        boundTest(spec, name) ? { kind: `calibration-clean` } : data,
      )
    const { outcome, counts } = enumeratedReach(
      spec,
      spec.source.histories,
      () => false,
    )
    tests.set(`reach`, outcome)
    return {
      loads: true,
      tests,
      ...loaded,
      reach: new Map(outcome.kind === `pass` ? [[`enumerated`, counts]] : []),
      replays: [],
    }
  }
  if (data) {
    for (const name of all)
      tests.set(
        name,
        boundTest(spec, name) ? { kind: `calibration-clean` } : data,
      )
    return {
      loads: true,
      tests,
      ...loaded,
      reach: new Map(),
      replays: names.filter(isCampaign),
      ...(names.find(
        (name) => isCampaign(name) && unitOf(name)?.seed !== undefined,
      )
        ? {
            unitRerun: names.find(
              (name) => isCampaign(name) && unitOf(name)?.seed !== undefined,
            ),
          }
        : {}),
    }
  }
  if (spec.slow) {
    for (const name of all) tests.set(name, { kind: `timeout` })
    // Every history's test started and timed out, so the reach test runs
    // none again, and a judgment that arrives late is not recorded.
    if (spec.source.kind === `enumerated` && declaredOf(spec))
      tests.set(
        `reach`,
        enumeratedReach(spec, spec.source.histories, () => false).outcome,
      )
    return { loads: true, tests, ...loaded, reach: new Map(), replays: [] }
  }
  // The source changes how the premise is chosen, never how a mutant verdict ranks.
  const calibrate = (
    calibration: SyntheticSpec[`calibrations`][number],
  ): Outcome => {
    const { name, kind, difference } = calibration
    const binding = bindingOf(spec, calibration)
    const selected = binding && selectedDeclaration(binding)
    const chosen = binding
      ? authoredInput(spec, `calibration: ${name}`, binding, builds)
      : undefined
    const clean = binding
      ? chosen
        ? [chosen]
        : []
      : calibrationCandidates(spec).filter(
          (history) =>
            judged({ ...spec, extraReach: false }, history).kind === `pass`,
        )
    if (binding) {
      if (!chosen || judged(spec, chosen).kind !== `pass` || spec.extraReach)
        return { kind: `calibration-clean` }
      const enters =
        selected && !Array.isArray(selected) && `enters` in selected
          ? (selected.enters ?? [])
          : []
      if (!reaches(spec, chosen, enters)) return { kind: `calibration-reach` }
    }
    if (!clean.length || kind === `inapplicable`)
      return { kind: binding ? `calibration-inapplicable` : `calibration-none` }
    if (
      [`corrupt-throws`, `judge-throws`, `judge-driver-throws`].includes(kind)
    )
      return { kind: `setup` }
    if (kind === `no-op`) return { kind: `calibration-passed` }
    if (kind === `wrong-law`) return { kind: `calibration-wrong-law` }
    if (difference === undefined) return { kind: `pass` }
    if (spec.numberDifference && kind !== `clock`)
      return { kind: `calibration-odd-difference` }
    const holds = (history: SyntheticHistory) =>
      differenceHolds[difference](
        kind === `clock`
          ? `clock passed its timer bound`
          : mutatedDifference(kind, history),
      )
    if (binding || !driverCalibration(kind))
      return holds(clean[0]!)
        ? { kind: `pass` }
        : { kind: `calibration-wrong-difference` }
    return clean.some(holds) ? { kind: `pass` } : { kind: `calibration-none` }
  }
  // A generated property's determinism test also runs three generated
  // histories (maintainer decision, 2026-11-03), so a nondeterministic driver
  // fails it even without fixed or constructed histories.
  const determinism = (
    histories = ran(`determinism`).filter((_, at) => at % 2 === 0),
  ): Outcome => {
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
  // 2026-11-03). Each campaign unit decides its own first failure.
  const campaign = (test: string): Outcome => {
    const construction = spec.constructed.find(
      ({ name }) => name === unitOf(test)!.name,
    )
    for (const history of streams.get(test)!) {
      const {
        cause: _shrinkableCause,
        causeMessage: _shrinkableCauseMessage,
        checkpoint: _shrinkableCheckpoint,
        ...verdict
      } = judged(spec, history)
      // Without a budget, a constructed history's failure shrinks to the
      // end. No smaller history is a constructed one, so a missed state
      // keeps the constructed history itself.
      const shrunk = (example: SyntheticHistory | undefined) =>
        construction && unbudgeted(spec) && example
          ? { counterexample: example }
          : {}
      if (verdict.kind !== `pass`)
        return { ...verdict, ...shrunk(unboundedShrink(spec, history)) }
      if (construction && !reaches(spec, history, construction.enters))
        return {
          kind: `constructed-reach`,
          ...shrunk(shrinkModelled(spec) ? history : undefined),
        }
    }
    return { kind: `pass` }
  }
  if (spec.source.kind === `enumerated`) {
    const declared = declaredOf(spec)
    for (const history of spec.source.histories) {
      const verdict = verdictOf(history, spec)
      tests.set(
        enumeratedName(spec, history, nameLog),
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
    for (const unit of streams.keys()) tests.set(unit, campaign(unit))
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
  for (const calibration of spec.calibrations)
    tests.set(`calibration: ${calibration.name}`, calibrate(calibration))
  // A forced-probe calibration needs a candidate whose clean trace passes and
  // whose prediction differs from the forced probe; the check must then report
  // reach agreement.
  for (const [at, name] of forcedCalibrationNames(spec).entries()) {
    const forced = at === 0
    if (spec.probeBinding && spec.probeBinding !== `empty`) {
      const clean = authoredInput(
        spec,
        name,
        selectedControlBinding(spec, forced),
        builds,
      )
      // The clean opposite-polarity premise also owes every state declared by
      // its selected fixed case or construction, not just the probe's state.
      const selectedControl = selectedControls(spec, forced)[0]
      tests.set(
        name,
        !clean || judged(spec, clean).kind !== `pass`
          ? { kind: `calibration-clean` }
          : !reaches(spec, clean, selectedControl?.enters ?? []) ||
              predictsZero(clean) === forced
            ? { kind: `calibration-reach` }
            : { kind: `pass` },
      )
      continue
    }
    tests.set(
      name,
      ran(name).some(
        (history) =>
          judged({ ...spec, extraReach: false }, history).kind === `pass` &&
          predictsZero(history) !== forced,
      )
        ? { kind: `pass` }
        : { kind: `calibration-none` },
    )
  }
  if (generated)
    for (const [name, history] of determinismOf)
      tests.set(name, determinism([history]))
  else tests.set(`determinism`, determinism())
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
  for (const [name, histories] of streams)
    if (tests.get(name)!.kind === `pass`)
      reach.set(
        name,
        Object.fromEntries(
          allStates.map((state) => [
            state === `saw-0` ? (spec.probeName ?? state) : state,
            histories.filter((history) =>
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
  const unitRerun = replays.find((name) => unitOf(name)?.seed !== undefined)
  return {
    loads: true,
    tests,
    ...loaded,
    reach,
    replays,
    ...(unitRerun ? { unitRerun } : {}),
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
  return Object.assign(
    new Map(
      plan.specs.map((spec) => [
        spec.id,
        predictSpec(spec, logged, run?.builds ?? []),
      ]),
    ),
    {
      hostScope:
        plan.hostRngDraw === undefined
          ? undefined
          : {
              draw: plan.hostRngDraw,
              outerHostUsed: true as const,
              outerForwarded: plan.hostRngForwarding !== undefined,
            },
    },
  )
}

// A late spec calls its probe again, unawaited, after every run of a history
// holding a 0, also when its driver threw, and each such call throws: one
// unhandled error per run the log records. A slow spec's driver runs on
// after its test timed out, so its calls may land after the run ended; they
// count at most once each.
const lateCalls = (
  plan: Plan,
  logged: ReadonlyArray<Pick<LogEntry, `id` | `history`>>,
) => {
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
  const unit = unitOf(name)
  if (unit?.seed !== undefined) return `fixed seed`
  if (unit) return replay ? `fixed history` : `fixed seed`
  if (name.startsWith(`fixed history:`)) return `fixed history`
  if (
    name.startsWith(`calibration:`) ||
    name.startsWith(`determinism`) ||
    name === `reach`
  )
    return `calibration`
  return `case`
}

// The self-oracle's own reach: states of the framework that its laws are
// about. Each fixed history names the state it witnesses, so every one is reached on
// every run; campaigns count them.
const warningReceivingKinds = [
  `run`,
  `seedless`,
  `replay`,
  `rerun`,
  `reach-alone`,
  `binding-reordered`,
  `registration-warnings`,
  `environment`,
] as const
const passingBudgetLanes = [
  { context: `run`, lane: `fixed` },
  { context: `run`, lane: `random` },
  { context: `seedless`, lane: `fixed` },
  { context: `seedless`, lane: `random` },
] as const
const passingUnitStates = passingBudgetLanes.flatMap(({ context, lane }) =>
  ([`constructed`, `generated`] as const).map(
    (unit) => `passing-unit-${context}-${lane}-${unit}` as const,
  ),
)
const round4FrameworkStates = [
  `host-rng-scope`,
  `host-rng-forwarding`,
  `receiving-host-scope`,
  ...passingUnitStates,
  `warning-order-equivalence`,
  ...warningReceivingKinds.map((kind) => `warning-receiving-${kind}` as const),
  ...passingBudgetLanes.map(
    ({ context, lane }) => `passing-budget-${context}-${lane}` as const,
  ),
  `passing-budget-constructed`,
  `campaign-budget-failure-neighbor`,
] as const
const round3FrameworkStates = [
  ...round4FrameworkStates,
  `bound-fixed-own-metadata-authored`,
  `bound-fixed-own-metadata-forced-entered`,
  `bound-fixed-own-metadata-forced-not-entered`,
  `bound-fixed-inherited-metadata-authored`,
  `bound-fixed-inherited-metadata-forced-entered`,
  `bound-fixed-inherited-metadata-forced-not-entered`,
  `bound-authored-distinct-selectors`,
  `bound-authored-search-neighbor`,
  `bound-mutant-violation-before-spin`,
  `legacy-mutant-violation-before-spin`,
  `bound-enumerated-label-rejected`,
  `enumerated-reach-key-order-neighbor`,
  `bound-registration-warning-silence`,
  `receiving-run`,
  `receiving-seedless`,
  `receiving-replay`,
  `receiving-rerun`,
  `receiving-reach-alone`,
  `receiving-binding-reordered`,
  `receiving-registration-warnings`,
  `receiving-environment`,
] as const
const frameworkStates = [
  ...round3FrameworkStates,
  `auxiliary-late-error`,
  `bound-enumerated-label-selector`,
  `bound-control-fixed-entered`,
  `bound-control-constructed-absent`,
  `bound-control-inferred-name-gate`,
  `bound-control-inferred-ambiguous`,
  `bound-control-inferred-zero`,
  `bound-control-explicit-name-gate`,
  `bound-equal-fixed-origin`,

  `bound-ranked-mutants`,
  `bound-independent-premise`,
  `bound-name-seed`,
  `bound-extra-state`,
  `bound-error-context`,
  `bound-null-selector`,
  `registration-warning-policy`,
  `bound-difference`,
  `registration-error`,
  `campaign-violation`,
  `campaign-setup-failure`,
  `slow-shrink-campaign-failure`,
  `unbudgeted-campaign-shrunk`,
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
  `calibration-difference-applied`,
  `calibration-difference-rejected`,
  `calibration-difference-later`,
  `calibration-empty-difference-error`,
  `calibration-odd-difference`,
  `calibration-skipped-candidate`,
  `bound-fixed-identity`,
  `bound-enumerated-identity`,
  `bound-combined-controls`,
  `unbound-prototype-probe`,
  `bound-control-full-reach`,
  `bound-calibration`,
  `bound-constructed-driver`,
  `bound-calibration-registration-error`,
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
  `enumerated-reach-alone`,
  `enumerated-reach-alone-undeclared`,
  `enumerated-unjudged-not-rerun`,
  `enumerated-timed-out-not-rerun`,
  `enumerated-shape-error`,
  `reserved-label-error`,
  `unit-split-verdict`,
  `unit-name-load-error`,
  `second-fixed-seed`,
  `unit-replay-constructed`,
  `unit-replay-generated`,
  `unit-replay-custom-prefix`,
  `unit-rerun`,
  `unit-rerun-beside-extension`,
  `seedless-units-drawn`,
  `replay-environment-error`,
  `unit-requires-property`,
  `retired-names-unit`,
  `replay-without-unit-error`,
  `replay-unit-missing-error`,
  `replay-unit-selected`,
] as const

function frameworkReach(
  plan: Plan,
  trace: ReadonlyArray<{ checkpoint: string; value: unknown }>,
  expected: ReturnType<typeof suiteModel>,
): Iterable<string> {
  const reached = new Set<string>()
  const host = trace.find(({ checkpoint }) => checkpoint === `host-scope`)
    ?.value as HostScopeRun | undefined
  const hostChildren = trace
    .filter(
      ({ checkpoint, value }) =>
        checkpoint === `child` &&
        (value as ChildRun).context.kind === `host-scope`,
    )
    .map(({ value }) => value as ChildRun)
  if (
    host &&
    host.outer !== null &&
    host.outer.draw === expected.hostScope?.draw &&
    host.outer.childMarker === false &&
    host.outer.hostUsed === true &&
    host.outer.forwarded === expected.hostScope.outerForwarded &&
    Number.isInteger(host.outer.seed) &&
    host.children.length === 2 &&
    host.children.every(
      (child) => child?.childMarker === true && Number.isInteger(child.seed),
    ) &&
    host.children[0]?.seed === host.children[1]?.seed &&
    hostChildren.length === 3 &&
    hostChildren.every(
      (child) =>
        child.tests.length === 1 &&
        child.tests[0]?.state === `passed` &&
        child.loads.every(({ errors }) => errors.length === 0),
    )
  ) {
    reached.add(`host-rng-scope`)
    if (host.outer.forwarded) reached.add(`host-rng-forwarding`)
  }
  if (
    trace.some(
      ({ checkpoint, value }) =>
        checkpoint === `warning-permutation` &&
        (value as { lists: number; stable: boolean }).lists > 0 &&
        (value as { stable: boolean }).stable,
    )
  )
    reached.add(`warning-order-equivalence`)
  // Count the real host receiving cut, not a plan flag or a derived summary.
  // Registration-only children owe a loaded test inventory; every other cut
  // additionally owes a test that actually ran in that child.
  for (const { checkpoint, value } of trace) {
    if (checkpoint !== `child`) continue
    const child = value as ChildRun
    if (
      child.loads.some(({ errors }) => errors.length === 0) &&
      child.tests.length > 0 &&
      (child.context.kind === `registration-warnings` ||
        child.tests.some(({ state }) => state !== `skipped`))
    )
      reached.add(`receiving-${child.context.kind}`)
    for (const original of plan.specs) {
      if (
        `id` in child.context &&
        child.context.id !== original.id &&
        child.context.kind !== `replay`
      )
        continue
      const spec = registeredSpec(original, child.context)
      if (!predictSpec(spec, child.log, child.builds).loads) continue
      if (
        unboundCalibrationNames(spec).length > 0 &&
        !(
          child.context.kind === `registration-warnings` &&
          child.context.phases.length === 0
        ) &&
        !warningMismatch(spec, child.warnings, false)
      )
        reached.add(`warning-receiving-${child.context.kind}`)
      if (spec.source.kind !== `generated`) continue
      const units = child.tests.filter(
        ({ id, name }) => id === spec.id && isCampaign(name),
      )
      for (const test of units) {
        const calls = child.log.filter(
          ({ id, test: name }) =>
            id === spec.id && name === `${spec.id} > ${test.name}`,
        )
        if (test.state === `failed` && calls.length > 0)
          reached.add(`campaign-budget-failure-neighbor`)
      }
      if (child.context.kind !== `run` && child.context.kind !== `seedless`)
        continue
      for (const seed of [...fixedSeedsOf(spec), undefined]) {
        const lane = seed === undefined ? `random` : `fixed`
        const names = unitNames(spec).map((unit) =>
          seed === undefined ? randomUnit(unit) : `fixed seed ${seed}: ${unit}`,
        )
        let total = 0
        const complete = names.every((name) => {
          const test = units.find((candidate) => candidate.name === name)
          const calls = child.log.filter(
            ({ id, test: actual }) =>
              id === spec.id && actual === `${spec.id} > ${name}`,
          )
          const generated = unitOf(name)?.name === `generated`
          const count = generated
            ? spec.source.kind === `generated`
              ? spec.source.runs
              : 0
            : 1
          if (test?.state !== `passed` || calls.length !== count) return false
          total += calls.length
          reached.add(
            `passing-unit-${child.context.kind}-${lane}-${generated ? `generated` : `constructed`}`,
          )
          return true
        })
        if (complete && total === spec.source.runs + spec.constructed.length) {
          reached.add(`passing-budget-${child.context.kind}-${lane}`)
          if (spec.constructed.length > 0)
            reached.add(`passing-budget-constructed`)
        }
      }
    }
  }
  if (
    trace
      .filter(({ checkpoint }) => checkpoint === `child`)
      .slice(1)
      .some(({ value }) => {
        const child = value as {
          log: Array<Pick<LogEntry, `id` | `history`>>
          unhandled: Array<string>
        }
        return (
          child.log.some(
            ({ id, history }) =>
              history.includes(0) &&
              plan.specs.some(
                (spec) => spec.id === id && spec.probe === `late`,
              ),
          ) &&
          child.unhandled.some((message) =>
            message.includes(`was called after its history ended`),
          )
        )
      })
  )
    reached.add(`auxiliary-late-error`)
  const run = trace.find(({ checkpoint }) => checkpoint === `run`)?.value as
    SuiteRun | undefined
  for (const spec of plan.specs) {
    const owed = expected.get(spec.id)!
    const reachOnly = trace.find(
      ({ checkpoint, value }) =>
        checkpoint === `reach-alone` && (value as ReachAlone).id === spec.id,
    )?.value as ReachAlone | undefined
    if (
      spec.enumeratedStates &&
      declaredOf(spec)!.join(`,`) !== [...declaredOf(spec)!].sort().join(`,`) &&
      reachOnly?.state === `passed`
    )
      reached.add(`enumerated-reach-key-order-neighbor`)
    const file = run?.files[spec.id]
    const ranCalibration = (name: string) =>
      file?.loaded &&
      file.tests.some(
        (test) => test.name === name && test.state !== `skipped`,
      ) &&
      run?.log.some(
        (entry) =>
          entry.id === spec.id && entry.test === `${spec.id} > ${name}`,
      )
    if (
      file &&
      spec.source.kind === `enumerated` &&
      bindingsOf(spec).some(
        (binding) =>
          `enumerated` in binding && typeof binding.enumerated === `string`,
      ) &&
      [`shell`, `default`].includes(spec.labelStyle ?? ``)
    ) {
      if (
        owed.loads &&
        spec.calibrations.some(({ name }) =>
          ranCalibration(`calibration: ${name}`),
        )
      )
        reached.add(`bound-enumerated-label-selector`)
      else if (!owed.loads && file.loaded === false)
        reached.add(`bound-enumerated-label-rejected`)
    }
    if (!owed.loads) {
      if (
        file?.loaded === false &&
        owed.nameError &&
        (spec.probeBinding === `explicit` || spec.probeBinding === `inferred`)
      )
        reached.add(`bound-control-${spec.probeBinding}-name-gate`)
      if (
        file?.loaded === false &&
        !owed.nameError &&
        owed.loadError === `calibration history selector` &&
        spec.probeBinding === `inferred`
      ) {
        if (
          spec.constructed.filter(({ enters }) => enters.includes(`saw-0`))
            .length > 1
        )
          reached.add(`bound-control-inferred-ambiguous`)
        if (
          spec.constructed.filter(({ enters }) => enters.includes(`saw-0`))
            .length === 0
        )
          reached.add(`bound-control-inferred-zero`)
      }
      if (
        [
          `null-entered`,
          `null-binding`,
          `false-binding`,
          `zero-binding`,
        ].includes(spec.probeBinding ?? ``)
      )
        reached.add(`bound-null-selector`)
      reached.add(`registration-error`)
      if (bindingsOf(spec).length)
        reached.add(`bound-calibration-registration-error`)
      if (owed.shapeError) reached.add(`enumerated-shape-error`)
      if (owed.reservedLabel) reached.add(`reserved-label-error`)
      if (owed.dataError) reached.add(`history-out-of-domain`)
      if (owed.buildError) reached.add(`constructed-build-load-error`)
      if (owed.emptyDifference)
        reached.add(`calibration-empty-difference-error`)
      if (
        owed.nameError &&
        owed.loadError &&
        file?.loaded === false &&
        file.loadErrors.some((message) => message.includes(owed.loadError!))
      )
        reached.add(`unit-name-load-error`)
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
    for (const declaration of spec.fixed) {
      if (!declaration.buildMetadata) continue
      const prefix = `bound-fixed-${declaration.buildMetadata}-metadata`
      if (
        spec.calibrations.some((calibration) => {
          const binding = bindingOf(spec, calibration)
          return (
            binding &&
            `fixed` in binding &&
            binding.fixed === declaration.name &&
            ranCalibration(`calibration: ${calibration.name}`)
          )
        })
      )
        reached.add(`${prefix}-authored`)
      if (spec.probeBinding === `explicit`)
        for (const [at, name] of forcedCalibrationNames(spec).entries()) {
          const binding = selectedControlBinding(spec, at === 0)
          if (
            `fixed` in binding &&
            binding.fixed === declaration.name &&
            ranCalibration(name)
          )
            reached.add(
              `${prefix}-${at === 0 ? `forced-entered` : `forced-not-entered`}`,
            )
        }
    }
    const authored = spec.calibrations.filter(({ name }) =>
      ranCalibration(`calibration: ${name}`),
    )
    if (
      new Set(
        authored
          .map((calibration) => bindingOf(spec, calibration))
          .filter(Boolean)
          .map((binding) => JSON.stringify(binding)),
      ).size > 1
    )
      reached.add(`bound-authored-distinct-selectors`)
    if (
      authored.some((calibration) => bindingOf(spec, calibration)) &&
      authored.some((calibration) => !bindingOf(spec, calibration))
    )
      reached.add(`bound-authored-search-neighbor`)
    for (const calibration of authored)
      if ([`driver-spin`, `driver-spin-throws`].includes(calibration.kind))
        reached.add(
          bindingOf(spec, calibration)
            ? `bound-mutant-violation-before-spin`
            : `legacy-mutant-violation-before-spin`,
        )
    if (
      run?.files[spec.id]?.loaded &&
      spec.probeBinding === `explicit` &&
      `fixed` in selectedControlBinding(spec, false)
    )
      reached.add(`bound-control-fixed-entered`)
    if (
      run?.files[spec.id]?.loaded &&
      spec.probeBinding &&
      spec.probeBinding !== `empty` &&
      `constructed` in selectedControlBinding(spec, true)
    )
      reached.add(`bound-control-constructed-absent`)
    if (
      run?.files[spec.id]?.loaded &&
      spec.identityHistories &&
      bindingsOf(spec).some(
        (binding) =>
          `fixed` in binding &&
          spec.fixed.filter(
            ({ history }) =>
              JSON.stringify(history) ===
              JSON.stringify(authoredInput(spec, ``, binding, [])),
          ).length > 1,
      )
    )
      reached.add(`bound-equal-fixed-origin`)
    if (
      bindingsOf(spec).length > 0 &&
      spec.calibrations.some(
        ({ kind }) => kind === `throws` || kind === `clock`,
      )
    )
      reached.add(`bound-ranked-mutants`)
    if (
      spec.probeBinding === `explicit` &&
      spec.constructed.length > 1 &&
      spec.fixed.length > 1
    )
      reached.add(`bound-independent-premise`)
    if (spec.calibrationNames !== `indexed` && spec.calibrations.length > 1)
      reached.add(`bound-name-seed`)
    if (bindingsOf(spec).length && spec.extraReach)
      reached.add(`bound-extra-state`)
    if (
      bindingsOf(spec).length > 0 &&
      spec.calibrations.some(({ kind }) =>
        [`corrupt-throws`, `judge-throws`, `judge-driver-throws`].includes(
          kind,
        ),
      )
    )
      reached.add(`bound-error-context`)
    if (spec.warningProbe) {
      reached.add(`registration-warning-policy`)
      if (
        unboundCalibrationNames(spec).length === 0 &&
        trace.some(
          ({ checkpoint, value }) =>
            checkpoint === `registration-warnings` &&
            (value as { id: string; loaded: Record<string, boolean> }).id ===
              spec.id &&
            Object.values(
              (value as { loaded: Record<string, boolean> }).loaded,
            ).every(Boolean),
        )
      )
        reached.add(`bound-registration-warning-silence`)
    }
    if (
      bindingsOf(spec).length > 0 &&
      spec.calibrations.some(({ difference }) => difference !== undefined)
    )
      reached.add(`bound-difference`)
    if (spec.identityHistories) {
      if (bindingsOf(spec).some((binding) => `fixed` in binding))
        reached.add(`bound-fixed-identity`)
      if (bindingsOf(spec).some((binding) => `enumerated` in binding))
        reached.add(`bound-enumerated-identity`)
    }
    if (
      bindingsOf(spec).length > 0 &&
      spec.probeBinding &&
      spec.probeBinding !== `empty`
    )
      reached.add(`bound-combined-controls`)
    if (
      spec.probe &&
      spec.probeBinding === `empty` &&
      spec.probeName !== `saw-0`
    )
      reached.add(`unbound-prototype-probe`)
    if (
      spec.probeBinding &&
      spec.probeBinding !== `empty` &&
      [...owed.tests.values()].some(({ kind }) => kind === `calibration-reach`)
    )
      reached.add(`bound-control-full-reach`)
    const ranUnit = (name: string) =>
      file?.loaded === true &&
      file.tests.some(
        (test) =>
          test.name === name &&
          (test.state === `passed` || test.state === `failed`),
      ) &&
      run!.log.some(
        ({ id, test }) => id === spec.id && test === `${spec.id} > ${name}`,
      )
    const secondSeed = fixedSeedsOf(spec)[1]
    if (
      spec.secondSeed &&
      secondSeed !== undefined &&
      unitNames(spec).every((unit) => ranUnit(fixedUnit(secondSeed, unit)))
    )
      reached.add(`second-fixed-seed`)
    // The real test results and calls must exhibit the model's two laws.
    for (const seed of fixedSeedsOf(spec)) {
      const generatedName = fixedUnit(seed, `generated`)
      const generated = file?.tests.find(({ name }) => name === generatedName)
      const generatedLaw = owed.tests.get(generatedName)?.law
      if (
        generatedLaw === undefined ||
        generated?.state !== `failed` ||
        generated.failure?.law !== generatedLaw ||
        !ranUnit(generatedName)
      )
        continue
      if (
        spec.constructed.some(({ name }) => {
          const unit = fixedUnit(seed, name)
          const law = owed.tests.get(unit)?.law
          const observed = file?.tests.find((test) => test.name === unit)
          return (
            law !== undefined &&
            law !== generatedLaw &&
            observed?.state === `failed` &&
            observed.failure?.law === law &&
            ranUnit(unit)
          )
        })
      )
        reached.add(`unit-split-verdict`)
    }
    const named = spec.fixed.length + spec.constructed.length > 0
    if (
      bindingsOf(spec).length > 0 ||
      (spec.probeBinding && spec.probeBinding !== `empty`)
    )
      reached.add(`bound-calibration`)
    if (
      spec.isolatedPlans &&
      spec.calibrations.some((calibration) => {
        const binding = bindingOf(spec, calibration)
        return (
          binding && `constructed` in binding && calibration.kind === `driver`
        )
      })
    )
      reached.add(`bound-constructed-driver`)
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
      if (spec.slowShrink && isCampaign(name) && outcome.kind !== `pass`)
        reached.add(`slow-shrink-campaign-failure`)
      if (outcome.counterexample) reached.add(`unbudgeted-campaign-shrunk`)
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
      if (isCampaign(name) && unitOf(name)!.seed === undefined)
        reached.add(`random-campaign`)
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
        'calibration-wrong-difference': `calibration-difference-rejected`,
      }[outcome.kind as string]
      if (failure) reached.add(failure)
      if (name.startsWith(`calibration:`) && outcome.kind === `pass`)
        reached.add(`calibration-applied`)
      // A calibration that requires a difference: one that matches applies,
      // and a mutant driver's that does not finds no history.
      const calibration = spec.calibrations.find(
        (candidate) => name === `calibration: ${candidate.name}`,
      )
      if (calibration?.difference && outcome.kind === `pass`)
        reached.add(`calibration-difference-applied`)
      if (outcome.kind === `calibration-odd-difference`)
        reached.add(`calibration-odd-difference`)
      // A mutant driver passed over a clean candidate whose difference did not
      // hold, then passed at a later one.
      if (calibration?.difference && outcome.kind === `pass`) {
        const first = (run?.log ?? []).find(
          (entry) =>
            entry.test === `${spec.id} > ${name}` &&
            judged(spec, entry.history).kind === `pass`,
        )
        if (
          first &&
          calibration.kind !== `right` &&
          !differenceHolds[calibration.difference](
            mutatedDifference(calibration.kind, first.history),
          )
        )
          reached.add(`calibration-difference-later`)
      }
      if (
        calibration?.kind === `driver` &&
        calibration.difference?.endsWith(`mismatch`) &&
        outcome.kind === `calibration-none` &&
        (run?.log ?? []).some(
          (entry) =>
            entry.test === `${spec.id} > ${name}` &&
            judged(spec, entry.history).kind === `pass`,
        )
      )
        reached.add(`calibration-difference-rejected`)
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
    // The reach test did not run again a history whose own test started
    // but reached no verdict.
    if (
      spec.source.kind === `enumerated` &&
      declaredOf(spec) &&
      owed.tests.get(`reach`)?.kind !== `timeout`
    ) {
      if (spec.slow) reached.add(`enumerated-timed-out-not-rerun`)
      else if (
        spec.source.histories.some(
          (history) => !judgedKind(verdictOf(history, spec)),
        )
      )
        reached.add(`enumerated-unjudged-not-rerun`)
    }
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
          test.startsWith(`${spec.id} > determinism`) &&
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
    if (checkpoint !== `replay` && checkpoint !== `rerun`) continue
    const unit = unitOf(probe.target)
    if (
      !unit ||
      !spec ||
      !probe.failure ||
      probe.failure.kind !== probe.original.kind ||
      probe.failure.law !== probe.original.law
    )
      continue
    const received = trace.find(({ checkpoint: cut, value: raw }) => {
      if (cut !== `child`) return false
      const child = raw as ChildRun
      const context = child.context
      return (
        (context.kind === `replay` || context.kind === `rerun`) &&
        context.kind === checkpoint &&
        context.id === probe.id &&
        context.target === probe.target &&
        context.probed === probe.probed
      )
    })?.value as ChildRun | undefined
    const executed =
      received?.tests.filter(
        ({ state }) => state === `passed` || state === `failed`,
      ) ?? []
    const isolated =
      executed.length === 1 &&
      executed[0]!.id === probe.id &&
      executed[0]!.name === probe.probed &&
      executed[0]!.state === `failed` &&
      received!.log.some(
        ({ id, test }) =>
          id === probe.id && test === `${probe.id} > ${probe.probed}`,
      )
    if (!isolated) continue
    if (
      checkpoint === `replay` &&
      probe.probed === randomUnit(unit.name) &&
      (probe.ran?.length ?? 0) > 0 &&
      probe.routes?.every((route) => route === `fixed history`)
    ) {
      reached.add(
        unit.name === `generated`
          ? `unit-replay-generated`
          : `unit-replay-constructed`,
      )
      if (
        plan.prefix !== `ORACLE` &&
        probe.variables?.[`${plan.prefix}_UNIT`] === probe.probed &&
        probe.variables[`${plan.prefix}_PROPERTY`] === spec.id &&
        probe.variables[`${plan.prefix}_SEED`] !== undefined &&
        probe.variables[`${plan.prefix}_PATH`] !== undefined
      )
        reached.add(`unit-replay-custom-prefix`)
    }
    if (checkpoint === `rerun` && probe.probed === probe.target) {
      reached.add(`unit-rerun`)
      // The extended sibling was actually registered and stayed skipped.
      if (
        probe.states.some(
          ([id, name, state]) =>
            id === spec.id &&
            name !== probe.target &&
            name.startsWith(probe.target) &&
            state === `skipped`,
        )
      )
        reached.add(`unit-rerun-beside-extension`)
    }
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
  if (trace.some(({ checkpoint }) => checkpoint === `reach-alone`))
    reached.add(`enumerated-reach-alone`)
  for (const { checkpoint, value } of trace)
    if (
      checkpoint === `reach-alone` &&
      (value as ReachAlone).failure?.kind === `undeclared-state`
    )
      reached.add(`enumerated-reach-alone-undeclared`)
  if (trace.some(({ checkpoint }) => checkpoint === `replay`))
    reached.add(`replay-probe`)
  const seedless = trace.find(({ checkpoint }) => checkpoint === `seedless`)
    ?.value as SeedlessRun | undefined
  if (seedless && Object.values(seedless).some(({ routes }) => routes.length))
    reached.add(`seedless-route`)
  if (
    seedless &&
    plan.specs.some((spec) => {
      const seen = seedless[spec.id]
      if (
        !expected.get(spec.id)!.loads ||
        spec.source.kind !== `generated` ||
        spec.slow ||
        seen?.seeds.length !== 1 ||
        JSON.stringify(seen.routes) !== JSON.stringify([`random seed`])
      )
        return false
      return unitNames(spec)
        .map(randomUnit)
        .every((unit) => {
          const { ran, owedRun } = comparedRun(
            spec,
            unit,
            unitStream(spec, seen.seeds[0]!, unitOf(unit)!.name),
            seen.ran[unit] ?? [],
          )
          return (
            ran.length > 0 && JSON.stringify(ran) === JSON.stringify(owedRun)
          )
        })
    })
  )
    reached.add(`seedless-units-drawn`)
  // Law `replay-config`: the environment's first error, or the selection a
  // path replay of the first spec makes.
  const under = trace.find(({ checkpoint }) => checkpoint === `environment`)
    ?.value as EnvironmentRun | undefined
  if (plan.environment && under) {
    const error = environmentError(plan)
    if (error) reached.add(`replay-environment-error`)
    if (error?.includes(`_UNIT requires`)) reached.add(`unit-requires-property`)
    if (error?.startsWith(`Retired`)) reached.add(`retired-names-unit`)
    const [first] = plan.specs
    const errors = under.files[first!.id]?.loadErrors ?? []
    if (
      !error &&
      errors.some((message) =>
        message.includes(`of a generated source requires`),
      )
    )
      reached.add(`replay-without-unit-error`)
    if (!error && errors.some((message) => message.includes(`_UNIT names "`)))
      reached.add(`replay-unit-missing-error`)
    if (
      !error &&
      plan.environment.path === `valid` &&
      (under.files[first!.id]?.tests ?? []).some(
        (test) => test.state !== `skipped` && isCampaign(test.name),
      )
    )
      reached.add(`replay-unit-selected`)
  }
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
//   Vitest runs that file with the command's `-t` pattern;
// - reach alone: for each loaded enumerated source that declares states,
//   Vitest runs that file with a `-t` pattern that selects only its reach
//   test.
// Child runs fix the random campaign's seed (a seed without a path reseeds the
// campaign and selects no replay). The ordinary-route child instead controls
// Math.random's draw while leaving ORACLE_SEED absent. This fixes the host
// input without changing the route, so every recorded fact can repeat.

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
  warnings: Array<string>
  warningPermutation?: { lists: number; stable: boolean }
  unhandled: Array<ReportedError>
  exit: number | null
  signal: string | null
}
type Failure = {
  message?: string
  causeMessage?: string
  kind: Kind | `other`
  dataPath?: string
  dataKind?: string
  law?: string
  checkpoint?: string
  diagnosis?: `never-reached` | `false-condition`
  cause?: `driver`
  counterexample?: string
  /** The concrete reported candidate, when its finite data form shows its items. */
  counterexampleHistory?: SyntheticHistory
  seed?: number
  path?: string
  rerun?: string
  /** A violation's whole rerun line, as printed. */
  violationRerun?: string
  /** A campaign unit's replay command, as printed. */
  replay?: string
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
  resolutions: Array<Pick<LogEntry, `id` | `test`>>
  builds: Array<BuildEntry>
  stdout: string
  warnings: Array<string>
  /** The run's unhandled errors, by message. */
  unhandled: Array<string>
}
// Every real child has a named receiving cut. The context is supplied by the
// driver, independently of the test states Vitest reports, so absent tests or
// an unexpected first error cannot authorize their own outcome.
type ChildContext =
  | { kind: `run` | `seedless` | `environment` }
  | { kind: `binding-reordered`; id: string }
  | { kind: `registration-warnings`; id: string; phases: Array<string> }
  | { kind: `replay`; id: string; target: string; probed: string }
  | { kind: `rerun`; id: string; target: string; probed: string }
  | { kind: `reach-alone`; id: string }
  | {
      kind: `host-scope`
      mode: `outer` | `child`
      ordinal: number
      draw: 0.25 | 0.75
    }
type ChildRun = {
  context: ChildContext
  exit: number | null
  signal: string | null
  files: Array<string>
  expectedFiles: Array<string>
  loads: Array<{ id: string; errors: Array<string>; causes: Array<string> }>
  tests: Array<{
    id: string
    name: string
    state: string
    errors: Array<Failure>
    seedLogs: Array<number>
  }>
  log: Array<LogEntry>
  builds: Array<BuildEntry>
  resolutions: SuiteRun[`resolutions`]
  /** Registration warnings retained for every process, including filtered runs. */
  warnings: Array<string>
  secondaryErrors: Array<{ test: string; message: string }>
  unhandled: Array<string>
  failed: boolean
}
type ProbeRun = {
  id: string
  /** The failing test whose command ran: a campaign unit for replay, a unit or a history for rerun. */
  target: string
  original: Failure
  /** For a replay: the printed command's variables, by name. */
  variables?: Record<string, string>
  /** The test the command must run: the random unit of the target's name for a replay. */
  probed: string
  /** Each test's state in the probe run, by property id and name. */
  states: Array<[string, string, string]>
  /** The probed test's failure in the probe run. */
  failure?: Failure
  /** Histories the replayed random unit ran, in order. */
  ran?: Array<SyntheticHistory>
  /** The routes those histories ran under. */
  routes?: Array<string | null>
}
/** A seedless child run, per property: its random units' routes, its logged seeds, and what each unit ran. */
type SeedlessRun = Record<
  string,
  {
    routes: Array<string | null>
    seeds: Array<number>
    ran: Record<string, Array<SyntheticHistory>>
  }
>
/** The run under a drawn replay environment. */
type EnvironmentRun = {
  files: Record<
    string,
    {
      loaded: boolean
      loadErrors: Array<string>
      tests: Array<{ name: string; state: string; failure?: Failure }>
    }
  >
  log: Array<LogEntry>
}

// The ordinary-host receiving witness reads its selected seed after importing
// the fixture. Marked children separately show that controlled inputs repeat.
type HostSeed = {
  seed: number
  childMarker: boolean
  draw: number
  /** The supplied host counter advanced during actual seed selection. */
  hostUsed: boolean
  /** The actual configured forwarding wrapper ran during seed selection. */
  forwarded: boolean
}
type HostScopeRun = {
  draw: 0.25 | 0.75
  outer: HostSeed | null
  children: Array<HostSeed | null>
}

/** A reach test run alone, under a `-t` pattern that selects only it. */
type ReachAlone = {
  id: string
  state: string
  failure?: Failure
  /** The counts it printed, when it passed. */
  reach?: unknown
  /** The property's other tests that did not stand aside. */
  others: Array<[string, string, string]>
}

const here = dirname(fileURLToPath(import.meta.url))
const packageDirectory = dirname(here)
const vitest = join(
  dirname(createRequire(import.meta.url).resolve(`vitest/package.json`)),
  `vitest.mjs`,
)
let runCount = 0
let warningPresentationCount = 0
let hostForwardingCount = 0

function classifyKind(
  inner: ReportedError,
  text: string,
  outer: string,
): Kind | `other` {
  if (text.includes(`selected clean run failed`)) return `calibration-clean`
  if (text.includes(`selected history did not enter`))
    return `calibration-reach`
  if (text.includes(`selected corruption did not apply`))
    return `calibration-inapplicable`
  // A wrapped runtime exception is still setup failure. Context and cause are
  // checked separately, so binding does not change the semantic verdict kind.
  if (text.includes(`selected mutant run failed`)) return `setup`
  if (inner.name === `OracleDataError`) return `data`
  if (text.includes(`the framework's encoding limit`)) return `limit`
  if (inner.name === `OracleModelError`) return `model-not-total`
  if (inner.name === `OracleViolation`) return `violation`
  if (/timed out in \d+ms/.test(text) || /timed out in \d+ms/.test(outer))
    return `timeout`
  if (text.includes(`did not enter`) && text.includes(`: fixed history "`))
    return `fixed-reach`
  if (
    text.includes(`did not enter`) &&
    text.includes(`: constructed history "`)
  )
    return `constructed-reach`
  if (text.includes(`no enumerated history entered`)) return `enumerated-reach`
  if (text.includes(`which the property does not declare`))
    return `undeclared-state`
  if (text.includes(`two runs of`)) return `determinism`
  if (text.includes(`a difference that is not text`))
    return `calibration-odd-difference`
  if (text.includes(`but the check reported difference`))
    return `calibration-wrong-difference`
  if (text.includes(`but the check passed it`)) return `calibration-passed`
  if (text.includes(`but the check reported law`))
    return `calibration-wrong-law`
  if (text.includes(`found no history`)) return `calibration-none`
  if (
    text.includes(`synthetic driver failed`) ||
    text.includes(`cannot read a 7`) ||
    text.includes(`mutant setup failed`) ||
    text.includes(`synthetic corruption failed`) ||
    text.includes(`synthetic judgment failed`)
  )
    return `setup`
  return `other`
}

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
  // The violation's command, or the failing unit's command on its wrapper.
  const rerun =
    /^Rerun: (-t .*)$/m.exec(text)?.[1] ?? /^Rerun: (-t .*)$/m.exec(outer)?.[1]
  const violationRerun =
    inner.name === `OracleViolation`
      ? /^Rerun: (.*)$/m.exec(text)?.[1]
      : undefined
  const replay = outer.startsWith(`Property failed`)
    ? /^Replay: (.*)$/m.exec(outer)?.[1]
    : undefined
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
  const kind = classifyKind(inner, text, outer)
  return {
    kind,
    message: text,
    ...(inner.cause?.message ? { causeMessage: inner.cause.message } : {}),
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
    ...(violationRerun !== undefined ? { violationRerun } : {}),
    ...(replay !== undefined ? { replay } : {}),
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
  {
    env = {},
    shellHead,
    shellTail,
    seeded = true,
    prefix,
    warningPresentation,
  }: {
    env?: Record<string, string>
    // Shell text before the command (variable assignments) and after it (a
    // `-t` pattern), which then runs in /bin/sh, as a pasted command does.
    shellHead?: string
    shellTail?: string
    // Without a seed, the random units draw theirs, as in an ordinary run.
    seeded?: boolean
    // The environment prefix every spec of the suite configures.
    prefix: Prefix
    // The representation control alternates across repeated outer drives.
    warningPresentation?: boolean
  },
): Report {
  const report = join(directory, `report-${runCount++}.json`)
  // The child reads the suite's oracle variables, so none of the parent's
  // oracle variables, under either prefix, may leak into it.
  const childEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !key.startsWith(`ORACLE_`) &&
        !key.startsWith(`SYNTH_ORACLE_`) &&
        !key.startsWith(`SELF_ORACLE_`),
    ),
  )
  const argv = [
    vitest,
    `run`,
    `--coverage.enabled=false`,
    `--typecheck.enabled=false`,
    `--maxWorkers=2`,
    `--reporter=${join(here, `oracle-property-self-oracle-reporter.mjs`)}`,
    // Each child scans only its own generated directory. The generated
    // directory sits outside `tests/`, so the package's default run never
    // collects a generated spec.
    `--dir=${directory}`,
    ...files,
  ]
  const shell = shellTail !== undefined || shellHead !== undefined
  const run = spawnSync(
    shell ? `/bin/sh` : process.execPath,
    shell
      ? [
          `-c`,
          `${shellHead ?? ``} ${[process.execPath, ...argv].map(shellWord).join(` `)} ${shellTail ?? ``}`,
        ]
      : argv,
    {
      cwd: packageDirectory,
      env: {
        ...childEnv,
        SELF_ORACLE_PREFIX: prefix,
        ...(seeded ? { [`${prefix}_SEED`]: String(childSeed) } : {}),
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
  const {
    files: reported,
    unhandled,
    warnings,
  } = JSON.parse(readFileSync(report, `utf8`)) as {
    files: Array<ReportedFile>
    unhandled?: Array<ReportedError>
    warnings?: Array<string>
  }
  const presentedWarnings = (warnings ?? []).map((warning) =>
    warningPresentation === true ? reversedWarning(warning) : warning,
  )
  const projectedWarnings = presentedWarnings.map(semanticWarning)
  const warningPermutation =
    warningPresentation === undefined
      ? undefined
      : {
          lists: presentedWarnings.filter(
            (warning) => reversedWarning(warning) !== warning,
          ).length,
          stable:
            JSON.stringify([...projectedWarnings].sort()) ===
            JSON.stringify(
              presentedWarnings
                .map(reversedWarning)
                .map(semanticWarning)
                .sort(),
            ),
        }
  if (warningPresentation !== undefined)
    writeFileSync(
      `${report}.presented-warnings.json`,
      JSON.stringify({
        reversed: warningPresentation,
        warnings: presentedWarnings,
      }),
    )
  return {
    files: reported,
    stdout: run.stdout,
    warnings: projectedWarnings,
    ...(warningPermutation ? { warningPermutation } : {}),
    unhandled: unhandled ?? [],
    exit: run.status,
    signal: run.signal,
  }
}

// A test's name within its property, without a nested spec's outer suite.
const unnested = (name: string) =>
  name.startsWith(`${outerSuite} > `) ? name.slice(outerSuite.length + 3) : name
const short = (id: string, name: string) =>
  unnested(name).replace(`${id} > `, ``)
// A slow spec can log under whichever test runs after its timeout. The raw
// child record retains these calls; this derived stream summary omits their
// host-dependent test attribution.
const settledLog = (plan: Plan, log: Array<LogEntry>) =>
  log.filter(
    ({ id }) => !plan.specs.some((spec) => spec.slow && spec.id === id),
  )
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
        // Vitest may run files concurrently. Each property's call order is
        // observable; interleaving independent properties is not a framework
        // promise. Stable grouping retains every call and each local order.
        .sort((a, b) => a.id.localeCompare(b.id))
    : []
// Resolve callbacks may create resources even when no driver receives the
// result. Their separate input-side log preserves extra and omitted calls.
const readResolutions = (log: string): SuiteRun[`resolutions`] =>
  existsSync(log)
    ? readFileSync(log, `utf8`)
        .trim()
        .split(`\n`)
        .filter(Boolean)
        .map((line) => {
          const entry = JSON.parse(line) as Pick<LogEntry, `id` | `test`>
          return { ...entry, test: unnested(entry.test) }
        })
        .sort((a, b) => a.id.localeCompare(b.id))
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

const readBuilds = (log: string): Array<BuildEntry> =>
  existsSync(`${log}.builds`)
    ? readFileSync(`${log}.builds`, `utf8`)
        .trim()
        .split(`\n`)
        .filter(Boolean)
        .map((line) => {
          const entry = JSON.parse(line) as BuildEntry
          return { ...entry, test: unnested(entry.test) }
        })
        // Independent files may finish in either order. Keep every build and
        // each property's local order, as the invocation log does.
        .sort((a, b) => a.id.localeCompare(b.id))
    : []

// Only semantic diagnostic facts enter the outer observation. Host stacks,
// temporary paths, elapsed times and a campaign wrapper's random seed are not
// promised failure differences. Error multiplicity remains observable.
const diagnosticFacts = ({
  kind,
  law,
  checkpoint,
  diagnosis,
  cause,
  causeMessage,
  counterexample,
  dataPath,
  dataKind,
}: Failure): Failure => ({
  kind,
  ...(law === undefined ? {} : { law }),
  ...(checkpoint === undefined ? {} : { checkpoint }),
  ...(diagnosis === undefined ? {} : { diagnosis }),
  ...(cause === undefined ? {} : { cause }),
  ...(causeMessage === undefined ? {} : { causeMessage }),
  ...(counterexample !== undefined && counterexampleItems(counterexample)
    ? { counterexampleHistory: counterexampleItems(counterexample)! }
    : {}),
  ...(dataPath === undefined ? {} : { dataPath }),
  ...(dataKind === undefined ? {} : { dataKind }),
})

// The variables a printed replay command sets, by name: each `NAME=value`
// word before `vitest run`, a value single-quoted as a POSIX shell quotes it.
const replayParts = (
  command: string,
):
  | { head: string; tail: string; variables: Record<string, string> }
  | undefined => {
  const split = /^(.*?) vitest run (.*)$/.exec(command)
  if (!split) return undefined
  const variables: Record<string, string> = {}
  for (const [, name, value] of split[1]!.matchAll(
    /([A-Z_]+)=('(?:[^']|'\\'')*'|\S*)/g,
  ))
    variables[name!] = value!.startsWith(`'`)
      ? value!.slice(1, -1).replace(/'\\''/g, `'`)
      : value!
  return { head: split[1]!, tail: split[2]!, variables }
}

// The `ORACLE_SEED` lines a test logged for a property, by seed.
const seedLogsOf = (test: ReportedTest, id: string) =>
  test.console
    .split(`\n`)
    .filter((line) =>
      line.startsWith(`ORACLE_SEED {"property":${JSON.stringify(id)},`),
    )
    .map(
      (line) =>
        (JSON.parse(line.slice(`ORACLE_SEED `.length)) as { seed: number })
          .seed,
    )

// The variables of a drawn replay environment, under the suite's prefix.
function environmentOf(plan: Plan): Record<string, string> {
  const drawn = plan.environment!
  const name = (setting: string) => `${plan.prefix}_${setting}`
  const [first] = plan.specs
  const values: Record<string, string | undefined> = {
    SELF_ORACLE_RETIRED: drawn.retired ? `1` : undefined,
    [name(`SEED`)]: { absent: undefined, valid: `5`, invalid: `x` }[drawn.seed],
    [name(`PATH`)]: {
      absent: undefined,
      valid: `0`,
      empty: ``,
      malformed: `a`,
    }[drawn.path],
    [name(`PROPERTY`)]: {
      absent: undefined,
      first: first!.id,
      empty: ``,
      unregistered: `self-oracle.unregistered`,
    }[drawn.property],
    [name(`UNIT`)]: {
      absent: undefined,
      named: randomUnit(
        first!.source.kind === `generated`
          ? unitNames(first!)[0]!
          : `generated`,
      ),
      missing: randomUnit(`missing`),
    }[drawn.unit],
  }
  return Object.fromEntries(
    Object.entries(values).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  )
}

function driveSuite(
  plan: Plan,
  observe: (checkpoint: string, value: unknown) => void,
) {
  const warningPresentation = plan.permuteWarnings
    ? warningPresentationCount++ % 2 === 0
    : undefined
  const directory = join(
    packageDirectory,
    `.self-oracle-${process.pid}-${runCount++}`,
  )
  const { prefix } = plan
  mkdirSync(directory, { recursive: true })
  try {
    const receive = (
      context: ChildContext,
      ...args: Parameters<typeof runVitest>
    ): Report => {
      const options = args[2]
      const childLog =
        options.env?.SELF_ORACLE_LOG ??
        join(directory, `child-${runCount}.jsonl`)
      const report = runVitest(args[0], args[1], {
        ...options,
        env: { ...options.env, SELF_ORACLE_LOG: childLog },
        warningPresentation,
      })
      if (report.warningPermutation)
        observe(`warning-permutation`, {
          context,
          ...report.warningPermutation,
        })
      observe(`child`, {
        context,
        log: readLog(childLog),
        builds: readBuilds(childLog),
        resolutions: readResolutions(`${childLog}.resolutions`),
        // Independent property files may register in either order.
        warnings: [...report.warnings].sort(),
        tests: report.files
          .flatMap(({ file, tests }) => {
            const id = plan.specs[files.indexOf(file)]?.id ?? `unknown`
            return tests.map((test) => ({
              id,
              name: short(id, test.name),
              state: test.state,
              errors: test.errors.map((error) =>
                diagnosticFacts(classify(error)),
              ),
              seedLogs: seedLogsOf(test, id),
            }))
          })
          .sort((a, b) => a.id.localeCompare(b.id)),
        loads: report.files.map(({ file, errors }) => ({
          id: plan.specs[files.indexOf(file)]?.id ?? `unknown`,
          errors: errors.map(({ message }) => message ?? ``),
          causes: errors.map(({ cause }) => cause?.message ?? ``),
        })),
        exit: report.exit,
        signal: report.signal,
        files: report.files.map(({ file }) =>
          file.replace(`${directory}/`, ``),
        ),
        expectedFiles: args[1].map((file) => file.replace(`${directory}/`, ``)),
        // Synthetic tests owe one primary failure; causes retain its nested
        // diagnostic chain. Separate teardown/hook failures must stay visible.
        secondaryErrors: report.files.flatMap(({ tests }) =>
          tests.flatMap(({ name, errors }) =>
            errors
              .slice(1)
              .map(({ message }) => ({ test: name, message: message ?? `` })),
          ),
        ),
        unhandled: report.unhandled.map(({ message }) => message ?? ``),
        failed: report.files.some(
          (file) =>
            file.errors.length > 0 ||
            file.tests.some(({ state }) => state === `failed`),
        ),
      } satisfies ChildRun)
      return report
    }
    const log = join(directory, `log.jsonl`)
    const files = plan.specs.map((spec, index) => {
      const file = join(directory, `spec-${index}-oracle.test.ts`)
      writeFileSync(
        file,
        `import { syntheticProperty } from ${JSON.stringify(join(here, `oracle-property-self-oracle-fixture.ts`))}\nsyntheticProperty(${JSON.stringify(spec)})\n`,
      )
      return file
    })
    const report = receive({ kind: `run` }, directory, files, {
      env: { SELF_ORACLE_LOG: log },
      prefix,
    })
    const run: SuiteRun = {
      files: {},
      log: settledLog(plan, readLog(log)),
      resolutions: readResolutions(`${log}.resolutions`),
      builds: readBuilds(log),
      // Independent files may finish in either order; every line remains.
      stdout: report.stdout.split(`\n`).sort().join(`\n`),
      warnings: [...report.warnings].sort(),
      unhandled: report.unhandled.map((error) => error.message ?? ``),
    }
    for (const [index, spec] of plan.specs.entries()) {
      const reported = report.files.find((file) => file.file === files[index])
      // A passing unit prints `<id> <unit> reach {...}`.
      const reach: Record<string, Record<string, number>> = {}
      for (const line of report.stdout.split(`\n`)) {
        const match = /^(\S+) (.+) reach (\{.*\})$/.exec(line)
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
          seedLogs: seedLogsOf(test, spec.id),
        })),
        reach,
      }
    }
    observe(`run`, run)
    // Adding a calibration ahead of another must not change the latter's seed
    // or built history. This is a metamorphic comparison of driver inputs,
    // independent of the framework's particular seed hash.
    for (const [index, spec] of plan.specs.entries()) {
      if (
        !spec.calibrations.some((calibration) => {
          const binding = bindingOf(spec, calibration)
          return binding && `constructed` in binding
        }) ||
        !run.files[spec.id]!.loaded
      )
        continue
      const file = files[index]!
      const original = readFileSync(file, `utf8`)
      const reorderedLog = join(directory, `reordered-${index}.jsonl`)
      try {
        const reordered = {
          ...spec,
          calibrations: [
            { name: `unrelated calibration`, kind: `right` },
            ...[...spec.calibrations].reverse(),
          ],
        }
        writeFileSync(
          file,
          `import { syntheticProperty } from ${JSON.stringify(join(here, `oracle-property-self-oracle-fixture.ts`))}\nsyntheticProperty(${JSON.stringify(reordered)})\n`,
        )
        receive({ kind: `binding-reordered`, id: spec.id }, directory, [file], {
          env: { SELF_ORACLE_LOG: reorderedLog },
          shellTail: `-t 'calibration:'`,
          prefix,
        })
        observe(`binding-reordered`, {
          id: spec.id,
          log: readLog(reorderedLog),
        })
      } finally {
        writeFileSync(file, original)
      }
    }
    for (const [index, spec] of plan.specs.entries()) {
      if (!spec.warningProbe || !run.files[spec.id]!.loaded) continue
      const file = files[index]!,
        original = readFileSync(file, `utf8`)
      // These probes supply the enclosing suites themselves. Register the
      // property synchronously inside each phase's callback so its environment
      // cannot change before a deferred nested describe runs.
      const call = `syntheticProperty(${JSON.stringify({ ...spec, nested: false })})`
      try {
        // Repeated ordinary registrations share one process/id, as do a collector
        // followed by ordinary registration. Tests are collected but not run.
        writeFileSync(
          file,
          `import { describe } from 'vitest'\nimport { syntheticProperty } from ${JSON.stringify(join(here, `oracle-property-self-oracle-fixture.ts`))}\ndescribe('first',()=>{${call}})\ndescribe('second',()=>{${call}})\n`,
        )
        const repeated = receive(
          {
            kind: `registration-warnings`,
            id: spec.id,
            phases: [`first`, `second`],
          },
          directory,
          [file],
          { shellTail: `-t '__registration_only__'`, prefix },
        )
        const manifest = join(directory, `manifest-${index}.jsonl`)
        writeFileSync(
          file,
          `import { describe } from 'vitest'\nimport { syntheticProperty } from ${JSON.stringify(join(here, `oracle-property-self-oracle-fixture.ts`))}\ndescribe('collect',()=>{process.env[${JSON.stringify(`ORACLE_MANIFEST`)}]=${JSON.stringify(manifest)};try{${call}}finally{delete process.env[${JSON.stringify(`ORACLE_MANIFEST`)}]}})\ndescribe('ordinary',()=>{${call}})\n`,
        )
        const collectThenRun = receive(
          {
            kind: `registration-warnings`,
            id: spec.id,
            phases: [`collect`, `ordinary`],
          },
          directory,
          [file],
          { shellTail: `-t '__registration_only__'`, prefix },
        )
        const collectedManifest = join(
          directory,
          `collected-manifest-${index}.jsonl`,
        )
        writeFileSync(
          file,
          `import { syntheticProperty } from ${JSON.stringify(join(here, `oracle-property-self-oracle-fixture.ts`))}\n${call}\n`,
        )
        const collected = receive(
          { kind: `registration-warnings`, id: spec.id, phases: [] },
          directory,
          [file],
          {
            env: { ORACLE_MANIFEST: collectedManifest },
            shellTail: `-t '__registration_only__'`,
            prefix,
          },
        )
        const loaded = (phase: Report) =>
          phase.files.length === 1 &&
          phase.files[0]!.file === file &&
          phase.files[0]!.errors.length === 0 &&
          phase.unhandled.length === 0
        const registered = (path: string) =>
          existsSync(path) &&
          readFileSync(path, `utf8`)
            .trim()
            .split(`\n`)
            .filter(Boolean)
            .map((line) => (JSON.parse(line) as { id: string }).id)
        observe(`registration-warnings`, {
          manifests: {
            collectThenRun: registered(manifest),
            collected: registered(collectedManifest),
          },
          tests: {
            repeated: repeated.files
              .flatMap(({ tests }) => tests.map(({ name }) => name))
              .sort(),
            collectThenRun: collectThenRun.files
              .flatMap(({ tests }) => tests.map(({ name }) => name))
              .sort(),
            collected: collected.files
              .flatMap(({ tests }) => tests.map(({ name }) => name))
              .sort(),
          },
          loaded: {
            repeated: loaded(repeated),
            collectThenRun: loaded(collectThenRun),
            collected: loaded(collected),
          },
          id: spec.id,
          repeated: repeated.warnings,
          collectThenRun: collectThenRun.warnings,
          collected: collected.warnings,
        })
      } finally {
        writeFileSync(file, original)
      }
    }
    if (plan.seedless) {
      const seedlessLog = join(directory, `seedless-${runCount}.jsonl`)
      const seedless = receive({ kind: `seedless` }, directory, files, {
        env: {
          SELF_ORACLE_LOG: seedlessLog,
          SELF_ORACLE_RANDOM_DRAW: String(plan.seedlessDraw ?? 0.5),
        },
        seeded: false,
        prefix,
      })
      const logged = readLog(seedlessLog)
      const settled = new Set(settledLog(plan, logged))
      // Per property: the routes its random units ran under, the same
      // whatever seed it drew; the seed it logged; and what each random unit
      // ran, which that seed decides (none for a slow spec).
      observe(
        `seedless`,
        Object.fromEntries(
          plan.specs.map((spec, index) => {
            const random = logged.filter(
              (entry) =>
                entry.id === spec.id &&
                unitOf(entry.test.slice(spec.id.length + 3))?.seed ===
                  undefined &&
                isCampaign(entry.test.slice(spec.id.length + 3)),
            )
            const ran: Record<string, Array<SyntheticHistory>> = {}
            for (const entry of random.filter((kept) => settled.has(kept)))
              (ran[entry.test.slice(spec.id.length + 3)] ??= []).push(
                entry.history,
              )
            return [
              spec.id,
              {
                routes: [...new Set(random.map((entry) => entry.route))].sort(),
                seeds: (
                  seedless.files.find((file) => file.file === files[index])
                    ?.tests ?? []
                ).flatMap((test) => seedLogsOf(test, spec.id)),
                ran,
              },
            ]
          }),
        ) satisfies SeedlessRun,
      )
    }
    for (const spec of plan.specs) {
      // replay: each failing unit's printed replay command, run as printed.
      for (const unit of run.files[spec.id]!.tests) {
        const command = unit.failure?.replay
        if (!isCampaign(unit.name) || command === undefined) continue
        const parts = replayParts(command)
        const probed = randomUnit(unitOf(unit.name)!.name)
        const replayLog = join(directory, `replay-${runCount}.jsonl`)
        const replay = parts
          ? receive(
              { kind: `replay`, id: spec.id, target: unit.name, probed },
              directory,
              files,
              {
                env: { SELF_ORACLE_LOG: replayLog },
                shellHead: parts.head,
                shellTail: parts.tail,
                seeded: false,
                prefix,
              },
            )
          : undefined
        const index = plan.specs.indexOf(spec)
        const random = replay?.files
          .find((file) => file.file === files[index])
          ?.tests.find((test) => short(spec.id, test.name) === probed)
        const replayed = readLog(replayLog).filter(
          (entry) => entry.test === `${spec.id} > ${probed}`,
        )
        observe(`replay`, {
          id: spec.id,
          target: unit.name,
          original: unit.failure!,
          variables: parts?.variables ?? {},
          probed,
          states: replay ? statesIn(replay, plan, files) : [],
          ...(random?.state === `failed`
            ? { failure: classify(random.errors[0]) }
            : {}),
          ran: replayed.map((entry) => entry.history),
          routes: replayed.map((entry) => entry.route),
        } satisfies ProbeRun)
      }
      // rerun: the first history test and the first fixed-seed unit that
      // printed a `-t` pattern.
      const targets = [
        run.files[spec.id]!.tests.find(
          (test) => !isCampaign(test.name) && test.failure?.rerun !== undefined,
        ),
        run.files[spec.id]!.tests.find(
          (test) =>
            unitOf(test.name)?.seed !== undefined &&
            test.failure?.rerun !== undefined,
        ),
      ]
      for (const target of targets) {
        if (!target) continue
        const index = plan.specs.indexOf(spec)
        const rerun = receive(
          {
            kind: `rerun`,
            id: spec.id,
            target: target.name,
            probed: target.name,
          },
          directory,
          [files[index]!],
          {
            shellTail: target.failure!.rerun,
            prefix,
          },
        )
        const ran = rerun.files[0]?.tests.find(
          (test) => test.state === `failed`,
        )
        observe(`rerun`, {
          id: spec.id,
          target: target.name,
          original: target.failure!,
          probed: target.name,
          states: statesIn(rerun, plan, files),
          ...(ran ? { failure: classify(ran.errors[0]) } : {}),
        } satisfies ProbeRun)
      }
    }
    // environment: every file once under the drawn replay environment.
    if (plan.environment) {
      const environmentLog = join(directory, `environment-${runCount}.jsonl`)
      const under = receive({ kind: `environment` }, directory, files, {
        env: { ...environmentOf(plan), SELF_ORACLE_LOG: environmentLog },
        seeded: false,
        prefix,
      })
      observe(`environment`, {
        files: Object.fromEntries(
          plan.specs.map((spec, index) => {
            const reported = under.files.find(
              (file) => file.file === files[index],
            )
            return [
              spec.id,
              {
                loaded: reported !== undefined && reported.errors.length === 0,
                loadErrors: (reported?.errors ?? []).map(
                  (error) => error.message ?? ``,
                ),
                tests: (reported?.tests ?? []).map((test) => ({
                  name: short(spec.id, test.name),
                  state: test.state,
                  ...(test.state === `failed`
                    ? { failure: classify(test.errors[0]) }
                    : {}),
                })),
              },
            ]
          }),
        ),
        log: settledLog(plan, readLog(environmentLog)),
      } satisfies EnvironmentRun)
    }
    if (plan.hostRngDraw !== undefined) {
      const draw = plan.hostRngDraw
      const forwarding =
        plan.hostRngForwarding === `alternate`
          ? hostForwardingCount++ % 2 === 0
            ? 1
            : 2
          : (plan.hostRngForwarding ?? 0)
      const hostSeed = (
        mode: `outer` | `child`,
        ordinal: number,
      ): HostSeed | null => {
        const file = join(
          directory,
          `host-seed-${mode}-${ordinal}-diagnostic.test.ts`,
        )
        const output = join(directory, `host-seed-${mode}-${ordinal}.json`)
        // Dynamic import gives the host draw and marker their intended cut:
        // before fixture evaluation, rather than after its side effects.
        writeFileSync(
          file,
          `import { test } from 'vitest'
import { writeFileSync } from 'node:fs'
let hostCalls=0
const hostRandom=()=>{hostCalls++;return ${draw}}
Math.random=hostRandom
${mode === `outer` ? `delete process.env.SELF_ORACLE_LOG\n` : ``}await import(${JSON.stringify(join(here, `oracle-property-self-oracle-fixture.ts`))})
const forwardingCalls=${mode === `outer` ? forwarding : 0}
let forwardingInvocations=0
if(forwardingCalls>0){const retainedRandom=Math.random;Math.random=()=>{forwardingInvocations++;const value=retainedRandom();if(forwardingCalls===2)retainedRandom();return value}}
const postImportDraw=Math.random()
const { oraclePropertyOptions }=await import(${JSON.stringify(join(packageDirectory, `src/oracle-config.ts`))})
test('host seed diagnostic',()=>{
  const hostCallsBeforeSeed=hostCalls
  const forwardingBeforeSeed=forwardingInvocations
  const {seed}=oraclePropertyOptions(1,'self-oracle.framework')
  const hostCallsAfterSeed=hostCalls
  const forwardingAfterSeed=forwardingInvocations
  writeFileSync(${JSON.stringify(output)},JSON.stringify({seed,childMarker:process.env.SELF_ORACLE_LOG!==undefined,draw:postImportDraw,hostUsed:hostCallsAfterSeed>hostCallsBeforeSeed,forwarded:forwardingAfterSeed>forwardingBeforeSeed,hostCallsBeforeSeed,hostCallsAfterSeed,forwardingCalls,forwardingBeforeSeed,forwardingAfterSeed}))
})
`,
        )
        receive(
          { kind: `host-scope`, mode, ordinal, draw },
          directory,
          [file],
          {
            seeded: false,
            prefix,
          },
        )
        if (!existsSync(output)) return null
        const actual = JSON.parse(readFileSync(output, `utf8`)) as HostSeed
        // Raw diagnostic JSON retains counter magnitudes and wrapper details.
        // Only public draw/use/seed facts enter the deterministic observation.
        return {
          seed: actual.seed,
          childMarker: actual.childMarker,
          draw: actual.draw,
          hostUsed: actual.hostUsed,
          forwarded: actual.forwarded,
        }
      }
      observe(`host-scope`, {
        draw,
        outer: hostSeed(`outer`, 0),
        children: [hostSeed(`child`, 0), hostSeed(`child`, 1)],
      } satisfies HostScopeRun)
    }
    // reach: for each loaded enumerated source that declares states, Vitest
    // runs that file again with a `-t` pattern that selects only its reach
    // test, so the reach test judges histories that no test of the run
    // recorded. A slow spec's reach test times out either way.
    for (const [index, spec] of plan.specs.entries()) {
      if (!spec.enumeratedStates || spec.slow || !run.files[spec.id]!.loaded)
        continue
      const escape = (text: string) =>
        text.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`)
      const pattern = `^${[...(spec.nested ? [outerSuite] : []), spec.id, `reach`].map(escape).join(`(?: | > )`)}$`
      const alone = receive(
        { kind: `reach-alone`, id: spec.id },
        directory,
        [files[index]!],
        {
          shellTail: `-t ${shellWord(pattern)}`,
          prefix,
        },
      )
      const test = alone.files[0]?.tests.find(
        (candidate) => short(spec.id, candidate.name) === `reach`,
      )
      const printed = new RegExp(
        `^${escape(spec.id)} enumerated reach (\\{.*\\})$`,
        `m`,
      ).exec(alone.stdout)?.[1]
      observe(`reach-alone`, {
        id: spec.id,
        state: test?.state ?? `missing`,
        ...(test?.state === `failed`
          ? { failure: classify(test.errors[0]) }
          : {}),
        ...(printed ? { reach: JSON.parse(printed) as unknown } : {}),
        others: statesIn(alone, plan, files).filter(
          ([id, name, state]) =>
            id === spec.id && name !== `reach` && state !== `skipped`,
        ),
      } satisfies ReachAlone)
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
    : name === `determinism` || name.startsWith(`determinism:`)
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

const matchesOutcome = (
  outcome: Outcome,
  failure: Failure | undefined,
  kind: string,
  campaign: boolean,
) =>
  kind === outcome.kind &&
  (outcome.law === undefined || failure?.law === outcome.law) &&
  (outcome.checkpoint === undefined ||
    failure?.checkpoint === outcome.checkpoint) &&
  failure?.diagnosis === outcome.diagnosis &&
  failure?.dataPath === outcome.dataPath &&
  failure?.dataKind === outcome.dataKind &&
  (campaign || failure?.cause === outcome.cause) &&
  (campaign ||
    (outcome.kind === `violation`
      ? failure?.causeMessage === outcome.causeMessage
      : outcome.causeMessage === undefined ||
        failure?.causeMessage === outcome.causeMessage))

// A concrete campaign candidate owes its own diagnostics, not those of the
// first failing history before shrinking. Missing a construction's state is
// separate from the candidate's row-value law and can have a passing trace.
const campaignCandidateOutcome = (
  spec: SyntheticSpec,
  concrete: SyntheticHistory,
  campaign: Outcome,
): Outcome => {
  const precise = dataOutcome(spec) ?? judged(spec, concrete)
  return campaign.kind === `constructed-reach` && precise.kind === `pass`
    ? campaign
    : precise
}

// Whether a unit's history fails it: a data error, a failing verdict, or, in
// a constructed unit, a state its construction names and does not enter.
const failsUnit = (
  spec: SyntheticSpec,
  unit: string,
  history: SyntheticHistory,
) => {
  const construction = spec.constructed.find(
    ({ name }) => name === unitOf(unit)?.name,
  )
  return (
    dataOutcome(spec) !== undefined ||
    judged(spec, history).kind !== `pass` ||
    (construction !== undefined && !reaches(spec, history, construction.enters))
  )
}
// A unit's log and its stream, as law `units` compares them: a unit that the
// model owes a pass ran exactly its stream, no history more; a failing unit
// ran its stream up to its first failure, and then its shrinks, which the
// law does not compare.
const comparedRun = (
  spec: SyntheticSpec,
  unit: string,
  stream: ReadonlyArray<SyntheticHistory>,
  logged: ReadonlyArray<SyntheticHistory>,
) => {
  const first = stream.findIndex((history) => failsUnit(spec, unit, history))
  return first < 0
    ? { ran: logged, owedRun: stream }
    : {
        ran: logged.slice(0, first + 1),
        owedRun: stream.slice(0, first + 1),
      }
}

// Model law `replay-config`: the first error of the drawn replay
// environment, in the order the law states, or none.
function environmentError(plan: Plan): string | undefined {
  const drawn = plan.environment!
  const name = (setting: string) => `${plan.prefix}_${setting}`
  if (drawn.retired)
    return `Retired oracle replay variables are set: SELF_ORACLE_RETIRED. Use ${name(`SEED`)}, ${name(`PATH`)}, ${name(`PROPERTY`)}, and ${name(`UNIT`)} to select a replay, and ${name(`RUNS_MULTIPLIER`)} to scale run counts.`
  // An empty property is still set.
  const property = drawn.property !== `absent`
  const unit = drawn.unit !== `absent`
  if (drawn.seed === `absent` && drawn.path !== `absent`)
    return `${name(`PATH`)} requires ${name(`SEED`)}`
  if (drawn.seed !== `invalid` && drawn.path === `absent`) {
    if (property) return `${name(`PROPERTY`)} requires ${name(`PATH`)}`
    return unit ? `${name(`UNIT`)} requires ${name(`PROPERTY`)}` : undefined
  }
  if (drawn.seed === `invalid`) return `${name(`SEED`)} must be an integer`
  if (drawn.path === `empty`) return `${name(`PATH`)} must be non-empty`
  if (drawn.path === `malformed`)
    return `${name(`PATH`)} must contain colon-separated nonnegative integers`
  if (!property || drawn.property === `empty`)
    return `${name(`PATH`)} requires ${name(`PROPERTY`)}`
  if (drawn.property === `unregistered`)
    return `unknown oracle property: self-oracle.unregistered`
  return undefined
}

// A replay configuration is checked before a declaration's UNIT selection.
// A declaration still owes its own first error before a valid environment can
// select its generated unit. This account is shared by every receiving child.
function environmentSelection(plan: Plan, spec: SyntheticSpec) {
  const error = environmentError(plan)
  const drawn = plan.environment!
  const replay = drawn.path === `valid` && error === undefined
  const selected = replay && plan.specs[0]!.id === spec.id && !spec.unregistered
  const unit = environmentOf(plan)[`${plan.prefix}_UNIT`]
  const replayError = !selected
    ? undefined
    : spec.source.kind === `enumerated`
      ? unit === undefined
        ? undefined
        : `${spec.id}: ${plan.prefix}_UNIT names "${unit}"`
      : unit === undefined
        ? `${spec.id}: ${plan.prefix}_PATH of a generated source requires ${plan.prefix}_UNIT`
        : unitNames(spec).map(randomUnit).includes(unit)
          ? undefined
          : `${spec.id}: ${plan.prefix}_UNIT names "${unit}"`
  return { error, replay, selected, unit, replayError }
}

function environmentUnitOutcome(spec: SyntheticSpec, unit: string): Outcome {
  const history = unitStream(spec, 5, unitOf(unit)!.name)[0]!
  const ordinary =
    dataOutcome(spec) ??
    (spec.slow ? { kind: `timeout` as const } : judged(spec, history))
  return ordinary.kind === `pass` && failsUnit(spec, unit, history)
    ? { kind: `constructed-reach` }
    : ordinary
}

// The same independent synthetic model judges every receiving child. The
// context determines selection, never the reported state. Full registration
// remains owed when a filter or path replay makes most tests stand aside.
function childExpectation(
  plan: Plan,
  child: ChildRun,
  expected: ReturnType<typeof suiteModel>,
  nameLog: ReadonlyArray<LogEntry>,
) {
  const context = child.context
  if (context.kind === `host-scope`) {
    const diagnostic = child.tests[0]
    if (
      child.tests.length !== 1 ||
      diagnostic?.name !== `host seed diagnostic` ||
      diagnostic.state !== `passed` ||
      diagnostic.errors.length !== 0 ||
      child.warnings.length !== 0
    )
      return {
        failure: violation(
          `host-scope`,
          `host seed diagnostic did not complete once: ${JSON.stringify(child.tests)}`,
          `host RNG scope`,
        ),
      }
    return { failed: false }
  }
  const selectedSpecs =
    `id` in context
      ? plan.specs.filter(
          ({ id }) => id === context.id || context.kind === `replay`,
        )
      : plan.specs
  if (
    unattributedWarnings(
      child.warnings,
      selectedSpecs.map(({ id }) => id),
    ).length
  )
    return {
      failure: violation(
        `child`,
        `registration reported a warning for no declared property: ${JSON.stringify(child.warnings)}`,
        `calibration`,
      ),
    }
  if (
    child.tests.some(({ id }) => !selectedSpecs.some((spec) => spec.id === id))
  )
    return {
      failure: violation(
        `child`,
        `child registered tests outside its declared property files`,
        `registration`,
      ),
    }
  let failed = false
  for (const original of selectedSpecs) {
    const spec = registeredSpec(original, context)
    // The selected seed is host input. Read its explicit seed line, never
    // infer a seed or a stream from the driver's observed histories.
    const randomSeed =
      child.tests
        .filter(({ id }) => id === spec.id)
        .flatMap(({ seedLogs }) => seedLogs)[0] ?? childSeed
    const prediction = predictSpec(
      spec,
      child.log,
      child.builds,
      nameLog,
      randomSeed,
    )
    const environment =
      context.kind === `environment`
        ? environmentSelection(plan, spec)
        : undefined
    const rejected =
      !prediction.loads ||
      environment?.error !== undefined ||
      environment?.replayError !== undefined
    if (rejected) failed = true
    const names = !rejected ? [...prediction.tests.keys()] : []
    const owedNames =
      context.kind === `registration-warnings` && context.phases.length
        ? context.phases.flatMap((phase) =>
            names.map((name) => `${phase} > ${name}`),
          )
        : names
    const seen = child.tests.filter(({ id }) => id === spec.id)
    const actualNames = seen.map(({ name }) => name).sort()
    if (JSON.stringify(actualNames) !== JSON.stringify([...owedNames].sort()))
      return {
        failure: violation(
          `child`,
          `${spec.id} ${context.kind} omitted or duplicated registrations`,
          `registration`,
          { actual: actualNames, expected: [...owedNames].sort() },
        ),
      }
    if (rejected) continue
    const collectOnly =
      context.kind === `registration-warnings` && context.phases.length === 0
    if (warningMismatch(spec, child.warnings, collectOnly))
      return {
        failure: violation(
          `child`,
          `${spec.id} ${context.kind} lost its once-per-process unbound calibration warning or names: ${JSON.stringify(propertyWarnings(child.warnings, spec.id))}`,
          `calibration`,
        ),
      }
    for (const test of seen) {
      const selected =
        context.kind === `registration-warnings`
          ? false
          : context.kind === `binding-reordered`
            ? test.name.startsWith(`calibration:`)
            : context.kind === `replay`
              ? spec.id === context.id && test.name === context.probed
              : environment?.replay
                ? environment.selected && test.name === environment.unit
                : context.kind === `rerun`
                  ? test.name === context.target
                  : context.kind === `reach-alone`
                    ? test.name === `reach`
                    : true
      if (!selected) {
        if (test.state !== `skipped` || test.errors.length !== 0)
          return {
            failure: violation(
              `child`,
              `${spec.id} ${context.kind} unselected test ${JSON.stringify(test.name)} did not stand aside`,
              `registration`,
            ),
          }
        continue
      }
      const originalPrediction = expected.get(spec.id)!
      if (!originalPrediction.loads)
        return {
          failure: violation(
            `child`,
            `${spec.id} ran despite its rejected declaration`,
            `registration`,
          ),
        }
      const ordinary =
        context.kind === `replay`
          ? originalPrediction.tests.get(context.target)!
          : prediction.tests.get(test.name)!
      const outcome =
        environment?.replay && environment.selected && environment.unit
          ? environmentUnitOutcome(spec, environment.unit)
          : context.kind === `reach-alone`
            ? reachAloneOutcome(spec, ordinary)
            : ordinary
      if (outcome.kind !== `pass`) failed = true
      const failure = test.errors[0]
      const kind = test.state === `passed` ? `pass` : (failure?.kind ?? `other`)
      const owesFailure = outcome.kind !== `pass`
      if (
        test.state !== (owesFailure ? `failed` : `passed`) ||
        test.errors.length !== (owesFailure ? 1 : 0) ||
        !matchesOutcome(outcome, failure, kind, isCampaign(test.name))
      )
        return {
          failure: violation(
            `child`,
            `${spec.id} ${context.kind} ${JSON.stringify(test.name)} ${test.state} as ${JSON.stringify(test.errors)}, owed ${JSON.stringify(outcome)}`,
            lawOfKind(outcome.kind === `pass` ? kind : outcome.kind, test.name),
            { actual: test.errors, expected: outcome },
          ),
        }
      if (
        spec.source.kind === `generated` &&
        isCampaign(test.name) &&
        outcome.kind === `pass`
      ) {
        const actualCalls = child.log.filter(
          ({ id, test: name }) =>
            id === spec.id && name === `${spec.id} > ${test.name}`,
        ).length
        const owedCalls =
          context.kind === `replay` || environment?.replay
            ? 1
            : unitOf(test.name)!.name === `generated`
              ? spec.source.runs
              : 1
        if (actualCalls !== owedCalls)
          return {
            failure: violation(
              `child`,
              `${spec.id} ${context.kind} ${JSON.stringify(test.name)} passed after ${actualCalls} driver calls, owed ${owedCalls} from its declared campaign budget`,
              `campaign budget`,
              { actual: actualCalls, expected: owedCalls },
            ),
          }
      }
      if (isCampaign(test.name) && failure) {
        const calls = child.log.filter(
          ({ id, test: name }) =>
            id === spec.id && name === `${spec.id} > ${test.name}`,
        )
        // A path replay runs its one requested concrete history directly.
        // The input-side log also supplies its items when an Error history's
        // inspection cannot be read back as an array of integers.
        if (context.kind === `replay` && calls.length !== 1)
          return {
            failure: violation(
              `child`,
              `${spec.id} replay ran ${calls.length} histories, owed exactly one`,
              `replay`,
            ),
          }
        const concrete =
          context.kind === `replay`
            ? calls[0]!.history
            : failure.counterexampleHistory
        if (
          context.kind === `replay` &&
          failure.counterexampleHistory &&
          JSON.stringify(failure.counterexampleHistory) !==
            JSON.stringify(concrete)
        )
          return {
            failure: violation(
              `child`,
              `${spec.id} replay reported a different concrete candidate than it ran`,
              `replay`,
            ),
          }
        if (concrete) {
          if (
            !calls.some(
              ({ history }) =>
                JSON.stringify(history) === JSON.stringify(concrete),
            )
          )
            return {
              failure: violation(
                `child`,
                `${spec.id} ${context.kind} reported a candidate the driver never ran`,
                `shrink`,
              ),
            }
          const diagnostic = campaignCandidateOutcome(spec, concrete, outcome)
          if (!matchesOutcome(diagnostic, failure, kind, false))
            return {
              failure: violation(
                `child`,
                `${spec.id} ${context.kind} campaign lost its concrete candidate's diagnostic facts: ${JSON.stringify(failure)}, owed ${JSON.stringify(diagnostic)} for ${JSON.stringify(concrete)}`,
                context.kind === `replay` ? `replay` : `shrink`,
                { actual: failure, expected: diagnostic },
              ),
            }
        }
      }
    }
  }
  return { failed }
}

function checkSuite(
  plan: Plan,
  trace: ReadonlyArray<{ checkpoint: string; value: unknown }>,
  expected: ReturnType<typeof suiteModel>,
) {
  const run = trace.find(({ checkpoint }) => checkpoint === `run`)?.value as
    SuiteRun | undefined
  if (!run) return violation(`run`, `the driver recorded no run`, `trace`)
  if (
    unattributedWarnings(
      run.warnings,
      plan.specs.map(({ id }) => id),
    ).length
  )
    return violation(
      `run`,
      `ordinary warnings name an undeclared property: ${JSON.stringify(run.warnings)}`,
      `calibration`,
    )
  for (const { checkpoint, value } of trace)
    if (
      checkpoint === `warning-permutation` &&
      !(value as { stable: boolean }).stable
    )
      return violation(
        `child`,
        `permuting actual warning names changed their semantic observation`,
        `calibration`,
      )
  const children = trace.filter(({ checkpoint }) => checkpoint === `child`)
  const owedChildren =
    1 +
    trace.reduce(
      (count, { checkpoint }) =>
        count +
        (checkpoint === `registration-warnings` || checkpoint === `host-scope`
          ? 3
          : [
                `binding-reordered`,
                `seedless`,
                `replay`,
                `rerun`,
                `reach-alone`,
                `environment`,
              ].includes(checkpoint)
            ? 1
            : 0),
      0,
    )
  if (children.length !== owedChildren)
    return violation(
      `child`,
      `recorded ${children.length} child reports, owed ${owedChildren}`,
      `trace`,
    )
  // Expected synthetic failures exit 1; unexpected process failures do not
  // disappear merely because a reporter managed to write a partial result.
  const lateMessage = `probe synthetic#saw-0 was called after its history ended. The driver must await the work it starts, so every probe call belongs to one history.`
  const ordinaryLog =
    children
      .map(({ value }) => value as ChildRun)
      .find(({ context }) => context.kind === `run`)?.log ?? run.log
  for (const { value } of children) {
    const child = value as ChildRun
    if (child.secondaryErrors.length)
      return violation(
        `child`,
        `unexpected secondary test errors: ${JSON.stringify(child.secondaryErrors)}`,
        `trace`,
      )
    if (child.context.kind === `host-scope`) {
      if (
        child.loads.length !== 1 ||
        child.loads.some(({ errors, causes }) => errors.length || causes.length)
      )
        return violation(
          `host-scope`,
          `host seed diagnostic reported load errors: ${JSON.stringify(child.loads)}`,
          `host RNG scope`,
        )
    } else {
      for (const file of child.loads) {
        const spec = plan.specs.find(({ id }) => id === file.id)
        const declaration =
          spec &&
          predictSpec(
            registeredSpec(spec, child.context),
            child.log,
            child.builds,
            ordinaryLog,
          )
        const environment =
          spec && child.context.kind === `environment`
            ? environmentSelection(plan, spec)
            : undefined
        const loadError =
          environment?.error ??
          (declaration && !declaration.loads
            ? declaration.loadError
            : environment?.replayError)
        const rejects =
          !declaration?.loads ||
          environment?.error !== undefined ||
          environment?.replayError !== undefined
        if (
          !declaration ||
          (rejects
            ? file.errors.length !== 1 ||
              file.causes.length !== 1 ||
              (loadError !== undefined &&
                !file.errors[0]!.includes(loadError)) ||
              (!environment?.error &&
                !declaration.loads &&
                ((declaration.loadFix !== undefined &&
                  !file.errors[0]!.includes(declaration.loadFix)) ||
                  (declaration.loadCause !== undefined &&
                    file.causes[0] !== declaration.loadCause)))
            : file.errors.length !== 0 || file.causes.length !== 0)
        )
          return violation(
            `child`,
            `unexpected child load/suite errors: ${JSON.stringify(file)}`,
            `registration`,
          )
      }
    }
    const modeled = childExpectation(plan, child, expected, ordinaryLog)
    if (modeled.failure) return modeled.failure
    const owedLate = lateCalls(plan, child.log)
    const actualLate = child.unhandled.filter(
      (message) => message === lateMessage,
    ).length
    if (actualLate < owedLate.min || actualLate > owedLate.max)
      return violation(
        `child`,
        `child reported ${actualLate} late probe calls, owed ${owedLate.min} to ${owedLate.max}`,
        `agreement`,
      )
    const unexpected = child.unhandled.filter(
      (message) =>
        message !== lateMessage ||
        !plan.specs.some(({ probe }) => probe === `late`),
    )
    if (unexpected.length)
      return violation(
        `child`,
        `unexpected unhandled errors: ${JSON.stringify(unexpected)}`,
        `trace`,
      )
    if (
      child.signal !== null ||
      child.exit !== (modeled.failed || child.unhandled.length ? 1 : 0) ||
      JSON.stringify([...child.files].sort()) !==
        JSON.stringify([...child.expectedFiles].sort())
    )
      return violation(
        `child`,
        `incomplete or abnormal child process: ${JSON.stringify(child)}`,
        `trace`,
      )
  }
  const probes = trace
    .filter(
      ({ checkpoint }) => checkpoint === `replay` || checkpoint === `rerun`,
    )
    .map(({ checkpoint, value }) => ({
      checkpoint,
      probe: value as ProbeRun,
    }))
  const envName = (setting: string) => `${plan.prefix}_${setting}`
  if (expected.hostScope) {
    const scope = trace.find(({ checkpoint }) => checkpoint === `host-scope`)
      ?.value as HostScopeRun | undefined
    if (
      !scope ||
      scope.draw !== expected.hostScope.draw ||
      scope.outer === null ||
      scope.outer.draw !== expected.hostScope.draw ||
      scope.outer.hostUsed !== expected.hostScope.outerHostUsed ||
      scope.outer.forwarded !== expected.hostScope.outerForwarded ||
      !Number.isInteger(scope.outer.seed) ||
      scope.outer.childMarker !== false ||
      scope.children.length !== 2 ||
      scope.children.some(
        (child) =>
          child === null ||
          child.childMarker !== true ||
          !Number.isFinite(child.draw) ||
          typeof child.hostUsed !== `boolean` ||
          child.forwarded !== false ||
          !Number.isInteger(child.seed),
      ) ||
      scope.children[0]?.seed !== scope.children[1]?.seed
    )
      return violation(
        `host-scope`,
        `fixture import changed host seed selection or receiving-child repeatability: ${JSON.stringify(scope ?? null)}, owed ${JSON.stringify(expected.hostScope)}`,
        `host RNG scope`,
      )
  }
  for (const spec of plan.specs) {
    const owed = expected.get(spec.id)!
    const seen = run.files[spec.id]!
    if (!owed.loads) {
      if (
        (bindingsOf(spec).length ||
          (spec.probeBinding && spec.probeBinding !== `empty`)) &&
        ordinaryLog.some((entry) => entry.id === spec.id)
      )
        return violation(
          `run`,
          `${spec.id} ran a driver despite an invalid calibration selector`,
          `calibration`,
        )
      const law = owed.membership ? `membership` : `registration`
      if (seen.loaded)
        return violation(
          `run`,
          `${spec.id} loaded, but its id is unregistered, a required state has no constructed history, a constructed history names an undeclared state, two of its tests would share a name, a fixed or constructed history is one the arbitrary cannot take back, \`owns\` is not a non-empty literal list of strings, or a history is not data`,
          law,
        )
      if (seen.loadErrors.length !== 1 || seen.loadCauses.length !== 1)
        return violation(
          `run`,
          `${spec.id} must report its first load error alone`,
          `registration`,
          { actual: seen.loadErrors, expected: `one load error` },
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
          owed.membership || owed.nameError ? law : `data`,
          { actual: seen.loadErrors, expected: owedText },
        )
      continue
    }
    if (!seen.loaded)
      return violation(`run`, `${spec.id} failed to load`, `registration`)
    const reordered = trace.find(
      ({ checkpoint, value }) =>
        checkpoint === `binding-reordered` &&
        (value as { id: string }).id === spec.id,
    )?.value as { log: Array<LogEntry> } | undefined
    if (reordered) {
      const tests = new Set(
        spec.calibrations.map(
          ({ name }) => `${spec.id} > calibration: ${name}`,
        ),
      )
      const selected = (log: ReadonlyArray<LogEntry>) =>
        log
          .filter(({ test }) => tests.has(test))
          .map(({ test, history }) => ({ test, history }))
          .sort((a, b) => a.test.localeCompare(b.test))
      if (
        JSON.stringify(selected(ordinaryLog)) !==
        JSON.stringify(selected(reordered.log))
      )
        return violation(
          `run`,
          `${spec.id} changed bound histories after calibration insertion/reordering`,
          `calibration`,
        )
    }
    if (
      spec.calibrationNames !== `indexed` &&
      spec.calibrations.length > 1 &&
      spec.calibrations.every((calibration) => {
        const binding = bindingOf(spec, calibration)
        return binding && `constructed` in binding
      })
    ) {
      const inputs = spec.calibrations.map(
        ({ name }) =>
          run.builds.find(
            (entry) =>
              entry.id === spec.id &&
              entry.test === `${spec.id} > calibration: ${name}`,
          )?.generated,
      )
      if (
        inputs.some((input) => !input) ||
        new Set(inputs.map((input) => JSON.stringify(input))).size < 2
      )
        return violation(
          `run`,
          `${spec.id} distinct named calibrations did not vary their full construction inputs`,
          `calibration`,
        )
    }
    const warningProbe = trace.find(
      ({ checkpoint, value }) =>
        checkpoint === `registration-warnings` &&
        (value as { id: string }).id === spec.id,
    )?.value as
      | {
          tests: {
            repeated: Array<string>
            collectThenRun: Array<string>
            collected: Array<string>
          }
          repeated: Array<string>
          collectThenRun: Array<string>
          collected: Array<string>
          manifests: {
            collectThenRun: Array<string> | false
            collected: Array<string> | false
          }
          loaded: {
            repeated: boolean
            collectThenRun: boolean
            collected: boolean
          }
        }
      | undefined
    if (warningProbe) {
      // Each ordinary registration owes the full model-derived test set.
      // Preserve suite scope and multiplicity: warning deduplication grants no
      // permission to drop the second property's tests or either forced control.
      const names = [...owed.tests.keys()]
      const phaseNames = (phases: Array<string>) =>
        phases
          .flatMap((phase) =>
            names.map((name) => `${phase} > ${spec.id} > ${name}`),
          )
          .sort()
      for (const [phase, expectedNames] of [
        [`repeated`, phaseNames([`first`, `second`])],
        [`collectThenRun`, phaseNames([`collect`, `ordinary`])],
        [`collected`, names.map((name) => `${spec.id} > ${name}`).sort()],
      ] as const) {
        if (
          JSON.stringify(warningProbe.tests[phase]) !==
          JSON.stringify(expectedNames)
        )
          return violation(
            `run`,
            `${spec.id} ${phase} omitted or duplicated registrations`,
            `registration`,
            { actual: warningProbe.tests[phase], expected: expectedNames },
          )
      }
      if (
        [
          warningProbe.manifests.collectThenRun,
          warningProbe.manifests.collected,
        ].some((ids) => JSON.stringify(ids) !== JSON.stringify([spec.id]))
      )
        return violation(
          `run`,
          `${spec.id} did not complete its collect-only registration in each phase`,
          `calibration`,
        )
      if (
        !warningProbe.loaded.repeated ||
        !warningProbe.loaded.collectThenRun ||
        !warningProbe.loaded.collected ||
        [
          warningProbe.repeated,
          warningProbe.collectThenRun,
          warningProbe.collected,
        ].some(
          (warnings) => unattributedWarnings(warnings, [spec.id]).length > 0,
        ) ||
        warningMismatch(spec, warningProbe.repeated, false) ||
        warningMismatch(spec, warningProbe.collectThenRun, false) ||
        warningMismatch(spec, warningProbe.collected, true)
      )
        return violation(
          `run`,
          `${spec.id} repeated or collect-only registration violated the one-warning boundary`,
          `calibration`,
        )
    }
    // The compatibility route must be visible before any selected test runs,
    // including automatic controls; bound calibrations must never warn search.
    const warnings = propertyWarnings(run.warnings, spec.id)
    if (warningMismatch(spec, run.warnings, false))
      return violation(
        `run`,
        `${spec.id} did not report unbound calibrations once per property: ${JSON.stringify(warnings)}`,
        `calibration`,
      )
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
    const firstRandom =
      spec.source.kind === `generated`
        ? randomUnit(unitNames(spec)[0]!)
        : undefined
    const loggedSeed = seen.tests.find(({ name }) => name === firstRandom)
      ?.seedLogs[0]
    for (const test of seen.tests) {
      const outcome = owed.tests.get(test.name)!
      const failure = test.failure
      if (
        spec.probeBinding &&
        spec.probeBinding !== `empty` &&
        forcedCalibrationNames(spec).includes(test.name)
      ) {
        const calls = ordinaryLog.filter(
          (entry) =>
            entry.id === spec.id && entry.test === `${spec.id} > ${test.name}`,
        )
        const expectedBinding = selectedControlBinding(
          spec,
          test.name === forcedCalibrationNames(spec)[0],
        )
        const expectedHistory = authoredInput(
          spec,
          test.name,
          expectedBinding,
          run.builds,
        )
        const expectedOrigin = authoredOrigin(spec, expectedBinding)
        if (
          calls.some(
            (entry) =>
              entry.origin !== expectedOrigin ||
              JSON.stringify(entry.history) !== JSON.stringify(expectedHistory),
          )
        )
          return violation(
            `run`,
            `${spec.id} forced control ran a different declared premise`,
            `calibration`,
          )
        const expectedCalls =
          outcome.kind === `calibration-clean` ||
          outcome.kind === `calibration-reach`
            ? 1
            : 2
        const expectedBuilds =
          `constructed` in expectedBinding ? expectedCalls : 0
        const builds = run.builds.filter(
          (entry) =>
            entry.id === spec.id && entry.test === `${spec.id} > ${test.name}`,
        )
        if (
          builds.length !== expectedBuilds ||
          (`constructed` in expectedBinding &&
            builds.some((entry) => entry.name !== expectedBinding.constructed))
        )
          return violation(
            `run`,
            `${spec.id} "${test.name}" used ${builds.length} construction builds; selected control owes ${expectedBuilds}`,
            `calibration`,
          )
        if (
          (spec.isolatedPlans || spec.identityHistories) &&
          run.resolutions.filter(
            (entry) =>
              entry.id === spec.id &&
              entry.test === `${spec.id} > ${test.name}`,
          ).length !== expectedCalls
        )
          return violation(
            `run`,
            `${spec.id} "${test.name}" did not resolve once per driver execution (owed ${expectedCalls})`,
            `calibration`,
          )
        if (
          calls.length !== expectedCalls ||
          calls.some(
            ({ history }) =>
              JSON.stringify(history) !== JSON.stringify(calls[0]!.history),
          )
        )
          return violation(
            `run`,
            `${spec.id} forced control did not run ${expectedCalls} equivalent selected histories`,
            `calibration`,
          )
      }
      const calibration = spec.calibrations.find(
        ({ name }) => test.name === `calibration: ${name}`,
      )
      const calibrationBinding = calibration && bindingOf(spec, calibration)
      if (calibrationBinding) {
        const calls = ordinaryLog.filter(
          (entry) =>
            entry.id === spec.id && entry.test === `${spec.id} > ${test.name}`,
        )
        const expectedCalls =
          driverCalibration(calibration.kind) &&
          outcome.kind !== `calibration-clean` &&
          outcome.kind !== `calibration-reach`
            ? 2
            : 1
        const expectedConstruction =
          `constructed` in calibrationBinding
            ? calibrationBinding.constructed
            : undefined
        const expectedBuilds =
          expectedConstruction === undefined ? 0 : expectedCalls
        const builds = run.builds.filter(
          (entry) =>
            entry.id === spec.id && entry.test === `${spec.id} > ${test.name}`,
        )
        if (
          builds.length !== expectedBuilds ||
          (expectedConstruction !== undefined &&
            builds.some((entry) => entry.name !== expectedConstruction))
        )
          return violation(
            `run`,
            `${spec.id} "${test.name}" used ${builds.length} construction builds; binding owes ${expectedBuilds}`,
            `calibration`,
          )
        if (
          (spec.isolatedPlans || spec.identityHistories) &&
          run.resolutions.filter(
            (entry) =>
              entry.id === spec.id &&
              entry.test === `${spec.id} > ${test.name}`,
          ).length !== expectedCalls
        )
          return violation(
            `run`,
            `${spec.id} "${test.name}" did not resolve once per driver execution (owed ${expectedCalls})`,
            `calibration`,
          )
        if (calls.length !== expectedCalls)
          return violation(
            `run`,
            `${spec.id} "${test.name}" used ${calls.length} driver calls; binding owes ${expectedCalls}`,
            `calibration`,
          )
        const binding = calibrationBinding
        const first = calls[0]!.history
        const fullInput = authoredInput(spec, test.name, binding, run.builds)
        if (
          fullInput &&
          calls.some(
            ({ history, origin }) =>
              origin !== authoredOrigin(spec, binding) ||
              JSON.stringify(history) !== JSON.stringify(fullInput),
          )
        )
          return violation(
            `run`,
            `${spec.id} selected calibration did not run its full authored input and origin`,
            `calibration`,
          )
        const selected =
          `fixed` in binding
            ? spec.fixed.find(({ name }) => name === binding.fixed)?.history
            : `enumerated` in binding && spec.source.kind === `enumerated`
              ? spec.source.histories.find((history, index) =>
                  typeof binding.enumerated === `number`
                    ? index === binding.enumerated
                    : authoredEnumerationLabel(spec, history) ===
                      binding.enumerated,
                )
              : undefined
        const prefix =
          `constructed` in binding
            ? spec.constructed.find(({ name }) => name === binding.constructed)!
                .prefix
            : undefined
        if (
          (selected && JSON.stringify(first) !== JSON.stringify(selected)) ||
          (prefix &&
            JSON.stringify(first.slice(0, prefix.length)) !==
              JSON.stringify(prefix)) ||
          calls.some(
            ({ history }) => JSON.stringify(history) !== JSON.stringify(first),
          )
        )
          return violation(
            `run`,
            `${spec.id} "${test.name}" did not run equivalent selected histories`,
            `calibration`,
          )
      }
      if (
        calibrationBinding &&
        test.state === `failed` &&
        ([`corrupt-throws`, `judge-throws`, `judge-driver-throws`].includes(
          calibration.kind,
        ) ||
          (spec.odd && dataOutcome(spec)))
      ) {
        const selectedKind =
          `constructed` in calibrationBinding
            ? `constructed`
            : `fixed` in calibrationBinding
              ? `fixed`
              : `enumerated`
        const invalidData = dataOutcome(spec)
        const expectedCause =
          calibration.kind === `corrupt-throws`
            ? `synthetic corruption failed`
            : [`judge-throws`, `judge-driver-throws`].includes(calibration.kind)
              ? `synthetic judgment failed`
              : undefined
        const causeMatches =
          expectedCause !== undefined
            ? failure?.causeMessage === expectedCause
            : invalidData?.kind === `data`
              ? failure?.causeMessage?.includes(invalidData.dataPath!) &&
                failure.causeMessage.includes(invalidData.dataKind!)
              : invalidData?.kind === `limit` &&
                failure?.causeMessage?.includes(
                  `the framework's encoding limit`,
                )
        if (
          !failure?.message?.includes(`calibration "${calibration.name}"`) ||
          !failure.message.includes(`${selectedKind} history:`) ||
          !causeMatches
        )
          return violation(
            `run`,
            `${spec.id} callback failure lost its calibration/history context or cause`,
            `calibration`,
          )
      }
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
          // A campaign that owes a failure and times out shrank too long.
          isCampaign(test.name) &&
            observedKind === `timeout` &&
            ![`pass`, `timeout`].includes(outcome.kind)
            ? `shrink budget`
            : lawOfKind(
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
      // A property selects its seed once, in its first random unit, and
      // logs that selection once; every random unit runs it.
      const owedSeedLogs = test.name === firstRandom ? 1 : 0
      if (test.seedLogs.length !== owedSeedLogs)
        return violation(
          `run`,
          `${spec.id} "${test.name}" logged ${test.seedLogs.length} ORACLE_SEED lines, owed ${owedSeedLogs}`,
          `seed-log`,
          { actual: test.seedLogs, expected: owedSeedLogs },
        )
      if (
        failure?.seed !== undefined &&
        unitOf(test.name) !== undefined &&
        unitOf(test.name)!.seed === undefined &&
        loggedSeed !== failure.seed
      )
        return violation(
          `run`,
          `${spec.id} "${test.name}" ran seed ${failure.seed}, but the property logged seed ${loggedSeed}`,
          `seed-log`,
          { actual: failure.seed, expected: loggedSeed },
        )
      // A failing unit prints its replay command; a failing fixed-seed unit
      // also prints its own `-t` pattern; a failing random unit's violation
      // prints the replay command as its rerun line.
      const unit = unitOf(test.name)
      if (unit && failure?.seed !== undefined) {
        if (failure.replay === undefined)
          return violation(
            `run`,
            `${spec.id} "${test.name}" failed with seed ${failure.seed} and printed no replay command`,
            `replay`,
          )
        if (unit.seed !== undefined && failure.rerun === undefined)
          return violation(
            `run`,
            `${spec.id} "${test.name}" failed and printed no \`-t\` rerun of itself`,
            `rerun`,
          )
        const owedLine =
          unit.seed === undefined ? failure.replay : failure.rerun
        if (
          failure.violationRerun !== undefined &&
          failure.violationRerun !== owedLine
        )
          return violation(
            `run`,
            `${spec.id} "${test.name}" printed the rerun line ${JSON.stringify(failure.violationRerun)} in its violation, owed ${JSON.stringify(owedLine)}`,
            unit.seed === undefined ? `replay` : `rerun`,
            { actual: failure.violationRerun, expected: owedLine },
          )
      }
      // A passing determinism unit ran its one history twice.
      const twice = owed.determinism.get(test.name)
      if (twice && test.state === `passed`) {
        const runs = run.log
          .filter(
            (entry) =>
              entry.id === spec.id &&
              entry.test === `${spec.id} > ${test.name}`,
          )
          .map((entry) => entry.history)
        if (JSON.stringify(runs) !== JSON.stringify([twice, twice]))
          return violation(
            `run`,
            `${spec.id} "${test.name}" ran ${JSON.stringify(runs)}, owed ${JSON.stringify(twice)} twice`,
            `determinism`,
            { actual: runs, expected: [twice, twice] },
          )
      }
      if (
        test.name === `determinism` &&
        test.state === `passed` &&
        owed.determinismRuns !== undefined
      ) {
        const runs = run.log.filter(
          ({ id, test: name }) =>
            id === spec.id && name === `${spec.id} > determinism`,
        ).length
        if (runs !== 2 * owed.determinismRuns)
          return violation(
            `run`,
            `${spec.id} determinism ran ${runs / 2} histories, owed ${owed.determinismRuns}`,
            `determinism`,
          )
      }
      // Without a timeout, a campaign shrinks without a budget.
      if (outcome.counterexample) {
        const shrunk =
          failure?.counterexample && counterexampleItems(failure.counterexample)
        if (JSON.stringify(shrunk) !== JSON.stringify(outcome.counterexample))
          return violation(
            `run`,
            `${spec.id} "${test.name}" (timeout ${spec.timeout}) reported counterexample ${failure?.counterexample ?? `none`}, owed the unbounded shrink ${JSON.stringify(outcome.counterexample)}`,
            `shrink budget`,
            { actual: shrunk, expected: outcome.counterexample },
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
    // Law `units`: each passing unit ran exactly the stream the model draws,
    // and a failing unit that stream up to its first failure. A slow spec's
    // driver runs on after its test timed out, so its log names other tests.
    if (!spec.slow)
      for (const [unit, stream] of owed.streams) {
        const { ran, owedRun } = comparedRun(
          spec,
          unit,
          stream,
          run.log
            .filter((entry) => entry.test === `${spec.id} > ${unit}`)
            .map((entry) => entry.history),
        )
        if (JSON.stringify(ran) !== JSON.stringify(owedRun))
          return violation(
            `run`,
            `${spec.id} "${unit}" ran ${JSON.stringify(ran)}, owed ${JSON.stringify(owedRun)}`,
            `units`,
            { actual: ran, expected: owedRun },
          )
      }
    if (
      (bindingsOf(spec).length ||
        (spec.probeBinding && spec.probeBinding !== `empty`)) &&
      run.stdout
        .split(`\n`)
        .some(
          (line) =>
            line.startsWith(`${spec.id}: calibration "`) &&
            line.includes(` on `),
        )
    )
      return violation(
        `run`,
        `${spec.id} printed a per-calibration selected-history announcement`,
        `calibration`,
      )
    for (const [campaign, counts] of owed.reach)
      // Reach is a dictionary of counts, not an ordered observation. Renaming
      // a state may reorder its printed keys without changing any count.
      if (
        JSON.stringify(Object.entries(seen.reach[campaign] ?? {}).sort()) !==
        JSON.stringify(Object.entries(counts).sort())
      )
        return violation(
          `run`,
          `${spec.id} "${campaign}" printed reach ${JSON.stringify(seen.reach[campaign] ?? null)}, owed ${JSON.stringify(counts)}`,
          `reach`,
          { actual: seen.reach[campaign], expected: counts },
        )
    // Only a test that passes in time prints reach: a merge of the units'
    // lines must not count a unit that failed or timed out.
    const unowed = Object.keys(seen.reach).filter(
      (test) => !owed.reach.has(test),
    )
    if (unowed.length > 0)
      return violation(
        `run`,
        `${spec.id} printed reach for ${JSON.stringify(unowed)}, which passed no test in time`,
        `reach`,
        { actual: unowed, expected: [] },
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
    for (const [owedRerun, unitTarget] of [
      [owed.rerun, false],
      [owed.unitRerun, true],
    ] as const)
      if (
        owedRerun &&
        !probes.some(
          ({ checkpoint, probe }) =>
            checkpoint === `rerun` &&
            probe.id === spec.id &&
            isCampaign(probe.target) === unitTarget,
        )
      )
        return violation(
          `rerun`,
          `${spec.id} "${owedRerun}" printed no rerun command`,
          `rerun`,
        )
  }
  // In a run without a seed, every history of a random unit runs under
  // `random seed`, and a loaded property runs at least one. A slow unit
  // times out, but its first history starts before it does. The property
  // logged one seed, and each random unit ran the stream of that seed.
  const seedless = trace.find(({ checkpoint }) => checkpoint === `seedless`)
    ?.value as SeedlessRun | undefined
  if (seedless)
    for (const spec of plan.specs) {
      const generated =
        expected.get(spec.id)!.loads && spec.source.kind === `generated`
      const owedRoutes = generated ? [`random seed`] : []
      const { routes, seeds, ran } = seedless[spec.id]!
      if (JSON.stringify(routes) !== JSON.stringify(owedRoutes))
        return violation(
          `seedless`,
          `${spec.id}: an ordinary run's random units ran under ${JSON.stringify(routes)}, owed ${JSON.stringify(owedRoutes)}`,
          `route`,
          { actual: routes, expected: owedRoutes },
        )
      if (seeds.length !== (generated ? 1 : 0))
        return violation(
          `seedless`,
          `${spec.id}: an ordinary run logged ${seeds.length} ORACLE_SEED lines, owed ${generated ? 1 : 0}`,
          `seed-log`,
          { actual: seeds, expected: generated ? 1 : 0 },
        )
      if (!generated || spec.slow) continue
      for (const unit of unitNames(spec).map(randomUnit)) {
        const { ran: logged, owedRun } = comparedRun(
          spec,
          unit,
          unitStream(spec, seeds[0]!, unitOf(unit)!.name),
          ran[unit] ?? [],
        )
        if (JSON.stringify(logged) !== JSON.stringify(owedRun))
          return violation(
            `seedless`,
            `${spec.id} "${unit}" ran ${JSON.stringify(logged)} in an ordinary run that logged seed ${seeds[0]}, owed ${JSON.stringify(owedRun)}`,
            `units`,
            { actual: logged, expected: owedRun },
          )
      }
    }
  // In a full run, every history's test starts, so the reach test runs
  // none of them again: it reuses what their tests recorded.
  for (const spec of plan.specs) {
    if (!expected.get(spec.id)!.loads || spec.slow) continue
    const reruns = run.log.filter(
      (entry) => entry.id === spec.id && entry.test === `${spec.id} > reach`,
    )
    if (reruns.length > 0)
      return violation(
        `run`,
        `${spec.id}: the reach test ran ${reruns.length} histories again in a full run, owed none`,
        `reach`,
        { actual: reruns.map(({ history }) => history), expected: [] },
      )
  }
  // A reach test run alone judges every history itself, and owes the same
  // outcome and counts as in the full run, except that a history it runs
  // that enters an undeclared state fails it.
  for (const spec of plan.specs) {
    const owed = expected.get(spec.id)!
    if (!spec.enumeratedStates || spec.slow || !owed.loads) continue
    const alone = trace.find(
      ({ checkpoint, value }) =>
        checkpoint === `reach-alone` && (value as ReachAlone).id === spec.id,
    )?.value as ReachAlone | undefined
    const outcome = reachAloneOutcome(spec, owed.tests.get(`reach`)!)
    const kind =
      alone?.state === `passed` ? `pass` : (alone?.failure?.kind ?? `other`)
    if (!alone || alone.others.length > 0 || kind !== outcome.kind)
      return violation(
        `reach-alone`,
        `${spec.id}: its reach test run alone ${alone ? `${alone.state} as ${JSON.stringify(alone.failure ?? null)}${alone.others.length ? `, beside ${JSON.stringify(alone.others)}` : ``}` : `never ran`}, owed ${JSON.stringify(outcome)}`,
        `reach`,
        { actual: alone ?? null, expected: outcome },
      )
    const counts = outcome.kind === `pass` && owed.reach.get(`enumerated`)
    if (
      counts &&
      JSON.stringify(
        Object.entries((alone.reach ?? {}) as Record<string, number>).sort(),
      ) !== JSON.stringify(Object.entries(counts).sort())
    )
      return violation(
        `reach-alone`,
        `${spec.id}: its reach test run alone printed ${JSON.stringify(alone.reach ?? null)}, owed ${JSON.stringify(counts)}`,
        `reach`,
        { actual: alone.reach, expected: counts },
      )
  }
  // Each late probe call surfaces as an unhandled error of the run.
  const late = run.unhandled.filter((message) =>
    message.includes(`was called after its history ended`),
  ).length
  const owedLate = lateCalls(plan, ordinaryLog)
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
    const probed = probe.probed
    if (checkpoint === `replay`) {
      const owedVariables = {
        [envName(`SEED`)]: String(probe.original.seed),
        [envName(`PATH`)]: probe.original.path,
        [envName(`PROPERTY`)]: probe.id,
        [envName(`UNIT`)]: probe.probed,
      }
      const printed = Object.fromEntries(
        Object.keys(owedVariables).map((key) => [key, probe.variables?.[key]]),
      )
      if (JSON.stringify(printed) !== JSON.stringify(owedVariables))
        return violation(
          `replay`,
          `${probe.id} "${probe.target}" printed replay variables ${JSON.stringify(probe.variables)}, owed ${JSON.stringify(owedVariables)}`,
          `replay`,
          { actual: printed, expected: owedVariables },
        )
    }
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
    if (checkpoint === `rerun`) {
      const prediction = expected.get(probe.id as SyntheticSpec[`id`])!
      if (!prediction.loads)
        return violation(
          checkpoint,
          `${probe.id}: rerun of a rejected declaration`,
          `registration`,
        )
      const ordinary = prediction.tests.get(probe.target)!
      const spec = plan.specs.find(({ id }) => id === probe.id)!
      const concrete =
        probe.failure.counterexampleHistory ??
        (probe.failure.counterexample
          ? counterexampleItems(probe.failure.counterexample)
          : undefined)
      const outcome =
        isCampaign(probe.target) && concrete
          ? campaignCandidateOutcome(spec, concrete, ordinary)
          : ordinary
      if (!matchesOutcome(outcome, probe.failure, probe.failure.kind, false))
        return violation(
          checkpoint,
          `${probe.id}: rerun lost its modeled diagnostic facts: ${JSON.stringify(probe.failure)}, owed ${JSON.stringify(outcome)}`,
          `rerun`,
          { actual: diagnosticFacts(probe.failure), expected: outcome },
        )
      continue
    }
    const spec = plan.specs.find(({ id }) => id === probe.id)!
    const prediction = expected.get(spec.id)!
    if (!prediction.loads)
      return violation(
        checkpoint,
        `${probe.id}: replay of a rejected declaration`,
        `registration`,
      )
    const receiving = children
      .map(({ value }) => value as ChildRun)
      .find(
        ({ context }) =>
          context.kind === `replay` &&
          context.id === probe.id &&
          context.target === probe.target,
      )
    const concreteInputs = receiving?.log
      .filter(
        ({ id, test }) =>
          id === spec.id && test === `${spec.id} > ${probe.probed}`,
      )
      .map(({ history }) => history)
    if (
      concreteInputs?.length !== 1 ||
      JSON.stringify(probe.ran) !== JSON.stringify(concreteInputs)
    )
      return violation(
        checkpoint,
        `${probe.id}: replay summary omitted or changed its one received concrete history`,
        `replay`,
      )
    const diagnostic = campaignCandidateOutcome(
      spec,
      concreteInputs[0]!,
      prediction.tests.get(probe.target)!,
    )
    if (!matchesOutcome(diagnostic, probe.failure, probe.failure.kind, false))
      return violation(
        checkpoint,
        `${probe.id}: replay summary lost its concrete candidate's diagnostic facts: ${JSON.stringify(probe.failure)}, owed ${JSON.stringify(diagnostic)}`,
        `replay`,
        { actual: diagnosticFacts(probe.failure), expected: diagnostic },
      )
    const replayRoute = owedRoute(probe.probed, true)
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
  return checkEnvironment(plan, trace, expected) ?? pass
}

// Law `replay-config`: under a malformed replay environment every file fails
// to load with its first error. Otherwise, in a path replay of the first
// spec's property, a generated source without `UNIT`, or with a `UNIT` that
// names none of its random units, fails to load, and so does an enumerated
// source with a `UNIT`; a `UNIT` that names a random unit runs only that
// unit, the history at path `0` of its stream at seed 5. Every other spec
// stands aside. Without a path, every spec loads as it does in the main run.
function checkEnvironment(
  plan: Plan,
  trace: ReadonlyArray<{ checkpoint: string; value: unknown }>,
  expected: ReturnType<typeof suiteModel>,
): ReturnType<typeof violation> | undefined {
  const under = trace.find(({ checkpoint }) => checkpoint === `environment`)
    ?.value as EnvironmentRun | undefined
  if (!plan.environment || !under) return undefined
  const name = (setting: string) => `${plan.prefix}_${setting}`
  const failed = (text: string) =>
    violation(`environment`, text, `replay-config`)
  const error = environmentError(plan)
  const drawn = plan.environment
  const replays = drawn.path === `valid` && error === undefined
  const unit = environmentOf(plan)[name(`UNIT`)]
  for (const [index, spec] of plan.specs.entries()) {
    const owed = expected.get(spec.id)!
    const seen = under.files[spec.id]!
    const selected = replays && index === 0 && !spec.unregistered
    // The text of the replay error the selected spec's registration owes.
    const replayError = !selected
      ? undefined
      : spec.source.kind === `enumerated`
        ? unit === undefined
          ? undefined
          : `${spec.id}: ${name(`UNIT`)} names "${unit}"`
        : unit === undefined
          ? `${spec.id}: ${name(`PATH`)} of a generated source requires ${name(`UNIT`)}`
          : unitNames(spec).map(randomUnit).includes(unit)
            ? undefined
            : `${spec.id}: ${name(`UNIT`)} names "${unit}"`
    const owedError =
      error ?? (owed.loads ? replayError : (owed.loadError ?? undefined))
    const owedLoads = error === undefined && owed.loads && !replayError
    if (seen.loaded !== owedLoads)
      return failed(
        `${spec.id} ${seen.loaded ? `loaded` : `failed to load with ${JSON.stringify(seen.loadErrors)}`} under ${JSON.stringify(environmentOf(plan))}, owed ${owedLoads ? `a load` : JSON.stringify(owedError ?? `a load error`)}`,
      )
    if (
      !seen.loaded &&
      owedError !== undefined &&
      !seen.loadErrors.some((message) => message.includes(owedError))
    )
      return failed(
        `${spec.id} failed to load with ${JSON.stringify(seen.loadErrors)} under ${JSON.stringify(environmentOf(plan))}, owed ${JSON.stringify(owedError)}`,
      )
    if (!seen.loaded || !replays) continue
    // A path replay: only the selected unit runs, if any.
    const running = seen.tests.filter((test) => test.state !== `skipped`)
    const owedRunning = selected && unit !== undefined ? [unit] : []
    if (
      JSON.stringify(running.map((test) => test.name)) !==
      JSON.stringify(owedRunning)
    )
      return failed(
        `${spec.id} ran ${JSON.stringify(running.map((test) => test.name))} in a path replay that selects ${JSON.stringify(unit ?? null)}, owed ${JSON.stringify(owedRunning)}`,
      )
    if (owedRunning.length === 0) continue
    const [history] = unitStream(spec, 5, unitOf(unit!)!.name)
    const ran = under.log
      .filter((entry) => entry.test === `${spec.id} > ${unit}`)
      .map((entry) => entry.history)
    if (!spec.slow && JSON.stringify(ran) !== JSON.stringify([history]))
      return failed(
        `${spec.id} "${unit}" ran ${JSON.stringify(ran)} at path 0, owed ${JSON.stringify([history])}`,
      )
    const owedKind =
      dataOutcome(spec)?.kind ??
      (spec.slow
        ? `timeout`
        : failsUnit(spec, unit!, history!)
          ? (() => {
              const verdict = judged(spec, history!)
              return verdict.kind === `pass`
                ? `constructed-reach`
                : verdict.kind
            })()
          : `pass`)
    const observed =
      running[0]!.state === `passed`
        ? `pass`
        : (running[0]!.failure?.kind ?? `other`)
    if (observed !== owedKind)
      return failed(
        `${spec.id} "${unit}" ${running[0]!.state} as ${JSON.stringify(running[0]!.failure ?? null)} at path 0, owed ${owedKind}`,
      )
  }
  return undefined
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
  constructedNames: `indexed`,
  fixedNames: `indexed`,
  secondSeed: false,
  arbitraryMap: `none`,
  mapAt: `history`,
  enumeratedStates: null,
  enumeratedShape: `ok`,
  throwingBuild: false,
  nondeterministic: false,
  reachVia: `reached`,
  timing: `normal`,
  timeoutMode: `default`,
  calibrations: [],
  calibrationHistory: null,
  isolatedPlans: false,
  identityHistories: false,
  probeName: `saw-0`,
  probeBinding: `unbound`,
  probeEntered: { constructed: `constructed-0` },
  probeNotEntered: { fixed: `fixed-0` },
  duplicateHistoryNames: false,
  unregistered: false,
  numberDifference: false,
  extraReach: false,
  calibrationNames: `indexed`,
  warningProbe: false,
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
) => ({
  name,
  enters,
  history: {
    drafts,
    seedless: false,
    prefix: `ORACLE` as Prefix,
    environment: null,
  },
})
const seedlessHistory = (
  name: string,
  enters: Array<(typeof frameworkStates)[number]>,
  ...drafts: Array<Draft>
) => ({
  name,
  enters,
  history: {
    drafts,
    seedless: true,
    prefix: `ORACLE` as Prefix,
    environment: null,
  },
})
// A suite under a custom environment prefix, a drawn replay environment, or both.
const suiteHistory = (
  name: string,
  enters: Array<(typeof frameworkStates)[number]>,
  { prefix = `ORACLE`, environment = null }: Partial<Omit<Suite, `drafts`>>,
  ...drafts: Array<Draft>
) => ({
  name,
  enters,
  history: { drafts, seedless: false, prefix, environment },
})
const replayOf = (
  environment: Partial<ReplayEnvironment>,
): ReplayEnvironment => ({
  retired: false,
  seed: `valid`,
  path: `valid`,
  property: `first`,
  unit: `named`,
  ...environment,
})
const at = (history: SyntheticHistory) => ({ history, enters: null })
const receivingCutStates = [
  `receiving-run`,
  `receiving-seedless`,
  `receiving-replay`,
  `receiving-rerun`,
  `receiving-reach-alone`,
  `receiving-binding-reordered`,
  `receiving-registration-warnings`,
  `receiving-environment`,
] as const
const receivingCutDrafts = (tail: 1 | 2 = 1): Array<Draft> => [
  generatedDraft({
    fixed: [at([3, 6])],
    constructed: [
      { prefix: [0, tail], enters: [`saw-0`] },
      { prefix: [3, 6], enters: [] },
    ],
    calibrationHistory: { constructed: `constructed-0` },
    calibrations: [
      `right`,
      { kind: `driver`, difference: `none`, history: null },
      { kind: `right`, difference: `none`, history: null },
    ],
    isolatedPlans: true,
    warningProbe: true,
  }),
  generatedDraft({
    source: { kind: `enumerated`, histories: [[0], [tail]] },
    enumeratedStates: [`measured`, `measured`, `measured`],
    calibrations: [`right`, `driver`],
  }),
]
const campaignBudgetSuite = (
  runs: 2 | 3 = 2,
  constructions: 0 | 1 | 2 = 1,
  tail: 1 | 2 = 1,
): Suite => ({
  seedless: true,
  seedlessDraw: cleanHostDraw,
  drafts: [
    generatedDraft({
      source: { kind: `generated`, runs, seed: 7 },
      constructed: [
        { prefix: [0, tail, 1], enters: [`saw-0`] },
        { prefix: [tail, 0, tail], enters: [`saw-0`] },
      ].slice(0, constructions),
    }),
    generatedDraft({
      constructed: [{ prefix: [3, 6], enters: [] }],
    }),
  ],
})
const warningRepresentationSuite = (): Suite => ({
  drafts: [
    generatedDraft({
      source: { kind: `enumerated`, histories: [[0], [1]] },
      calibrations: [`right`, `driver`],
    }),
  ],
  seedless: false,
  permuteWarnings: true,
})
const cal = (
  kind: CalibrationDraft[`kind`],
  difference: CalibrationDraft[`difference`] = `none`,
  history?: CalibrationDraft[`history`],
): CalibrationDraft => ({
  kind,
  difference,
  ...(history === undefined ? {} : { history }),
})

// One wrapper dimension crosses all three public selection receivers. Its
// metadata must never execute, regardless of the selected clean polarity.
const metadataDraft = (
  buildMetadata: `own` | `inherited` | undefined,
  tail = 1,
  receiver:
    `all` | `authored` | `forced-entered` | `forced-not-entered` = `all`,
) =>
  generatedDraft({
    fixed: [
      {
        history: [0, tail],
        enters: null,
        ...(buildMetadata && receiver !== `forced-entered`
          ? { buildMetadata }
          : {}),
      },
      {
        history: [tail],
        enters: null,
        ...(buildMetadata &&
        (receiver === `all` || receiver === `forced-entered`)
          ? { buildMetadata }
          : {}),
      },
    ],
    calibrationHistory: { fixed: `fixed-0` },
    calibrations:
      receiver === `all` || receiver === `authored` ? [`driver`] : [],
    constructed: [{ prefix: [0], enters: [`saw-0`] }],
    probe: receiver === `authored` ? `none` : `agree`,
    probeBinding: receiver === `authored` ? `unbound` : `explicit`,
    probeEntered: { fixed: `fixed-0` },
    probeNotEntered: { fixed: `fixed-1` },
    identityHistories: true,
  })
const mixedBindingsDraft = (second: `fixed` | `constructed`) =>
  generatedDraft({
    fixed: [at([0]), at([1])],
    constructed: [{ prefix: [0], enters: [`saw-0`] }],
    // The last calibration explicitly opts out of this property default.
    calibrationHistory: { fixed: `fixed-1` },
    calibrations: [
      cal(`driver`, `none`, { fixed: `fixed-0` }),
      cal(
        `driver`,
        `none`,
        second === `fixed`
          ? { fixed: `fixed-1` }
          : { constructed: `constructed-0` },
      ),
      cal(`driver`, `none`, null),
    ],
    isolatedPlans: true,
  })
const spinDraft = (
  kind: `driver-spin` | `driver-spin-throws`,
  bound: boolean,
  tail = 1,
) =>
  generatedDraft({
    fixed: [at([0, tail])],
    calibrations: [
      cal(kind, `text match`, bound ? { fixed: `fixed-0` } : null),
    ],
    identityHistories: true,
  })

// Add to histories.states with ...mainUnitRequiredStates, remove these names
// from histories.measured, and append ...mainUnitRequiredConstructed to the
// existing histories.constructed. Keep every branch required state/builder.
const mainUnitRequiredStates = [
  `unit-split-verdict`,
  `unit-name-load-error`,
  `second-fixed-seed`,
  `unit-replay-constructed`,
  `unit-replay-generated`,
  `unit-replay-custom-prefix`,
  `unit-rerun`,
  `unit-rerun-beside-extension`,
  `seedless-units-drawn`,
  `replay-environment-error`,
  `unit-requires-property`,
] as const
const mainUnitPositiveStates = [
  `unit-split-verdict`,
  `second-fixed-seed`,
  `unit-replay-constructed`,
  `unit-replay-generated`,
  `unit-replay-custom-prefix`,
  `unit-rerun`,
  `unit-rerun-beside-extension`,
] as const
const unitWitnessSuite = (
  drafts: Array<Draft>,
  options: Partial<Omit<Suite, `drafts`>> = {},
): Suite => ({
  drafts,
  seedless: false,
  prefix: `ORACLE`,
  environment: null,
  ...options,
})
const mainUnitRequiredConstructed: Array<{
  name: string
  enters: ReadonlyArray<(typeof mainUnitRequiredStates)[number]>
  build: (generated: Suite) => Suite
}> = [
  {
    name: `generated UNIT split, named rerun, and custom-prefix replay`,
    enters: mainUnitPositiveStates,
    build: (generated) => {
      const tail = generated.drafts[0]!.clock ? 1 : 2
      return unitWitnessSuite(
        [
          generatedDraft({
            source: { kind: `generated`, runs: 2, seed: 5 },
            secondSeed: true,
            constructedNames: `prefixed`,
            constructed: [
              { prefix: [3, tail], enters: [] },
              { prefix: [0, tail, tail], enters: [`saw-0`] },
            ],
          }),
        ],
        { prefix: `SYNTH_ORACLE` },
      )
    },
  },
  {
    name: `generated UNIT history-name gate`,
    enters: [`unit-name-load-error`],
    build: (generated) => {
      const tail = generated.drafts[0]!.clock ? 1 : 2
      const naming = generated.drafts[0]!.constructedNames
      return unitWitnessSuite([
        generatedDraft(
          naming === `indexed`
            ? {
                constructedNames: `generated`,
                constructed: [{ prefix: [0, tail], enters: [`saw-0`] }],
              }
            : naming === `prefixed`
              ? {
                  constructedNames: `duplicate`,
                  constructed: [
                    { prefix: [0, tail], enters: [`saw-0`] },
                    { prefix: [1, tail], enters: [`saw-1`] },
                  ],
                }
              : {
                  fixedNames: `duplicate`,
                  fixed: [at([0, tail]), at([1, tail])],
                },
        ),
      ])
    },
  },
  {
    name: `generated UNITs share their drawn property seed`,
    enters: [`seedless-units-drawn`],
    build: (generated) => {
      const tail = generated.drafts[0]!.clock ? 1 : 2
      return unitWitnessSuite(
        [
          generatedDraft({
            constructed: [
              { prefix: [0, tail, tail], enters: [`saw-0`] },
              { prefix: [1, tail, tail], enters: [`saw-1`] },
            ],
          }),
        ],
        {
          seedless: true,
          seedlessDraw: generated.drafts[0]!.clock ? 0.5 : cleanHostDraw,
        },
      )
    },
  },
  {
    name: `generated UNIT requires its replay property`,
    enters: [`replay-environment-error`, `unit-requires-property`],
    build: (generated) => {
      const tail = generated.drafts[0]!.clock ? 1 : 2
      return unitWitnessSuite(
        [
          generatedDraft({
            constructed: [{ prefix: [0, tail, tail], enters: [`saw-0`] }],
          }),
        ],
        {
          prefix: generated.drafts[0]!.clock ? `ORACLE` : `SYNTH_ORACLE`,
          environment: replayOf({
            seed: generated.drafts[0]!.clock ? `valid` : `absent`,
            path: `absent`,
            property: `absent`,
          }),
        },
      )
    },
  },
]

oracleProperty({
  id: `self-oracle.framework`,
  law: {
    statement: `oracleProperty registers, fails, shrinks, replays, reruns, calibrates, times out, and checks determinism, membership, and reach as its contract states.`,
    authority: `packages/oracles/src/oracle-property.ts header; maintainer decisions of 2026-11-03; oracle rubric ORC-006, ORC-007, ORC-015`,
    limits: `Synthetic properties with histories of one to three integers, one or two per run; real Vitest child processes; one rerun probe per property.`,
  },
  histories: {
    arbitrary: suite,
    states: [
      ...mainUnitRequiredStates,
      ...round3FrameworkStates,
      `auxiliary-late-error`,
      `bound-enumerated-label-selector`,
      `bound-control-fixed-entered`,
      `bound-control-constructed-absent`,
      `bound-control-inferred-name-gate`,
      `bound-control-inferred-ambiguous`,
      `bound-control-inferred-zero`,
      `bound-control-explicit-name-gate`,
      `bound-equal-fixed-origin`,
      `bound-ranked-mutants`,
      `bound-independent-premise`,
      `bound-name-seed`,
      `bound-extra-state`,
      `bound-error-context`,
      `bound-null-selector`,
      `registration-warning-policy`,
      `bound-difference`,
      `bound-fixed-identity`,
      `bound-enumerated-identity`,
      `bound-combined-controls`,
      `unbound-prototype-probe`,
      `bound-control-full-reach`,
      `bound-calibration`,
      `bound-calibration-registration-error`,
      `bound-constructed-driver`,
    ],
    measured: frameworkStates.filter(
      (state) =>
        state !== `auxiliary-late-error` &&
        !mainUnitRequiredStates.some((required) => required === state) &&
        !round3FrameworkStates.some((required) => required === state) &&
        !state.startsWith(`bound-`) &&
        state !== `unbound-prototype-probe` &&
        state !== `registration-warning-policy`,
    ),
    runs: 3,
    fixedSeeds: [1],
    constructed: [
      ...mainUnitRequiredConstructed,
      ...([0, 2] as const).map((entering) => ({
        name: `inferred control with ${entering} distinct entering constructions`,
        enters: [
          entering === 0
            ? (`bound-control-inferred-zero` as const)
            : (`bound-control-inferred-ambiguous` as const),
        ],
        build: (generated: Suite) => ({
          ...generated,
          drafts: [
            generatedDraft({
              fixed: [at([1])],
              constructed: [
                { prefix: [0], enters: entering === 2 ? [`saw-0`] : [] },
                {
                  prefix: [0, generated.drafts[0]!.clock ? 1 : 2],
                  enters: entering === 2 ? [`saw-0`] : [],
                },
              ],
              probe: `agree`,
              probeBinding: `inferred`,
            }),
          ],
        }),
      })),
      {
        name: `fixture preserves outer host RNG`,
        enters: [
          `host-rng-scope`,
          `receiving-host-scope`,
          `host-rng-forwarding`,
        ],
        build: (generated: Suite) => ({
          ...generated,
          hostRngDraw: generated.drafts[0]!.clock
            ? (0.25 as const)
            : (0.75 as const),
          hostRngForwarding: `alternate` as const,
          drafts: [generatedDraft({})],
        }),
      },
      {
        name: `round3 every actual receiving cut`,
        enters: [
          ...receivingCutStates,
          `warning-order-equivalence`,
          ...warningReceivingKinds.map(
            (kind) => `warning-receiving-${kind}` as const,
          ),
        ],
        build: (generated: Suite) => ({
          ...generated,
          seedless: true,
          permuteWarnings: true,
          prefix: generated.drafts[0]!.clock
            ? (`ORACLE` as const)
            : (`SYNTH_ORACLE` as const),
          environment: replayOf({
            path: `absent`,
            property: `absent`,
            unit: `absent`,
          }),
          drafts: receivingCutDrafts(generated.drafts[0]!.clock ? 1 : 2),
        }),
      },
      {
        name: `round4 successful campaign budgets and failing neighbor`,
        enters: [
          ...passingUnitStates,
          ...passingBudgetLanes.map(
            ({ context, lane }) => `passing-budget-${context}-${lane}` as const,
          ),
          `passing-budget-constructed`,
          `campaign-budget-failure-neighbor`,
        ],
        build: (generated: Suite) =>
          campaignBudgetSuite(
            2,
            generated.drafts[0]!.clock ? 1 : 2,
            generated.drafts[0]!.isolatedPlans ? 1 : 2,
          ),
      },
      {
        name: `round3 replayed clock failure retains driver cause`,
        enters: [`receiving-replay`],
        build: (generated: Suite) => ({
          ...generated,
          drafts: [
            generatedDraft({
              clock: true,
              throwOnSpin: true,
              constructed: [{ prefix: [7], enters: [] }],
            }),
          ],
        }),
      },
      {
        name: `round3 named reach counts permit key reorder`,
        enters: [`enumerated-reach-key-order-neighbor`],
        build: (generated: Suite) => ({
          ...generated,
          drafts: [
            generatedDraft({
              source: { kind: `enumerated`, histories: [[0], [0, 1], [2]] },
              enumeratedStates: generated.drafts[0]!.clock
                ? [`measured`, `measured`, `required`]
                : [`measured`, `required`, `measured`],
            }),
          ],
        }),
      },
      ...([`own`, `inherited`] as const).flatMap((buildMetadata) =>
        ([`authored`, `forced-entered`, `forced-not-entered`] as const).map(
          (receiver) => ({
            name: `round3 ${buildMetadata} fixed metadata ${receiver}`,
            enters: [`bound-fixed-${buildMetadata}-metadata-${receiver}`],
            build: (generated: Suite) => ({
              ...generated,
              drafts: [
                metadataDraft(
                  buildMetadata,
                  generated.drafts[0]!.clock ? 1 : 2,
                  receiver,
                ),
              ],
            }),
          }),
        ),
      ),
      {
        name: `round3 independently selected authored calibrations`,
        enters: [
          `bound-authored-distinct-selectors`,
          `bound-authored-search-neighbor`,
        ],
        build: (generated: Suite) => ({
          ...generated,
          drafts: [
            mixedBindingsDraft(
              generated.drafts[0]!.clock ? `fixed` : `constructed`,
            ),
          ],
        }),
      },
      {
        name: `round3 recorded violation before mutant clock spin`,
        enters: [
          `bound-mutant-violation-before-spin`,
          `legacy-mutant-violation-before-spin`,
        ],
        build: (generated: Suite) => {
          const kind = generated.drafts[0]!.clock
            ? `driver-spin`
            : `driver-spin-throws`
          return {
            ...generated,
            drafts: [spinDraft(kind, true), spinDraft(kind, false)],
          }
        },
      },
      {
        name: `review auxiliary late errors`,
        enters: [`auxiliary-late-error`],
        build: (generated: Suite) => ({
          ...generated,
          drafts: [
            generatedDraft({
              probe: `late`,
              clock: true,
              strictModel: true,
              constructed: [{ prefix: [7, 0], enters: [] }],
            }),
          ],
        }),
      },
      {
        name: `review enumerated selector labels`,
        enters: [`bound-enumerated-label-selector`],
        build: (generated: Suite) => ({
          ...generated,
          drafts: [
            generatedDraft({
              source: { kind: `enumerated`, histories: [[0, 1]] },
              labelStyle: generated.drafts[0]!.clock ? `shell` : `default`,
              calibrationHistory: {
                enumerated: generated.drafts[0]!.clock
                  ? `items 0 | 1 ${shellText}`
                  : `[0,1]`,
              },
              calibrations: [`right`],
            }),
          ],
        }),
      },
      {
        name: `round3 rejected named enumeration selector`,
        enters: [`bound-enumerated-label-rejected`],
        build: (generated: Suite) => ({
          ...generated,
          drafts: [
            generatedDraft({
              source: { kind: `enumerated`, histories: [[0, 1]] },
              labelStyle: generated.drafts[0]!.clock ? `shell` : `default`,
              calibrationHistory: { enumerated: `items 0 | 1` },
              calibrations: [`right`],
            }),
          ],
        }),
      },
      {
        name: `review fixed entered control`,
        enters: [`bound-control-fixed-entered`],
        build: (generated: Suite) => ({
          ...generated,
          drafts: [
            generatedDraft({
              fixed: [at([1]), at([0, generated.drafts[0]!.clock ? 1 : 2])],
              constructed: [{ prefix: [0], enters: [`saw-0`] }],
              probe: `agree`,
              probeBinding: `explicit`,
              probeEntered: { fixed: `fixed-1` },
              identityHistories: true,
            }),
          ],
        }),
      },
      {
        name: `review constructed absent control`,
        enters: [`bound-control-constructed-absent`],
        build: (generated: Suite) => ({
          ...generated,
          drafts: [
            generatedDraft({
              fixed: [at([1])],
              constructed: [
                { prefix: [0], enters: [`saw-0`] },
                {
                  prefix: [1, generated.drafts[0]!.clock ? 1 : 2, 2],
                  enters: [],
                },
              ],
              probe: `agree`,
              probeBinding: generated.drafts[0]!.clock
                ? `explicit`
                : `inferred`,
              probeNotEntered: { constructed: `constructed-1` },
              isolatedPlans: true,
            }),
          ],
        }),
      },
      ...([`inferred`, `explicit`] as const).map((probeBinding) => ({
        name: `review ${probeBinding} ambiguous control`,
        enters: [`bound-control-${probeBinding}-name-gate` as const],
        build: (generated: Suite) => ({
          ...generated,
          drafts: [
            generatedDraft({
              fixed: [at([1])],
              constructed: [
                { prefix: [0], enters: [`saw-0`] },
                { prefix: [generated.drafts[0]!.clock ? 1 : 2], enters: [] },
              ],
              probe: `agree`,
              probeBinding,
              duplicateHistoryNames: true,
              calibrationHistory: { fixed: `fixed-0` },
            }),
          ],
        }),
      })),
      {
        name: `review equal fixed originals`,
        enters: [`bound-equal-fixed-origin`],
        build: (generated: Suite) => {
          const history = [0, generated.drafts[0]!.clock ? 1 : 2]
          return {
            ...generated,
            drafts: [
              generatedDraft({
                fixed: [at([...history]), at([...history])],
                calibrationHistory: { fixed: `fixed-1` },
                calibrations: [`driver`],
                identityHistories: true,
              }),
            ],
          }
        },
      },
      {
        name: `round2 ranked mutant verdicts`,
        enters: [`bound-ranked-mutants`],
        build: (generated: Suite) => ({
          ...generated,
          drafts: [
            generatedDraft({
              fixed: [at([0])],
              calibrationHistory: { fixed: `fixed-0` },
              calibrations: [generated.drafts[0]!.clock ? `clock` : `throws`],
            }),
          ],
        }),
      },
      {
        name: `round2 independent forced premises`,
        enters: [`bound-independent-premise`],
        build: (generated: Suite) => ({
          ...generated,
          drafts: [
            generatedDraft({
              fixed: [at([1]), at([0])],
              constructed: [
                { prefix: [0], enters: [`saw-0`] },
                { prefix: [0, 2], enters: [`saw-0`] },
              ],
              probe: `agree`,
              probeBinding: `explicit`,
              isolatedPlans: true,
            }),
          ],
        }),
      },
      {
        name: `round2 named seed variation`,
        enters: [`bound-name-seed`],
        build: (generated: Suite) => ({
          ...generated,
          drafts: [
            generatedDraft({
              constructed: [{ prefix: [0], enters: [`saw-0`] }],
              calibrationHistory: { constructed: `constructed-0` },
              calibrations: [`right`],
              calibrationNames: generated.drafts[0]!.clock
                ? `astral`
                : `varied`,
              isolatedPlans: true,
            }),
          ],
        }),
      },
      {
        name: `round2 declared clean reach`,
        enters: [`bound-extra-state`],
        build: (generated: Suite) => ({
          ...generated,
          drafts: [
            generatedDraft({
              fixed: [at([0])],
              calibrationHistory: { fixed: `fixed-0` },
              calibrations: [`right`],
              extraReach: `calibration`,
            }),
          ],
        }),
      },
      {
        name: `round2 contextual callback errors`,
        enters: [`bound-error-context`],
        build: (generated: Suite) => ({
          ...generated,
          drafts: [
            generatedDraft({
              fixed: [at([0])],
              calibrationHistory: { fixed: `fixed-0` },
              calibrations: [
                generated.drafts[0]!.clock
                  ? `judge-driver-throws`
                  : `corrupt-throws`,
              ],
            }),
          ],
        }),
      },
      {
        name: `round2 invalid explicit probe selectors`,
        enters: [`bound-null-selector`],
        build: (generated: Suite) => ({
          ...generated,
          drafts: [
            generatedDraft({
              fixed: [at([1])],
              constructed: [{ prefix: [0], enters: [`saw-0`] }],
              probe: `agree`,
              probeBinding: generated.drafts[0]!.clock
                ? `null-entered`
                : `null-binding`,
            }),
          ],
        }),
      },
      {
        name: `round2 registration warning phases`,
        enters: [
          `registration-warning-policy`,
          `bound-registration-warning-silence`,
        ],
        build: (generated: Suite) => ({
          ...generated,
          drafts: [
            generatedDraft({
              fixed: [at([1])],
              constructed: [{ prefix: [0], enters: [`saw-0`] }],
              probe: `agree`,
              warningProbe: true,
              calibrations: [`right`, `driver`],
            }),
            generatedDraft({
              fixed: [at([0, generated.drafts[0]!.clock ? 1 : 2])],
              calibrationHistory: { fixed: `fixed-0` },
              warningProbe: true,
              calibrations: [`right`, `driver`],
            }),
          ],
        }),
      },
      {
        name: `round2 selected difference criterion`,
        enters: [`bound-difference`],
        build: (generated: Suite) => ({
          ...generated,
          drafts: [
            generatedDraft({
              fixed: [at([0]), at([1, 1, 0])],
              calibrationHistory: { fixed: `fixed-0` },
              calibrations: [
                cal(
                  `driver-last`,
                  generated.drafts[0]!.clock ? `later pattern` : `later text`,
                ),
              ],
            }),
          ],
        }),
      },
      ...([`fixed`, `enumerated`] as const).map((source) => ({
        name: `selected ${source} preserves identity`,
        enters: [
          source === `fixed`
            ? `bound-fixed-identity`
            : `bound-enumerated-identity`,
        ] as const,
        build: (generated: Suite) => {
          const varied = generated.drafts[0]!
          const history = [
            0,
            varied.source.kind === `generated` ? varied.source.seed % 3 : 1,
          ]
          return {
            ...generated,
            drafts: [
              generatedDraft({
                ...(source === `fixed`
                  ? {
                      fixed: [at(history)],
                      calibrationHistory: { fixed: `fixed-0` },
                    }
                  : {
                      source: { kind: `enumerated`, histories: [history] },
                      calibrationHistory: { enumerated: 0 },
                    }),
                form: source === `fixed` && varied.clock ? `boxed` : `plain`,
                identityHistories: true,
                isolatedPlans: varied.isolatedPlans,
                calibrations: [varied.clock ? `driver` : `right`],
              }),
            ],
          }
        },
      })),
      {
        name: `authored bindings coexist with automatic controls`,
        enters: [`bound-combined-controls`],
        build: (generated) => ({
          ...generated,
          drafts: [
            generatedDraft({
              fixed: [at([1])],
              constructed: [{ prefix: [0], enters: [`saw-0`] }],
              calibrationHistory: { constructed: `constructed-0` },
              calibrations: [generated.drafts[0]!.clock ? `right` : `driver`],
              isolatedPlans: generated.drafts[0]!.isolatedPlans,
              probe: `agree`,
              probeName: generated.drafts[0]!.probeName,
              probeBinding: generated.drafts[0]!.clock
                ? `inferred`
                : `explicit`,
            }),
          ],
        }),
      },
      {
        name: `empty tables leave arbitrary probe names unbound`,
        enters: [`unbound-prototype-probe`],
        build: (generated) => ({
          ...generated,
          drafts: [
            generatedDraft({
              fixed: [at([1])],
              constructed: [{ prefix: [0], enters: [`saw-0`] }],
              probe: `agree`,
              probeBinding: `empty`,
              probeName:
                generated.drafts[0]!.probeName === `saw-0`
                  ? `constructor`
                  : generated.drafts[0]!.probeName,
            }),
          ],
        }),
      },
      {
        name: `automatic controls require all selected states`,
        enters: [`bound-control-full-reach`],
        build: (generated) => ({
          ...generated,
          drafts: [
            generatedDraft({
              fixed: [
                {
                  history: [1],
                  enters: generated.drafts[0]!.clock ? [`saw-2`] : null,
                },
              ],
              constructed: [
                {
                  prefix: [0, 0, 0],
                  enters: generated.drafts[0]!.clock
                    ? [`saw-0`]
                    : [`saw-0`, `saw-1`],
                },
              ],
              probe: `agree`,
              probeBinding: generated.drafts[0]!.isolatedPlans
                ? `explicit`
                : `inferred`,
            }),
          ],
        }),
      },
      {
        name: `bound constructed drivers rebuild seeded plans`,
        enters: [`bound-constructed-driver`],
        build: (generated) => ({
          ...generated,
          drafts: [
            generatedDraft({
              fixed: [at([6])],
              constructed: [{ prefix: [0], enters: [`saw-0`] }],
              isolatedPlans: true,
              calibrations: [`driver`],
              calibrationHistory: { constructed: `constructed-0` },
            }),
          ],
        }),
      },
      {
        name: `bound calibrations bypass unrelated histories`,
        enters: [`bound-calibration`],
        build: (generated) => ({
          ...generated,
          drafts: [
            generatedDraft({
              // The decoy fails if scanned. The selected construction keeps a
              // generated tail; builder identity and fresh resolution are checked.
              fixed: [at([6])],
              constructed: [{ prefix: [0], enters: [`saw-0`] }],
              isolatedPlans: true,
              calibrations: [generated.drafts[0]!.clock ? `driver` : `right`],
              calibrationHistory: { constructed: `constructed-0` },
            }),
          ],
        }),
      },
      {
        name: `invalid bindings fail before execution`,
        enters: [`bound-calibration-registration-error`],
        build: (generated) => ({
          ...generated,
          drafts: [
            generatedDraft({
              fixed: [at([0])],
              calibrations: [`right`],
              calibrationHistory: { fixed: `unknown` },
            }),
          ],
        }),
      },
      {
        name: `bound forced controls retain both clean premises`,
        enters: [`bound-calibration`],
        build: (generated) => ({
          ...generated,
          drafts: [
            generatedDraft({
              fixed: [at([1])],
              constructed: [{ prefix: [0], enters: [`saw-0`] }],
              isolatedPlans: true,
              probe: `agree`,
              probeBinding: generated.drafts[0]!.clock
                ? `inferred`
                : `explicit`,
            }),
          ],
        }),
      },
    ],
    fixed: [
      {
        name: `custom prefix preserves every receiving cut`,
        enters: [
          ...receivingCutStates,
          ...warningReceivingKinds.map(
            (kind) => `warning-receiving-${kind}` as const,
          ),
        ],
        history: {
          drafts: receivingCutDrafts(),
          seedless: true,
          permuteWarnings: true,
          prefix: `SYNTH_ORACLE` as const,
          environment: replayOf({
            path: `absent`,
            property: `absent`,
            unit: `absent`,
          }),
        },
      },
      ...([0, 2] as const).map((entering) =>
        fixedHistory(
          `inferred control with ${entering} distinct entering constructions`,
          [
            entering === 0
              ? `bound-control-inferred-zero`
              : `bound-control-inferred-ambiguous`,
          ],
          generatedDraft({
            fixed: [at([1])],
            constructed: [
              { prefix: [0], enters: entering === 2 ? [`saw-0`] : [] },
              { prefix: [0, 1], enters: entering === 2 ? [`saw-0`] : [] },
            ],
            probe: `agree`,
            probeBinding: `inferred`,
          }),
        ),
      ),
      ...([0.25, 0.75] as const).map((hostRngDraw) => ({
        name: `fixture preserves outer host RNG ${hostRngDraw}`,
        enters: [`host-rng-scope` as const, `receiving-host-scope` as const],
        history: { drafts: [generatedDraft({})], seedless: false, hostRngDraw },
      })),
      ...([1, 2, `alternate`] as const).map((hostRngForwarding) => ({
        name: `fixture preserves forwarded outer host RNG ${hostRngForwarding}`,
        enters: [
          `host-rng-scope` as const,
          `receiving-host-scope` as const,
          `host-rng-forwarding` as const,
        ],
        history: {
          drafts: [generatedDraft({})],
          seedless: false,
          hostRngDraw: 0.25 as const,
          hostRngForwarding,
        },
      })),
      {
        name: `round3 every actual receiving cut`,
        enters: [
          ...receivingCutStates,
          `warning-order-equivalence`,
          ...warningReceivingKinds.map(
            (kind) => `warning-receiving-${kind}` as const,
          ),
        ],
        history: {
          drafts: receivingCutDrafts(),
          seedless: true,
          permuteWarnings: true,
          environment: replayOf({
            path: `absent`,
            property: `absent`,
            unit: `absent`,
          }),
        },
      },
      {
        name: `round5 warning-order equivalence`,
        enters: [`warning-order-equivalence`],
        history: warningRepresentationSuite(),
      },
      {
        name: `round4 successful campaign budgets and failing neighbor`,
        enters: [
          ...passingUnitStates,
          ...passingBudgetLanes.map(
            ({ context, lane }) => `passing-budget-${context}-${lane}` as const,
          ),
          `passing-budget-constructed`,
          `campaign-budget-failure-neighbor`,
        ],
        history: campaignBudgetSuite(),
      },
      {
        name: `round4 successful campaign budget without constructions`,
        enters: passingBudgetLanes.map(
          ({ context, lane }) => `passing-budget-${context}-${lane}` as const,
        ),
        history: campaignBudgetSuite(2, 0),
      },
      {
        name: `round4 larger successful fixed and seedless budgets`,
        enters: [
          `passing-budget-run-fixed`,
          `passing-budget-seedless-fixed`,
          `passing-budget-seedless-random`,
        ],
        history: campaignBudgetSuite(3, 2),
      },
      fixedHistory(
        `round3 replayed clock failure retains driver cause`,
        [`receiving-replay`],
        generatedDraft({
          clock: true,
          throwOnSpin: true,
          constructed: [{ prefix: [7], enters: [] }],
        }),
      ),
      fixedHistory(
        `round3 named reach count key order neighbor`,
        [`enumerated-reach-key-order-neighbor`],
        generatedDraft({
          source: { kind: `enumerated`, histories: [[0], [0, 1], [2]] },
          enumeratedStates: [`measured`, `measured`, `required`],
        }),
      ),
      fixedHistory(
        `round3 fully bound warning phases stay silent`,
        [`bound-registration-warning-silence`],
        generatedDraft({
          fixed: [at([0])],
          calibrationHistory: { fixed: `fixed-0` },
          warningProbe: true,
          calibrations: [`right`, `driver`],
        }),
      ),
      fixedHistory(
        `round3 plain fixed declaration metadata neighbor`,
        [],
        metadataDraft(undefined),
      ),
      ...([`own`, `inherited`] as const).flatMap((buildMetadata) =>
        ([`authored`, `forced-entered`, `forced-not-entered`] as const).map(
          (receiver) =>
            fixedHistory(
              `round3 ${buildMetadata} fixed metadata ${receiver} receiver`,
              [`bound-fixed-${buildMetadata}-metadata-${receiver}`],
              metadataDraft(buildMetadata, 1, receiver),
            ),
        ),
      ),
      ...([`fixed`, `constructed`] as const).map((second) =>
        fixedHistory(
          `round3 distinct ${second} and unbound authored selectors`,
          [
            `bound-authored-distinct-selectors`,
            `bound-authored-search-neighbor`,
          ],
          mixedBindingsDraft(second),
        ),
      ),
      ...([`driver-spin`, `driver-spin-throws`] as const).flatMap((kind) =>
        [true, false].map((bound) =>
          fixedHistory(
            `round3 ${kind} after recorded violation ${bound ? `bound` : `legacy`} receiver`,
            [
              bound
                ? `bound-mutant-violation-before-spin`
                : `legacy-mutant-violation-before-spin`,
            ],
            spinDraft(kind, bound),
          ),
        ),
      ),
      fixedHistory(
        `review auxiliary late errors preserve counts`,
        [`auxiliary-late-error`],
        generatedDraft({
          probe: `late`,
          clock: true,
          strictModel: true,
          constructed: [{ prefix: [7, 0], enters: [] }],
        }),
      ),
      ...([`shell`, `default`] as const).flatMap((labelStyle) =>
        [true, false].map((valid) =>
          fixedHistory(
            `review ${labelStyle} enumerated selector ${valid ? `exact` : `missing`}`,
            [
              valid
                ? `bound-enumerated-label-selector`
                : `bound-enumerated-label-rejected`,
            ],
            generatedDraft({
              source: { kind: `enumerated`, histories: [[0, 1]] },
              labelStyle,
              calibrationHistory: {
                enumerated: valid
                  ? labelStyle === `shell`
                    ? `items 0 | 1 ${shellText}`
                    : `[0,1]`
                  : `items 0 | 1`,
              },
              calibrations: [`right`],
              identityHistories: true,
            }),
          ),
        ),
      ),
      ...([`inferred`, `explicit`] as const).map((probeBinding) =>
        fixedHistory(
          `review duplicate selected ${probeBinding} names`,
          [`bound-control-${probeBinding}-name-gate`],
          generatedDraft({
            fixed: [at([1])],
            constructed: [
              { prefix: [0], enters: [`saw-0`] },
              { prefix: [1], enters: [] },
            ],
            probe: `agree`,
            probeBinding,
            duplicateHistoryNames: true,
            calibrationHistory: { fixed: `fixed-0` },
          }),
        ),
      ),
      fixedHistory(
        `review fixed entered selector`,
        [`bound-control-fixed-entered`],
        generatedDraft({
          fixed: [at([1]), at([0, 1])],
          constructed: [{ prefix: [0], enters: [`saw-0`] }],
          probe: `agree`,
          probeBinding: `explicit`,
          probeEntered: { fixed: `fixed-1` },
          identityHistories: true,
        }),
      ),
      fixedHistory(
        `review constructed absent selector`,
        [`bound-control-constructed-absent`],
        generatedDraft({
          fixed: [at([1])],
          constructed: [
            { prefix: [0], enters: [`saw-0`] },
            { prefix: [1, 2, 2], enters: [] },
          ],
          probe: `agree`,
          probeBinding: `explicit`,
          probeNotEntered: { constructed: `constructed-1` },
          isolatedPlans: true,
        }),
      ),
      fixedHistory(
        `review equal fixed input origins`,
        [`bound-equal-fixed-origin`],
        generatedDraft({
          fixed: [at([0]), at([0])],
          calibrationHistory: { fixed: `fixed-1` },
          calibrations: [`driver`],
          identityHistories: true,
        }),
      ),
      ...([`throws`, `clock`] as const).map((kind) =>
        fixedHistory(
          `round2 ranked ${kind} bound and legacy`,
          [`bound-ranked-mutants`],
          generatedDraft({
            fixed: [at([0])],
            calibrationHistory: { fixed: `fixed-0` },
            calibrations: [kind],
            identityHistories: true,
          }),
          generatedDraft({ fixed: [at([0])], calibrations: [kind] }),
        ),
      ),
      fixedHistory(
        `round2 forced premise origins`,
        [`bound-independent-premise`],
        generatedDraft({
          fixed: [at([1]), at([0])],
          constructed: [
            { prefix: [0], enters: [`saw-0`] },
            { prefix: [0, 2], enters: [`saw-0`] },
          ],
          probe: `agree`,
          probeBinding: `explicit`,
          isolatedPlans: true,
        }),
      ),
      ...([`varied`, `astral`] as const).map((calibrationNames) =>
        fixedHistory(
          `round2 ${calibrationNames} calibration seeds`,
          [`bound-name-seed`],
          generatedDraft({
            constructed: [{ prefix: [0], enters: [`saw-0`] }],
            calibrationHistory: { constructed: `constructed-0` },
            calibrations: [`right`],
            calibrationNames,
            isolatedPlans: true,
          }),
        ),
      ),
      fixedHistory(
        `round2 bound calibrations keep stdout quiet`,
        [],
        generatedDraft({
          fixed: [at([0])],
          calibrationHistory: { fixed: `fixed-0` },
          calibrations: [`right`],
        }),
      ),
      fixedHistory(
        `round2 undeclared clean source reach`,
        [`bound-extra-state`],
        generatedDraft({
          fixed: [at([0])],
          calibrationHistory: { fixed: `fixed-0` },
          calibrations: [`right`],
          extraReach: `calibration`,
        }),
      ),
      fixedHistory(
        `round2 declared enumerated clean source reach`,
        [`bound-extra-state`],
        generatedDraft({
          source: { kind: `enumerated`, histories: [[0], [1]] },
          enumeratedStates: [`required`, `measured`, `measured`],
          calibrationHistory: { enumerated: 0 },
          calibrations: [`right`],
          extraReach: `calibration`,
        }),
      ),
      fixedHistory(
        `round2 generated fixed history rejects undeclared reach`,
        [],
        generatedDraft({ fixed: [at([0])], extraReach: true }),
      ),
      ...(
        [`corrupt-throws`, `judge-throws`, `judge-driver-throws`] as const
      ).map((kind) =>
        fixedHistory(
          `round2 context ${kind}`,
          [`bound-error-context`],
          generatedDraft({
            fixed: [at([0])],
            calibrationHistory: { fixed: `fixed-0` },
            calibrations: [kind],
          }),
        ),
      ),
      fixedHistory(
        `round2 context clean invalid observation`,
        [],
        generatedDraft({
          fixed: [at([0])],
          calibrationHistory: { fixed: `fixed-0` },
          calibrations: [`right`],
          odd: `class`,
        }),
      ),
      ...(
        [
          `null-entered`,
          `null-binding`,
          `false-binding`,
          `zero-binding`,
        ] as const
      ).map((probeBinding) =>
        fixedHistory(
          `round2 invalid ${probeBinding}`,
          [`bound-null-selector`],
          generatedDraft({
            fixed: [at([1])],
            constructed: [{ prefix: [0], enters: [`saw-0`] }],
            probe: `agree`,
            probeBinding,
          }),
        ),
      ),
      ...([`empty text`, `empty pattern`] as const).flatMap((difference) =>
        (
          [
            `null-binding`,
            `false-binding`,
            `zero-binding`,
            `no-absence`,
            `inferred`,
            `null-entered`,
            `explicit`,
          ] as const
        ).map((probeBinding) =>
          fixedHistory(
            `registration phases ${probeBinding} with ${difference}`,
            [`registration-error`],
            generatedDraft({
              fixed: [at([1])],
              // Inferred entry lacks a unique construction; explicit entry
              // selects a missing one. These fail in different phases.
              constructed:
                probeBinding === `inferred` || probeBinding === `explicit`
                  ? []
                  : [{ prefix: [0], enters: [`saw-0`] }],
              probe: `agree`,
              probeBinding,
              calibrations: [cal(`right`, difference)],
            }),
          ),
        ),
      ),
      fixedHistory(
        `round2 warning repeat and manifest phases`,
        [`registration-warning-policy`],
        generatedDraft({
          fixed: [at([1])],
          constructed: [{ prefix: [0], enters: [`saw-0`] }],
          probe: `agree`,
          warningProbe: true,
          calibrations: [`right`, `driver`],
        }),
      ),
      ...([`fixed`, `enumerated`, `constructed`] as const).map((selectedKind) =>
        fixedHistory(
          `round2 selected ${selectedKind} difference never searches`,
          [`bound-difference`],
          generatedDraft({
            ...(selectedKind === `enumerated`
              ? {
                  source: {
                    kind: `enumerated`,
                    histories: [[0], [1, 1, 0]],
                  },
                  calibrationHistory: { enumerated: 0 },
                }
              : selectedKind === `fixed`
                ? {
                    fixed: [at([0]), at([1, 1, 0])],
                    calibrationHistory: { fixed: `fixed-0` },
                  }
                : {
                    fixed: [at([1, 1, 0])],
                    constructed: [{ prefix: [0], enters: [`saw-0`] }],
                    calibrationHistory: {
                      constructed: `constructed-0`,
                    },
                    isolatedPlans: true,
                  }),
            calibrations: [
              cal(`driver-last`, `later text`),
              cal(`right`, `pattern match`),
            ],
          }),
        ),
      ),
      ...([false, true] as const).map((isolatedPlans) =>
        fixedHistory(
          `review combined controls isolated=${isolatedPlans}`,
          [`bound-combined-controls`],
          generatedDraft({
            fixed: [at([1])],
            constructed: [{ prefix: [0], enters: [`saw-0`] }],
            isolatedPlans,
            probe: `agree`,
            probeBinding: `explicit`,
            calibrationHistory: { constructed: `constructed-0` },
            calibrations: [`driver`],
          }),
        ),
      ),
      fixedHistory(
        `review entered control full reach`,
        [`bound-control-full-reach`],
        generatedDraft({
          fixed: [at([1])],
          constructed: [{ prefix: [0, 0, 0], enters: [`saw-0`, `saw-1`] }],
          probe: `agree`,
          probeBinding: `inferred`,
        }),
      ),
      fixedHistory(
        `review absence control full reach`,
        [`bound-control-full-reach`],
        generatedDraft({
          fixed: [{ history: [1], enters: [`saw-2`] }],
          constructed: [{ prefix: [0, 0, 0], enters: [`saw-0`] }],
          probe: `agree`,
          probeBinding: `inferred`,
        }),
      ),
      ...([`saw-0`, `toString`, `constructor`, `__proto__`] as const).map(
        (probeName) =>
          fixedHistory(
            `review empty binding table ${probeName}`,
            [],
            generatedDraft({
              fixed: [at([1])],
              constructed: [{ prefix: [0], enters: [`saw-0`] }],
              probe: `agree`,
              probeBinding: `empty`,
              probeName,
            }),
          ),
      ),
      ...([`toString`, `constructor`, `__proto__`] as const).map((probeName) =>
        fixedHistory(
          `review own binding table ${probeName}`,
          [`bound-calibration`],
          generatedDraft({
            fixed: [at([1])],
            constructed: [{ prefix: [0], enters: [`saw-0`] }],
            probe: `agree`,
            probeBinding: `explicit`,
            probeName,
            isolatedPlans: true,
          }),
        ),
      ),
      fixedHistory(
        `review enumerated alpha naming and invalid data precedence`,
        [],
        generatedDraft({
          source: { kind: `enumerated`, histories: [[0], [1]] },
          probeName: `toString`,
          identityHistories: true,
          enumeratedStates: [`required`, `measured`, `measured`],
        }),
        generatedDraft({
          source: { kind: `enumerated`, histories: [[0]] },
          identityHistories: true,
          form: `trap`,
        }),
      ),
      fixedHistory(
        `review fixed private slots without resolve`,
        [],
        generatedDraft({
          fixed: [at([0])],
          form: `boxed`,
          calibrationHistory: { fixed: `fixed-0` },
          calibrations: [`driver`],
        }),
      ),
      fixedHistory(
        `review fixed plain identity metadata`,
        [`bound-fixed-identity`],
        generatedDraft({
          fixed: [at([0])],
          identityHistories: true,
          calibrationHistory: { fixed: `fixed-0` },
          calibrations: [`driver`],
        }),
      ),
      fixedHistory(
        `review fixed identity and private slots`,
        [`bound-fixed-identity`],
        generatedDraft({
          fixed: [at([0])],
          form: `boxed`,
          identityHistories: true,
          calibrationHistory: { fixed: `fixed-0` },
          calibrations: [`driver`],
        }),
      ),
      fixedHistory(
        `review enumerated identity metadata`,
        [`bound-enumerated-identity`],
        generatedDraft({
          source: { kind: `enumerated`, histories: [[0]] },
          identityHistories: true,
          calibrationHistory: { enumerated: 0 },
          calibrations: [`driver`],
        }),
      ),
      fixedHistory(
        `selected clean driver errors cannot search for another history`,
        [`bound-calibration`],
        generatedDraft({
          fixed: [at([6]), at([0])],
          calibrations: [`driver`],
          calibrationHistory: { fixed: `fixed-0` },
        }),
      ),
      fixedHistory(
        `bound constructed drivers rebuild seeded plans`,
        [`bound-constructed-driver`],
        generatedDraft({
          fixed: [at([6])],
          constructed: [{ prefix: [0], enters: [`saw-0`] }],
          isolatedPlans: true,
          calibrations: [`driver`],
          calibrationHistory: { constructed: `constructed-0` },
        }),
      ),
      fixedHistory(
        `duplicate enumerated labels fail before execution`,
        [`bound-calibration-registration-error`],
        generatedDraft({
          source: {
            kind: `enumerated`,
            histories: [
              [0, 1],
              [1, 0],
            ],
          },
          duplicateHistoryNames: true,
          calibrations: [`right`],
          calibrationHistory: { enumerated: `items 0 | 1` },
        }),
      ),
      ...([`inferred`, `explicit`] as const).map((probeBinding) =>
        fixedHistory(
          `bound forced controls use ${probeBinding} entered history`,
          [`bound-calibration`],
          generatedDraft({
            fixed: [at([1])],
            constructed: [{ prefix: [0], enters: [`saw-0`] }],
            isolatedPlans: true,
            probe: `agree`,
            probeBinding,
          }),
        ),
      ),
      fixedHistory(
        `probe inference rejects ambiguous and missing constructions`,
        [`registration-error`],
        generatedDraft({
          fixed: [at([1])],
          constructed: [
            { prefix: [0], enters: [`saw-0`] },
            { prefix: [0], enters: [`saw-0`] },
          ],
          probe: `agree`,
          probeBinding: `inferred`,
        }),
        generatedDraft({
          fixed: [at([1])],
          probe: `agree`,
          probeBinding: `inferred`,
        }),
      ),
      fixedHistory(
        `a bound probe control needs an absent history`,
        [`registration-error`],
        generatedDraft({ probe: `agree`, probeBinding: `no-absence` }),
      ),
      fixedHistory(
        `fixed and constructed duplicate selectors fail before execution`,
        [`bound-calibration-registration-error`],
        generatedDraft({
          fixed: [at([0]), at([1])],
          duplicateHistoryNames: true,
          calibrations: [`right`],
          calibrationHistory: { fixed: `fixed-0` },
        }),
        generatedDraft({
          constructed: [
            { prefix: [0], enters: [] },
            { prefix: [1], enters: [] },
          ],
          duplicateHistoryNames: true,
          calibrations: [`right`],
          calibrationHistory: { constructed: `constructed-0` },
        }),
      ),
      fixedHistory(
        `bound calibrations use only their selected histories`,
        [`bound-calibration`],
        generatedDraft({
          fixed: [at([6]), at([0, 1])],
          calibrations: [`right`],
          calibrationHistory: { fixed: `fixed-1` },
        }),
        generatedDraft({
          source: { kind: `enumerated`, histories: [[6], [0, 2]] },
          calibrations: [`driver`],
          calibrationHistory: { enumerated: 1 },
        }),
      ),
      ...(
        [`right`, `no-op`, `wrong-law`, `inapplicable`, `throws`] as const
      ).map((kind) =>
        fixedHistory(
          `bound ${kind} requires the designated rejection`,
          [`bound-calibration`],
          generatedDraft({
            fixed: [at([6]), at([0])],
            calibrations: [kind],
            calibrationHistory: { fixed: `fixed-1` },
          }),
        ),
      ),
      fixedHistory(
        `a failed selected clean run cannot search for another`,
        [`bound-calibration`],
        generatedDraft({
          fixed: [at([3]), at([0])],
          calibrations: [`right`],
          calibrationHistory: { fixed: `fixed-0` },
        }),
      ),
      fixedHistory(
        `a selected history must prove its declared reach`,
        [`bound-calibration`],
        generatedDraft({
          fixed: [{ history: [0], enters: [`saw-1`] }],
          calibrations: [`right`],
          calibrationHistory: { fixed: `fixed-0` },
        }),
      ),
      ...(
        [
          { fixed: `missing` },
          { constructed: `missing` },
          { enumerated: -1 },
          { enumerated: 1.5 },
          { enumerated: 2 },
          { fixed: `fixed-0` },
        ] as const
      ).map((binding, index) =>
        fixedHistory(
          `invalid binding ${index} fails at registration`,
          [`bound-calibration-registration-error`],
          generatedDraft({
            source: { kind: `enumerated`, histories: [[0], [1]] },
            calibrations: [`right`],
            calibrationHistory: binding,
          }),
        ),
      ),
      fixedHistory(
        `enumerated histories can be selected by label`,
        [`bound-calibration`],
        generatedDraft({
          source: { kind: `enumerated`, histories: [[6], [0, 1]] },
          calibrations: [`right`],
          calibrationHistory: { enumerated: `items 0 | 1` },
        }),
      ),
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
        [`replay-probe`, `unit-replay-constructed`],
        generatedDraft({
          constructed: [{ prefix: [1, 3], enters: [`saw-1`] }],
        }),
      ),
      // Unbounded, the shrink of [4,2,2] runs [4,2] and [4,0] for 2 s each
      // after the first failure's 2 s, past the 5 s timeout.
      fixedHistory(
        `a campaign whose shrinking would outlast its timeout reports its law in time`,
        [`slow-shrink-campaign-failure`, `campaign-violation`, `replay-probe`],
        generatedDraft({
          timing: `slow shrink`,
          constructed: [{ prefix: [4, 2, 2], enters: [] }],
        }),
      ),
      // A timeout of 0 or less is none: the deadline must not be now.
      fixedHistory(
        `a campaign without a timeout shrinks without a budget`,
        [`unbudgeted-campaign-shrunk`, `campaign-violation`],
        generatedDraft({
          timeoutMode: `zero`,
          constructed: [{ prefix: [4, 2, 2], enters: [] }],
        }),
      ),
      fixedHistory(
        `a campaign with a negative timeout shrinks without a budget`,
        [`unbudgeted-campaign-shrunk`, `campaign-setup-failure`],
        generatedDraft({
          timeoutMode: `negative`,
          constructed: [{ prefix: [2, 6, 4], enters: [] }],
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
        generatedDraft({
          fixed: [at([3]), at([0])],
          calibrations: [cal(`right`)],
        }),
      ),
      // A spin fails its history, so its trace is no clean candidate, though
      // every observation in it passes the check.
      fixedHistory(
        `a calibration skips a candidate whose clock spins`,
        [`calibration-skipped-candidate`, `calibration-applied`],
        generatedDraft({
          clock: true,
          fixed: [at([7]), at([0])],
          calibrations: [cal(`right`), cal(`driver`)],
        }),
      ),
      fixedHistory(
        `calibrations need the named law`,
        [`calibration-applied`, `calibration-rejected`],
        generatedDraft({
          fixed: [at([0])],
          calibrations: [cal(`right`), cal(`wrong-law`), cal(`no-op`)],
        }),
      ),
      fixedHistory(
        `a mutant driver calibration`,
        [`calibration-applied`],
        generatedDraft({ fixed: [at([0])], calibrations: [cal(`driver`)] }),
      ),
      // Text and a pattern, on a corruption and on a mutant driver.
      ...[
        [`text match`, `pattern match`],
        [`pattern match`, `text match`],
      ].map(([corrupted, mutated]) =>
        fixedHistory(
          `a calibration that requires a difference its violation has applies (${corrupted}, ${mutated})`,
          [`calibration-applied`, `calibration-difference-applied`],
          generatedDraft({
            fixed: [at([0])],
            calibrations: [
              cal(`right`, corrupted as CalibrationDifference),
              cal(`driver`, mutated as CalibrationDifference),
            ],
          }),
        ),
      ),
      ...[
        [`text mismatch`, `pattern mismatch`],
        [`pattern mismatch`, `text mismatch`],
      ].map(([corrupted, mutated]) =>
        fixedHistory(
          `a calibration that requires a difference its violation lacks fails (${corrupted}, ${mutated})`,
          [`calibration-difference-rejected`],
          generatedDraft({
            fixed: [at([0])],
            calibrations: [
              cal(`right`, corrupted as CalibrationDifference),
              cal(`driver`, mutated as CalibrationDifference),
            ],
          }),
        ),
      ),
      // The driver passes over the first candidate, whose last item is item
      // 0, and passes at the second, whose last item is item 2.
      fixedHistory(
        `a mutant driver passes at a later candidate whose difference holds`,
        [`calibration-difference-applied`, `calibration-difference-later`],
        generatedDraft({
          fixed: [at([0]), at([1, 1, 0])],
          calibrations: [
            cal(`driver-last`, `later text`),
            cal(`driver-last`, `later pattern`),
            cal(`driver-last`, `text match`),
          ],
        }),
      ),
      fixedHistory(
        `a calibration that requires the empty text fails to load`,
        [`registration-error`, `calibration-empty-difference-error`],
        generatedDraft({
          fixed: [at([0])],
          calibrations: [
            cal(`right`, `text match`),
            cal(`driver`, `empty text`),
          ],
        }),
      ),
      fixedHistory(
        `a calibration that requires a pattern matching the empty string fails to load`,
        [`registration-error`, `calibration-empty-difference-error`],
        {
          ...generatedDraft({ calibrations: [cal(`right`, `empty pattern`)] }),
          source: { kind: `enumerated`, histories: [[0], [1]] },
        },
      ),
      fixedHistory(
        `a difference that is not text fails a calibration that requires one`,
        [`calibration-odd-difference`, `calibration-applied`],
        generatedDraft({
          numberDifference: true,
          fixed: [at([0])],
          calibrations: [
            cal(`right`, `text match`),
            cal(`driver-last`, `pattern match`),
            cal(`driver`),
          ],
        }),
      ),
      fixedHistory(
        `a calibration's wrong law decides before its difference`,
        [`calibration-rejected`],
        generatedDraft({
          fixed: [at([0])],
          calibrations: [
            cal(`wrong-law`, `text mismatch`),
            cal(`wrong-law`, `pattern match`),
            cal(`no-op`, `text match`),
          ],
        }),
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
        [`enumerated-reach-counted`, `enumerated-reach-alone`],
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
        [`enumerated-undeclared-state`, `enumerated-reach-alone-undeclared`],
        {
          ...generatedDraft({
            enumeratedStates: [`required`, `undeclared`, `measured`],
          }),
          source: { kind: `enumerated`, histories: [[0], [3, 1], [2]] },
        },
      ),
      // A driver error leaves its history unjudged; its own test reports
      // it, and the reach test counts nothing for it without running it again.
      fixedHistory(
        `the reach test does not run again a history whose driver threw`,
        [`enumerated-unjudged-not-rerun`, `enumerated-reach-counted`],
        {
          ...generatedDraft({
            enumeratedStates: [`required`, `measured`, `undeclared`],
          }),
          source: { kind: `enumerated`, histories: [[6, 0], [0]] },
        },
      ),
      // Every history times out; the reach test runs none again, so it fails
      // on its own counts at once. The fixture starts the reach test only
      // after every late judgment arrived, so the first history's, which
      // enters the required state, comes first and must not be recorded.
      fixedHistory(
        `the reach test does not run again a history whose test timed out`,
        [`enumerated-timed-out-not-rerun`],
        {
          ...generatedDraft({
            timing: `slow`,
            enumeratedStates: [`required`, `measured`, `measured`],
          }),
          source: { kind: `enumerated`, histories: [[0], [1], [2], [1, 1]] },
        },
      ),
      fixedHistory(
        `an enumerated source with a generated source's key fails to load`,
        [`registration-error`, `enumerated-shape-error`],
        {
          ...generatedDraft({
            enumeratedStates: [`required`, `measured`, `measured`],
            enumeratedShape: `extra key`,
          }),
          source: { kind: `enumerated`, histories: [[0]] },
        },
      ),
      fixedHistory(
        `an enumerated source with a probe-bound state fails to load`,
        [`registration-error`, `enumerated-shape-error`],
        {
          ...generatedDraft({
            enumeratedStates: [`required`, `measured`, `measured`],
            enumeratedShape: `probe state`,
          }),
          source: { kind: `enumerated`, histories: [[0]] },
        },
      ),
      fixedHistory(
        `a label that names the reach test fails to load`,
        [`registration-error`, `reserved-label-error`],
        {
          ...generatedDraft({
            enumeratedStates: [`required`, `measured`, `measured`],
            labelStyle: `reserved-reach`,
          }),
          source: { kind: `enumerated`, histories: [[0], [1]] },
        },
      ),
      fixedHistory(
        `a label that names the determinism test fails to load`,
        [`registration-error`, `reserved-label-error`],
        {
          ...generatedDraft({ labelStyle: `reserved-determinism` }),
          source: { kind: `enumerated`, histories: [[0], [1]] },
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
      // A slow random campaign times out, but its first history still runs
      // under the route of an ordinary run.
      seedlessHistory(
        `a slow random campaign runs under random seed in an ordinary run`,
        [`seedless-route`, `timeout`],
        generatedDraft({ timing: `slow` }),
      ),
      fixedHistory(
        `a property timeout limits every test it registers`,
        [`timeout`],
        generatedDraft({ timing: `slow`, fixed: [at([0])] }),
      ),
      // Units (maintainer decision, 2026-11-11, option D). At seed 5, the
      // generated unit's first failing history holds a 4 first, and the
      // constructed unit's history starts with a 3.
      fixedHistory(
        `each unit decides its own first failure`,
        [`unit-split-verdict`, `campaign-violation`, `replay-probe`],
        generatedDraft({
          source: { kind: `generated`, runs: 2, seed: 5 },
          constructed: [{ prefix: [3], enters: [] }],
        }),
      ),
      // At seed 6, without constructed histories, the generated unit fails.
      fixedHistory(
        `a generated unit's replay runs only that unit`,
        [`unit-replay-generated`, `replay-probe`],
        generatedDraft({ source: { kind: `generated`, runs: 2, seed: 6 } }),
      ),
      fixedHistory(
        `a constructed history named generated fails to load`,
        [`registration-error`, `unit-name-load-error`],
        generatedDraft({
          constructedNames: `generated`,
          constructed: [{ prefix: [0], enters: [`saw-0`] }],
        }),
      ),
      fixedHistory(
        `two constructed histories of one name fail to load`,
        [`registration-error`, `unit-name-load-error`],
        generatedDraft({
          constructedNames: `duplicate`,
          constructed: [
            { prefix: [0], enters: [`saw-0`] },
            { prefix: [1], enters: [`saw-1`] },
          ],
        }),
      ),
      fixedHistory(
        `two fixed histories of one name fail to load`,
        [`registration-error`, `unit-name-load-error`],
        generatedDraft({ fixedNames: `duplicate`, fixed: [at([0]), at([1])] }),
      ),
      // At seed 7, `c` fails and `c.1`, whose name extends it, passes.
      fixedHistory(
        `a unit's rerun runs it beside a unit whose name extends its name`,
        [`unit-rerun`, `unit-rerun-beside-extension`],
        generatedDraft({
          constructedNames: `prefixed`,
          constructed: [
            { prefix: [3], enters: [] },
            { prefix: [0], enters: [`saw-0`] },
          ],
        }),
      ),
      fixedHistory(
        `a second fixed seed, whose text extends the first, runs its own units`,
        [`second-fixed-seed`, `unit-rerun`],
        generatedDraft({
          source: { kind: `generated`, runs: 2, seed: 1 },
          secondSeed: true,
          constructed: [{ prefix: [3], enters: [] }],
        }),
      ),
      seedlessHistory(
        `an ordinary run's random units run the one seed they logged`,
        [`seedless-units-drawn`, `seedless-route`],
        generatedDraft({
          constructed: [
            { prefix: [0], enters: [`saw-0`] },
            { prefix: [1], enters: [`saw-1`] },
          ],
        }),
      ),
      suiteHistory(
        `a replay command under a custom prefix names its variables`,
        [`unit-replay-custom-prefix`, `replay-probe`],
        { prefix: `SYNTH_ORACLE` },
        generatedDraft({ constructed: [{ prefix: [3], enters: [] }] }),
      ),
      // Law `replay-config` (maintainer decisions, 2026-11-11, Q3 and Q4).
      suiteHistory(
        `UNIT without PROPERTY fails every load`,
        [`replay-environment-error`, `unit-requires-property`],
        { environment: replayOf({ path: `absent`, property: `absent` }) },
        generatedDraft({ constructed: [{ prefix: [0], enters: [`saw-0`] }] }),
      ),
      suiteHistory(
        `UNIT alone fails every load under a custom prefix`,
        [`replay-environment-error`, `unit-requires-property`],
        {
          prefix: `SYNTH_ORACLE`,
          environment: replayOf({
            seed: `absent`,
            path: `absent`,
            property: `absent`,
          }),
        },
        generatedDraft({}),
      ),
      suiteHistory(
        `PATH requires SEED before UNIT requires PROPERTY`,
        [`replay-environment-error`],
        {
          environment: replayOf({ seed: `absent`, property: `absent` }),
        },
        generatedDraft({}),
      ),
      suiteHistory(
        `a retired variable's message names UNIT`,
        [`replay-environment-error`, `retired-names-unit`],
        { environment: replayOf({ retired: true }) },
        generatedDraft({}),
      ),
      suiteHistory(
        `a path replay of a generated source without UNIT fails its load`,
        [`replay-without-unit-error`],
        { environment: replayOf({ unit: `absent` }) },
        generatedDraft({ constructed: [{ prefix: [0], enters: [`saw-0`] }] }),
      ),
      suiteHistory(
        `a UNIT that names no random unit fails its load`,
        [`replay-unit-missing-error`],
        { prefix: `SYNTH_ORACLE`, environment: replayOf({ unit: `missing` }) },
        generatedDraft({}),
      ),
      suiteHistory(
        `a UNIT on an enumerated property fails its load`,
        [`replay-unit-missing-error`],
        { environment: replayOf({}) },
        {
          ...generatedDraft({}),
          source: { kind: `enumerated`, histories: [[0], [1]] },
        },
      ),
      suiteHistory(
        `a UNIT that names a random unit runs only that unit`,
        [`replay-unit-selected`],
        { environment: replayOf({}) },
        generatedDraft({ constructed: [{ prefix: [3], enters: [] }] }),
        generatedDraft({ constructed: [{ prefix: [0], enters: [`saw-0`] }] }),
      ),
    ],
  },
  resolve: resolveSuite,
  model: suiteModel,
  reached: frameworkReach,
  driver: driveSuite,
  check: checkSuite,
  calibrations: [
    ...(
      [`draw`, `host use`, `forwarding`, `malformed`, `child seed`] as const
    ).map((fault) => ({
      name: `reject wrong host RNG ${fault}`,
      history: {
        fixed: `fixture preserves forwarded outer host RNG alternate`,
      },
      law: `host RNG scope`,
      corrupt: (
        trace: ReadonlyArray<{ checkpoint: string; value: unknown }>,
      ) => {
        const altered = structuredClone([...trace])
        const scope = altered.find(
          ({ checkpoint }) => checkpoint === `host-scope`,
        )!.value as HostScopeRun
        if (fault === `draw`) scope.outer!.draw = 1 - scope.draw
        if (fault === `host use`) scope.outer!.hostUsed = false
        if (fault === `forwarding`) scope.outer!.forwarded = false
        if (fault === `malformed`)
          delete (scope.outer as Partial<HostSeed>).draw
        if (fault === `child seed`) scope.children[1]!.seed++
        return altered
      },
    })),
    ...([`child`, `run`, `phase`] as const).map((receiver) => ({
      name: `reject unrelated ${receiver} warning property`,
      history: {
        fixed:
          receiver === `phase`
            ? `round3 every actual receiving cut`
            : `round5 warning-order equivalence`,
      },
      law: `calibration`,
      corrupt: (
        trace: ReadonlyArray<{ checkpoint: string; value: unknown }>,
      ) => {
        const altered = structuredClone([...trace])
        const unknown = `self-oracle.unrelated: calibrations "cal-0" have no history binding; using transitional candidate search.`
        if (receiver === `phase`) {
          const phase = altered.find(
            ({ checkpoint }) => checkpoint === `registration-warnings`,
          )!.value as { repeated: Array<string> }
          phase.repeated.push(unknown)
        } else {
          const observation = altered.find(
            ({ checkpoint }) => checkpoint === receiver,
          )!.value as { warnings: Array<string> }
          observation.warnings.push(unknown)
        }
        return altered
      },
    })),
    ...([`suffix`, `replacement`, `malformed`] as const).map((mutation) => ({
      name: `reject ${mutation} actual warning identity`,
      history: { fixed: `round5 warning-order equivalence` },
      law: `calibration`,
      corrupt: (
        trace: ReadonlyArray<{ checkpoint: string; value: unknown }>,
      ) => {
        const altered = structuredClone([...trace])
        const child = altered.find(({ checkpoint }) => checkpoint === `child`)!
          .value as ChildRun
        child.warnings = child.warnings.map((warning) => {
          if (mutation === `malformed`)
            return warning.replace(`: calibrations `, `: malformed names `)
          const parts = warningParts(warning)!
          return renderWarning(
            parts,
            parts.names.map((name, index) =>
              mutation === `suffix`
                ? `${name}-extra`
                : index === 0
                  ? `replacement calibration`
                  : name,
            ),
          )
        })
        return altered
      },
    })),
    {
      name: `reject suffixed ordinary warning summary identity`,
      history: { fixed: `round5 warning-order equivalence` },
      law: `calibration`,
      corrupt: (trace) => {
        const altered = structuredClone([...trace])
        const run = altered.find(({ checkpoint }) => checkpoint === `run`)!
          .value as SuiteRun
        run.warnings = run.warnings.map((warning) => {
          const parts = warningParts(warning)!
          return renderWarning(
            parts,
            parts.names.map((name) => `${name}-extra`),
          )
        })
        return altered
      },
    },
    {
      name: `reject suffixed registration phase summary identity`,
      history: { fixed: `round3 every actual receiving cut` },
      law: `calibration`,
      corrupt: (trace) => {
        const altered = structuredClone([...trace])
        const phase = altered.find(
          ({ checkpoint }) => checkpoint === `registration-warnings`,
        )!.value as { repeated: Array<string> }
        phase.repeated = phase.repeated.map((warning) => {
          const parts = warningParts(warning)!
          return renderWarning(
            parts,
            parts.names.map((name) => `${name}-extra`),
          )
        })
        return altered
      },
    },
    {
      name: `reject lost warning permutation equivalence`,
      history: { fixed: `round5 warning-order equivalence` },
      law: `calibration`,
      corrupt: (trace) => {
        const altered = structuredClone([...trace])
        const permutation = altered.find(
          ({ checkpoint }) => checkpoint === `warning-permutation`,
        )!.value as { stable: boolean }
        permutation.stable = false
        return altered
      },
    },
    ...warningReceivingKinds.flatMap((context) =>
      ([`omit`, `duplicate`] as const).map((mutation) => ({
        name: `reject ${mutation} ${context} registration warning`,
        history: { fixed: `round3 every actual receiving cut` },
        law: `calibration`,
        corrupt: (
          trace: ReadonlyArray<{ checkpoint: string; value: unknown }>,
        ) => {
          const altered = structuredClone([...trace])
          const child = altered
            .filter(({ checkpoint }) => checkpoint === `child`)
            .map(({ value }) => value as ChildRun)
            .find(
              ({ context: cut, warnings }) =>
                cut.kind === context && warnings.length > 0,
            )!
          if (mutation === `omit`) child.warnings.splice(0, 1)
          else child.warnings.push(child.warnings[0]!)
          return altered
        },
      })),
    ),
    ...([`omit`, `duplicate`] as const).map((mutation) => ({
      name: `reject ${mutation} unbound warning name`,
      history: { fixed: `round3 every actual receiving cut` },
      law: `calibration`,
      corrupt: (
        trace: ReadonlyArray<{ checkpoint: string; value: unknown }>,
      ) => {
        const altered = structuredClone([...trace])
        const child = altered
          .filter(({ checkpoint }) => checkpoint === `child`)
          .map(({ value }) => value as ChildRun)
          .find(({ context }) => context.kind === `seedless`)!
        child.warnings = child.warnings.map((warning) =>
          warning.replace(
            `"cal-1"`,
            mutation === `omit` ? `"missing calibration"` : `"cal-1", "cal-1"`,
          ),
        )
        return altered
      },
    })),
    {
      name: `reject warning from all-bound registration`,
      history: { fixed: `round3 fully bound warning phases stay silent` },
      law: `calibration`,
      corrupt: (trace) => {
        const altered = structuredClone([...trace])
        const child = altered.find(({ checkpoint }) => checkpoint === `child`)!
          .value as ChildRun
        child.warnings.push(
          `${syntheticIds[0]}: calibrations "cal-0" have no history binding`,
        )
        return altered
      },
    },
    {
      name: `reject warning from collect-only registration`,
      history: { fixed: `round3 every actual receiving cut` },
      law: `calibration`,
      corrupt: (trace) => {
        const altered = structuredClone([...trace])
        const children = altered
          .filter(({ checkpoint }) => checkpoint === `child`)
          .map(({ value }) => value as ChildRun)
        const collected = children.find(
          ({ context }) =>
            context.kind === `registration-warnings` &&
            context.phases.length === 0,
        )!
        collected.warnings.push(
          children.find(({ context }) => context.kind === `run`)!.warnings[0]!,
        )
        return altered
      },
    },
    // Each successful UNIT owes its own budget. Mutating one unit must not
    // borrow the whole lane's aggregate runs + constructions allowance.
    ...passingBudgetLanes.flatMap(({ context, lane }) =>
      ([`generated`, `constructed`] as const).flatMap((unitKind) =>
        ([`few`, `many`] as const).map((mutation) => ({
          name: `reject too ${mutation} successful ${context} ${lane} ${unitKind} unit calls`,
          history: {
            fixed: `round4 successful campaign budgets and failing neighbor`,
          },
          law: `campaign budget`,
          corrupt: (
            trace: ReadonlyArray<{ checkpoint: string; value: unknown }>,
          ) => {
            const altered = structuredClone([...trace])
            const child = altered
              .filter(({ checkpoint }) => checkpoint === `child`)
              .map(({ value }) => value as ChildRun)
              .find(({ context: cut }) => cut.kind === context)!
            const target = child.tests.find(({ id, name, state }) => {
              const unit = unitOf(name)
              return (
                id === syntheticIds[0] &&
                state === `passed` &&
                unit &&
                (unitKind === `generated`
                  ? unit.name === `generated`
                  : unit.name !== `generated`) &&
                (lane === `random`
                  ? unit.seed === undefined
                  : unit.seed !== undefined)
              )
            })!.name
            const callAt = child.log.findIndex(
              ({ id, test }) =>
                id === syntheticIds[0] && test === `${id} > ${target}`,
            )
            if (mutation === `few`) child.log.splice(callAt, 1)
            else child.log.push(structuredClone(child.log[callAt]!))
            return altered
          },
        })),
      ),
    ),
    // Moving a construction's call to the generated unit keeps the lane's
    // aggregate unchanged. It still omits one owed unit and over-runs another.
    ...passingBudgetLanes.map(({ context, lane }) => ({
      name: `reject redistributed successful ${context} ${lane} unit calls`,
      history: {
        fixed: `round4 successful campaign budgets and failing neighbor`,
      },
      law: `campaign budget`,
      corrupt: (
        trace: ReadonlyArray<{ checkpoint: string; value: unknown }>,
      ) => {
        const altered = structuredClone([...trace])
        const child = altered
          .filter(({ checkpoint }) => checkpoint === `child`)
          .map(({ value }) => value as ChildRun)
          .find(({ context: cut }) => cut.kind === context)!
        const units = child.tests.filter(({ id, name, state }) => {
          const unit = unitOf(name)
          return (
            id === syntheticIds[0] &&
            state === `passed` &&
            unit &&
            (lane === `random`
              ? unit.seed === undefined
              : unit.seed !== undefined)
          )
        })
        const construction = units.find(
          ({ name }) => unitOf(name)!.name !== `generated`,
        )!.name
        const generated = units.find(({ name }) => {
          const unit = unitOf(name)!
          return (
            unit.name === `generated` &&
            unit.seed === unitOf(construction)!.seed
          )
        })!.name
        const call = child.log.find(
          ({ id, test }) =>
            id === syntheticIds[0] && test === `${id} > ${construction}`,
        )!
        call.test = `${syntheticIds[0]} > ${generated}`
        return altered
      },
    })),
    {
      name: `reject replay summary cause loss`,
      history: { fixed: `round3 replayed clock failure retains driver cause` },
      law: `replay`,
      corrupt: (trace) => {
        const altered = structuredClone([...trace])
        const probe = altered.find(({ checkpoint }) => checkpoint === `replay`)!
          .value as ProbeRun
        if (probe.failure?.cause !== `driver`) return undefined
        delete probe.failure.cause
        delete probe.failure.causeMessage
        return altered
      },
    },
    {
      name: `reject rerun wrong cause ordinal`,
      history: {
        fixed: `a driver error after a violation is the violation's cause`,
      },
      law: `verdict`,
      corrupt: (trace) => {
        const altered = structuredClone([...trace])
        const child = altered
          .filter(({ checkpoint }) => checkpoint === `child`)
          .map(({ value }) => value as ChildRun)
          .find(({ context }) => context.kind === `rerun`)!
        const test = child.tests.find(({ state }) => state === `failed`)!
        test.errors[0]!.causeMessage = `synthetic driver failed at item 2`
        return altered
      },
    },
    {
      name: `reject replay concrete cause loss`,
      history: { fixed: `round3 replayed clock failure retains driver cause` },
      law: `replay`,
      corrupt: (trace) => {
        const altered = structuredClone([...trace])
        const child = altered
          .filter(({ checkpoint }) => checkpoint === `child`)
          .map(({ value }) => value as ChildRun)
          .find(({ context }) => context.kind === `replay`)!
        const test = child.tests.find(({ state }) => state === `failed`)!
        if (test.errors[0]?.cause !== `driver`) return undefined
        delete test.errors[0].cause
        delete test.errors[0].causeMessage
        return altered
      },
    },
    ...[`omit`, `duplicate`].map((mutation) => ({
      name: `reject ${mutation} auxiliary registration`,
      history: { fixed: `a replayed campaign failure reproduces its path` },
      law: `registration`,
      corrupt: (
        trace: ReadonlyArray<{ checkpoint: string; value: unknown }>,
      ) => {
        const altered = structuredClone([...trace])
        const child = altered
          .filter(({ checkpoint }) => checkpoint === `child`)
          .map(({ value }) => value as ChildRun)
          .find(({ context }) => context.kind === `replay`)!
        const omittedAt = child.tests.findIndex(
          ({ state }) => state === `skipped`,
        )
        if (mutation === `omit`) child.tests.splice(omittedAt, 1)
        else child.tests.push(structuredClone(child.tests[omittedAt]!))
        return altered
      },
    })),
    {
      name: `reject seedless first primary error`,
      history: {
        fixed: `an ordinary run's random campaign runs under random seed`,
      },
      law: `determinism`,
      corrupt: (trace) => {
        const altered = structuredClone([...trace])
        const child = altered
          .filter(({ checkpoint }) => checkpoint === `child`)
          .map(({ value }) => value as ChildRun)
          .find(({ context }) => context.kind === `seedless`)!
        const test = child.tests.find(({ name }) =>
          name.startsWith(`determinism:`),
        )!
        test.state = `failed`
        test.errors = [{ kind: `other` }]
        child.failed = true
        child.exit = 1
        return altered
      },
    },
    {
      name: `reject rerun recorder cause loss`,
      history: {
        fixed: `a driver error after a violation is the violation's cause`,
      },
      law: `verdict`,
      corrupt: (trace) => {
        const altered = structuredClone([...trace])
        const child = altered
          .filter(({ checkpoint }) => checkpoint === `child`)
          .map(({ value }) => value as ChildRun)
          .find(({ context }) => context.kind === `rerun`)!
        const test = child.tests.find(({ state }) => state === `failed`)!
        delete test.errors[0]!.cause
        delete test.errors[0]!.causeMessage
        return altered
      },
    },
    {
      name: `reject rerun probe cause loss`,
      history: {
        fixed: `a driver error after a violation is the violation's cause`,
      },
      law: `rerun`,
      corrupt: (trace) => {
        const altered = structuredClone([...trace])
        const probe = altered.find(({ checkpoint }) => checkpoint === `rerun`)!
          .value as ProbeRun
        delete probe.failure!.cause
        delete probe.failure!.causeMessage
        return altered
      },
    },
    {
      name: `reject changed reach-only count`,
      history: {
        fixed: `an enumerated source counts the histories that entered each declared state`,
      },
      law: `reach`,
      corrupt: (trace) => {
        const altered = structuredClone([...trace])
        const alone = altered.find(
          ({ checkpoint }) => checkpoint === `reach-alone`,
        )!.value as ReachAlone
        const counts = alone.reach as Record<string, number>
        counts[`saw-0`] = (counts[`saw-0`] ?? 0) + 1
        return altered
      },
    },
    {
      name: `reject missing child observation`,
      history: { constructed: `round2 ranked mutant verdicts` },
      law: `trace`,
      corrupt: (trace) => {
        const first = trace.findIndex(
          ({ checkpoint }) => checkpoint === `child`,
        )
        return trace.filter((_, index) => index !== first)
      },
    },
    {
      name: `reject abnormal child exit`,
      history: { constructed: `round2 ranked mutant verdicts` },
      law: `trace`,
      corrupt: (trace) => {
        const altered = structuredClone([...trace])
        const child = altered.find(({ checkpoint }) => checkpoint === `child`)!
          .value as { exit: number }
        child.exit = 2
        return altered
      },
    },
    {
      name: `reject secondary auxiliary test errors`,
      history: { constructed: `review auxiliary late errors` },
      law: `trace`,
      corrupt: (trace) => {
        const altered = structuredClone([...trace])
        const child = altered.filter(
          ({ checkpoint }) => checkpoint === `child`,
        )[1]!.value as {
          secondaryErrors: Array<{ test: string; message: string }>
        }
        child.secondaryErrors.push({
          test: `random seed`,
          message: `unexpected replay teardown failure`,
        })
        return altered
      },
    },
    {
      name: `reject auxiliary teardown errors`,
      history: { constructed: `round2 registration warning phases` },
      law: `registration`,
      corrupt: (trace) => {
        const altered = structuredClone([...trace])
        const child = altered.filter(
          ({ checkpoint }) => checkpoint === `child`,
        )[1]!.value as {
          loads: Array<{ errors: Array<string> }>
          failed: boolean
          exit: number
        }
        child.loads[0]!.errors.push(`unexpected replay teardown failure`)
        child.failed = true
        child.exit = 1
        return altered
      },
    },
    {
      name: `reject auxiliary late error duplicates`,
      history: { constructed: `review auxiliary late errors` },
      law: `agreement`,
      corrupt: (trace) => {
        const altered = structuredClone([...trace])
        const child = altered
          .filter(({ checkpoint }) => checkpoint === `child`)
          .slice(1)
          .map(({ value }) => value as { unhandled: Array<string> })
          .find(({ unhandled }) => unhandled.length > 0)!
        child.unhandled.push(child.unhandled[0]!)
        return altered
      },
    },
    {
      name: `reject extra registration diagnostics`,
      history: { constructed: `review inferred ambiguous control` },
      law: `registration`,
      corrupt: (trace) => {
        const altered = structuredClone([...trace])
        const run = altered.find(({ checkpoint }) => checkpoint === `run`)!
          .value as SuiteRun
        const file = Object.values(run.files)[0]!
        file.loadErrors.push(file.loadErrors[0]!)
        file.loadCauses.push(file.loadCauses[0]!)
        return altered
      },
    },
    ...[`authored`, `forced`].map((kind) => ({
      name: `reject lost ${kind} repeated registration`,
      history: { constructed: `round2 registration warning phases` },
      law: `registration`,
      corrupt: (
        trace: ReadonlyArray<{ checkpoint: string; value: unknown }>,
      ) => {
        const altered = structuredClone([...trace])
        const phase = altered.find(
          ({ checkpoint }) => checkpoint === `registration-warnings`,
        )!.value as {
          tests: { repeated: Array<string> }
        }
        const omitted = phase.tests.repeated.findIndex(
          (name) =>
            name.startsWith(`second >`) &&
            (kind === `forced`
              ? name.includes(`forced entered`)
              : name.includes(`calibration: cal-0`)),
        )
        phase.tests.repeated.splice(omitted, 1)
        return altered
      },
    })),
    {
      name: `reject unexpected child error`,
      history: { constructed: `round2 ranked mutant verdicts` },
      law: `trace`,
      corrupt: (trace) => {
        const altered = structuredClone([...trace])
        const child = altered.find(({ checkpoint }) => checkpoint === `child`)!
          .value as {
          exit: number
          unhandled: Array<string>
        }
        child.exit = 1
        child.unhandled.push(`unexpected registration rejection`)
        return altered
      },
    },
    {
      name: `reject equal-data origin substitution`,
      history: { constructed: `review equal fixed originals` },
      law: `calibration`,
      corrupt: (trace) => {
        const altered = structuredClone([...trace])
        const run = altered.find(({ checkpoint }) => checkpoint === `run`)!
          .value as SuiteRun
        for (const entry of run.log)
          if (entry.test.includes(`calibration: cal-0`))
            entry.origin = `fixed:fixed-0`
        return altered
      },
    },
  ],
  owns: [`src/oracle-property.ts`],
  // Each history spawns one to five child Vitest runs.
  timeout: 600_000,
})
