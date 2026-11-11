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
// mutant's key is its source and id (`source#authored:id`).
import {
  baselineLines,
  blockedLines,
  change,
  codeSpan,
  escapeControls,
  gapLine,
  kindOf,
} from './stream.mjs'

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
  `blocked`,
])

/** An authored mutant's key: its source and its id. */
export const authoredKey = (source, id) => `${source}#authored:${id}`

/**
 * Numbers each operator mutant's key over the list it is given: a repeat of
 * one anchor in one function gets `~n`. Call it on the whole mutant list,
 * before any selection, so a key does not depend on what a run selects.
 */
export function assignKeys(mutants) {
  const seen = new Map()
  for (const mutant of mutants) {
    const base = `${mutant.source}#${mutant.function ?? `<module>`}:${mutant.operator}:${mutant.anchor}`
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    mutant.key = count === 1 ? base : `${base}~${count}`
  }
}

/**
 * The mutants a run selects, keyed over the whole list first: keys are the
 * same in a partial run (`only`, a set of ids, or `sample`, a fixed-seed
 * count per source) and in a full one.
 */
export function keyAndSelect(mutants, { only, sample, sources }) {
  assignKeys(mutants)
  const queue = mutants.filter((m) => !only || only.has(m.id))
  if (sample === undefined) return queue
  // A fixed-seed shuffle, so a survey samples the same mutants every run.
  let seed = 20251102
  const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
  return sources.flatMap((source) => {
    const own = queue.filter((m) => m.source === source)
    for (let i = own.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1))
      ;[own[i], own[j]] = [own[j], own[i]]
    }
    return own.slice(0, sample)
  })
}

// The evidence tag a mutant may carry (schemata.mjs), and the sentence it adds.
const BOUNDARY = `boundary: -0`
const BOUNDARY_SENTENCE = `Add a boundary history with -0 and 0.`

// The name of the test a key names: its path after the file.
// A test's name prints on one line: a control character as its escape.
const testName = (key) =>
  key ? escapeControls(key.split(` > `).slice(1).join(` > `)) : `(background)`
const first = (names) =>
  names?.[0] === undefined ? `(none)` : escapeControls(names[0])
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
  // Infected, and no observation changed: a value nothing observed, or a
  // forced branch that computed the same result as the original (F22).
  'not-observed': (g) =>
    `Observe the value this code changes in ${g.infectedBy === undefined ? `the owner tests` : `\`${testName(g.infectedBy)}\``}, and assert on it. Where the mutated code computes the same result as the original, add a history where it computes something different.`,
  'not-distinguished': (g) => distinguishingDirective(g),
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
    `The framework check \`${first(g.by)}\` failed with \`${errorText(g.detail)}\`, and a calibration judges no behavior: state the oracle law that decides this input's outcome, and let it reject the change.`,
  crashed: (g) =>
    `Production threw \`${errorText(g.detail)}\` in \`${first(g.by)}\`; record the error as an observation in the driver, and state the law that decides this input's outcome.`,
  timeout: () =>
    `Bound the run of the owner tests so that they end, and let a law reject a run that does not.`,
  'setup-error': () =>
    `Run an owner test that loads this module and asserts on its exports, so a failed load rejects the mutant.`,
  'does-not-apply': () =>
    `Update the \`find\` text of this authored mutant so that it occurs exactly once in the source.`,
  blocked: (g) =>
    `Make ${g.blockedBy.map((file) => `\`${file}\``).join(`, `)} pass with no mutant active, then check again: this mutant waits for ${g.blockedBy.length === 1 ? `it` : `them`}.`,
}

// What a legend line says a class is, before its directive, where the
// class's name alone misleads (maintainer disposition G3, 2026-11-11): a
// crash is a gap, not a kill (the v20 freeze, P3 and C1).
const meanings = {
  crashed: `Production threw where no law judged it: a gap, not a kill. Its error is on the gap's Detail line in summary.md, and in its \`detail\` in results.json. `,
}

// The directive for an operator whose infection is not measured: the input
// that makes its value differ, built from the operator (classify.mjs).
function distinguishingDirective(g) {
  const line = g.line
  if (g.operator === `loop-false`)
    return `Add an owner history that enters the loop on line ${line}, so that forcing its condition to false changes an asserted result, and assert on the result.`
  if (g.operator === `value-undefined`)
    return `Add an owner history where the call on line ${line} returns a value that changes an asserted result when it is \`undefined\`, and assert on the result.`
  if (g.operator === `field-drop`)
    return `Add an owner history that reads the property dropped on line ${line}, so that its absence changes an asserted result, and assert on the result.`
  if (g.operator === `delete-call`)
    return `Add an owner history where the call on line ${line} changes an asserted result when it does not run, and assert on the result.`
  if (g.original === `??`)
    return `Add an owner history where the left operand of \`??\` on line ${line} is truthy, so \`??\` and \`&&\` give different results, and assert on the result.`
  if (g.original === `&&` || g.original === `||`)
    return `Add an owner history where one operand of \`${g.original}\` on line ${line} is falsy and the other is truthy, so \`&&\` and \`||\` give different results, and assert on the result.`
  return `Add an owner history where the input that changes the value on line ${line} gives a different result, and assert on the result.`
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
  operator: `<operator>`,
  blockedBy: [`<file>`],
}
const legendOf = (kind) =>
  `${meanings[kind] ?? ``}${directive[kind]({ ...placeholders, outcome: kind })}`

