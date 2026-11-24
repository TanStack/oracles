// The parallel CI jobs that split the slow test suites a pull request runs.
//
// Each partition splits one suite's tests between jobs. A shard is either a
// pattern over the test names or `rest`, the selected tests that no other
// shard of its partition takes. The check lists the suite's tests with
// `vitest list` and fails unless every selected test is in exactly one
// shard, no other test is in any shard, and every test that a shard names
// exists. So the jobs together
// run exactly the tests that one job ran before: a test in no shard would
// leave its law out of CI, and a test in two would run twice. A new test
// lands in the `rest` shard, so the jobs' balance can drift, but no test is
// left out.
//
//   node scripts/pr-shards.mjs check                       checks every
//                                                          partition
//   node scripts/pr-shards.mjs pattern <partition> <shard> prints the
//                                                          shard's `-t`
//                                                          pattern
//
// A pattern matches a test's full name, its suite's name and its own,
// joined as Vitest 4 joins them (a space) or as Vitest 5 does (` > `). A
// space followed by `> ` is no separator: otherwise a negative lookahead
// after it would pass on the `> ` of a Vitest 5 name and select every test.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`)
const anyOf = (names) => `(?:${names.map(escape).join(`|`)})`
const rest = Symbol(`rest`)

// The self-oracle's test names, split by the start of the name after its
// kind (`determinism: fixed history: `, `fixed history: `, `calibration: `):
// each list holds the starts of one shard's names, measured in CI.
const detFixedA = [
  'P',
  'U',
  'a U',
  'a b',
  'a cal',
  'a campaign r',
  'a campaign wh',
  'a campaign wi',
  'a cl',
  'a co',
  'a d',
  'a f',
  'a g',
  'a l',
  'a m',
  'a p',
  'a r',
  'a s',
  'a u',
  'a v',
  'an E',
  'an a',
  'an e',
  'an observed a',
]
const detFixedB = [
  'an observed c',
  'an observed d',
  'an observed e',
  'an observed f',
  'an observed m',
  'an observed o',
  'an observed p',
  'an observed s',
  'an observed t',
  'an or',
  'an ow',
  'an u',
  'b',
  'c',
  'd',
  'e',
  'f',
  'h',
  'i',
  'o',
  'p',
  'rea',
  'reg',
  'review a',
  'review c',
  'review d',
  'review e',
  'review f',
  'review o',
  'review s',
  'round10 opaque c',
]
const detFixedC = [
  'round10 opaque r',
  'round11',
  'round2 a',
  'round2 b',
  'round2 c',
  'round2 d',
  'round2 f',
  'round2 g',
  'round2 i',
  'round2 r',
  'round2 s',
  'round2 u',
  'round2 v',
  'round2 w',
  'round3 d',
  'round3 e',
  'round3 f',
  'round3 i',
  'round3 n',
  'round3 o',
  'round3 p',
  'round3 r',
  'round4',
  'round5',
  'round7',
  'round8',
  'round9',
  's',
  'th',
  'ti',
  'tw',
  'u',
]
const fixedA = [
  'P',
  'U',
  'a U',
  'a b',
  'a cal',
  'a campaign r',
  'a campaign wh',
  'a campaign wi',
  'a cl',
  'a co',
  'a d',
  'a f',
  'a g',
  'a l',
  'a m',
  'a p',
  'a r',
  'a s',
  'a u',
  'a v',
  'an E',
  'an a',
  'an e',
  'an observed a',
  'an observed c',
  'an observed d',
  'an observed e',
  'an observed f',
  'an observed m',
  'an observed o',
  'an observed p',
  'an observed s',
  'an observed t',
  'an or',
  'an ow',
  'an u',
  'b',
]
const fixedB = [
  'c',
  'd',
  'e',
  'f',
  'h',
  'i',
  'o',
  'p',
  're',
  'round1',
  'round2',
  'round3',
  'round4',
  'round5',
  'round7',
  'round8',
  'round9',
  's',
  't',
  'u',
]
const calibration1 = [
  'reject a',
  'reject callback b',
  'reject callback e',
  'reject callback r',
  'reject callback s',
  'reject ch',
  'reject duplicate a',
  'reject duplicate b',
  'reject duplicate e',
  'reject duplicate re',
]
const calibration2 = [
  'reject duplicate ru',
  'reject duplicate s',
  'reject duplicate u',
  'reject e',
  'reject l',
  'reject m',
  'reject omit a',
  'reject omit b',
  'reject omit e',
  'reject omit re',
  'reject omit ru',
  'reject omit s',
]
const calibration3 = [
  'reject omit u',
  'reject r',
  'reject s',
  'reject timeout b',
  'reject timeout c',
  'reject timeout e',
  'reject timeout i',
  'reject timeout r',
]
const calibration4 = [
  'reject timeout s',
  'reject too f',
  'reject too m',
  'reject u',
  'reject w',
]
/** Names of a kind whose rest starts with one of `starts`. */
const startsWith = (kind, starts) =>
  `${escape(kind)}(?:${starts.map(escape).join(`|`)}).*`

/**
 * The partitions, with their shards balanced by the costs measured in one
 * local run on an 18-core Mac under other agents' load, at 908b1f9
 * (2026-11-12). CI took about 1.0 times the local time for the framework
 * self-oracle and 1.7 to 2.5 times for the end-to-end oracle.
 */
