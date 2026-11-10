/**
 * # The gap report's classification, checked on run records
 *
 * Laws 4 and 7 of the gap report (gap-report-oracle.property.test.mjs states
 * them in full) say what each mutant's outcome is and what the summary lists.
 * The CLI computes both from plain records of the runs that judged a mutant
 * (classify.mjs, report.mjs): each test's state and error text, whether its
 * file's run timed out or failed to load, and its capture rows, which hold
 * the sites it reached, the `if` outcomes it saw, the hashes of what it
 * asserted on and observed, its registered route, and its law verdicts.
 * This oracle generates those records directly, including combinations that
 * a fixture package reaches only rarely, and checks the CLI's pure functions
 * against a small model in-process. The end-to-end oracle checks that real
 * runs produce such records.
 *
 * ## The law over records
 *
 * For one mutant, with the owner files of its function:
 *
 * 1. No owner: `unowned`. No owner test reached it: `unreached`.
 * 2. Otherwise the records of the owner files whose tests reached it judge
 *    it, except tests whose values differed between the two unmutated runs
 *    (nondeterministic), which judge nothing.
 * 3. A law verdict takes the route active when it fired, or the test's route
 *    when none was active. A verdict on a reproducible route (`fixed seed`,
 *    `fixed history`, `case`; any name outside the framework's vocabulary is
 *    an unknown route) under a behavioral
 *    law (any law but reach agreement) kills: `killed`, even when another
 *    owner file's run timed out, and the kill names at least one such law.
 *    The runner may stop at the first one (maintainer decision, 2026-11-06),
 *    so a kill names a non-empty part of them. Failing that, a run that
 *    timed out makes it `timeout`. Failing that, reproducible verdicts under
 *    reach agreement alone make it an `agreement-only-kill`, which names
 *    them all. Failing that, a verdict on the random campaign
 *    makes it a `random-only-kill`, and one on an unknown or unregistered
 *    route an `unregistered-kill`.
 * 4. Failing that, if every failing test timed out, it is `timeout`; a
 *    failing test outside the framework's own checks makes it `crashed`; a
 *    failing framework check alone (the `calibration` route, which covers
 *    calibrations, probe calibrations, and the determinism test) makes it a
 *    `framework-error`; and errors outside any
 *    test make it a `setup-error`.
 * 5. With no failure it survived, and gets exactly one survivor class, from
 *    what the run measured (decision 11 of the v20 design grammar):
 *    `not-judged` when a reaching, deterministic owner test's asserted or
 *    observed value changed (code that ran when a file loaded the module
 *    reaches every test of that file, maintainer decision of 2026-11-06);
 *    `indeterminate` when no such test judged it; `dead-code` when the
 *    mutant carries the `dead code` evidence (no input distinguishes it);
 *    `branch-never-taken` when it is an `if`-operator mutant and an owner
 *    test reached its `if` with one outcome only; `not-infected` when it is
 *    a comparison whose two operators agree on every operand pair the
 *    owners reached; and `not-observed` otherwise, when the mutant changed a
 *    value that no recorded observation showed.
 *    A mutant is infected in a test when its mutated expression's value
 *    differs from the original's there. A comparison is infected when the
 *    operators disagree on its operands; an `if` when its condition took the
 *    outcome the mutant forces the other way; any other mutant when reached
 *    (its helper infects on reach).
 * 7. Every survivor's message is one directive from its class's fixed set,
 *    built from the run's data (the test that infected it, the operands
 *    seen, the outcome an `if` took). A message never offers an exit:
 *    no equivalence, approval, limit, or question. A mutant with the
 *    `boundary: -0` hint adds "Add a boundary history with -0 and 0." to its
 *    message. The summary's message is read as an author reads it.
 * 8. The compressed stdout summary (report.mjs `renderStdout`) lists the
 *    totals, one legend line per class present, and every gap once, one line
 *    each, grouped by function; it names the full report's path. The
 *    streamed gap lines (stream.mjs `gapLine`), printed in the order the
 *    mutants are judged, are the same lines, each once.
 * 6. A survivor or an unreached mutant that ordinary tests reached gets
 *    their outcome for information, where an assertion failure counts on the
 *    test's route; it never changes the class.
 *
 * Law 7 over the classified mutants: the summary lists every gap (every
 * class except `killed` and `unowned`, outside probe code) once under its
 * key, with its kind and line, every unowned mutant as a warning, and counts
 * that agree.
 *
 * Authority: the maintainer's gap-check decisions (design runs v11, v14,
 * and v19), as for oracle-gaps.report; ORC-006's outcome kinds; the frozen
 * design's oracle over the checker's pure core (v19 P10, F4); and the
 * maintainer's few-seconds budget for an incremental test run (2026-11-05).
 *
 * Limits: authored mutants are not generated here (the end-to-end oracle
 * has them). The records' shapes are those capture-setup.mjs writes; that a
 * real run writes them correctly is the end-to-end oracle's.
 */
import fc from 'fast-check'
import { declareOracle } from '../src/oracle-declaration.ts'
import { oracleProperty, pass, violation } from '../src/oracle-property.ts'
import {
  baselineOf,
  judgeMutant,
  judgeOrdinary,
  needsOrdinary,
  targetsOf,
} from './classify.mjs'
import { readSummary } from './gap-report-model-oracle.mjs'
import * as report from './report.mjs'

const MUTANTS = 4

