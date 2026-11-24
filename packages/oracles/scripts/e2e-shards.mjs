// The CI shards of the end-to-end gap oracle
// (oracle-gaps/gap-report-oracle.property.test.mjs).
//
// The oracle runs the real CLI on scratch packages. Its work is CPU-bound, so
// shards run as separate CI jobs, never side by side on one runner. Each
// shard names whole tests of the property. A shard's tests are chosen by
// their measured cost, longest first, so that the slowest shard sets the
// job's time. Every test of the file must be in exactly one shard: a test in
// no shard would leave its law out of CI, and a test in two would run twice.
//
//   node scripts/e2e-shards.mjs check           checks the partition against
//                                               `vitest list`
//   node scripts/e2e-shards.mjs pattern <shard> prints the shard's `-t`
//                                               pattern
//
// The pattern matches a test's full name, its suite's name and its own,
// joined as Vitest 4 joins them (a space) or as Vitest 5 does (` > `).
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const suite = `oracle-gaps.report`

// The shards balance the costs measured in one full run of every unit on
// feat/unit-replay (2026-11-11, an 18-core Mac under other agents' load, one
// Vitest worker): 2,610 s in all, 370 s for the fixed-seed units, 605 s for
// the random units (their cost varies with the drawn seed), 917 s for the
// calibrations, and 718 s for the determinism units. The fixed-seed units
// took 2.36 times the 157 s of an idle run (84cd34a), and CI took 2.31 times
// an idle run, so a shard of about 522 s here is about 221 s idle and 5.5 to
// 8.5 minutes in CI, before job setup. The property registers each campaign
// part, each calibration, and each determinism history as its own test
// (units), so a shard can hold any of them; the slowest unit, the
// determinism of the edit sequence, is 236 s here. The shards are a
// longest-first packing of those costs, listed by kind. A random unit's
// cost follows its seed, so a shard's time varies from run to run. Option M
// of the e2e speed plan bounds the random units' tail: a generated history
// with the witness module takes no steps, and the one edit sequence over it
// is a constructed history. A pull request runs the fixed-seed, random, and
// determinism units as the partitions of pr-shards.mjs; these shards are
// the full-suite plan, which this file's check keeps partitioned.
export const shards = {
  // 522 s in the measured run, about 221 s idle.
  'e2e-1': [
    `fixed seed 20261105: a stop with the default output directory`,
    `fixed seed 20261105: a daemon check with the default output directory`,
    `fixed seed 20261105: a daemon check with the default output directory, unsupervised`,
    `fixed seed 20261105: a stop before the CLI starts`,
    `fixed seed 20261105: a stop before the CLI starts, after a stopped check`,
    `fixed seed 20261105: a run after a killed CLI`,
    `fixed seed 20261105: a stop by SIGTERM as the CLI starts`,
    `fixed seed 20261105: an unsupervised run stopped after its note`,
    `fixed seed 20261105: a start refuses a dangling claim`,
    `fixed seed 20261105: a supervised check with no ps on its PATH`,
    `fixed seed 20261105: a stream log that cannot be written`,
    `fixed seed 20261105: two runs on one output directory`,
    `fixed seed 20261105: a .cjs config that calls require`,
    `fixed seed 20261105: a declaration fault: missingSource`,
    `fixed seed 20261105: a declaration fault: noTypescript`,
    `fixed seed 20261105: a declaration fault: outsideSource`,
    `fixed seed 20261105: a declaration fault: projects`,
    `random seed: a config that --config names`,
    `random seed: a declaration fault: badEntry`,
    `random seed: a failing owner under a config that --config names`,
    `random seed: a load failure beside a hang`,
    `calibration: a key drops its statement text`,
    `calibration: a mutant is dropped from the enumeration`,
    `calibration: an edit moves a key`,
    `determinism: constructed history: a .ts config in a package with no module type that calls require`,
    `determinism: constructed history: a config that --config names`,
    `determinism: constructed history: a declaration fault: badEntry`,
    `determinism: constructed history: a declaration fault: missingSource`,
    `determinism: constructed history: a declaration fault: projects`,
    `determinism: constructed history: a package with no config`,
    `determinism: constructed history: an edit sequence through the daemon`,
    // The witness module's edit sequence (option M): 189 s here, measured
    // with the daemon fix of fix/daemon-current-inputs.
    `determinism: constructed history: an edit sequence over the witness module, the first half`,
    `determinism: constructed history: an edit sequence over the witness module, the second half`,
    // The daemon's law 9 histories cost 3 to 13 s each here (their replays).
    `fixed seed 20261105: an edit that changed the cold result after a hang replaced the only context`,
    `random seed: an edit that changed the cold result after a hang replaced the only context`,
    `determinism: constructed history: an edit that changed the cold result after a hang replaced the only context`,
    // The mid-run edit's histories (law 9): 3.5 to 5 s each here, fixed seed.
    `fixed seed 20261105: an edit during a check through the daemon`,
    `random seed: an edit during a check through the daemon`,
    `determinism: constructed history: an edit during a check through the daemon`,
    `fixed seed 20261105: a test edits the helper it read, during a check through the daemon`,
    `random seed: a test edits the helper it read, during a check through the daemon`,
    `determinism: constructed history: a test edits the helper it read, during a check through the daemon`,
    `fixed seed 20261105: a test edits the data it read, during a check through the daemon`,
    `random seed: a test edits the data it read, during a check through the daemon`,
    `determinism: constructed history: a test edits the data it read, during a check through the daemon`,
    `calibration: the check a mid-run edit did not reach flips a mutant of the editing file`,
    `calibration: the check a mid-run edit reached reports another file's mutant as neither cold run did`,
    `fixed seed 20261105: an unchanged check through the daemon under a config's pre plugin`,
    `random seed: an unchanged check through the daemon under a config's pre plugin`,
    `determinism: constructed history: an unchanged check through the daemon under a config's pre plugin`,
    `fixed seed 20261105: an unchanged check through the daemon while a test reads a source through fs`,
    `random seed: an unchanged check through the daemon while a test reads a source through fs`,
    `determinism: constructed history: an unchanged check through the daemon while a test reads a source through fs`,
    `fixed seed 20261105: a capture row read while the worker wrote it`,
    `fixed seed 20261105: two batches each read a capture row while its worker wrote it`,
    `random seed: a capture row read while the worker wrote it`,
    `random seed: two batches each read a capture row while its worker wrote it`,
    `determinism: constructed history: a capture row read while the worker wrote it`,
    `determinism: constructed history: two batches each read a capture row while its worker wrote it`,
    // The fs-read data histories (law 9): 2.7 to 5.4 s each here, fixed seed.
    `fixed seed 20261105: an edit to data a test reads through fs (sync)`,
    `random seed: an edit to data a test reads through fs (sync)`,
    `determinism: constructed history: an edit to data a test reads through fs (sync)`,
    `fixed seed 20261105: an edit to data a test reads through fs (promise)`,
    `random seed: an edit to data a test reads through fs (promise)`,
    `determinism: constructed history: an edit to data a test reads through fs (promise)`,
    `fixed seed 20261105: an edit to data a test reads through fs (callback)`,
    `random seed: an edit to data a test reads through fs (callback)`,
    `determinism: constructed history: an edit to data a test reads through fs (callback)`,
    `fixed seed 20261105: an edit to data a test reads through fs (statDir)`,
    `random seed: an edit to data a test reads through fs (statDir)`,
    `determinism: constructed history: an edit to data a test reads through fs (statDir)`,
    // Added with the CLI's parent-config discovery (not yet measured).
    `fixed seed 20261105: a package whose parent directory has its config`,
    `random seed: test.projects in a parent's config`,
    `determinism: constructed history: a failing owner under its parent's config`,
  ],
  // 522 s in the measured run, about 221 s idle.
  'e2e-2': [
    `fixed seed 20261105: two starts race for a stale claim`,
    `fixed seed 20261105: a start refuses a stale claim`,
    `fixed seed 20261105: a start refuses an empty claim`,
    `fixed seed 20261105: a start refuses an unreadable claim`,
    `fixed seed 20261105: a supervised child exits when its supervisor is killed`,
    `fixed seed 20261105: a stream log lost after its note, then stopped`,
    `fixed seed 20261105: a stream log lost after its note, then completed`,
    `fixed seed 20261105: a stop as the CLI starts`,
    `fixed seed 20261105: a declaration fault: setupThrows`,
    `fixed seed 20261105: a declaration fault: setupThrows, then the abort stop`,
    `fixed seed 20261105: a package with no config`,
    `fixed seed 20261105: an ambiguous authored mutant`,
    `fixed seed 20261105: generated`,
    `random seed: a config fault in a run that owns nothing`,
    `random seed: a declaration fault: apiLessTypescript`,
    `calibration: a crash is reported as a kill`,
    `calibration: a daemon is left after --stop-daemon`,
    `calibration: a refused run is reported as complete`,
    `determinism: constructed history: a .cjs config that calls require`,
    `determinism: constructed history: a declaration fault: configNoDefault`,
    `determinism: constructed history: a declaration fault: configNull`,
    `determinism: constructed history: a declaration fault: configSyntax`,
    `determinism: constructed history: a declaration fault: outsideSource`,
    `determinism: constructed history: a declaration fault: setupThrows`,
    `determinism: constructed history: a declaration fault: setupThrows, then the abort stop`,
    `determinism: constructed history: a load failure beside a hang`,
    `determinism: constructed history: a stale authored mutant and a reformat`,
    `determinism: constructed history: an awaiting config in a package with no module type`,
    `determinism: constructed history: ordinary tests left out by default`,
    `determinism: generated 0`,
    `determinism: generated 1`,
    // The daemon's law 9 histories cost 3 to 13 s each here (their replays).
    `fixed seed 20261105: an edit to a module that only mutated runs load`,
    `random seed: an edit to a module that only mutated runs load`,
    `determinism: constructed history: an edit to a module that only mutated runs load`,
    // Added with the CLI's parent-config discovery (not yet measured).
    `fixed seed 20261105: a failing owner under its parent's config`,
    `random seed: a package whose parent directory has its config`,
    `determinism: constructed history: test.projects in a parent's config`,
  ],
  // 522 s in the measured run, about 221 s idle.
  'e2e-3': [
    `fixed seed 20261105: a daemon pause that cannot engage`,
    `random seed: a daemon pause that cannot engage`,
    `determinism: constructed history: a daemon pause that cannot engage`,
    `fixed seed 20261105: a reset check after its warm daemon was replaced`,
    `random seed: a reset check after its warm daemon was replaced`,
    `determinism: constructed history: a reset check after its warm daemon was replaced`,
    `fixed seed 20261105: a config whose test root is a subdirectory that holds the tests`,
    `random seed: a config whose test root is a subdirectory that holds the tests`,
    `determinism: constructed history: a config whose test root is a subdirectory that holds the tests`,
    `fixed seed 20261105: a config whose test root is above the package`,
    `random seed: a config whose test root is above the package`,
    `determinism: constructed history: a config whose test root is above the package`,
    `fixed seed 20261105: a config whose test root holds no test file`,
    `random seed: a config whose test root holds no test file`,
    `determinism: constructed history: a config whose test root holds no test file`,
    `fixed seed 20261105: a config whose test root is a symbolic link`,
    `random seed: a config whose test root is a symbolic link`,
    `determinism: constructed history: a config whose test root is a symbolic link`,
    `fixed seed 20261105: a config whose plugin loads test files with a sync read`,
    `random seed: a config whose plugin loads test files with a sync read`,
    `determinism: constructed history: a config whose plugin loads test files with a sync read`,
    `determinism: constructed history: two starts race for a stale claim`,
    `determinism: constructed history: a start refuses a stale claim`,
    `determinism: constructed history: a start refuses an empty claim`,
    `determinism: constructed history: a start refuses an unreadable claim`,
    `determinism: constructed history: a supervised child exits when its supervisor is killed`,
    `determinism: constructed history: a stop before the CLI starts`,
    `determinism: constructed history: a stop before the CLI starts, after a stopped check`,
    `determinism: constructed history: a run after a killed CLI`,
    `determinism: constructed history: a stop by SIGTERM as the CLI starts`,
    `determinism: constructed history: an unsupervised run stopped after its note`,
    `determinism: constructed history: a start refuses a dangling claim`,
    `determinism: constructed history: a supervised check with no ps on its PATH`,
    `determinism: constructed history: a stream log lost after its note, then stopped`,
    `determinism: constructed history: a stream log lost after its note, then completed`,
    `determinism: constructed history: a stop as the CLI starts`,
    `random seed: a stop with the default output directory`,
    `random seed: a daemon check with the default output directory`,
    `random seed: a daemon check with the default output directory, unsupervised`,
    `random seed: a stream log that cannot be written`,
    `random seed: two runs on one output directory`,
    `fixed seed 20261105: a config fault in a run that owns nothing`,
    `fixed seed 20261105: a declaration fault: brokenOwner`,
    `fixed seed 20261105: a declaration fault: configThrows`,
    `fixed seed 20261105: a run with eleven contexts`,
    `fixed seed 20261105: a stale authored mutant and a reformat`,
    `fixed seed 20261105: an awaiting config in a package with no module type`,
    `fixed seed 20261105: every outcome class`,
    `fixed seed 20261105: a batch whose run rejects`,
    `random seed: a batch whose run rejects`,
    `determinism: constructed history: a batch whose run rejects`,
    // The stream calibrations: two runs of the rejected batch each.
    `calibration: a V8 fatal block beside our own line with no prefix`,
    `calibration: a traced warning's frames beside our own line with no prefix`,
    `calibration: an esbuild block beside our own line with no prefix`,
    `calibration: our own indented line with no prefix`,
    `calibration: a win32 abort's native backtrace beside our own line with no prefix`,
    `calibration: a win32 abort's native backtrace with a line that is no frame`,
    `calibration: a win32 abort's native backtrace with a frame-shaped line of ours`,
    `calibration: a win32 abort's native frames without their CRLF lead are strays`,
    `fixed seed 20261105: a check whose daemon stops answering`,
    `random seed: a check whose daemon stops answering`,
    `determinism: constructed history: a check whose daemon stops answering`,
    `fixed seed 20261105: an edit to data that only a spun copy reads`,
    `random seed: an edit to data that only a spun copy reads`,
    `determinism: constructed history: an edit to data that only a spun copy reads`,
    `fixed seed 20261105: a refused run beside the CLI's directory, under a name that extends it`,
    `random seed: a refused run beside the CLI's directory, under a name that extends it`,
    `determinism: constructed history: a refused run beside the CLI's directory, under a name that extends it`,
    `fixed seed 20261105: an edit to data that only a copy spun alone reads`,
    `random seed: an edit to data that only a copy spun alone reads`,
    `determinism: constructed history: an edit to data that only a copy spun alone reads`,
    `fixed seed 20261105: a slow but healthy warm-up`,
    `random seed: a slow but healthy warm-up`,
    `determinism: constructed history: a slow but healthy warm-up`,
    `fixed seed 20261105: a daemon start slower than the bound`,
    `random seed: a daemon start slower than the bound`,
    `determinism: constructed history: a daemon start slower than the bound`,
    `fixed seed 20261105: a check abandoned while a context warms in place of a cut one`,
    `random seed: a check abandoned while a context warms in place of a cut one`,
    `determinism: constructed history: a check abandoned while a context warms in place of a cut one`,
    `fixed seed 20261105: a check through the daemon that works past the bound`,
    `random seed: a check through the daemon that works past the bound`,
    `determinism: constructed history: a check through the daemon that works past the bound`,
    `random seed: a .ts config in a package with no module type that calls require`,
    `random seed: a declaration fault: configThrows`,
    `random seed: a declaration fault: noTypescript`,
    `random seed: a declaration fault: outsideSource`,
    `random seed: a stale authored mutant and a reformat`,
    `random seed: an edit sequence through the daemon`,
    `random seed: every outcome class`,
    `random seed: generated`,
    `random seed: two authored mutants`,
    `determinism: constructed history: a declaration fault: brokenOwner`,
    `determinism: constructed history: a declaration fault: configThrows`,
    `determinism: constructed history: a declaration fault: nonLiteral`,
    // The daemon's law 9 histories cost 3 to 13 s each here (their replays).
    `fixed seed 20261105: a lazy module loaded before a hang in the same batch`,
    `random seed: a lazy module loaded before a hang in the same batch`,
    `determinism: constructed history: a lazy module loaded before a hang in the same batch`,
    // Added with the CLI's parent-config discovery (not yet measured).
    `fixed seed 20261105: test.projects in a parent's config`,
    `random seed: a failing owner under its parent's config`,
    `determinism: constructed history: a package whose parent directory has its config`,
  ],
  // 522 s in the measured run, about 221 s idle.
  'e2e-4': [
    `random seed: two starts race for a stale claim`,
    `random seed: a start refuses a stale claim`,
    `random seed: a start refuses an empty claim`,
    `random seed: a start refuses an unreadable claim`,
    `random seed: a supervised child exits when its supervisor is killed`,
    `random seed: a stop before the CLI starts`,
    `random seed: a stop before the CLI starts, after a stopped check`,
    `random seed: a run after a killed CLI`,
    `random seed: a stop by SIGTERM as the CLI starts`,
    `random seed: an unsupervised run stopped after its note`,
    `random seed: a start refuses a dangling claim`,
    `random seed: a supervised check with no ps on its PATH`,
    `random seed: a stream log lost after its note, then stopped`,
    `random seed: a stream log lost after its note, then completed`,
    `random seed: a stop as the CLI starts`,
    `fixed seed 20261105: a .ts config in a package with no module type that calls require`,
    `fixed seed 20261105: a config that --config names`,
    `fixed seed 20261105: a declaration fault: apiLessTypescript`,
    `fixed seed 20261105: a declaration fault: badEntry`,
    `fixed seed 20261105: a declaration fault: brokenVitest`,
    `fixed seed 20261105: a declaration fault: configNoDefault`,
    `fixed seed 20261105: a declaration fault: configNull`,
    `fixed seed 20261105: a declaration fault: configSyntax`,
    `fixed seed 20261105: a declaration fault: nonLiteral`,
    `fixed seed 20261105: a failing owner under a config that --config names`,
    `fixed seed 20261105: a load failure beside a hang`,
    `random seed: a .cjs config that calls require`,
    `random seed: a declaration fault: configNoDefault`,
    `random seed: a declaration fault: configNull`,
    `random seed: a declaration fault: configSyntax`,
    `random seed: an awaiting config in a package with no module type`,
    `calibration: production code is reported as probe code`,
    `calibration: the daemon reports another outcome than the cold run`,
    `calibration: the summary omits a gap`,
    `determinism: constructed history: a run with eleven contexts`,
    `determinism: constructed history: an ambiguous authored mutant`,
    `determinism: constructed history: every outcome class`,
    `determinism: constructed history: two authored mutants`,
    // Added with the gap CLI's runtime fixes (not yet measured).
    `fixed seed 20261105: a second daemon check of the budget witness`,
    `calibration: a stopped run leaves a process it started running`,
    `calibration: a stopped run leaves its own session directory`,
    // The heartbeat calibrations after the shape-only change (not yet measured).
    `calibration: a heartbeat names a mutant whose gap line came first`,
    `calibration: a heartbeat names no mutant of its run`,
    // Law 15's calibrations (the greppable stream), measured at ab18c60:
    // 79 s and 70 s; the daemon-notes one, bound to its history, 2 s (it
    // took 433 s searching for one).
    `calibration: a streamed line has no prefix`,
    // The stream log's calibrations, not yet measured.
    `calibration: the stream log misses a line`,
    `calibration: the line that names the stream log comes after another line`,
    `calibration: a refusal through the daemon drops the cold run's notes`,
    // Bound to its history (re-review N2), not yet measured.
    `calibration: a run names a test-output log it never captured`,
    `calibration: a completed run ends without its done line`,
    `determinism: constructed history: a second daemon check of the budget witness`,
    // The witness module's edit sequence (option M): 97 s here, measured
    // with the daemon fix of fix/daemon-current-inputs.
    `fixed seed 20261105: an edit sequence over the witness module, the first half`,
    `fixed seed 20261105: an edit sequence over the witness module, the second half`,
  ],
  // 522 s in the measured run, about 221 s idle.
  'e2e-5': [
    // A probe branch under a generated test's work bound (about 3 s each on
    // an Arclet for the fixed-seed and random units).
    `fixed seed 20261105: a probe branch under a generated test's work bound`,
    `random seed: a probe branch under a generated test's work bound`,
    `determinism: constructed history: a probe branch under a generated test's work bound`,
    // A value change at a ?. read and at a return: one small function of
    // three statements, like the probe branch's history.
    `fixed seed 20261105: a value change at a ?. read and at a return`,
    `random seed: a value change at a ?. read and at a return`,
    `determinism: constructed history: a value change at a ?. read and at a return`,
    // A ?. read of an object absent only at load: one small function.
    `fixed seed 20261105: a ?. read of an object absent only at load`,
    `random seed: a ?. read of an object absent only at load`,
    `determinism: constructed history: a ?. read of an object absent only at load`,
    // A failing law beside its file's passing laws: two small functions
    // (about 2 s on an Arclet).
    `fixed seed 20261105: a failing law beside its file's passing laws`,
    `random seed: a failing law beside its file's passing laws`,
    `determinism: constructed history: a failing law beside its file's passing laws`,
    // The failing law's position, calls and hooks: one or two small
    // functions each, about 2 s on an Arclet (the heavy law's loop adds
    // about a second).
    `fixed seed 20261105: a heavy failing law at the start of its file, beside a passing law`,
    `random seed: a heavy failing law at the start of its file, beside a passing law`,
    `determinism: constructed history: a heavy failing law at the start of its file, beside a passing law`,
    `fixed seed 20261105: a failing beforeAll around a law`,
    `random seed: a failing beforeAll around a law`,
    `determinism: constructed history: a failing beforeAll around a law`,
    `fixed seed 20261105: a failing afterAll around a law that calls production`,
    `random seed: a failing afterAll around a law that calls production`,
    `determinism: constructed history: a failing afterAll around a law that calls production`,
    `fixed seed 20261105: a failing law that spins under a mutant before a passing law`,
    `random seed: a failing law that spins under a mutant before a passing law`,
    `determinism: constructed history: a failing law that spins under a mutant before a passing law`,
    `fixed seed 20261105: module data that only the failing owner's passing pair judges`,
    `random seed: module data that only the failing owner's passing pair judges`,
    `determinism: constructed history: module data that only the failing owner's passing pair judges`,
    // The filed history of a stale authored mutant's fourth base (about 12 s).
    `fixed history: a filed base whose owner reads an absent object through ?.`,
    `determinism: fixed history: a filed base whose owner reads an absent object through ?.`,
    `fixed seed 20261105: every outcome class, the warm stop`,
    `fixed seed 20261105: every outcome class, the abort stop`,
    `random seed: every outcome class, the warm stop`,
    `random seed: every outcome class, the abort stop`,
    `determinism: constructed history: every outcome class, the warm stop`,
    `determinism: constructed history: every outcome class, the abort stop`,
    `determinism: constructed history: a stop with the default output directory`,
    `determinism: constructed history: a daemon check with the default output directory`,
    `determinism: constructed history: a daemon check with the default output directory, unsupervised`,
    `determinism: constructed history: a stream log that cannot be written`,
    `determinism: constructed history: two runs on one output directory`,
    `fixed seed 20261105: an edit sequence through the daemon`,
    `fixed seed 20261105: ordinary tests left out by default`,
    `fixed seed 20261105: two authored mutants`,
    `random seed: a declaration fault: brokenOwner`,
    `random seed: a declaration fault: brokenVitest`,
    `random seed: a declaration fault: missingSource`,
    `random seed: a declaration fault: nonLiteral`,
    `random seed: a declaration fault: projects`,
    `random seed: a declaration fault: setupThrows`,
    `random seed: a declaration fault: setupThrows, then the abort stop`,
    `random seed: a package with no config`,
    `random seed: a run with eleven contexts`,
    `random seed: an ambiguous authored mutant`,
    `random seed: ordinary tests left out by default`,
    `calibration: an owned mutant is reported as unowned`,
    `determinism: constructed history: a config fault in a run that owns nothing`,
    `determinism: constructed history: a declaration fault: apiLessTypescript`,
    `determinism: constructed history: a declaration fault: brokenVitest`,
    `determinism: constructed history: a declaration fault: noTypescript`,
    `determinism: constructed history: a failing owner under a config that --config names`,
    `determinism: generated 2`,
    // Added with the gap CLI's runtime fixes (not yet measured).
    `random seed: a second daemon check of the budget witness`,
    `calibration: a stopped run had written a copy beside the tests`,
    `calibration: a stopped run keeps a killed run's session directory`,
    `calibration: a heartbeat names a file that does not run its mutant`,
    // Law 15's calibrations (the greppable stream), measured at ab18c60:
    // 69 s, 58 s, 73 s, and 69 s.
    `calibration: the decisive baseline line comes after a mutant's line`,
    `calibration: a stopped run ends without its done line`,
    `calibration: a raw line reaches the stdout`,
    `calibration: a run ends with two done lines`,
    // Law 15's stdout gap lines against results.json, one calibration per
    // rejection, about 60 s each locally (one worker, light load).
    `calibration: the stdout prints one gap twice and drops another`,
    `calibration: a stdout gap line gives another line than results.json`,
    `calibration: the stdout drops a gap line`,
    `calibration: a stdout gap line shows another change`,
    `calibration: a stdout gap line names another kind`,
    `calibration: a stdout gap line does not read as a gap`,
    `calibration: the stdout has a gap line for a mutant that is not a gap`,
    `calibration: a check through the daemon drops a gap line`,
    `calibration: a check through the daemon names another check's report`,
    // A config that only --config names, outside the package: about 4 s
    // each locally (one worker, light load).
    `fixed seed 20261105: a config that --config names outside the package`,
    `fixed seed 20261105: a failing owner under a config that --config names outside the package`,
    `random seed: a config that --config names outside the package`,
    `random seed: a failing owner under a config that --config names outside the package`,
    `determinism: constructed history: a config that --config names outside the package`,
    `determinism: constructed history: a failing owner under a config that --config names outside the package`,
    // The witness module's edit sequence (option M): about 97 s here, measured
    // with the daemon fix of fix/daemon-current-inputs.
    `random seed: an edit sequence over the witness module, the first half`,
    `random seed: an edit sequence over the witness module, the second half`,
    // The module data census (the framework-added tests of an owner file, and
    // the placeholder guard): three units each, in fixed, random, determinism.
    `fixed seed 20261105: a module data mutant judged past nondeterministic plan tests`,
    `fixed seed 20261105: a module data mutant whose owner file holds no plan test`,
    `random seed: a module data mutant judged past nondeterministic plan tests`,
    `random seed: a module data mutant whose owner file holds no plan test`,
    `determinism: constructed history: a module data mutant judged past nondeterministic plan tests`,
    `determinism: constructed history: a module data mutant whose owner file holds no plan test`,
    // Histories replayed by history (#184, #116, #203): fixed units.
    `fixed history: a module array mutant judged past nondeterministic plan tests under a daemon pause`,
    `determinism: fixed history: a module array mutant judged past nondeterministic plan tests under a daemon pause`,
    `fixed history: a module object field-drop judged past a console test`,
    `determinism: fixed history: a module object field-drop judged past a console test`,
    `fixed history: a module boolean flip judged past a console test`,
    `determinism: fixed history: a module boolean flip judged past a console test`,
  ],
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`)

/** The `-t` pattern that selects exactly a shard's tests. */
export function patternOf(shard) {
  const tests = shards[shard]
  if (tests === undefined)
    throw new Error(
      `no shard ${JSON.stringify(shard)}; the shards are ${Object.keys(shards).join(`, `)}`,
    )
  return `^${escape(suite)}(?: > | (?!> ))(?:${tests.map(escape).join(`|`)})$`
}

/**
 * The partition's errors against the tests that `vitest list` reports: a
 * test in no shard or in several, and a shard entry that names no test.
 */
export function partitionErrors(listed) {
  const errors = []
  const patterns = Object.keys(shards).map((shard) => ({
    shard,
    pattern: new RegExp(patternOf(shard)),
  }))
  for (const name of listed) {
    // `vitest list` joins the names with ` > `; Vitest 4's `-t` reads them
    // joined with a space, so a pattern must select the test both ways.
    const joined = [name, name.replace(/ > /, ` `)]
    // A shard that selects either join owns the test, and it must select
    // both: in each Vitest version, exactly one shard runs the test.
    const owners = patterns.filter(({ pattern }) =>
      joined.some((full) => pattern.test(full)),
    )
    const whole =
      owners.length === 1 &&
      joined.every((full) => owners[0].pattern.test(full))
    if (!whole)
      errors.push(
        `${JSON.stringify(name)} is in ${owners.length === 0 ? `no shard` : owners.length === 1 ? `shard ${owners[0].shard} under only one of Vitest's name joins` : `shards ${owners.map(({ shard }) => shard).join(`, `)}`}`,
      )
  }
  for (const [shard, tests] of Object.entries(shards))
    for (const test of tests)
      if (!listed.includes(`${suite} > ${test}`))
        errors.push(`shard ${shard} names ${JSON.stringify(test)}, no test`)
  return errors
}

function listed() {
  const run = spawnSync(
    `pnpm`,
    [
      // --silent keeps pnpm's workspace banner off stdout, which is JSON.
      `--silent`,
      `exec`,
      `vitest`,
      `list`,
      `--json`,
      `--config`,
      `oracle-gaps/vitest.config.mjs`,
      `gap-report-oracle`,
    ],
    {
      cwd: join(dirname(fileURLToPath(import.meta.url)), `..`),
      encoding: `utf8`,
    },
  )
  if (run.status !== 0)
    throw new Error(`vitest list failed:\n${run.stderr}${run.stdout}`)
  return JSON.parse(run.stdout).map((test) => test.name)
}

const [command, shard] = process.argv.slice(2)
if (command === `pattern`) process.stdout.write(`${patternOf(shard)}\n`)
else if (command === `check`) {
  const errors = partitionErrors(listed())
  if (errors.length > 0) {
    process.stderr.write(
      `The e2e shards do not partition the tests:\n${errors.map((error) => `- ${error}`).join(`\n`)}\nEdit packages/oracles/scripts/e2e-shards.mjs so each test is in exactly one shard.\n`,
    )
    process.exit(1)
  }
  process.stdout.write(
    `${Object.keys(shards).length} shards partition the e2e tests\n`,
  )
} else if (command !== undefined) {
  process.stderr.write(`usage: e2e-shards.mjs check | pattern <shard>\n`)
  process.exit(2)
}