export const partitions = {
  // The oracleProperty self-oracle: 843 tests, 2,258 s in all, measured in
  // CI on main at e2af13a (run 43266105332), where its three shards took
  // 4:12, 16:12, and 18:09. One file whose tests run in sequence, so a
  // shard's time is the sum of its tests. Eight shards of 195 to 330 s:
  // the fixed histories' determinism units in three, the constructed
  // histories' determinism units, the fixed histories and the calibrations
  // in three, and the rest (the seeded units, 312 s, and any new kind).
  'oracle-framework': {
    args: [`--config`, `vitest.oracle-framework.config.mjs`],
    suite: `self-oracle.framework`,
    select: ``,
    // Packed to about 9 minutes a job (register M, 2026-11-17, "Pack CI jobs
    // to about 9 min"), from CI runs 44198893231 (59b5c449), 44279328397
    // (deb5997f) and 44283777367 (cf2bca81). Two determinism shards together
    // ran 8m37s and 9m42s, so each runs alone. The first half of the
    // random-seed campaign units runs alone too (beside a determinism shard
    // it ran 7m59s and 9m42s, run 44297247671), and the last calibrations
    // run beside the second half, in the rest. The campaign
    // units run one fixed base and one drawn from the run's seed (#122).
    shards: {
      1: startsWith(`determinism: fixed history: `, detFixedA),
      2: startsWith(`determinism: fixed history: `, detFixedB),
      3: startsWith(`determinism: fixed history: `, detFixedC),
      4: `determinism: constructed history: .*`,
      5: `(?:${startsWith(`fixed history: `, fixedA)}|${startsWith(`calibration: `, calibration1)})`,
      6: `(?:${startsWith(`fixed history: `, fixedB)}|${startsWith(`calibration: `, calibration2)})`,
      7: `fixed seed 1: .*`,
      // The first half of the random-seed campaign units: its bases vary from
      // run to run, and beside a determinism shard it ran 7m59s and 9m42s.
      8: `random seed: (?:[a-q]|r(?!ound[3-9])).*`,
      // The rest: the second half of the random-seed campaign units (3m59s),
      // the last calibrations (3m19s), and any new kind.
      9: rest,
    },
  },
  // The gap report's static oracle, the slowest of the fast gap suites and
  // a file whose units run one after another: 171 units, 136 s on the gap
  // CLI's runtime branch, against 98 s on main at 09f5b9d, in one local run
  // under other agents' load. CI took 4.5 to 5 times its local time in
  // #39's run, since each history runs the CLI. The first shard takes the
  // two generated units and the calibrations, 66 s; the second the rest,
  // 70 s. The classify, probe-form, and mutant-validity oracles run whole
  // in a third job (`.github/workflows/pr.yml`).
  'oracle-gaps-static': {
    args: [`--config`, `oracle-gaps/vitest.config.mjs`, `gap-report-static`],
    suite: `oracle-gaps.report-static`,
    select: ``,
    shards: {
      1: `(?:fixed seed 20261105: generated|random seed: generated|calibration: .*)`,
      2: rest,
    },
  },
  // The end-to-end gap oracle's fixed-seed units, which a pull request runs
  // (`-t "fixed seed"`): 87 units, packed longest first into four shards of
  // 401 s of weight: about 7 minutes a job. Three shards would reach 533 s
  // (main's own third shard ran 11.2 minutes with #131's units). The CI
  // times come from each unit's reach line, since this job's reporter
  // prints no durations.
  // Weights (merged with main at 9881146, #131): each unit weighs the larger
  // of its longest CI time in runs 44200775802, 44216367366, 44221410343 and
  // 44225053167 and its longest passing time on the Arca pool at 7e0d436
  // (tags r90e-*; and r90b-* at 7418dcc) times the median CI/Arclet ratio of
  // its kind (1.9). A packing is judged by its worst shard under each measured
  // seed (CI as measured, Arclet times the ratio), against the maintainer's
  // decision "Pack CI jobs to about 9 min" (2026-11-17; P12: never over 10).
  'oracle-gaps-fixed-seed': {
    args: [`--config`, `oracle-gaps/vitest.config.mjs`, `gap-report-oracle`],
    suite: `oracle-gaps.report`,
    select: `fixed seed 20261105: `,
    // The tests that one job selected before: the shards together must
    // select exactly these.
    previously: `fixed seed`,
    shards: {
      // 434 s of measured weight (CI, scaled from Arclet r99-green-fixed by 1.58).
      1: anyOf([
        `a .cjs config that calls require`,
        `a config whose plugin loads test files with a sync read`,
        `a config whose test root is above the package`,
        `a copy beside the runner's pending timer`,
        `a copy waiting on a timer`,
        `a daemon check with the default output directory, unsupervised`,
        `a daemon start slower than the bound`,
        `a declaration fault: badEntry`,
        `a declaration fault: outsideSource`,
        `a lazy module loaded before a hang in the same batch`,
        `a package whose parent directory has its config`,
        `a probe branch under a generated test's work bound`,
        `a property test's count cut lands in its first part after a run with no positive n`,
        `a slow kill after a 22 s wait, past the old backstop`,
        `a start refuses an empty claim`,
        `a stop before the CLI starts, after a stopped check`,
        `a stop by SIGTERM as the CLI starts`,
        `an authored mutant whose owner hangs`,
        `an edit sequence over the witness module, the first half`,
        `an edit to data that only a spun copy reads`,
        `an unsupervised run stopped after its note`,
        `ordinary tests left out by default`,
        `two runs on one output directory`,
      ]),
      // 434 s of measured weight (CI, scaled from Arclet r99-green-fixed by 1.58).
      2: anyOf([
        `a .ts config in a package with no module type that calls require`,
        `a batch whose run rejects`,
        `a clocked owner beside a counted one under the work budget`,
        `a config whose test root holds no test file`,
        `a config whose test root is a symbolic link`,
        `a declaration fault: brokenOwner`,
        `a declaration fault: configNoDefault`,
        `a declaration fault: configNull`,
        `a declaration fault: projects`,
        `a declaration fault: setupThrows, then the abort stop`,
        `a property test's later run spins into bounded work`,
        `a reset check after its warm daemon was replaced`,
        `a run after a killed CLI`,
        `a stop before the CLI starts`,
        `a stop with the default output directory`,
        `a supervised child exits when its supervisor is killed`,
        `a value change at a ?. read and at a return`,
        `an edit that changed the cold result after a hang replaced the only context`,
        `an edit to a module that only mutated runs load`,
        `an edit to data a test reads through fs (sync)`,
        `an unchanged check through the daemon while a test reads a source through fs`,
        `generated`,
        `two starts race for a stale claim`,
      ]),
      // 434 s of measured weight (CI, scaled from Arclet r99-green-fixed by 1.58).
      3: anyOf([
        `a ?. read of an object absent only at load`,
        `a check whose daemon stops answering`,
        `a clocked copy that spins`,
        `a copy beside the runner's pending write`,
        `a declaration fault: configThrows`,
        `a declaration fault: noTypescript`,
        `a declaration fault: nonLiteral`,
        `a declaration fault: setupThrows`,
        `a hang in a file whose test does a short read`,
        `a later owner's kill joined before an earlier owner's hang under four contexts`,
        `a module data mutant whose owner file holds no plan test`,
        `a slow but healthy warm-up`,
        `a slow kill after a 16 s wait`,
        `a slow owner's kill and another owner's kill`,
        `a start refuses a dangling claim`,
        `a stream log lost after its note, then stopped`,
        `a supervised check with no ps on its PATH`,
        `a test edits the data it read, during a check through the daemon`,
        `an ambiguous authored mutant`,
        `an edit to data a test reads through fs (callback)`,
        `an edit to data a test reads through fs (statDir)`,
        `every outcome class`,
        `every outcome class, the abort stop`,
        `test.projects in a parent's config`,
      ]),
      // 434 s of measured weight (CI, scaled from Arclet r99-green-fixed by 1.58).
      4: anyOf([
        `a capture row read while the worker wrote it`,
        `a check through the daemon that works past the bound`,
        `a config fault in a run that owns nothing`,
        `a config whose test root is a subdirectory that holds the tests`,
        `a copy waiting on an unref'd timer`,
        `a daemon pause that cannot engage`,
        `a declaration fault: apiLessTypescript`,
        `a declaration fault: missingSource`,
        `a flaky owner's loop calls under the call budget`,
        `a heavy test that reads the clock first`,
        `a load failure beside a hang`,
        `a module data mutant judged past nondeterministic plan tests`,
        `a refused run beside the CLI's directory, under a name that extends it`,
        `a second daemon check of the budget witness`,
        `a spin after a short async read`,
        `a start refuses a stale claim`,
        `a stop as the CLI starts`,
        `a stream log lost after its note, then completed`,
        `a test edits the helper it read, during a check through the daemon`,
        `an awaiting config in a package with no module type`,
        `an edit sequence through the daemon`,
        `an edit to data that only a copy spun alone reads`,
        `two authored mutants`,
        `two batches each read a capture row while its worker wrote it`,
      ]),
      // 434 s of measured weight (CI, scaled from Arclet r99-green-fixed by 1.58).
      5: anyOf([
        `a backstop cut ends the copies ahead of a later kill`,
        `a check abandoned while a context warms in place of a cut one`,
        `a config that --config names`,
        `a copy waiting on a pipe it opened`,
        `a daemon check with the default output directory`,
        `a declaration fault: brokenVitest`,
        `a declaration fault: configSyntax`,
        `a failing owner under a config that --config names`,
        `a failing owner under its parent's config`,
        `a heavy test that reads the clock after its work`,
        `a kill past the work budget in a later owner`,
        `a later owner's test listed first beside an earlier owner's hang`,
        `a package with no config`,
        `a run with eleven contexts`,
        `a stale authored mutant and a reformat`,
        `a start refuses an unreadable claim`,
        `a stream log lost after its note, then stopped, unsupervised`,
        `a stream log that cannot be written`,
        `an authored mutant whose owner spins`,
        `an edit during a check through the daemon`,
        `an edit sequence over the witness module, the second half`,
        `an edit to data a test reads through fs (promise)`,
        `an unchanged check through the daemon under a config's pre plugin`,
        `every outcome class, the warm stop`,
      ]),
    },
  },
  // The end-to-end gap oracle's random units, which every pull request runs
  // (maintainer decision CI-1; v21.2 P4, R26): each run draws a fresh
  // campaign seed, and a failing unit prints its replay line and its
  // history. 87 units, packed longest first into four shards of 560 s of
  // weight. Under the 12 measured seeds the worst shard is 475 s of tests,
  // about 8.4 minutes a job. Three shards were too few: under seed
  // 1047281476 one took 570 s of tests and its job 10:00 (run 44221410343).
  // CI's random units do not shrink (GAP_E2E_SHRINKS=0, pr.yml), so a
  // failing seed's job takes about its passing time.
  // Weights (merged with main at 9881146, #131): each unit weighs the larger
  // of its longest CI time in runs 44200775802, 44216367366, 44221410343 and
  // 44225053167 and its longest passing time on the Arca pool at 7e0d436
  // (tags r90e-*; and r90b-* at 7418dcc) times the median CI/Arclet ratio of
  // its kind (1.22). A packing is judged by its worst shard under each measured
  // seed (CI as measured, Arclet times the ratio), against the maintainer's
  // decision "Pack CI jobs to about 9 min" (2026-11-17; P12: never over 10).
  'oracle-gaps-random': {
    args: [`--config`, `oracle-gaps/vitest.config.mjs`, `gap-report-oracle`],
    suite: `oracle-gaps.report`,
    select: `random seed: `,
    // Every name is checked against the listed tests (partitionErrors).
    exactNames: true,
    shards: {
      // 387 s of measured weight (CI run 45339396414).
      1: anyOf([
        `a .ts config in a package with no module type that calls require`,
        `a backstop cut ends the copies ahead of a later kill`,
        `a config whose plugin loads test files with a sync read`,
        `a copy waiting on an unref'd timer`,
        `a daemon check with the default output directory`,
        `a declaration fault: brokenOwner`,
        `a declaration fault: configNull`,
        `a declaration fault: missingSource`,
        `a declaration fault: outsideSource`,
        `a module data mutant whose owner file holds no plan test`,
        `a property test's count cut lands in its first part after a run with no positive n`,
        `a slow kill after a 16 s wait`,
        `a spin after a short async read`,
        `a start refuses a stale claim`,
        `a start refuses an empty claim`,
        `a stop before the CLI starts, after a stopped check`,
        `a stop by SIGTERM as the CLI starts`,
        `a stream log lost after its note, then stopped`,
        `a supervised child exits when its supervisor is killed`,
        `a test edits the helper it read, during a check through the daemon`,
        `an authored mutant whose owner hangs`,
        `an edit that changed the cold result after a hang replaced the only context`,
        `an edit to data a test reads through fs (promise)`,
        `two starts race for a stale claim`,
      ]),
      // 387 s of measured weight (CI run 45339396414).
      2: anyOf([
        `a capture row read while the worker wrote it`,
        `a check through the daemon that works past the bound`,
        `a clocked owner beside a counted one under the work budget`,
        `a config whose test root is a subdirectory that holds the tests`,
        `a daemon check with the default output directory, unsupervised`,
        `a declaration fault: configNoDefault`,
        `a declaration fault: configThrows`,
        `a kill past the work budget in a later owner`,
        `a lazy module loaded before a hang in the same batch`,
        `a property test's later run spins into bounded work`,
        `a slow but healthy warm-up`,
        `a slow kill after a 22 s wait, past the old backstop`,
        `a start refuses a dangling claim`,
        `a test edits the data it read, during a check through the daemon`,
        `an ambiguous authored mutant`,
        `an authored mutant whose owner spins`,
        `an edit to data a test reads through fs (callback)`,
        `an edit to data that only a spun copy reads`,
        `an unchanged check through the daemon while a test reads a source through fs`,
        `every outcome class, the abort stop`,
        `every outcome class, the warm stop`,
        `ordinary tests left out by default`,
        `test.projects in a parent's config`,
      ]),
      // 387 s of measured weight (CI run 45339396414).
      3: anyOf([
        `a check abandoned while a context warms in place of a cut one`,
        `a check whose daemon stops answering`,
        `a config fault in a run that owns nothing`,
        `a config that --config names`,
        `a config whose test root holds no test file`,
        `a copy waiting on a pipe it opened`,
        `a copy waiting on a timer`,
        `a declaration fault: apiLessTypescript`,
        `a declaration fault: configSyntax`,
        `a failing owner under a config that --config names`,
        `a heavy test that reads the clock after its work`,
        `a load failure beside a hang`,
        `a module data mutant judged past nondeterministic plan tests`,
        `a package whose parent directory has its config`,
        `a reset check after its warm daemon was replaced`,
        `a run after a killed CLI`,
        `a run with eleven contexts`,
        `a second daemon check of the budget witness`,
        `a start refuses an unreadable claim`,
        `a stop as the CLI starts`,
        `a value change at a ?. read and at a return`,
        `an edit sequence through the daemon`,
        `an edit to data a test reads through fs (statDir)`,
      ]),
      // 387 s of measured weight (CI run 45339396414).
      4: anyOf([
        `a clocked copy that spins`,
        `a config whose test root is above the package`,
        `a daemon pause that cannot engage`,
        `a daemon start slower than the bound`,
        `a declaration fault: badEntry`,
        `a declaration fault: brokenVitest`,
        `a declaration fault: nonLiteral`,
        `a failing owner under its parent's config`,
        `a later owner's test listed first beside an earlier owner's hang`,
        `a package with no config`,
        `a probe branch under a generated test's work bound`,
        `a refused run beside the CLI's directory, under a name that extends it`,
        `a stop before the CLI starts`,
        `a stream log lost after its note, then completed`,
        `a stream log lost after its note, then stopped, unsupervised`,
        `a stream log that cannot be written`,
        `a supervised check with no ps on its PATH`,
        `an awaiting config in a package with no module type`,
        `an edit during a check through the daemon`,
        `an edit sequence over the witness module, the second half`,
        `an edit to a module that only mutated runs load`,
        `an edit to data a test reads through fs (sync)`,
        `an unchanged check through the daemon under a config's pre plugin`,
        `two batches each read a capture row while its worker wrote it`,
        `two runs on one output directory`,
      ]),
      // 387 s of measured weight (CI run 45339396414).
      5: anyOf([
        `generated`,
        `a .cjs config that calls require`,
        `a ?. read of an object absent only at load`,
        `a batch whose run rejects`,
        `a config whose test root is a symbolic link`,
        `a copy beside the runner's pending timer`,
        `a copy beside the runner's pending write`,
        `a declaration fault: noTypescript`,
        `a declaration fault: projects`,
        `a declaration fault: setupThrows`,
        `a declaration fault: setupThrows, then the abort stop`,
        `a flaky owner's loop calls under the call budget`,
        `a hang in a file whose test does a short read`,
        `a heavy test that reads the clock first`,
        `a later owner's kill joined before an earlier owner's hang under four contexts`,
        `a slow owner's kill and another owner's kill`,
        `a stale authored mutant and a reformat`,
        `a stop with the default output directory`,
        `an edit sequence over the witness module, the first half`,
        `an edit to data that only a copy spun alone reads`,
        `an unsupervised run stopped after its note`,
        `every outcome class`,
        `two authored mutants`,
      ]),
    },
  },
  // The end-to-end gap oracle's determinism units, which every pull request
  // runs, in blocking jobs (the maintainer's decision "#90 job stays
  // blocking", 2026-11-16; v21.2 R55 (a)). Each unit runs one history twice
  // and compares the two traces: results and fixed lines, not the heartbeats,
  // which are progress (maintainer decision, 2026-11-14; v21.2 R52). 89
  // units. Six shards hold 490 s of measured weight each, and the seventh
  // (`rest`) the remaining 317 s and the untimed units. The weights are the
  // mean of each unit's time in two CI runs at a1e1c140 and 4626959b (the
  // per-backstop limit in place); the runs' job sums differed by about 10%.
  // The witness module's edit sequence runs as two halves,
  // where the whole took 344 to 364 s on an Arclet (#106). Every unit is in
  // a shard: the daemon edit sequence (#92, fixed by #126) passed 4 of 4 and
  // the daemon pause that cannot engage (#105) 6 of 6 on this branch.
  // Weights (merged with main at 9881146, #131): each unit weighs the larger
  // of its longest CI time in runs 44200775802, 44216367366, 44221410343 and
  // 44225053167 and its longest passing time on the Arca pool at 7e0d436
  // (tags r90e-*; and r90b-* at 7418dcc) times the median CI/Arclet ratio of
  // its kind (1.58). A packing is judged by its worst shard under each measured
  // seed (CI as measured, Arclet times the ratio), against the maintainer's
  // decision "Pack CI jobs to about 9 min" (2026-11-17; P12: never over 10).
  'oracle-gaps-determinism': {
    args: [`--config`, `oracle-gaps/vitest.config.mjs`, `gap-report-oracle`],
    suite: `oracle-gaps.report`,
    select: `determinism: `,
    // Every name is checked against the listed tests (partitionErrors).
    exactNames: true,
    shards: {
      // 467 s of measured weight (CI run 45339396414).
      1: anyOf([
        `constructed history: a config fault in a run that owns nothing`,
        `constructed history: a config whose test root holds no test file`,
        `constructed history: a copy beside the runner's pending timer`,
        `constructed history: a declaration fault: configNoDefault`,
        `constructed history: a declaration fault: nonLiteral`,
        `constructed history: a property test's later run spins into bounded work`,
        `constructed history: a run with eleven contexts`,
        `constructed history: a supervised child exits when its supervisor is killed`,
        `constructed history: an authored mutant whose owner hangs`,
        `constructed history: two runs on one output directory`,
        `generated 2`,
      ]),
      // 467 s of measured weight (CI run 45339396414).
      2: anyOf([
        `constructed history: a clocked copy that spins`,
        `constructed history: a config whose test root is a symbolic link`,
        `constructed history: a copy waiting on an unref'd timer`,
        `constructed history: a daemon start slower than the bound`,
        `constructed history: a declaration fault: badEntry`,
        `constructed history: a hang in a file whose test does a short read`,
        `constructed history: a probe branch under a generated test's work bound`,
        `constructed history: a spin after a short async read`,
        `constructed history: a stop by SIGTERM as the CLI starts`,
        `constructed history: a stream log lost after its note, then stopped, unsupervised`,
        `constructed history: an edit to data a test reads through fs (callback)`,
        `constructed history: an edit to data a test reads through fs (promise)`,
        `constructed history: every outcome class`,
        `constructed history: test.projects in a parent's config`,
      ]),
      // 467 s of measured weight (CI run 45339396414).
      3: anyOf([
        `constructed history: a copy beside the runner's pending write`,
        `constructed history: a daemon check with the default output directory`,
        `constructed history: a daemon check with the default output directory, unsupervised`,
        `constructed history: a declaration fault: configThrows`,
        `constructed history: a declaration fault: setupThrows`,
        `constructed history: a property test's count cut lands in its first part after a run with no positive n`,
        `constructed history: a slow but healthy warm-up`,
        `constructed history: a start refuses a dangling claim`,
        `constructed history: a start refuses a stale claim`,
        `constructed history: a stop before the CLI starts, after a stopped check`,
        `constructed history: an edit to data a test reads through fs (sync)`,
        `constructed history: every outcome class, the warm stop`,
        `constructed history: ordinary tests left out by default`,
        `fixed history: a module array mutant judged past nondeterministic plan tests under a daemon pause`,
        `fixed history: a module object field-drop judged past a console test`,
      ]),
      // 466 s of measured weight (CI run 45339396414).
      4: anyOf([
        `constructed history: a batch whose run rejects`,
        `constructed history: a config whose test root is above the package`,
        `constructed history: a copy waiting on a timer`,
        `constructed history: a daemon pause that cannot engage`,
        `constructed history: a declaration fault: brokenVitest`,
        `constructed history: a declaration fault: configNull`,
        `constructed history: a failing owner under a config that --config names`,
        `constructed history: a kill past the work budget in a later owner`,
        `constructed history: a lazy module loaded before a hang in the same batch`,
        `constructed history: a second daemon check of the budget witness`,
        `constructed history: a slow owner's kill and another owner's kill`,
        `constructed history: a stale authored mutant and a reformat`,
        `constructed history: a stop as the CLI starts`,
        `constructed history: a stream log lost after its note, then completed`,
        `constructed history: a stream log that cannot be written`,
        `constructed history: an ambiguous authored mutant`,
        `constructed history: an edit sequence over the witness module, the second half`,
      ]),
      // 467 s of measured weight (CI run 45339396414).
      5: anyOf([
        `constructed history: a capture row read while the worker wrote it`,
        `constructed history: a config whose plugin loads test files with a sync read`,
        `constructed history: a declaration fault: projects`,
        `constructed history: a declaration fault: setupThrows, then the abort stop`,
        `constructed history: a later owner's kill joined before an earlier owner's hang under four contexts`,
        `constructed history: a later owner's test listed first beside an earlier owner's hang`,
        `constructed history: a module data mutant judged past nondeterministic plan tests`,
        `constructed history: a module data mutant whose owner file holds no plan test`,
        `constructed history: a refused run beside the CLI's directory, under a name that extends it`,
        `constructed history: a reset check after its warm daemon was replaced`,
        `constructed history: a slow kill after a 16 s wait`,
        `constructed history: a slow kill after a 22 s wait, past the old backstop`,
        `constructed history: a stream log lost after its note, then stopped`,
        `constructed history: an awaiting config in a package with no module type`,
        `constructed history: two batches each read a capture row while its worker wrote it`,
        `fixed history: a filed base whose owner reads an absent object through ?.`,
        `fixed history: a module boolean flip judged past a console test`,
      ]),
      // 467 s of measured weight (CI run 45339396414).
      6: anyOf([
        `constructed history: a .cjs config that calls require`,
        `constructed history: a backstop cut ends the copies ahead of a later kill`,
        `constructed history: a check abandoned while a context warms in place of a cut one`,
        `constructed history: a clocked owner beside a counted one under the work budget`,
        `constructed history: a flaky owner's loop calls under the call budget`,
        `constructed history: a heavy test that reads the clock first`,
        `constructed history: a load failure beside a hang`,
        `constructed history: a package whose parent directory has its config`,
        `constructed history: a start refuses an unreadable claim`,
        `constructed history: a test edits the helper it read, during a check through the daemon`,
        `constructed history: an edit sequence over the witness module, the first half`,
        `constructed history: an edit to a module that only mutated runs load`,
        `constructed history: an edit to data that only a copy spun alone reads`,
        `constructed history: an unchanged check through the daemon under a config's pre plugin`,
        `constructed history: two starts race for a stale claim`,
        `generated 1`,
      ]),
      // 467 s of measured weight (CI run 45339396414).
      7: anyOf([
        `constructed history: a ?. read of an object absent only at load`,
        `constructed history: a check through the daemon that works past the bound`,
        `constructed history: a check whose daemon stops answering`,
        `constructed history: a config that --config names`,
        `constructed history: a copy waiting on a pipe it opened`,
        `constructed history: a declaration fault: missingSource`,
        `constructed history: a failing owner under its parent's config`,
        `constructed history: a stop before the CLI starts`,
        `constructed history: a stop with the default output directory`,
        `constructed history: a test edits the data it read, during a check through the daemon`,
        `constructed history: an edit during a check through the daemon`,
        `constructed history: an edit sequence through the daemon`,
        `constructed history: an edit to data a test reads through fs (statDir)`,
        `constructed history: an unchanged check through the daemon while a test reads a source through fs`,
        `constructed history: an unsupervised run stopped after its note`,
        `constructed history: two authored mutants`,
        `generated 0`,
      ]),
      // 466 s of measured weight (CI run 45339396414).
      8: anyOf([
        `constructed history: a .ts config in a package with no module type that calls require`,
        `constructed history: a config whose test root is a subdirectory that holds the tests`,
        `constructed history: a declaration fault: apiLessTypescript`,
        `constructed history: a declaration fault: brokenOwner`,
        `constructed history: a declaration fault: configSyntax`,
        `constructed history: a declaration fault: noTypescript`,
        `constructed history: a declaration fault: outsideSource`,
        `constructed history: a heavy test that reads the clock after its work`,
        `constructed history: a package with no config`,
        `constructed history: a run after a killed CLI`,
        `constructed history: a start refuses an empty claim`,
        `constructed history: a supervised check with no ps on its PATH`,
        `constructed history: a value change at a ?. read and at a return`,
        `constructed history: an authored mutant whose owner spins`,
        `constructed history: an edit that changed the cold result after a hang replaced the only context`,
        `constructed history: an edit to data that only a spun copy reads`,
        `constructed history: every outcome class, the abort stop`,
      ]),
    },
  },
  'oracle-gaps-static-windows': {
    args: [`--config`, `oracle-gaps/vitest.config.mjs`, `gap-report-static`],
    suite: `oracle-gaps.report-static`,
    select: ``,
    // Windows runs on its own partition: the same tests, in six shards,
    // because each Linux shard takes 3 to 6 times as long on windows-latest.
    shards: {
      // Packed to about 9 minutes a job (register M, 2026-11-17, "Pack CI
      // jobs to about 9 min"): the six shards took 1m32s to 3m00s each at
      // #122's 59b5c449, so they run as two.
      1: anyOf([
        ...[
          "calibration: a derived class's super call is made conditional",
          'calibration: a refusal names another cause',
          'calibration: production code is marked as probe code',
          'determinism: constructed history: a declaration fault: outsideSource',
          'determinism: constructed history: a source in another letter case',
          'determinism: constructed history: an owns that is not a literal in a expect-aliased assertion refuses nothing',
          'determinism: constructed history: an owns that is not a literal in a node-assert-default assertion refuses nothing',
          'determinism: constructed history: bad arguments: directoryConfig',
          'determinism: constructed history: bad arguments: mutantLacksField',
          'determinism: constructed history: bad arguments: repeatedMutantIds',
          'determinism: constructed history: no oracle file refuses the run',
          'determinism: generated 1',
          'fixed seed 20261105: a declaration fault: outsideSource',
          'fixed seed 20261105: a source in another letter case',
          'fixed seed 20261105: an owns that is not a literal in a expect-aliased assertion refuses nothing',
          'fixed seed 20261105: an owns that is not a literal in a node-assert-default assertion refuses nothing',
          'fixed seed 20261105: bad arguments: directoryConfig',
          'fixed seed 20261105: bad arguments: mutantLacksField',
          'fixed seed 20261105: bad arguments: repeatedMutantIds',
          'fixed seed 20261105: module data owned by readers and by name',
          'random seed: a bad entry in a run with no owner names the bad entry',
          'random seed: a derived class calling super after ||',
          'random seed: a whole-file owner',
          'random seed: an owns that is not a literal in a expect-computed assertion refuses nothing',
          'random seed: an owns that is not a literal in a node-assert-namespace assertion refuses nothing',
          'random seed: bad arguments: envPrefix',
          'random seed: bad arguments: noSource',
          'random seed: bad arguments: unknown',
          'random seed: no owns entry refuses the run',
        ],
        ...[
          'calibration: a key drops its statement',
          'calibration: a refusal prints a stack trace, as a crash does',
          'calibration: the instrumented derived class differs with no mutant active',
          'determinism: constructed history: a derived class calling super after &&',
          'determinism: constructed history: a source through a link to the package',
          'determinism: constructed history: an owns that is not a literal in a expect-argument assertion refuses nothing',
          'determinism: constructed history: an owns that is not a literal in a node-assert-named assertion refuses nothing',
          'determinism: constructed history: bad arguments: directorySource',
          'determinism: constructed history: bad arguments: noPackage',
          'determinism: constructed history: bad arguments: seed',
          'determinism: constructed history: no owns entry refuses the run',
          'determinism: generated 2',
          'fixed seed 20261105: a derived class calling super after &&',
          'fixed seed 20261105: a source through a link to the package',
          'fixed seed 20261105: an owns that is not a literal in a expect-argument assertion refuses nothing',
          'fixed seed 20261105: an owns that is not a literal in a node-assert-named assertion refuses nothing',
          'fixed seed 20261105: bad arguments: directorySource',
          'fixed seed 20261105: bad arguments: noPackage',
          'fixed seed 20261105: bad arguments: seed',
          'fixed seed 20261105: no oracle file refuses the run',
          'random seed: a declaration fault: badEntry',
          'random seed: a derived class calling super in an arrow',
          'random seed: an owns that is not a literal in a assert assertion refuses nothing',
          'random seed: an owns that is not a literal in a expect-not assertion refuses nothing',
          'random seed: bad arguments: absentSource',
          'random seed: bad arguments: missingConfig',
          'random seed: bad arguments: noValue',
          'random seed: every static state',
          'random seed: owns read from both declarations',
        ],
        ...[
          'calibration: a mutant is dropped',
          "calibration: a refusal's fix offers a way around it",
          'determinism: constructed history: a bad entry in a run with no owner names the bad entry',
          'determinism: constructed history: a derived class calling super after ||',
          'determinism: constructed history: a whole-file owner',
          'determinism: constructed history: an owns that is not a literal in a expect-computed assertion refuses nothing',
          'determinism: constructed history: an owns that is not a literal in a node-assert-namespace assertion refuses nothing',
          'determinism: constructed history: bad arguments: envPrefix',
          'determinism: constructed history: bad arguments: noSource',
          'determinism: constructed history: bad arguments: unknown',
          'determinism: constructed history: owns read from both declarations',
          'fixed seed 20261105: a bad entry in a run with no owner names the bad entry',
          'fixed seed 20261105: a derived class calling super after ||',
          'fixed seed 20261105: a whole-file owner',
          'fixed seed 20261105: an owns that is not a literal in a expect-computed assertion refuses nothing',
          'fixed seed 20261105: an owns that is not a literal in a node-assert-namespace assertion refuses nothing',
          'fixed seed 20261105: bad arguments: envPrefix',
          'fixed seed 20261105: bad arguments: noSource',
          'fixed seed 20261105: bad arguments: unknown',
          'fixed seed 20261105: no owns entry refuses the run',
          'random seed: a declaration fault: missingSource',
          'random seed: a literal owns in an assertion makes no oracle file',
          'random seed: an owns that is not a literal in a chai assertion refuses nothing',
          'random seed: an owns that is not a literal in a expect-soft assertion refuses nothing',
          'random seed: bad arguments: badMutantJson',
          'random seed: bad arguments: missingMutants',
          'random seed: bad arguments: outsideSource',
          'random seed: generated',
          'random seed: owns read from oracleProperty',
        ],
      ]),
      2: anyOf([
        ...[
          'calibration: a refusal ends without its done line',
          'calibration: a rune is moved from its place',
          'determinism: constructed history: a declaration fault: badEntry',
          'determinism: constructed history: a derived class calling super in an arrow',
          'determinism: constructed history: an owns that is not a literal in a assert assertion refuses nothing',
          'determinism: constructed history: an owns that is not a literal in a expect-not assertion refuses nothing',
          'determinism: constructed history: bad arguments: absentSource',
          'determinism: constructed history: bad arguments: missingConfig',
          'determinism: constructed history: bad arguments: noValue',
          'determinism: constructed history: every static state',
          'determinism: constructed history: owns read from oracleProperty',
          'fixed seed 20261105: a declaration fault: badEntry',
          'fixed seed 20261105: a derived class calling super in an arrow',
          'fixed seed 20261105: an owns that is not a literal in a assert assertion refuses nothing',
          'fixed seed 20261105: an owns that is not a literal in a expect-not assertion refuses nothing',
          'fixed seed 20261105: bad arguments: absentSource',
          'fixed seed 20261105: bad arguments: missingConfig',
          'fixed seed 20261105: bad arguments: noValue',
          'fixed seed 20261105: every static state',
          'fixed seed 20261105: owns read from both declarations',
          'random seed: a declaration fault: nonLiteral',
          'random seed: a plain-parameter derived class',
          'random seed: an owns that is not a literal in a expect assertion refuses nothing',
          'random seed: an owns that is not a literal in a expect-type-of assertion refuses nothing',
          'random seed: bad arguments: count',
          'random seed: bad arguments: missingPackage',
          'random seed: bad arguments: pool',
          'random seed: module data named by an entry leaves its methods to their callers',
          'random seed: unnamed exports owned through an import',
        ],
        ...[
          'calibration: a refusal exits 1, as a crash does',
          'calibration: an edit moves a key',
          'determinism: constructed history: a declaration fault: missingSource',
          'determinism: constructed history: a literal owns in an assertion makes no oracle file',
          'determinism: constructed history: an owns that is not a literal in a chai assertion refuses nothing',
          'determinism: constructed history: an owns that is not a literal in a expect-soft assertion refuses nothing',
          'determinism: constructed history: bad arguments: badMutantJson',
          'determinism: constructed history: bad arguments: missingMutants',
          'determinism: constructed history: bad arguments: outsideSource',
          'determinism: constructed history: module data named by an entry leaves its methods to their callers',
          'determinism: constructed history: unnamed exports owned through an import',
          'fixed seed 20261105: a declaration fault: missingSource',
          'fixed seed 20261105: a literal owns in an assertion makes no oracle file',
          'fixed seed 20261105: an owns that is not a literal in a chai assertion refuses nothing',
          'fixed seed 20261105: an owns that is not a literal in a expect-soft assertion refuses nothing',
          'fixed seed 20261105: bad arguments: badMutantJson',
          'fixed seed 20261105: bad arguments: missingMutants',
          'fixed seed 20261105: bad arguments: outsideSource',
          'fixed seed 20261105: generated',
          'fixed seed 20261105: owns read from oracleProperty',
          'random seed: a declaration fault: outsideSource',
          'random seed: a source in another letter case',
          'random seed: an owns that is not a literal in a expect-aliased assertion refuses nothing',
          'random seed: an owns that is not a literal in a node-assert-default assertion refuses nothing',
          'random seed: bad arguments: directoryConfig',
          'random seed: bad arguments: mutantLacksField',
          'random seed: bad arguments: repeatedMutantIds',
          'random seed: module data owned by readers and by name',
        ],
        ...[
          'calibration: a refusal gives no fix',
          'calibration: an owned mutant is reported unowned',
          'determinism: constructed history: a declaration fault: nonLiteral',
          'determinism: constructed history: a plain-parameter derived class',
          'determinism: constructed history: an owns that is not a literal in a expect assertion refuses nothing',
          'determinism: constructed history: an owns that is not a literal in a expect-type-of assertion refuses nothing',
          'determinism: constructed history: bad arguments: count',
          'determinism: constructed history: bad arguments: missingPackage',
          'determinism: constructed history: bad arguments: pool',
          'determinism: constructed history: module data owned by readers and by name',
          'determinism: generated 0',
          'fixed seed 20261105: a declaration fault: nonLiteral',
          'fixed seed 20261105: a plain-parameter derived class',
          'fixed seed 20261105: an owns that is not a literal in a expect assertion refuses nothing',
          'fixed seed 20261105: an owns that is not a literal in a expect-type-of assertion refuses nothing',
          'fixed seed 20261105: bad arguments: count',
          'fixed seed 20261105: bad arguments: missingPackage',
          'fixed seed 20261105: bad arguments: pool',
          'fixed seed 20261105: module data named by an entry leaves its methods to their callers',
          'fixed seed 20261105: unnamed exports owned through an import',
          'random seed: a derived class calling super after &&',
          'random seed: a source through a link to the package',
          'random seed: an owns that is not a literal in a expect-argument assertion refuses nothing',
          'random seed: an owns that is not a literal in a node-assert-named assertion refuses nothing',
          'random seed: bad arguments: directorySource',
          'random seed: bad arguments: noPackage',
          'random seed: bad arguments: seed',
          'random seed: no oracle file refuses the run',
        ],
      ]),
    },
  },
  'oracle-gaps-fixed-seed-windows': {
    args: [`--config`, `oracle-gaps/vitest.config.mjs`, `gap-report-oracle`],
    suite: `oracle-gaps.report`,
    select: `fixed seed 20261105: `,
    previously: `fixed seed`,
    // Every name is checked against the listed tests (partitionErrors).
    exactNames: true,
    // Windows runs on its own partition, in ten shards sized by the measured
    // durations (review of #73, P12): the heaviest tests each have a shard of
    // their own, and the rest are dealt out longest-first. Each shard's pattern
    // stays short: cmd.exe limits the command line.
    shards: {
      1: anyOf([
        'an edit sequence over the witness module, the first half',
        'an edit sequence over the witness module, the second half',
      ]),
      2: anyOf(['every outcome class']),
      // #182's constructed history (one unit here, 57 s on the pool).
      3: anyOf([
        'a declaration fault: noTypescript',
        "a later owner's test listed first beside an earlier owner's hang",
        "a flaky owner's loop calls under the call budget",
        "a property test's later run spins into bounded work",
        "a property test's count cut lands in its first part after a run with no positive n",
        "a later owner's kill joined before an earlier owner's hang under four contexts",
      ]),
      4: anyOf(['every outcome class, the warm stop']),
      5: anyOf([
        'an edit sequence through the daemon',
        'every outcome class, the abort stop',
      ]),
      6: anyOf([
        'a batch whose run rejects',
        'a second daemon check of the budget witness',
        'a declaration fault: missingSource',
        'a config fault in a run that owns nothing',
        "test.projects in a parent's config",
        'a declaration fault: projects',
        'a declaration fault: outsideSource',
        'a config whose test root is a subdirectory that holds the tests',
        'a config whose test root is above the package',
        'a config whose test root holds no test file',
        'a config whose test root is a symbolic link',
        'a config whose plugin loads test files with a sync read',
        'a check whose daemon stops answering',
        'two runs on one output directory',
        'a stream log that cannot be written',
        'a start refuses an empty claim',
        // #99's merge-gate witnesses: per-copy no progress, the clocked work-budget rows, clocked by state.
        'a hang in a file whose test does a short read',
        'a clocked owner beside a counted one under the work budget',
        'a spin after a short async read',
        'an authored mutant whose owner spins',
      ]),
      7: anyOf([
        'a daemon pause that cannot engage',
        'an edit to data a test reads through fs (statDir)',
        'an edit to data a test reads through fs (promise)',
        'a declaration fault: brokenOwner',
        'a stale authored mutant and a reformat',
        'two authored mutants',
        'two batches each read a capture row while its worker wrote it',
        'a package whose parent directory has its config',
        'a declaration fault: configSyntax',
        'a declaration fault: nonLiteral',
        'a stop as the CLI starts',
        'a start refuses an unreadable claim',
      ]),
      8: anyOf([
        'a declaration fault: brokenVitest',
        'a test edits the data it read, during a check through the daemon',
        "an unchanged check through the daemon under a config's pre plugin",
        'an unchanged check through the daemon while a test reads a source through fs',
        'a failing owner under a config that --config names',
        'generated',
        'a run with eleven contexts',
        'an awaiting config in a package with no module type',
        'a declaration fault: configNoDefault',
        'a declaration fault: badEntry',
        'an edit to data that only a spun copy reads',
        "a refused run beside the CLI's directory, under a name that extends it",
        'an edit to data that only a copy spun alone reads',
        'a slow but healthy warm-up',
        'a daemon start slower than the bound',
        'a check abandoned while a context warms in place of a cut one',
        'a check through the daemon that works past the bound',
        'a stop with the default output directory',
        'a daemon check with the default output directory',
        'a daemon check with the default output directory, unsupervised',
        // #99's heavy-test witnesses.
        'a heavy test that reads the clock after its work',
        'a heavy test that reads the clock first',
      ]),
      9: anyOf([
        'a lazy module loaded before a hang in the same batch',
        'an edit during a check through the daemon',
        'an ambiguous authored mutant',
        'an edit to data a test reads through fs (sync)',
        "a failing owner under its parent's config",
        'a config that --config names',
        'a capture row read while the worker wrote it',
        'a .ts config in a package with no module type that calls require',
        'ordinary tests left out by default',
        'a declaration fault: configNull',
        'two starts race for a stale claim',
        'a start refuses a stale claim',
        'a stream log lost after its note, then stopped',
        'a stop before the CLI starts',
        'a stop by SIGTERM as the CLI starts',
        'a start refuses a dangling claim',
        'a stop before the CLI starts, after a stopped check',
        'a run after a killed CLI',
        // #99's unsupervised stop after a lost stream log.
        'a stream log lost after its note, then stopped, unsupervised',
      ]),
      10: anyOf([
        'a module data mutant judged past nondeterministic plan tests',
        'a module data mutant whose owner file holds no plan test',
        'an edit that changed the cold result after a hang replaced the only context',
        'a test edits the helper it read, during a check through the daemon',
        'an edit to data a test reads through fs (callback)',
        'an edit to a module that only mutated runs load',
        'a load failure beside a hang',
        'a declaration fault: apiLessTypescript',
        'a declaration fault: setupThrows',
        'a declaration fault: setupThrows, then the abort stop',
        'a .cjs config that calls require',
        'a package with no config',
        'a declaration fault: configThrows',
        'a reset check after its warm daemon was replaced',
        "a probe branch under a generated test's work bound",
        'a stream log lost after its note, then completed',
        'a supervised child exits when its supervisor is killed',
        'an unsupervised run stopped after its note',
        'a supervised check with no ps on its PATH',
        'a value change at a ?. read and at a return',
        'a ?. read of an object absent only at load',
        // #99's deterministic-cuts histories (the 16 s wait is the longest).
        "a slow owner's kill and another owner's kill",
        'a backstop cut ends the copies ahead of a later kill',
        'a kill past the work budget in a later owner',
        'a slow kill after a 16 s wait',
        'a slow kill after a 22 s wait, past the old backstop',
        'a copy waiting on a timer',
        "a copy waiting on an unref'd timer",
        'a copy waiting on a pipe it opened',
        "a copy beside the runner's pending write",
        "a copy beside the runner's pending timer",
        'a clocked copy that spins',
        'an authored mutant whose owner hangs',
      ]),
    },
  },
}

