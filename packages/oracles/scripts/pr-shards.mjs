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
    shards: {
      1: startsWith(`determinism: fixed history: `, detFixedA),
      2: startsWith(`determinism: fixed history: `, detFixedB),
      3: startsWith(`determinism: fixed history: `, detFixedC),
      4: `determinism: constructed history: .*`,
      5: `(?:${startsWith(`fixed history: `, fixedA)}|${startsWith(`calibration: `, calibration1)})`,
      6: `(?:${startsWith(`fixed history: `, fixedB)}|${startsWith(`calibration: `, calibration2)})`,
      7: startsWith(`calibration: `, [...calibration3, ...calibration4]),
      8: rest,
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
  // (`-t "fixed seed"`): 38 units, measured in CI on main at ae3184d (each
  // unit's cost read from its reach line's time in the three jobs' logs),
  // whose generated histories this branch keeps (the work law's bound in
  // the grammar is derived from the plan, not drawn, 2026-11-13). A unit's
  // cost follows the generated history its constructed history is built
  // from, and the witness module's histories grow with its witnesses. The
  // units are packed longest first into three shards: about 290 s, 277 s,
  // and 260 s of CI time.
  'oracle-gaps-fixed-seed': {
    args: [`--config`, `oracle-gaps/vitest.config.mjs`, `gap-report-oracle`],
    suite: `oracle-gaps.report`,
    select: `fixed seed 20261105: `,
    // The tests that one job selected before: the shards together must
    // select exactly these.
    previously: `fixed seed`,
    shards: {
      // 261 s, 25 s, and a small unit.
      1: anyOf([
        'an edit sequence over the witness module',
        'a stale authored mutant and a reformat',
        'a failing owner under a config that --config names',
      ]),
      // 134 s, 101 s, 27 s, and 15 s.
      2: anyOf([
        'every outcome class',
        'a second daemon check of the budget witness',
        'a declaration fault: brokenVitest',
        'an edit that changed the cold result after a hang replaced the only context',
      ]),
      // The rest: the edit sequence through the daemon (95 s), brokenOwner
      // (83 s), generated (23 s), the lazy module (12 s), and small units.
      3: rest,
    },
  },
  'oracle-gaps-static-windows': {
    args: [`--config`, `oracle-gaps/vitest.config.mjs`, `gap-report-static`],
    suite: `oracle-gaps.report-static`,
    select: ``,
    // Windows runs on its own partition: the same tests, in six shards,
    // because each Linux shard takes 3 to 6 times as long on windows-latest.
    shards: {
      1: anyOf([
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
      ]),
      2: anyOf([
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
      ]),
      3: anyOf([
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
      ]),
      4: anyOf([
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
      ]),
      5: anyOf([
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
      ]),
      6: anyOf([
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
      ]),
    },
  },
  'oracle-gaps-fixed-seed-windows': {
    args: [`--config`, `oracle-gaps/vitest.config.mjs`, `gap-report-oracle`],
    suite: `oracle-gaps.report`,
    select: `fixed seed 20261105: `,
    previously: `fixed seed`,
    // Windows runs on its own partition: the same tests, in six shards,
    // because each Linux shard takes 3 to 6 times as long on windows-latest.
    shards: {
      1: anyOf([
        'a .cjs config that calls require',
        'a declaration fault: brokenOwner',
        'a declaration fault: missingSource',
        'a failing owner under a config that --config names',
        'a run with eleven contexts',
        'an edit sequence through the daemon',
        "test.projects in a parent's config",
      ]),
      2: anyOf([
        'a stop with the default output directory',
        'a daemon check with the default output directory',
        'a .ts config in a package with no module type that calls require',
        'a declaration fault: brokenVitest',
        'a declaration fault: noTypescript',
        "a failing owner under its parent's config",
        'a second daemon check of the budget witness',
        'an edit that changed the cold result after a hang replaced the only context',
        'two authored mutants',
      ]),
      3: anyOf([
        'a stop as the CLI starts',
        'a stream log that cannot be written',
        'two runs on one output directory',
        'a config fault in a run that owns nothing',
        'a declaration fault: configNoDefault',
        'a declaration fault: nonLiteral',
        'a lazy module loaded before a hang in the same batch',
        'a stale authored mutant and a reformat',
        'an edit to a module that only mutated runs load',
      ]),
      4: anyOf([
        'a config that --config names',
        'a declaration fault: configNull',
        'a declaration fault: outsideSource',
        'a load failure beside a hang',
        'an ambiguous authored mutant',
        'every outcome class',
      ]),
      5: anyOf([
        'a declaration fault: apiLessTypescript',
        'a declaration fault: configSyntax',
        'a declaration fault: projects',
        'a package whose parent directory has its config',
        'an awaiting config in a package with no module type',
        'generated',
      ]),
      6: anyOf([
        'a declaration fault: badEntry',
        'a declaration fault: configThrows',
        'a declaration fault: setupThrows',
        'a package with no config',
        'an edit sequence over the witness module',
        'ordinary tests left out by default',
      ]),
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
