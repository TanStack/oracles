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
// is a constructed history. CI keeps its one fixed-seed job until the
// maintainer decides which units run on a pull request.
export const shards = {
  // 522 s in the measured run, about 221 s idle.
  'e2e-1': [
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
    `determinism: constructed history: an edit sequence over the witness module`,
    // The daemon's law 9 histories cost 3 to 13 s each here (their replays).
    `fixed seed 20261105: an edit that changed the cold result after a hang replaced the only context`,
    `random seed: an edit that changed the cold result after a hang replaced the only context`,
    `determinism: constructed history: an edit that changed the cold result after a hang replaced the only context`,
  ],
  // 522 s in the measured run, about 221 s idle.
  'e2e-2': [
    `fixed seed 20261105: a declaration fault: setupThrows`,
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
    `determinism: constructed history: a declaration fault: outsideSource`,
    `determinism: constructed history: a declaration fault: setupThrows`,
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
  ],
  // 522 s in the measured run, about 221 s idle.
  'e2e-3': [
    `fixed seed 20261105: a config fault in a run that owns nothing`,
    `fixed seed 20261105: a declaration fault: brokenOwner`,
    `fixed seed 20261105: a declaration fault: configThrows`,
    `fixed seed 20261105: a run with eleven contexts`,
    `fixed seed 20261105: a stale authored mutant and a reformat`,
    `fixed seed 20261105: an awaiting config in a package with no module type`,
    `fixed seed 20261105: every outcome class`,
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
  ],
  // 522 s in the measured run, about 221 s idle.
  'e2e-4': [
    `fixed seed 20261105: a .ts config in a package with no module type that calls require`,
    `fixed seed 20261105: a config that --config names`,
    `fixed seed 20261105: a declaration fault: apiLessTypescript`,
    `fixed seed 20261105: a declaration fault: badEntry`,
    `fixed seed 20261105: a declaration fault: brokenVitest`,
    `fixed seed 20261105: a declaration fault: configNoDefault`,
    `fixed seed 20261105: a declaration fault: nonLiteral`,
    `fixed seed 20261105: a failing owner under a config that --config names`,
    `fixed seed 20261105: a load failure beside a hang`,
    `random seed: a .cjs config that calls require`,
    `random seed: a declaration fault: configNoDefault`,
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
    `calibration: a busy mutant is named in no heartbeat`,
    `determinism: constructed history: a second daemon check of the budget witness`,
    // The witness module's edit sequence (option M): 97 s here, measured
    // with the daemon fix of fix/daemon-current-inputs.
    `fixed seed 20261105: an edit sequence over the witness module`,
  ],
  // 522 s in the measured run, about 221 s idle.
  'e2e-5': [
    `fixed seed 20261105: an edit sequence through the daemon`,
    `fixed seed 20261105: ordinary tests left out by default`,
    `fixed seed 20261105: two authored mutants`,
    `random seed: a declaration fault: brokenOwner`,
    `random seed: a declaration fault: brokenVitest`,
    `random seed: a declaration fault: missingSource`,
    `random seed: a declaration fault: nonLiteral`,
    `random seed: a declaration fault: projects`,
    `random seed: a declaration fault: setupThrows`,
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
    `calibration: a heartbeat names a file that does not run its mutant`,
    // The witness module's edit sequence (option M): about 97 s here, measured
    // with the daemon fix of fix/daemon-current-inputs.
    `random seed: an edit sequence over the witness module`,
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