// ## History grammar
//
// A history is a package's test files, each an oracle file or an ordinary
// one, and up to four mutants of one source, each with its owner files, its
// line, operator, and statement anchor (with backticks, which the summary
// must fence). Each test has a registered route or none, may be
// nondeterministic, and has, for each mutant, whether it reached it, which
// outcomes an `if` there took, and what it did under it: nothing different,
// a changed asserted or observed value, a law verdict (on the route then active, or with none
// active), an assertion failure, a crash, a timeout message, a timed-out
// run, a setup error, or an unhandled error.
const routes = [
  undefined,
  `fixed seed`,
  `fixed history`,
  `constructed history`,
  `case`,
  `enumerated`,
  `random seed`,
  `calibration`,
  `probe calibration`,
  `determinism`,
  `custom route`,
]
const effect = fc.record({
  kind: fc.constantFrom(
    `same`,
    `same`,
    `changed`,
    `observedChanged`,
    `verdict`,
    `verdict`,
    `assertion`,
    `crash`,
    `timeoutMessage`,
    `runTimeout`,
    `setupError`,
    `unhandled`,
  ),
  law: fc.constantFrom(`L`, `reach agreement`),
  // The route active when a verdict fired, when it differs from the test's.
  firedAt: fc.option(fc.constantFrom(...routes.slice(1)), { nil: undefined }),
})
const testRecord = fc.record({
  route: fc.constantFrom(...routes),
  flaky: fc.constantFrom(false, false, false, true),
  reaches: fc.array(fc.boolean(), { minLength: MUTANTS, maxLength: MUTANTS }),
  seen: fc.array(fc.constantFrom(`both`, `both`, `true`, `false`), {
    minLength: MUTANTS,
    maxLength: MUTANTS,
  }),
  under: fc.array(effect, { minLength: MUTANTS, maxLength: MUTANTS }),
  // The two operands of each comparison the test reached. Small, so that
  // ties (which separate `>` from `>=`) happen.
  pair: fc.array(fc.tuple(fc.nat({ max: 2 }), fc.nat({ max: 2 })), {
    minLength: MUTANTS,
    maxLength: MUTANTS,
  }),
})
const records = fc.record({
  files: fc.array(
    fc.record({
      oracle: fc.boolean(),
      tests: fc.array(testRecord, { minLength: 1, maxLength: 3 }),
      // Code that ran when the file loaded, outside any test.
      background: fc.array(fc.boolean(), {
        minLength: MUTANTS,
        maxLength: MUTANTS,
      }),
    }),
    { minLength: 1, maxLength: 3 },
  ),
  mutants: fc.array(
    fc.record({
      owners: fc.array(fc.nat({ max: 2 }), { maxLength: 2 }),
      line: fc.nat({ max: 1 }),
      // A `binary-swap` is a comparison (`>`, `>=`, `===`) or a logical
      // operator (`&&`); its evidence is a hint the framework may attach.
      operator: fc.constantFrom(
        `if-true`,
        `if-false`,
        `delete-call`,
        `binary-swap`,
      ),
      original: fc.constantFrom(`>`, `>=`, `===`, `&&`),
      evidence: fc.constantFrom(
        undefined,
        undefined,
        `dead code`,
        `boundary: -0`,
      ),
      anchor: fc.constantFrom(
        `out . push ( 'a' ) ;`,
        `if ( x > 4 ) out . push ( \`b\` ) ;`,
        `x \`\` y`,
        // Longer than 80 characters, so a key cannot be cut short.
        `if ( value . total > limit . maximum && value . total !== limit . exact ) out . push ( 'over the limit' ) ;`,
      ),
      probe: fc.constantFrom(false, false, false, true),
    }),
    { minLength: 1, maxLength: MUTANTS },
  ),
})

const fileName = (index) => `/pkg/tests/f${index}.test.ts`
const keyOf = (fi, ti) => `${fileName(fi)} > t${ti}`
// The framework's route vocabulary (oracle-route.ts in PR #1): three
// reproducible routes, the random campaign, and one route for the property's
// own checks. Any other name, the retired `constructed history`,
// `enumerated`, `probe calibration`, and `determinism` included, is an
// unknown route.
const reproducible = new Set([`fixed seed`, `fixed history`, `case`])
const framework = new Set([`calibration`])
const kindOf = (route) =>
  route === undefined
    ? `unknown`
    : reproducible.has(route)
      ? `reproducible`
      : route === `random seed`
        ? `random`
        : framework.has(route)
          ? `framework`
          : `unknown`

// ## Model
//
// The model states the law above over the records, without the CLI's
// functions: it reads each test's effect under the mutant directly.
function modelOutcome(h, mi) {
  const m = h.mutants[mi]
  const owners = new Set(
    m.owners.filter((fi) => fi < h.files.length && h.files[fi].oracle),
  )
  const reachingIn = (fi) =>
    h.files[fi].background[mi] || h.files[fi].tests.some((t) => t.reaches[mi])
  const ordinary = h.files
    .map((f, fi) => fi)
    .filter((fi) => !h.files[fi].oracle && reachingIn(fi))
  const withOrdinary = (result) =>
    (result.outcome === `survived` || result.outcome === `unreached`) &&
    ordinary.length > 0
      ? { ...result, testOutcome: ordinaryOutcome(h, mi, ordinary) }
      : result
  if (owners.size === 0) return { outcome: `unowned` }
  const targets = [...owners].filter(reachingIn)
  if (targets.length === 0)
    return withOrdinary({
      outcome: `unreached`,
      mention: [`line ${m.line + 1}`],
    })
  const tests = targets.flatMap((fi) =>
    h.files[fi].tests.map((t, ti) => ({ t, fi, ti })),
  )
  const under = ({ t }) => t.under[mi].kind
  const timedOut = tests.some((x) => under(x) === `runTimeout`)
  const setup = tests.some((x) => under(x) === `setupError`)
  // A file that failed to load, or whose run timed out, ran no tests.
  const ran = tests.filter(
    (x) =>
      !h.files[x.fi].tests.some((t) =>
        [`setupError`, `runTimeout`].includes(t.under[mi].kind),
      ),
  )
  const failing = ran.filter(
    (x) =>
      !x.t.flaky &&
      [`verdict`, `assertion`, `crash`, `timeoutMessage`].includes(under(x)),
  )
  const verdictsOn = (kind) =>
    failing
      .filter(
        (x) =>
          under(x) === `verdict` &&
          kindOf(x.t.under[mi].firedAt ?? x.t.route) === kind,
      )
      .map((x) => x.t.under[mi].law)
  const kills = verdictsOn(`reproducible`)
  const behavioral = kills.filter((law) => law !== `reach agreement`)
  if (behavioral.length > 0)
    return {
      outcome: `killed`,
      laws: [...new Set(behavioral)].sort(),
      lawsMayBePart: true,
    }
  if (timedOut) return { outcome: `timeout` }
  if (kills.length > 0)
    return { outcome: `agreement-only-kill`, laws: [`reach agreement`] }
  if (verdictsOn(`random`).length > 0)
    return withOrdinary({ outcome: `random-only-kill` })
  if (verdictsOn(`unknown`).length > 0) return { outcome: `unregistered-kill` }
  if (failing.length > 0 && failing.every((x) => under(x) === `timeoutMessage`))
    return { outcome: `timeout` }
  if (
    failing.some(
      (x) => under(x) !== `timeoutMessage` && kindOf(x.t.route) !== `framework`,
    )
  )
    return { outcome: `crashed` }
  if (failing.length > 0) return { outcome: `framework-error` }
  const unhandled = ran.some((x) => under(x) === `unhandled`)
  if (setup || unhandled) return { outcome: `setup-error` }
  // A survivor. Only reaching, deterministic owner tests judge it; code that
  // ran when a file loaded the module reaches every test of that file.
  const compared = ran.filter(
    (x) => (x.t.reaches[mi] || h.files[x.fi].background[mi]) && !x.t.flaky,
  )
  const changed = compared.find((x) =>
    [`changed`, `observedChanged`].includes(under(x)),
  )
  const sized = (cls, extra = {}) =>
    withOrdinary({
      outcome: `survived`,
      class: cls,
      mention: [],
      boundary: m.evidence === `boundary: -0`,
      ...extra,
    })
  if (changed)
    return sized(`not-judged`, {
      mention: [`Make a law in \`t${changed.ti}\` reject the changed value.`],
    })
  if (compared.length === 0) return sized(`indeterminate`)
  if (m.evidence === `dead code`)
    return sized(`dead-code`, { mention: [`line ${m.line + 1}.`] })
  // An `if`'s site, reached with one outcome only (the first such sibling).
  const siblings = h.mutants
    .map((other, oi) => ({ other, oi }))
    .filter(
      ({ other }) => other.operator === `if-true` && other.line === m.line,
    )
  if (isIf(m)) {
    for (const { oi } of siblings) {
      const seen = targetsSeen(h, oi, owners)
      if (seen.reached && !(seen.truthy && seen.falsy))
        return sized(`branch-never-taken`, {
          mention: [
            `the condition on line ${m.line + 1} is ${seen.truthy ? `false` : `true`},`,
          ],
        })
    }
  }
  if (isCompare(m) && !infectedIn(h, mi, owners, targets))
    return sized(`not-infected`, {
      mention: [`Operands seen: ${operandsSeen(h, mi, owners)}.`],
    })
  const infecting = infectingTest(h, mi, owners)
  return sized(`not-observed`, {
    mention: [
      infecting === undefined
        ? `Observe the value this code changes in the owner tests, and assert on it.`
        : `Observe the value this code changes in \`${infecting}\`, and assert on it.`,
    ],
  })
}

