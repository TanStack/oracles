// The parallel CI jobs that split the slow test suites a pull request runs.
//
// Each partition splits one suite's tests between jobs. A shard is either a
// pattern over the test names or `rest`, the selected tests that no other
// shard of its partition takes. The check lists the suite's tests with
// `vitest list` and fails unless every selected test is in exactly one
// shard, no other test is in any shard, and every test that a shard names
// exists. So the jobs together run exactly the tests that one job ran
// before: a test in no shard would leave its law out of CI, and a test in
// two would run twice. A new test lands in the `rest` shard, so the jobs'
// balance can drift, but no test is left out.
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
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`)
const anyOf = (names) => `(?:${names.map(escape).join(`|`)})`
const rest = Symbol(`rest`)

// The self-oracle's slowest determinism unit, which joins the other shard.
const slowestDeterminism = `determinism: fixed history: a campaign whose shrinking would outlast its timeout reports its law in time`

/**
 * The partitions, with their shards balanced by the costs measured in one
 * local run on an 18-core Mac under other agents' load, at 908b1f9
 * (2026-11-12). CI took about 1.0 times the local time for the framework
 * self-oracle and 1.7 to 2.5 times for the end-to-end oracle.
 */
export const partitions = {
  // The oracleProperty self-oracle: 299 tests, 588 s in all. Its
  // determinism units take 383 s, so one shard takes them, less the slowest
  // (61 s), which joins the rest: 322 s and 266 s.
  'oracle-framework': {
    args: [`--config`, `vitest.oracle-framework.config.mjs`],
    suite: `self-oracle.framework`,
    select: ``,
    exceptions: [slowestDeterminism],
    shards: {
      1: `(?!${anyOf([slowestDeterminism])}$)determinism: .*`,
      2: rest,
    },
  },
  // The end-to-end gap oracle's fixed-seed units, which a pull request runs
  // (`-t "fixed seed"`): 33 units, 475 s in all, measured on this
  // branch in one local run under other agents' load (load average about 3).
  // A unit's cost follows the generated history its constructed history is
  // built from, so a grammar change can move cost between units. The units
  // are packed longest first into three shards: 158 s, 158 s, and 158 s.
  'oracle-gaps-fixed-seed': {
    args: [`--config`, `oracle-gaps/vitest.config.mjs`, `gap-report-oracle`],
    suite: `oracle-gaps.report`,
    select: `fixed seed 20261105: `,
    // The tests that one job selected before: the shards together must
    // select exactly these.
    previously: `fixed seed`,
    shards: {
      1: anyOf([
        'a second daemon check of the budget witness',
        'generated',
        'an edit that changed the cold result after a hang replaced the only context',
        'a declaration fault: badEntry',
        'a failing owner under a config that --config names',
        'two authored mutants',
        'a declaration fault: setupThrows',
        'a .ts config in a package with no module type that calls require',
        'ordinary tests left out by default',
        'a declaration fault: configThrows',
      ]),
      2: anyOf([
        'an edit sequence through the daemon',
        'every outcome class',
        'a declaration fault: apiLessTypescript',
        'a declaration fault: brokenVitest',
        'an edit to a module that only mutated runs load',
        'a load failure beside a hang',
        'a declaration fault: missingSource',
        'a run with eleven contexts',
        'a config that --config names',
        'a config fault in a run that owns nothing',
        'a declaration fault: outsideSource',
      ]),
      3: rest,
    },
  },
}

/** A shard's pattern over the name that follows the suite's. */
function bodyOf(partition, shard) {
  const own = partition.shards[shard]
  if (own !== rest) return `${escape(partition.select)}(?:${own})`
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
  return errors
}

function listed({ args }) {
  const run = spawnSync(`pnpm`, [`exec`, `vitest`, `list`, `--json`, ...args], {
    cwd: join(dirname(fileURLToPath(import.meta.url)), `..`),
    encoding: `utf8`,
    maxBuffer: 64 * 1024 * 1024,
  })
  if (run.status !== 0)
    throw new Error(`vitest list failed:\n${run.stderr}${run.stdout}`)
  return JSON.parse(run.stdout).map((test) => test.name)
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
