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

// The shards balance the costs measured in one full local run on main
// (84cd34a, 2026-11-11, an idle 18-core Mac, one Vitest worker), in local
// seconds: determinism about 345 (all 30 histories, twice each), the random
// seed 160 to 600 by its seed, the fixed seed 157, the refused-run
// calibration 102, the two daemon calibrations 56 and 53, and each other
// calibration 38 to 46. CI took 2.31 times as long. The property registers
// each campaign, each calibration, and the determinism test as one test, so
// a shard cannot be smaller than its largest test, and the determinism test
// alone sets the slowest shard. CI keeps its one fixed-seed job until the
// property registers its parts as units that a shard can split.
export const shards = {
  'e2e-1': [`determinism`],
  'e2e-2': [`random seed`],
  'e2e-3': [
    `fixed seed 20261105`,
    `calibration: a refused run is reported as complete`,
  ],
  'e2e-4': [
    `calibration: the daemon reports another outcome than the cold run`,
    `calibration: a daemon is left after --stop-daemon`,
    `calibration: a mutant is dropped from the enumeration`,
    `calibration: an owned mutant is reported as unowned`,
  ],
  'e2e-5': [
    `calibration: a crash is reported as a kill`,
    `calibration: a key drops its statement text`,
    `calibration: the summary omits a gap`,
    `calibration: an edit moves a key`,
    `calibration: production code is reported as probe code`,
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
  return `^${escape(suite)}(?: | > )(?:${tests.map(escape).join(`|`)})$`
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
    const owners = patterns.filter(({ pattern }) =>
      joined.every((full) => pattern.test(full)),
    )
    if (owners.length !== 1)
      errors.push(
        `${JSON.stringify(name)} is in ${owners.length === 0 ? `no shard` : `shards ${owners.map(({ shard }) => shard).join(`, `)}`}`,
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