// Comparisons and their swaps, as the mutant states them. A comparison is
// infected when its operators disagree on the operands a test reached.
const comparisons = new Set([`>`, `>=`, `===`])
const swapOf = { '>': `>=`, '>=': `>`, '===': `!==` }
const holds = {
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
  '===': (a, b) => a === b,
  '!==': (a, b) => a !== b,
}
const isIf = (m) => m.operator === `if-true` || m.operator === `if-false`
const isCompare = (m) =>
  m.operator === `binary-swap` && comparisons.has(m.original)
// Whether test t's mutated expression takes another value than the original.
// Only `if` and comparison mutants are measured (the capture records them);
// any other mutant infects on reach (its helper does).
function infects(h, mi, t) {
  const m = h.mutants[mi]
  if (!t.reaches[mi]) return false
  if (m.operator === `if-true`) return t.seen[mi] !== `true`
  if (m.operator === `if-false`) return t.seen[mi] !== `false`
  if (isCompare(m)) {
    const [a, b] = t.pair[mi]
    return holds[m.original](a, b) !== holds[swapOf[m.original]](a, b)
  }
  return true
}
// The owner tests, in file order, that reached the mutant.
function reachingTests(h, mi, owners) {
  return [...owners]
    .sort((a, b) => a - b)
    .flatMap((fi) =>
      h.files[fi].tests.flatMap((t, ti) => (t.reaches[mi] ? [{ t, ti }] : [])),
    )
}
function infectedIn(h, mi, owners, targets) {
  if (!isIf(h.mutants[mi]) && !isCompare(h.mutants[mi]))
    return targets.length > 0
  return reachingTests(h, mi, owners).some(({ t }) => infects(h, mi, t))
}
// The first test that infected the mutant, or the first that reached it when
// no infection is measured. None when only a file's background reached it.
function infectingTest(h, mi, owners) {
  const tests = reachingTests(h, mi, owners)
  const measured = isIf(h.mutants[mi]) || isCompare(h.mutants[mi])
  const hit = measured ? tests.find(({ t }) => infects(h, mi, t)) : tests[0]
  return hit ? `t${hit.ti}` : undefined
}
// The operand pairs the owners' tests reached, distinct, in order, up to three.
function operandsSeen(h, mi, owners) {
  const pairs = [
    ...new Set(
      reachingTests(h, mi, owners)
        .filter(({ t }) => isCompare(h.mutants[mi]))
        .map(({ t }) => t.pair[mi].join(` and `)),
    ),
  ].slice(0, 3)
  return pairs.length > 0 ? pairs.join(`; `) : `none recorded`
}

// Whether an owner test reached an `if-true` mutant, and which outcomes the
// owners' deterministic and nondeterministic tests saw there.
function targetsSeen(h, oi, owners) {
  let reached = false
  let truthy = false
  let falsy = false
  for (const fi of owners) {
    if (h.files[fi].background[oi]) reached = true
    for (const t of h.files[fi].tests) {
      if (!t.reaches[oi]) continue
      reached = true
      truthy ||= t.seen[oi] !== `false`
      falsy ||= t.seen[oi] !== `true`
    }
  }
  return { reached, truthy, falsy }
}