/** A shard's pattern over the name that follows the suite's. */
function bodyOf(partition, shard) {
  const own = partition.shards[shard]
  if (own !== rest) return `${escape(partition.select)}(?:${own})`
  // A rest shard takes what no other shard takes.
  const others = Object.values(partition.shards).filter((body) => body !== rest)
  return `(?!${escape(partition.select)}(?:${others.join(`|`)})$)${escape(partition.select)}.*`
}

/** The `-t` pattern that selects exactly a shard's tests. */
export function patternOf(name, shard) {
  const partition = partitions[name]
  if (partition?.shards[shard] === undefined)
    throw new Error(
      `no shard ${JSON.stringify(shard)} of ${JSON.stringify(name)}; the partitions are ${Object.entries(
        partitions,
      )
        .map(
          ([key, { shards }]) => `${key} (${Object.keys(shards).join(`, `)})`,
        )
        .join(`, `)}`,
    )
  return `^${escape(partition.suite)}(?: > | (?!> ))(?:${bodyOf(partition, shard)})$`
}

/**
 * A partition's errors against the tests that `vitest list` reports: a
 * selected test in no shard or in several, another test in a shard, a test
 * that the old single job selected and the shards do not (or the reverse),
 * and a named test or exception that no longer exists.
 */
export function partitionErrors(name, listed) {
  const partition = partitions[name]
  const errors = []
  const prefix = `${partition.suite} > `
  const patterns = Object.keys(partition.shards).map((shard) => ({
    shard,
    pattern: new RegExp(patternOf(name, shard)),
  }))
  for (const full of listed) {
    // `vitest list` joins the names with ` > `; Vitest 4's `-t` reads them
    // joined with a space, so a pattern must select the test both ways.
    const joined = [full, full.replace(/ > /, ` `)]
    // A shard that selects either join owns the test, and it must select
    // both: in each Vitest version, exactly one shard runs the test.
    const owners = patterns.filter(({ pattern }) =>
      joined.some((text) => pattern.test(text)),
    )
    const whole =
      owners.length === 1 &&
      joined.every((text) => owners[0].pattern.test(text))
    const own = full.startsWith(prefix) ? full.slice(prefix.length) : undefined
    const selected = own !== undefined && own.startsWith(partition.select)
    if (selected && !whole)
      errors.push(
        `${JSON.stringify(full)} is in ${owners.length === 0 ? `no shard` : owners.length === 1 ? `shard ${owners[0].shard} under only one of Vitest's name joins` : `shards ${owners.map(({ shard }) => shard).join(`, `)}`}`,
      )
    if (!selected && owners.length > 0)
      errors.push(`${JSON.stringify(full)} is not selected, but is in a shard`)
    if (
      partition.previously !== undefined &&
      selected !== new RegExp(partition.previously).test(full)
    )
      errors.push(
        `${JSON.stringify(full)} is ${selected ? `` : `not `}selected, but -t ${JSON.stringify(partition.previously)} ${selected ? `did not select` : `selected`} it`,
      )
  }
  const names = new Set(listed)
  for (const exception of partition.exceptions ?? [])
    if (!names.has(`${prefix}${exception}`))
      errors.push(`exception ${JSON.stringify(exception)} names no test`)
  for (const [shard, body] of Object.entries(partition.shards))
    if (
      body !== rest &&
      !listed.some((full) => new RegExp(patternOf(name, shard)).test(full))
    )
      errors.push(`shard ${shard} selects no test`)
  // Every name a shard lists must be a listed test: a name that matches no test
  // is a dead entry (a shard that selects one real test still passes the check above).
  const own = (full) =>
    full.startsWith(prefix) ? full.slice(prefix.length) : undefined
  for (const [shard, body] of Object.entries(partition.shards)) {
    if (body === rest || !partition.exactNames) continue
    // A shard's body is `(?:name|name|…)`, every name escaped.
    const names = body
      .slice(3, -1)
      .split(/(?<!\\)\|/)
      .map((alt) => alt.replace(/\\(.)/g, '$1'))
    for (const entry of names) {
      const exists = listed.some(
        (full) => own(full) === partition.select + entry,
      )
      if (!exists)
        errors.push(`shard ${shard} names no test: ${JSON.stringify(entry)}`)
    }
  }
  return errors
}

