// The check report: the gaps an oracle's author must answer.
//
// The report is evidence, not a fix. A surviving mutant or an unreached
// branch does not say which model rule to add; it says the oracle cannot see
// some difference in production. Each gap has one directive message (decision
// 10 of the v20 design grammar: messages leave no outs). The message names
// the run's data, and it never offers an equivalence, an approval, or a
// question. The author then states the law the gap reveals and re-plans the
// oracle around it, and runs the check again.
//
// Two renderings. The full report (`renderReport`, written to summary.md)
// lists every gap with its key, owners, and data. The stdout summary
// (`renderStdout`) prints the totals, one legend line per class present (its
// directive, with placeholders), and every gap once, one line each, grouped
// by function, with owners printed once per function as package-relative
// paths. Unowned warnings are counted per function. A gap is identified by an
// anchor that survives unrelated edits and reformatting: the source file, the
// function (`name`, or `Class.method`), the operator, and the tokens of the
// innermost statement that holds the site, joined by single spaces and kept in
// full, with `~n` for the nth repeat of one anchor in a function. An authored
// mutant's key is its id.
import { codeSpan, gapLine, kindOf } from './stream.mjs'

/** Outcomes that are gaps. Only a law verdict on a reproducible route kills. */
export const gapOutcomes = new Set([
  `survived`,
  `crashed`,
  `unreached`,
  `random-only-kill`,
  `agreement-only-kill`,
  `unregistered-kill`,
  `framework-error`,
  `timeout`,
  `setup-error`,
  `does-not-apply`,
])

export function assignKeys(results) {
  const seen = new Map()
  for (const result of results) {
    if (result.authored) {
      result.key = `${result.source}#authored:${result.authoredId}`
      continue
    }
    const base = `${result.source}#${result.function ?? `<module>`}:${result.operator}:${result.anchor}`
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    result.key = count === 1 ? base : `${base}~${count}`
  }
}

// The evidence tag a mutant may carry (schemata.mjs), and the sentence it adds.
const BOUNDARY = `boundary: -0`
const BOUNDARY_SENTENCE = `Add a boundary history with -0 and 0.`

// The name of the test a key names: its path after the file.
const testName = (key) =>
  key ? key.split(` > `).slice(1).join(` > `) : `(background)`