// The ordinary tests' outcome: their assertion failures count on their
// test's route, and nothing is nondeterministic for them.
function ordinaryOutcome(h, mi, files) {
  const tests = files.flatMap((fi) => h.files[fi].tests.map((t) => ({ t, fi })))
  const under = ({ t }) => t.under[mi].kind
  const timedOut = tests.some((x) => under(x) === `runTimeout`)
  const ran = tests.filter(
    (x) =>
      !h.files[x.fi].tests.some((t) =>
        [`setupError`, `runTimeout`].includes(t.under[mi].kind),
      ),
  )
  const failing = ran.filter((x) =>
    [`verdict`, `assertion`, `crash`, `timeoutMessage`].includes(under(x)),
  )
  const judgedOn = (kind) =>
    failing.filter(
      (x) =>
        (under(x) === `verdict` &&
          kindOf(x.t.under[mi].firedAt ?? x.t.route) === kind) ||
        (under(x) === `assertion` &&
          kindOf(x.t.route) === kind &&
          kind !== `framework`),
    )
  const kills = judgedOn(`reproducible`)
  const behavioral = kills.filter(
    (x) => under(x) === `assertion` || x.t.under[mi].law !== `reach agreement`,
  )
  if (behavioral.length > 0) return `killed`
  if (timedOut) return `timeout`
  if (kills.length > 0) return `agreement-only-kill`
  if (judgedOn(`random`).length > 0) return `random-only-kill`
  if (judgedOn(`unknown`).length > 0) return `unregistered-kill`
  if (failing.length > 0 && failing.every((x) => under(x) === `timeoutMessage`))
    return `timeout`
  if (
    failing.some(
      (x) => under(x) !== `timeoutMessage` && kindOf(x.t.route) !== `framework`,
    )
  )
    return `crashed`
  if (failing.length > 0) return `framework-error`
  if (tests.some((x) => under(x) === `setupError` || under(x) === `unhandled`))
    return `setup-error`
  return `survived`
}

function model(h) {
  const outcomes = h.mutants.map((m, mi) => modelOutcome(h, mi))
  const kindOfResult = (o) => o.class ?? o.outcome
  const keyOf = (m, mi) => {
    const base = `src/x.ts#f${m.line}:${m.operator}:${m.anchor}`
    const before = h.mutants
      .slice(0, mi)
      .filter(
        (o) =>
          o.line === m.line &&
          o.operator === m.operator &&
          o.anchor === m.anchor,
      ).length
    return before === 0 ? base : `${base}~${before + 1}`
  }
  const listed = h.mutants.map((m, mi) => ({
    m,
    key: keyOf(m, mi),
    kind: kindOfResult(outcomes[mi]),
  }))
  const gapsOf = listed.filter(
    (x) => !x.m.probe && ![`killed`, `unowned`].includes(x.kind),
  )
  // Each mutant's key, line, id, and function, for the messages and the
  // stdout summary (the driver names mutant mi `m${mi}` in `f${line}`).
  outcomes.forEach((o, mi) => {
    o.key = listed[mi].key
    o.line = h.mutants[mi].line + 1
    o.id = `m${mi}`
    o.function = `f${h.mutants[mi].line}`
    o.probe = h.mutants[mi].probe
  })
  return {
    outcomes,
    summary: {
      counts: {
        mutants: h.mutants.length,
        authored: 0,
        killed: listed.filter((x) => !x.m.probe && x.kind === `killed`).length,
        gaps: gapsOf.length,
        probe: listed.filter((x) => x.m.probe).length,
      },
      gaps: gapsOf.map((x) => x.key).sort(),
      unowned: listed
        .filter((x) => !x.m.probe && x.kind === `unowned`)
        .map((x) => x.key)
        .sort(),
      entries: gapsOf
        .map((x) => ({ key: x.key, kind: x.kind, line: String(x.m.line + 1) }))
        .sort((a, b) => (a.key < b.key ? -1 : 1)),
    },
  }
}

// ## Messages
//
// Each gap's message is one directive from its kind's fixed set (decision 10:
// messages leave no outs). Names in backticks are run data. A message never
// offers an exit: no equivalence, approval, allowance, limit, choice, or
// question. A survivor with the `boundary: -0` hint carries the boundary
// sentence after its directive.
const boundaryLine = `Add a boundary history with -0 and 0.`
// The kills-by-law section's one next step for a law that rejects no mutant.
const killsDirective = `To find a law that rejects no mutant, add a history that varies the input the law judges, and run the check again.`
const exits =
  /equivalen|maintainer|approv|allowance|either|whether|\bor\b|\bif no\b|limit|accept|\?|\bsay\b/i
const directives = {
  unreached:
    /^Add an owner test that runs line \d+ and asserts on its result\.$/,
  'branch-never-taken':
    /^Add an owner history where the condition on line \d+ is (true|false), so the branch it guards runs\.$/,
  'not-infected':
    /^Add a history whose operands are equal, where `[^`]+` and `[^`]+` disagree\. Operands seen: .+\.$/,
  'not-observed':
    /^Observe the value this code changes in (`[^`]+`|the owner tests), and assert on it\.$/,
  'not-judged': /^Make a law in `[^`]+` reject the changed value\.$/,
  indeterminate:
    /^(Make `[^`]+` deterministic: control its clock and its random seed, so its failures judge this code|Add an owner test that runs line \d+ and asserts on its result)\.$/,
  'dead-code': /^Remove the redundant code on line \d+\.$/,
  'random-only-kill':
    /^Keep the counterexample that `[^`]+` found in the random campaign as a fixed history\.$/,
  'agreement-only-kill':
    /^Assert on the value this path produces in `[^`]+`\.$/,
  'unregistered-kill':
    /^Register the route of `[^`]+` through the framework, so its failure counts as a kill\.$/,
  'framework-error':
    /^Make a law in `[^`]+` reject the change: only a framework calibration failed, and it judges no behavior\.$/,
  crashed:
    /^Production threw `[^`]*` in `[^`]+`; record the error as an observation in the driver, and state the law that decides if this input may throw\.$/,
  timeout:
    /^Bound the run of the owner tests so that they end, and let a law reject a run that does not\.$/,
  'setup-error':
    /^Run an owner test that loads this module and asserts on its exports, so a failed load rejects the mutant\.$/,
  'does-not-apply':
    /^Update the `find` text of this authored mutant so that it occurs exactly once in the source\.$/,
}
// Each gap's message as the report's author reads it: the line after its key.
function messagesOf(summary) {
  const lines = summary.split(`\n`)
  const messages = {}
  lines.forEach((line, i) => {
    const key = line.startsWith(`  - Key: `)
      ? line.slice(`  - Key: `.length).match(/^(`+) (.*) \1; rerun/)?.[2]
      : undefined
    if (key !== undefined) messages[key] = lines[i + 1].replace(/^  - /, ``)
  })
  return messages
}