// Vitest writes the listing to a file, so no package manager's own stdout line
// (pnpm prints "Scope: ..." in some workspaces) can reach the JSON.
function listed({ args }) {
  const dir = mkdtempSync(join(tmpdir(), `pr-shards-`))
  try {
    const file = join(dir, `list.json`)
    const run = spawnSync(
      `pnpm`,
      [`exec`, `vitest`, `list`, `--json=${file}`, ...args],
      {
        cwd: join(dirname(fileURLToPath(import.meta.url)), `..`),
        encoding: `utf8`,
        maxBuffer: 64 * 1024 * 1024,
      },
    )
    if (run.status !== 0)
      throw new Error(`vitest list failed:\n${run.stderr}${run.stdout}`)
    return JSON.parse(readFileSync(file, `utf8`)).map((test) => test.name)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const [command, ...operands] = process.argv.slice(2)
if (command === `pattern`)
  process.stdout.write(`${patternOf(operands[0], operands[1])}\n`)
else if (command === `check`) {
  const errors = Object.keys(partitions).flatMap((name) =>
    partitionErrors(name, listed(partitions[name])).map(
      (error) => `${name}: ${error}`,
    ),
  )
  if (errors.length > 0) {
    process.stderr.write(
      `The CI shards do not partition the tests:\n${errors.map((error) => `- ${error}`).join(`\n`)}\nEdit packages/oracles/scripts/pr-shards.mjs so each selected test is in exactly one shard.\n`,
    )
    process.exit(1)
  }
  process.stdout.write(
    `${Object.keys(partitions).length} partitions split their tests exactly\n`,
  )
} else if (command !== undefined) {
  process.stderr.write(
    `usage: pr-shards.mjs check | pattern <partition> <shard>\n`,
  )
  process.exit(2)
}