const first = (names) => names?.[0] ?? `(none)`
// The error a crash threw, as one short line that fits a code span.
const errorText = (text = `(no message)`) =>
  text.replace(/`/g, `'`).split(`\n`)[0].slice(0, 120)

// Each gap kind's directive, from the run's data. The legend prints each one
// with placeholders (`legendOf`), and the messages print it with the data.
const directive = {
  unreached: (g) =>
    `Add an owner test that runs line ${g.line} and asserts on its result.`,
  'branch-never-taken': (g) =>
    `Add an owner history where the condition on line ${g.line} is ${g.wanted}, so the branch it guards runs.`,
  'not-infected': (g) =>
    `Add a history whose operands are equal, where \`${g.original}\` and \`${g.replacement}\` disagree. Operands seen: ${g.operands?.length ? g.operands.join(`; `) : `none recorded`}.`,
  'not-observed': (g) =>
    g.infectedBy === undefined
      ? `Observe the value this code changes in the owner tests, and assert on it.`
      : `Observe the value this code changes in \`${testName(g.infectedBy)}\`, and assert on it.`,
  'not-judged': (g) =>
    `Make a law in \`${testName(g.changedTests?.[0])}\` reject the changed value.`,
  indeterminate: (g) =>
    g.nondeterministicBy?.length
      ? `Make \`${g.nondeterministicBy.map(testName).join(`, `)}\` deterministic: control its clock and its random seed, so its failures judge this code.`
      : `Add an owner test that runs line ${g.line} and asserts on its result.`,
  'dead-code': (g) => `Remove the redundant code on line ${g.line}.`,
  'random-only-kill': (g) =>
    `Keep the counterexample that \`${first(g.by)}\` found in the random campaign as a fixed history.`,
  'agreement-only-kill': (g) =>
    `Assert on the value this path produces in \`${first(g.by)}\`.`,
  'unregistered-kill': (g) =>
    `Register the route of \`${first(g.by)}\` through the framework, so its failure counts as a kill.`,
  'framework-error': (g) =>
    `Make a law in \`${first(g.by)}\` reject the change: only a framework calibration failed, and it judges no behavior.`,
  crashed: (g) =>
    `Production threw \`${errorText(g.detail)}\` in \`${first(g.by)}\`; record the error as an observation in the driver, and state the law that decides if this input may throw.`,
  timeout: () =>
    `Bound the run of the owner tests so that they end, and let a law reject a run that does not.`,
  'setup-error': () =>
    `Run an owner test that loads this module and asserts on its exports, so a failed load rejects the mutant.`,
  'does-not-apply': () =>
    `Update the \`find\` text of this authored mutant so that it occurs exactly once in the source.`,
}

/** The gap's message: its kind's directive, with the boundary sentence if any. */
export function messageOf(gap) {
  const text = directive[kindOf(gap)](gap)
  return gap.evidence === BOUNDARY && gap.outcome === `survived`
    ? `${text} ${BOUNDARY_SENTENCE}`
    : text
}

// The legend: each kind's directive with placeholders for its run data.
const placeholders = {
  line: `N`,
  wanted: `<outcome>`,
  original: `<operator>`,
  replacement: `<operator>`,
  operands: [`<a> and <b>`],
  infectedBy: `<file> > <test>`,
  changedTests: [`<file> > <test>`],
  nondeterministicBy: [`<file> > <test>`],
  by: [`<test>`],
  detail: `<error>`,
}
const legendOf = (kind) => directive[kind]({ ...placeholders, outcome: kind })

// What the author does about a law that rejects no mutant: one next step.
const killsDirective = `To find a law that rejects no mutant, add a history that varies the input the law judges, and run the check again.`

export function gapsOf(results) {
  return results.filter(
    (result) => !result.probeGuard && gapOutcomes.has(result.outcome),
  )
}

function change(result) {
  if (result.authored) return `${result.intent} (authored by ${result.author})`
  return `${codeSpan(String(result.original).replace(/\s+/g, ` `))} → ${codeSpan(String(result.replacement))}`
}

// Entries of a list, grouped by a key, in first-seen order.
function groupBy(list, keyOf) {
  const groups = new Map()
  for (const item of list)
    groups.set(keyOf(item), [...(groups.get(keyOf(item)) ?? []), item])
  return groups
}

// A group of gaps: the authored mutants, or one function.
const groupOf = (gap) =>
  gap.authored ? `authored mutants` : `fn ${gap.function}`

export function renderReport({ results, run, excluded }) {
  const gaps = gapsOf(results)
  const guards = results.filter((r) => r.probeGuard)
  const unowned = results.filter(
    (r) => !r.probeGuard && r.outcome === `unowned`,
  )
  const killed = results.filter((r) => r.outcome === `killed` && !r.probeGuard)
  const crashed = results.filter(
    (r) => r.outcome === `crashed` && !r.probeGuard,
  )
  const lines = [
    `# Oracle check report`,
    ``,
    `Run ${run.id}. Inputs: ${run.inputs}.`,
    ``,
    `${results.length} mutants (${results.filter((r) => r.authored).length} authored). ` +
      `${killed.length} killed by a law on a reproducible route, ` +
      `${crashed.length} crashed production, ` +
      `**${gaps.length} gaps**.` +
      (unowned.length > 0
        ? ` ${unowned.length} mutants are in functions no oracle owns (warnings).`
        : ``) +
      (guards.length > 0
        ? ` ${guards.length} mutants of state-probe code (guards, helpers, and calls to them) are left out; reach agreement and the bundle check own them.`
        : ``),
    ``,
  ]
  if (excluded.length > 0)
    lines.push(
      `Ordinary test files left out because they fail with no mutant active: ${excluded.join(`, `)}.`,
      ``,
    )
  lines.push(
    `## How to use this report`,
    ``,
    `A gap is evidence that the oracle cannot see some difference in production. It does not say which model rule to add. For each gap:`,
    ``,
    `1. State the law it reveals: one that is missing, misstated, or not enforced. Several gaps often reveal one law.`,
    `2. Name the law's authority: a contract document and section, or a maintainer decision.`,
    `3. Re-plan the oracle around that law: its grammar or domain, model, observations, or comparison. Do not patch the line.`,
    `4. Run the check again.`,
    ``,
    `Rerun one mutant with \`--only <id>\`.`,
    ``,
    `## Gaps`,
    ``,
  )
  if (gaps.length === 0) lines.push(`None.`, ``)
  for (const [group, rows] of groupBy(gaps, groupOf)) {
    lines.push(`### ${group} (${rows[0].source})`, ``)
    for (const gap of rows) {
      lines.push(
        `- **${kindOf(gap)}**, line ${gap.line}: ${change(gap)}`,
        `  - Key: ${codeSpan(gap.key)}; rerun: \`--only ${gap.id}\``,
        `  - ${messageOf(gap)}`,
      )
      if (gap.oracleFiles?.length)
        lines.push(`  - Owners: ${gap.oracleFiles.join(`, `)}`)
      if (gap.changedTests?.length)
        lines.push(
          `  - Changed observations in: ${gap.changedTests
            .slice(0, 3)
            .map(testName)
            .join(`; `)}`,
        )
      if (gap.laws?.length)
        lines.push(`  - Laws that rejected it: ${gap.laws.join(`, `)}`)
      if (gap.detail) lines.push(`  - Detail: ${gap.detail.slice(0, 200)}`)
    }
    lines.push(``)
  }
  if (unowned.length > 0) {
    lines.push(
      `## Unowned (warnings)`,
      ``,
      `No oracle's \`owns\` call tree contains these functions, so no test judges them.`,
      ``,
    )
    for (const [fn, rows] of groupBy(unowned, (r) => r.function)) {
      lines.push(
        `### ${fn} (${rows[0].source}): ${rows.length} ${rows.length === 1 ? `mutant` : `mutants`}`,
        ``,
        ...rows.map((r) => `- Unowned: ${codeSpan(r.key)}`),
        ``,
      )
    }
  }
  const byLaw = new Map()
  for (const result of killed)
    for (const law of result.laws ?? [])
      byLaw.set(law, (byLaw.get(law) ?? 0) + 1)
  lines.push(
    `## Kills by law`,
    ``,
    killsDirective,
    ``,
    `| Law | Mutants it rejected |`,
    `|---|---|`,
    ...[...byLaw]
      .sort((a, b) => b[1] - a[1])
      .map(([law, count]) => `| ${law} | ${count} |`),
  )
  return lines.join(`\n`)
}

/**
 * The stdout summary: the totals, one legend line per class present, every
 * gap once under its function (owners printed once per function), the
 * unowned warnings counted per function, and the paths of the full report
 * and the results.
 */
export function renderStdout({ results, run, excluded, pkg, paths }) {
  const gaps = gapsOf(results)
  const unowned = results.filter(
    (r) => !r.probeGuard && r.outcome === `unowned`,
  )
  const killed = results.filter((r) => r.outcome === `killed` && !r.probeGuard)
  const relative = (file) =>
    file.startsWith(`${pkg}/`) ? file.slice(pkg.length + 1) : file
  const lines = [
    `Oracle gap check ${run.id}: ${results.length} mutants, ${killed.length} killed, ${gaps.length} gaps, ${unowned.length} unowned (warnings). ${run.inputs}.`,
    ``,
    `Legend, one directive per class:`,
  ]
  for (const kind of new Set(gaps.map(kindOf)))
    lines.push(`  ${kind}: ${legendOf(kind)}`)
  lines.push(``, `Gaps, by function:`)
  if (gaps.length === 0) lines.push(`  none`)
  for (const [group, rows] of groupBy(gaps, groupOf)) {
    const owners = [
      ...new Set(rows.flatMap((g) => g.oracleFiles ?? []).map(relative)),
    ].sort()
    lines.push(
      `${group}${owners.length > 0 ? ` (owners: ${owners.join(`, `)})` : ``}`,
    )
    for (const gap of rows) lines.push(`  ${gapLine(gap)}`)
  }
  if (unowned.length > 0) {
    lines.push(``, `Unowned warnings, by function:`)
    for (const [fn, rows] of groupBy(unowned, (r) => r.function))
      lines.push(
        `  unowned fn ${fn}: ${rows.length} ${rows.length === 1 ? `mutant` : `mutants`}`,
      )
  }
  if (excluded.length > 0)
    lines.push(
      ``,
      `Left out, failing with no mutant active: ${excluded.join(`, `)}.`,
    )
  lines.push(``, `Full report: ${paths.report}`, `Results: ${paths.results}`)
  return lines.join(`\n`)
}