// ## Production driver
//
// The driver turns the records into the capture rows and units the CLI's
// runner produces, calls the CLI's classification for each mutant as the
// runner does (asking for units only of the files it targets), assigns keys,
// and renders the summary.
const messages = {
  verdict: `Error: violation`,
  assertion: `AssertionError: expected [ 'a' ] to deeply equal [ 'b' ]`,
  crash: `TypeError: x.y is not a function`,
  timeoutMessage: `Error: Test timed out in 15000ms.`,
}
// The capture's comparison and the swap a comparison mutant states, as the
// instrumented code evaluates them (capture-setup.mjs `cmp`).
const captured = {
  '===': (a, b) => a === b,
  '!==': (a, b) => a !== b,
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
}
const capturedSwap = { '>': `>=`, '>=': `>`, '===': `!==` }
// What the capture records for a reached test: the mutants whose value it
// changed (`infected`), and the operands of each reached comparison.
function capturedRows(h, t) {
  const infected = []
  const operands = []
  t.reaches.forEach((r, mi) => {
    if (!r || mi >= h.mutants.length) return
    const m = h.mutants[mi]
    if (m.operator === `if-true`) {
      if (t.seen[mi] !== `true`) infected.push(mi)
    } else if (m.operator === `if-false`) {
      if (t.seen[mi] !== `false`) infected.push(mi)
    } else if (m.operator === `binary-swap` && capturedSwap[m.original]) {
      const [a, b] = t.pair[mi]
      operands.push([mi, [a, b]])
      const swapped = capturedSwap[m.original]
      if (captured[m.original](a, b) !== captured[swapped](a, b))
        infected.push(mi)
    } else infected.push(mi)
  })
  return { infected, operands }
}
function rowsOf(h, pass) {
  const rows = new Map()
  h.files.forEach((f, fi) => {
    f.tests.forEach((t, ti) => {
      rows.set(keyOf(fi, ti), {
        key: keyOf(fi, ti),
        hash: t.flaky && pass === 2 ? `h-again` : `h`,
        observed: `o`,
        hits: t.reaches.flatMap((r, mi) =>
          r && mi < h.mutants.length ? [mi] : [],
        ),
        outcomes: t.reaches.flatMap((r, mi) =>
          r && mi < h.mutants.length && h.mutants[mi].operator === `if-true`
            ? [[mi, [t.seen[mi] !== `false`, t.seen[mi] !== `true`]]]
            : [],
        ),
        ...capturedRows(h, t),
        route: t.route,
        verdicts: [],
      })
    })
    rows.set(`${fileName(fi)} > (background)`, {
      key: `${fileName(fi)} > (background)`,
      background: true,
      hits: f.background.flatMap((r, mi) =>
        r && mi < h.mutants.length ? [mi] : [],
      ),
    })
  })
  return rows
}
function unitOf(h, fi, mi) {
  const f = h.files[fi]
  const under = (t) => t.under[mi]
  if (f.tests.some((t) => under(t).kind === `runTimeout`))
    return { file: fileName(fi), timedOut: true, seconds: 1 }
  const loadFailed = f.tests.some((t) => under(t).kind === `setupError`)
  const tests = loadFailed ? [] : f.tests
  return {
    file: fileName(fi),
    timedOut: false,
    seconds: 1,
    setupErrors: loadFailed ? [`Error: cannot load the file`] : [],
    unhandled: tests.some((t) => under(t).kind === `unhandled`)
      ? [`unhandled rejection`]
      : [],
    tests: tests.map((t, ti) => {
      const kind = under(t).kind
      return {
        key: keyOf(fi, ti),
        fullName: `t${ti}`,
        state: messages[kind] ? `failed` : `passed`,
        message: messages[kind] ?? ``,
      }
    }),
    rows: tests.map((t, ti) => {
      const kind = under(t).kind
      return [
        keyOf(fi, ti),
        {
          key: keyOf(fi, ti),
          hash: kind === `changed` ? `h-changed` : `h`,
          observed: kind === `observedChanged` ? `o-changed` : `o`,
          hits: [],
          outcomes: [],
          route: t.route,
          verdicts:
            kind === `verdict`
              ? [
                  {
                    property: `p`,
                    law: under(t).law,
                    checkpoint: `c`,
                    route: under(t).firedAt,
                  },
                ]
              : [],
        },
      ]
    }),
  }
}

async function driver(h, observe) {
  const oracleFiles = new Set(
    h.files.flatMap((f, fi) => (f.oracle ? [fileName(fi)] : [])),
  )
  const baseline = baselineOf(rowsOf(h, 1), rowsOf(h, 2), oracleFiles)
  // The swap a comparison or logical mutant states (its replacement).
  const swapFor = { '>': `>=`, '>=': `>`, '===': `!==`, '&&': `||` }
  const mutants = h.mutants.map((m, mi) => ({
    id: `m${mi}`,
    number: mi,
    source: `src/x.ts`,
    function: `f${m.line}`,
    line: m.line + 1,
    operator: m.operator,
    anchor: m.anchor,
    ...(m.operator === `binary-swap`
      ? { original: m.original, replacement: swapFor[m.original] }
      : {}),
    ...(m.evidence ? { evidence: m.evidence } : {}),
    ...(m.probe ? { probeGuard: true } : {}),
  }))
  const fileIndex = (file) => Number(file.match(/f(\d+)\.test/)[1])
  const states = new Set()
  const results = mutants.map((mutant, mi) => {
    const owners = new Set(
      h.mutants[mi].owners
        .filter((fi) => fi < h.files.length)
        .map(fileName)
        .filter((file) => oracleFiles.has(file)),
    )
    const targets = targetsOf(mutant, baseline, owners, oracleFiles)
    const units = targets.oracleTargets.map((file) =>
      unitOf(h, fileIndex(file), mi),
    )
    const result = {
      ...mutant,
      ...judgeMutant(mutant, { owners, targets, units, baseline, mutants }),
    }
    if (result.outcome === `killed` && units.some((u) => u.timedOut))
      states.add(`killed beside a timeout`)
    if (needsOrdinary(result, targets))
      result.testOutcome = judgeOrdinary(
        targets.testTargets.map((file) => unitOf(h, fileIndex(file), mi)),
      )
    return result
  })
  report.assignKeys(results)
  const summary = report.renderReport({
    results,
    run: { id: `r`, inputs: `records` },
    excluded: [],
  })
  // The streaming printer (stream.mjs) prints each gap as the mutant is
  // judged; the completion order is the reverse here.
  const printer = await import(`./stream.mjs`).catch(() => undefined)
  observe(`classified`, {
    outcomes: results.map((r) => ({
      outcome: r.outcome,
      class: r.class,
      laws: r.laws && [...r.laws].sort(),
      testOutcome: r.testOutcome,
    })),
    summary: readSummary(summary),
    messages: messagesOf(summary),
    stdout: report.renderStdout?.({
      results,
      run: { id: `r`, inputs: `records` },
      excluded: [],
      pkg: `/pkg`,
      paths: { report: `out/summary.md`, results: `out/results.json` },
    }),
    streamed: printer
      ? [...report.gapsOf(results)].reverse().map((r) => printer.gapLine(r))
      : undefined,
    killsSection: summary.slice(summary.indexOf(`## Kills by law`)),
  })
  for (const r of results) {
    states.add(r.class ?? r.outcome)
    if (r.testOutcome === `killed`) states.add(`ordinary killed`)
    if (r.class === `not-infected` && r.evidence)
      states.add(`not-infected with a boundary hint`)
  }
  if (h.mutants.some((m) => m.anchor.includes(`\``) && !m.probe))
    states.add(`a key with backticks`)
  for (const state of states) observe(`reach`, state)
}