// A count of things, as the report words it.
const counted = (n, thing) => `${n} ${thing}${n === 1 ? `` : `s`}`

/**
 * The baseline's lines that lead both reports (the v20 freeze's one loop:
 * test results and gaps together): each test file's result, a line for
 * each failing oracle file that names what it blocks (G13), and, when one
 * failed, the provisional status with how many mutants are blocked (the
 * freeze's decision 2).
 */
function baselineSection(results, baseline, config) {
  const blocking = blockedLines(baseline)
  const blocked = gapsOf(results).filter((r) => r.outcome === `blocked`).length
  return {
    lines: [...baselineLines(baseline, config), ...blocking],
    provisional:
      blocking.length === 0
        ? undefined
        : `Provisional: ${counted(blocked, `mutant`)} ${blocked === 1 ? `is` : `are`} blocked by failing oracle files; the rest are judged.`,
  }
}

// What the author does about a law that rejects no mutant: one next step.
// The table credits each history's first rejecting law only: a check returns
// its first violation, so a later law on the same history is never judged.
// The count says which law rejected first, not which laws can reject.
const killsDirective = `Each count credits only the first law that rejected a history: a later law on the same history is not checked. To test a law with no count, add a history that varies the input the law judges, and run the check again.`

export function gapsOf(results) {
  return results.filter(
    (result) => !result.probeGuard && gapOutcomes.has(result.outcome),
  )
}

// Entries of a list, grouped by a key, in first-seen order.
function groupBy(list, keyOf) {
  const groups = new Map()
  for (const item of list) {
    const key = keyOf(item)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }
  return groups
}

// A group of gaps: the authored mutants, or one function, named with its
// source file, since two files can each have a function of one name.
const groupOf = (gap) =>
  gap.authored
    ? `authored mutants (${gap.source})`
    : `fn ${gap.function} (${gap.source})`

export function renderReport({
  results,
  run,
  excluded,
  baseline = [],
  config,
}) {
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
  // The baseline, before the gaps, in a fence that no backtick in it closes.
  const section = baselineSection(results, baseline, config)
  const longest = Math.max(
    0,
    ...section.lines.flatMap((line) =>
      (line.match(/`+/g) ?? []).map((run) => run.length),
    ),
  )
  const fence = `\``.repeat(Math.max(3, longest + 1))
  lines.push(
    `## Baseline`,
    ``,
    ...(section.provisional ? [section.provisional, ``] : []),
    `${fence}text`,
    ...section.lines,
    fence,
    ``,
  )
  lines.push(
    `## How to use this report`,
    ``,
    `A gap is evidence that the oracle cannot see some difference in production. It does not say which model rule to add. For each gap:`,
    ``,
    `1. State the law it reveals: one that is missing, misstated, or not enforced. Several gaps often reveal one law.`,
    `2. Name the law's authority: a contract document and section, or a maintainer decision.`,
    `3. Re-plan the oracle around that law: its grammar or domain, model, observations, or comparison. Do not patch the line, except dead code, whose gap says to remove the code.`,
    `4. Run the check again.`,
    ``,
    `Rerun one mutant with \`--only <id>\`.`,
    ``,
    `## Gaps`,
    ``,
  )
  if (gaps.length === 0) lines.push(`None.`, ``)
  for (const [group, rows] of groupBy(gaps, groupOf)) {
    lines.push(`### ${group}`, ``)
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
    for (const [group, rows] of groupBy(unowned, groupOf)) {
      lines.push(
        `### ${group}: ${rows.length} ${rows.length === 1 ? `mutant` : `mutants`}`,
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
    `## First law to reject, by law`,
    ``,
    killsDirective,
    ``,
    `| Law | Mutants it rejected first |`,
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
export function renderStdout({
  results,
  run,
  excluded,
  pkg,
  paths,
  baseline = [],
  config,
}) {
  const gaps = gapsOf(results)
  const unowned = results.filter(
    (r) => !r.probeGuard && r.outcome === `unowned`,
  )
  const killed = results.filter((r) => r.outcome === `killed` && !r.probeGuard)
  const relative = (file) =>
    file.startsWith(`${pkg}/`) ? file.slice(pkg.length + 1) : file
  const section = baselineSection(results, baseline, config)
  const lines = [
    ...section.lines,
    ...(section.provisional ? [section.provisional] : []),
    ``,
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
    for (const [group, rows] of groupBy(unowned, groupOf))
      lines.push(
        `  unowned ${group}: ${rows.length} ${rows.length === 1 ? `mutant` : `mutants`}`,
      )
  }
  if (excluded.length > 0)
    lines.push(
      ``,
      `Left out, failing with no mutant active: ${excluded.join(`, `)}.`,
    )
  lines.push(``, `Full report: ${paths.report}`, `Results: ${paths.results}`)
  if (paths.out !== undefined) lines.push(`output: ${paths.out}`)
  // The last line says the check ran to its end, and how many gaps it
  // found (G6): exit 0 means the run completed, not that it found none.
  lines.push(`completed: ${counted(gaps.length, `gap`)}`)
  return lines.join(`\n`)
}