// ## Comparison
function check(h, observations, expected) {
  const got = observations.find((o) => o.checkpoint === `classified`)?.value
  if (!got)
    return violation(`classified`, `nothing was classified`, `completion`)
  // A kill names a non-empty part of its behavioral laws (the runner may
  // stop at the first); an agreement-only kill names reach agreement.
  const view = (o) =>
    JSON.stringify([o.outcome, o.class, o.testOutcome ?? null])
  for (const [mi, owed] of expected.outcomes.entries()) {
    const actual = got.outcomes[mi]
    const lawsFit =
      owed.laws === undefined ||
      (owed.lawsMayBePart
        ? (actual.laws ?? []).length > 0 &&
          actual.laws.every((law) => owed.laws.includes(law))
        : JSON.stringify(actual.laws ?? []) === JSON.stringify(owed.laws))
    if (view(actual) !== view(owed) || !lawsFit)
      return violation(
        `classified`,
        `mutant m${mi}: ${view(actual)} laws ${JSON.stringify(actual.laws ?? [])}, owed ${view(owed)} laws ${JSON.stringify(owed.laws ?? [])}`,
        `classification`,
        { actual, expected: owed },
      )
  }
  // Messages. Each gap's message is one directive from its kind's fixed set,
  // with no exit, carries the boundary sentence exactly when the mutant has
  // the hint, and names the run's data its kind is built from.
  const gapsOfModel = expected.outcomes.filter(
    (o) => !o.probe && !['killed', 'unowned'].includes(o.class ?? o.outcome),
  )
  for (const owed of gapsOfModel) {
    const kind = owed.class ?? owed.outcome
    const message = got.messages?.[owed.key]
    if (message === undefined)
      return violation(
        `classified`,
        `gap ${owed.key} has no message in the report`,
        `messages`,
      )
    const core =
      owed.boundary && owed.outcome === `survived`
        ? message.endsWith(` ${boundaryLine}`)
          ? message.slice(0, -boundaryLine.length - 1)
          : undefined
        : message.includes(boundaryLine)
          ? undefined
          : message
    if (core === undefined || !directives[kind]?.test(core))
      return violation(
        `classified`,
        `gap ${owed.key} (${kind}) has message ${JSON.stringify(message)}, which is not its directive${owed.boundary ? ` with the boundary sentence` : ``}`,
        `messages`,
        { actual: message, expected: directives[kind] },
      )
    if (exits.test(message.replace(/`[^`]*`/g, ``)))
      return violation(
        `classified`,
        `gap ${owed.key} (${kind}) has an exit in its message: ${JSON.stringify(message)}`,
        `messages`,
      )
    for (const text of owed.mention ?? [])
      if (!message.includes(text))
        return violation(
          `classified`,
          `gap ${owed.key} (${kind}) message ${JSON.stringify(message)} does not name ${JSON.stringify(text)}`,
          `messages`,
        )
  }
  // The compressed stdout summary: the totals, one legend line per class
  // present, and every gap once, under its function.
  const stdout = got.stdout
  if (typeof stdout !== `string`)
    return violation(`classified`, `no compressed stdout summary`, `stdout`)
  const stdoutGaps = stdout
    .split(`\n`)
    .filter((line) => /^  \S+ L\d+ m\d+ /.test(line))
  const kinds = new Set(gapsOfModel.map((o) => o.class ?? o.outcome))
  const functions = new Set(gapsOfModel.map((o) => o.function))
  const legend = stdout.split(`\n`).filter((line) => /^  [a-z-]+: /.test(line))
  const headings = stdout.split(`\n`).filter((line) => line.startsWith(`fn `))
  const stdoutProblem = !stdout.includes(`, ${gapsOfModel.length} gaps,`)
    ? `the totals do not state ${gapsOfModel.length} gaps`
    : !stdout.includes(`out/summary.md`)
      ? `the stdout does not print the path of the full report`
      : stdoutGaps.length !== gapsOfModel.length
        ? `${stdoutGaps.length} gap lines for ${gapsOfModel.length} gaps`
        : legend.length !== kinds.size
          ? `${legend.length} legend lines for ${kinds.size} classes`
          : headings.length !== functions.size
            ? `${headings.length} function groups for ${functions.size} functions`
            : gapsOfModel.find(
                  (o) =>
                    stdoutGaps.filter((line) =>
                      line.startsWith(
                        `  ${o.class ?? o.outcome} L${o.line} ${o.id} `,
                      ),
                    ).length !== 1,
                )
              ? `a gap is not printed once under its class, line, and id`
              : exits.test(stdout.replace(/`[^`]*`/g, ``))
                ? `the stdout summary has an exit`
                : undefined
  if (stdoutProblem)
    return violation(`classified`, stdoutProblem, `stdout`, {
      actual: stdout,
    })
  // Unowned warnings: one line per function, with its count, so that they
  // do not bury the gaps.
  const unownedFns = new Map()
  for (const o of expected.outcomes)
    if (!o.probe && o.outcome === `unowned`)
      unownedFns.set(o.function, (unownedFns.get(o.function) ?? 0) + 1)
  const unownedLines = stdout
    .split(`\n`)
    .filter((line) => line.startsWith(`  unowned fn `))
  const unownedText = (fn, n) =>
    `  unowned fn ${fn}: ${n} ${n === 1 ? `mutant` : `mutants`}`
  if (
    unownedLines.length !== unownedFns.size ||
    [...unownedFns].some(
      ([fn, n]) => !unownedLines.includes(unownedText(fn, n)),
    )
  )
    return violation(
      `classified`,
      `${unownedLines.length} unowned lines for ${unownedFns.size} functions with unowned mutants, or a wrong count`,
      `stdout`,
      { actual: unownedLines, expected: [...unownedFns] },
    )
  // The kills-by-law section names one next step for a law that rejects no
  // mutant, and offers no exit.
  if (!got.killsSection?.includes(killsDirective))
    return violation(
      `classified`,
      `the kills-by-law section does not direct the author to a next step`,
      `messages`,
      { actual: got.killsSection },
    )
  if (exits.test(got.killsSection.replace(/`[^`]*`/g, ``)))
    return violation(
      `classified`,
      `the kills-by-law section offers an exit`,
      `messages`,
      { actual: got.killsSection },
    )
  // The streamed lines are the stdout's gap lines, each once.
  const printed = stdoutGaps.map((line) => line.slice(2)).sort()
  const streamed = got.streamed
  if (!Array.isArray(streamed))
    return violation(`classified`, `no streaming printer`, `stream`)
  if (JSON.stringify([...streamed].sort()) !== JSON.stringify(printed))
    return violation(
      `classified`,
      `the streamed gap lines differ from the stdout's: ${streamed.length} streamed, ${printed.length} printed`,
      `stream`,
      { actual: streamed, expected: printed },
    )
  if (JSON.stringify(got.summary) !== JSON.stringify(expected.summary))
    return violation(
      `classified`,
      `the summary does not list exactly the owed gaps, unowned warnings, and counts`,
      `report completeness`,
      { actual: got.summary, expected: expected.summary },
    )
  return pass
}

declareOracle({
  check: [check],
  model: [model, modelOutcome, ordinaryOutcome],
  grammar: [records],
})

// ## Calibrations
const corrupt = (change) => (trace) => {
  const index = trace.findIndex((o) => o.checkpoint === `classified`)
  if (index < 0) return undefined
  const value = structuredClone(trace[index].value)
  if (change(value) === false) return undefined
  return trace.map((o, i) => (i === index ? { ...o, value } : o))
}
const calibrations = [
  {
    name: `a message offers an equivalence exit`,
    law: `messages`,
    corrupt: (trace) => {
      const index = trace.findIndex((o) => o.checkpoint === `classified`)
      if (index < 0) return undefined
      const value = structuredClone(trace[index].value)
      const key = Object.keys(value.messages ?? {})[0]
      if (key === undefined) return undefined
      value.messages[key] =
        `Either the mutant is equivalent, or ${value.messages[key]}`
      return trace.map((o, i) => (i === index ? { ...o, value } : o))
    },
  },
  {
    name: `a survivor's message asks a question`,
    law: `messages`,
    corrupt: (trace) => {
      const index = trace.findIndex((o) => o.checkpoint === `classified`)
      if (index < 0) return undefined
      const value = structuredClone(trace[index].value)
      const key = Object.keys(value.messages ?? {})[0]
      if (key === undefined) return undefined
      value.messages[key] = `Which law forbids this value?`
      return trace.map((o, i) => (i === index ? { ...o, value } : o))
    },
  },
  {
    name: `a not-infected comparison is reported as not observed`,
    law: `classification`,
    corrupt: corrupt((v) => {
      const o = v.outcomes.find((x) => x.class === `not-infected`)
      if (!o) return false
      o.class = `not-observed`
    }),
  },
  {
    name: `the stdout summary omits a gap`,
    law: `stdout`,
    corrupt: (trace) => {
      const index = trace.findIndex((o) => o.checkpoint === `classified`)
      if (index < 0) return undefined
      const value = structuredClone(trace[index].value)
      const line = value.stdout
        ?.split(`\n`)
        .find((l) => /^  \S+ L\d+ m\d+ /.test(l))
      if (line === undefined) return undefined
      value.stdout = value.stdout.replace(`${line}\n`, ``)
      return trace.map((o, i) => (i === index ? { ...o, value } : o))
    },
  },
  {
    name: `the stream prints a gap twice`,
    law: `stream`,
    corrupt: (trace) => {
      const index = trace.findIndex((o) => o.checkpoint === `classified`)
      if (index < 0) return undefined
      const value = structuredClone(trace[index].value)
      if (!value.streamed?.length) return undefined
      value.streamed.push(value.streamed[0])
      return trace.map((o, i) => (i === index ? { ...o, value } : o))
    },
  },
  {
    name: `a crash is reported as a kill`,
    law: `classification`,
    corrupt: corrupt((v) => {
      const o = v.outcomes.find((x) => x.outcome === `crashed`)
      if (!o) return false
      o.outcome = `killed`
    }),
  },
  {
    name: `a random-only kill is reported as a kill`,
    law: `classification`,
    corrupt: corrupt((v) => {
      const o = v.outcomes.find((x) => x.outcome === `random-only-kill`)
      if (!o) return false
      o.outcome = `killed`
    }),
  },
  {
    name: `the summary omits a gap`,
    law: `report completeness`,
    corrupt: corrupt((v) => {
      if (v.summary.gaps.length === 0) return false
      v.summary.gaps.shift()
    }),
  },
]

const required = [
  `unowned`,
  `unreached`,
  `timeout`,
  `killed`,
  `killed beside a timeout`,
  `agreement-only-kill`,
  `random-only-kill`,
  `unregistered-kill`,
  `crashed`,
  `framework-error`,
  `setup-error`,
  `not-judged`,
  `indeterminate`,
  `branch-never-taken`,
  `not-infected`,
  `not-infected with a boundary hint`,
  `not-observed`,
  `dead-code`,
  `ordinary killed`,
  `a key with backticks`,
]

// One constructed history per outcome class: one mutant judged by one
// oracle file's test, with the effect that makes the class, and an ordinary
// file whose assertion fails beside a survivor.
const four = (value) => Array.from({ length: MUTANTS }, () => value)
const single = (
  name,
  enters,
  { mutant = {}, test = {}, effect = {}, ordinary = false } = {},
) => ({
  name,
  enters,
  build: () => ({
    files: [
      {
        oracle: true,
        tests: [
          {
            route: `fixed seed`,
            flaky: false,
            reaches: four(true),
            seen: four(`both`),
            pair: four([0, 1]),
            under: four({
              kind: `same`,
              law: `L`,
              firedAt: undefined,
              ...effect,
            }),
            ...test,
          },
        ],
        background: four(false),
      },
      ...(ordinary
        ? [
            {
              oracle: false,
              tests: [
                {
                  route: `fixed seed`,
                  flaky: false,
                  reaches: four(true),
                  seen: four(`both`),
                  pair: four([0, 1]),
                  under: four({
                    kind: `assertion`,
                    law: `L`,
                    firedAt: undefined,
                  }),
                },
              ],
              background: four(false),
            },
          ]
        : []),
    ],
    mutants: [
      {
        owners: [0],
        line: 0,
        operator: `delete-call`,
        original: `>`,
        evidence: undefined,
        anchor: `out . push ( 'a' ) ;`,
        probe: false,
        ...mutant,
      },
    ],
  }),
})
const constructed = [
  single(`an unowned mutant`, [`unowned`], { mutant: { owners: [] } }),
  single(`an unreached mutant`, [`unreached`], {
    test: { reaches: four(false) },
  }),
  single(`a run that timed out`, [`timeout`], {
    effect: { kind: `runTimeout` },
  }),
  single(`a verdict on a fixed seed`, [`killed`], {
    effect: { kind: `verdict` },
  }),
  single(`reach agreement alone`, [`agreement-only-kill`], {
    effect: { kind: `verdict`, law: `reach agreement` },
  }),
  single(`a verdict that fired in the random campaign`, [`random-only-kill`], {
    effect: { kind: `verdict`, firedAt: `random seed` },
  }),
  single(`a verdict with no route`, [`unregistered-kill`], {
    test: { route: undefined },
    effect: { kind: `verdict` },
  }),
  single(`a crash`, [`crashed`], { effect: { kind: `crash` } }),
  {
    // One owner file kills; another's run times out. The kill decides.
    name: `a kill beside a timed-out run`,
    enters: [`killed beside a timeout`],
    build: () => {
      const base = single(`x`, [], { effect: { kind: `verdict` } }).build()
      return {
        ...base,
        files: [
          base.files[0],
          {
            ...base.files[0],
            tests: [
              {
                ...base.files[0].tests[0],
                under: four({
                  kind: `runTimeout`,
                  law: `L`,
                  firedAt: undefined,
                }),
              },
            ],
          },
        ],
        mutants: [{ ...base.mutants[0], owners: [0, 1] }],
      }
    },
  },
  single(`a failing calibration`, [`framework-error`], {
    test: { route: `calibration` },
    effect: { kind: `crash` },
  }),
  single(`a file that fails to load`, [`setup-error`], {
    effect: { kind: `setupError` },
  }),
  single(`a changed value`, [`not-judged`], {
    effect: { kind: `changed` },
  }),
  single(`a changed observation`, [`not-judged`], {
    effect: { kind: `observedChanged` },
  }),
  single(`only a nondeterministic test`, [`indeterminate`], {
    test: { flaky: true },
  }),
  single(`an if that took one outcome`, [`branch-never-taken`], {
    mutant: { operator: `if-true` },
    test: { seen: four(`true`) },
  }),
  // A comparison whose operators agree on the operands the test reached: the
  // mutant changes no value, and the message names those operands.
  single(`a comparison whose operands never tie`, [`not-infected`], {
    mutant: { operator: `binary-swap`, original: `>` },
    test: { pair: four([1, 2]) },
  }),
  single(
    `a comparison that never ties, with the boundary hint`,
    [`not-infected`, `not-infected with a boundary hint`],
    {
      mutant: {
        operator: `binary-swap`,
        original: `>`,
        evidence: `boundary: -0`,
      },
      test: { pair: four([1, 2]) },
    },
  ),
  // The same comparison on a tie: infected, and no observation shows it.
  single(`a comparison that ties and shows nothing`, [`not-observed`], {
    mutant: { operator: `binary-swap`, original: `>` },
    test: { pair: four([2, 2]) },
  }),
  single(`a logical swap that is dead code`, [`dead-code`], {
    mutant: {
      operator: `binary-swap`,
      original: `&&`,
      evidence: `dead code`,
    },
  }),
  // The field witness (issue 2254): an infected survivor that no recorded
  // observation shows. Its message named the exits the report offered.
  single(
    `an infected survivor that no observation shows`,
    [`not-observed`],
    {},
  ),
  single(
    `a survivor an ordinary test fails`,
    [`not-observed`, `ordinary killed`],
    { ordinary: true },
  ),
  single(`a key with backticks`, [`a key with backticks`], {
    mutant: { anchor: `x \`\` y` },
    effect: { kind: `changed` },
  }),
]

oracleProperty({
  id: `oracle-gaps.report-classify`,
  law: {
    statement: `From the records of the runs that judged it, each mutant gets the outcome the law assigns: kills only by law verdicts on reproducible routes, agreement-only, random-only, and unregistered kills, timeouts, crashes, framework and setup errors as gaps, survivors split into not-judged, indeterminate, dead-code, branch-never-taken, not-infected, and not-observed, and ordinary tests for information only. Every gap has one directive message from its kind's fixed set, with no exit. The summary lists every gap and unowned mutant once with consistent counts; the stdout summary and the streamed gap lines cover every gap once.`,
    authority: `The maintainer's gap-check decisions in design runs v11, v14, and v19 (2026-11-04 and 2026-11-05), as for oracle-gaps.report; the oracle rubric's outcome kinds (ORC-006); the frozen design's oracle over the checker's pure core (v19 P10, F4); the maintainer's few-seconds budget for an incremental test run (2026-11-05).`,
    limits: `No authored mutants. That real runs produce these records is oracle-gaps.report's.`,
    owner: `packages/oracles/oracle-gaps`,
  },
  histories: {
    arbitrary: records,
    states: required,
    runs: 300,
    fixedSeeds: [20261105],
    constructed,
  },
  resolve: (h) => h,
  model,
  driver,
  check,
  calibrations,
  timeout: 60_000,
})
