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
 * 1. No owner: `unowned`. An oracle file that fails with no mutant active
 *    judges nothing: a mutant that one owns, and that no passing owner
 *    kills, is `blocked`, a gap whose message names the failing owners in
 *    report order (maintainer disposition G5, 2026-11-11; the v20 freeze's
 *    decision 2). Laws 2 to 5 apply over the passing owners. No passing
 *    owner test reached it: `unreached`.
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
 *    so a kill names a non-empty part of them. An operator mutant's owner
 *    files run one after another in report order (law 7), and the runner
 *    stops at the first that kills, so its kill names laws of that file
 *    alone. Failing that, a run that
 *    timed out makes it `timeout`. Failing that, reproducible verdicts under
 *    reach agreement alone make it an `agreement-only-kill`, which names
 *    them all. Failing that, a verdict on the random campaign
 *    makes it a `random-only-kill`, and one on an unknown or unregistered
 *    route an `unregistered-kill`.
 *    A test's work is the number of site evaluations that its production
 *    code made (capture-setup.mjs `calls`), a count, never a time. A test
 *    whose property declares a work bound (`work: { ratio }`) and whose
 *    work under the mutant is more than `ratio` times its work with no
 *    mutant active reports a verdict under law `work bound` on its route,
 *    as a law violation does, so it kills on a reproducible route and is a
 *    `random-only-kill` or an `unregistered-kill` elsewhere. Only a test
 *    whose work judges the mutant reports it: it passed under the mutant,
 *    it reached the mutant (or its file loaded code that did), its
 *    observations and its work agreed between the two unmutated runs, and
 *    its route judges production (not the framework's own checks). The
 *    runner's stop at the first file that kills reads law verdicts only, so
 *    a kill names the laws of the files that ran up to that one, `work
 *    bound` among them when one of their tests exceeded its bound.
 *    Authority: the maintainer's decision of 2026-11-12 that a production
 *    branch that exists only for speed, reported as `not-observed`, is a
 *    gap CLI bug ("this is a bug then in the gap cli and should be fixed"),
 *    and the design decided with it that day: a speed shortcut is owed a
 *    cost law, not an exit, so a regression that deletes it must be
 *    catchable, by a deterministic count and never by wall-clock time.
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
 *    `indeterminate` when no such test judged it; `extra-work` when a test
 *    whose work judges the mutant (law 3) did more work under it than with
 *    no mutant active, though no observation changed: the mutant deletes a
 *    shortcut that exists for speed, which only a cost law sees, so its
 *    directive names the first such test in report order, its two work
 *    counts and their ratio, and the work bound to declare on its property,
 *    the largest ratio in hundredths below the measured one (1 when the
 *    test did no work before), which rejects the mutant; a mutant whose
 *    work fell, or rose only in a test whose work does not judge it, is
 *    not `extra-work`; `dead-code` when the
 *    mutant carries the `dead code` evidence (no input distinguishes it);
 *    `outside-annotation` when the type analysis names an input class
 *    outside the declared types, and none of its inputs distinguishes the
 *    mutant (maintainer decision, 2026-11-11: types never skip a mutant or
 *    mark it dead, they label its survivor; an argument typed \`any\` is
 *    an input the types allow, so the class claims no more);
 *    `branch-never-taken` when it is an `if`-operator mutant and an owner
 *    test reached its `if` with one outcome only; `not-infected` when it is
 *    a comparison whose two operators agree on every operand pair the
 *    owners reached; `not-observed` when an `if` or comparison mutant was
 *    infected and no recorded observation showed the change; and
 *    `not-distinguished` for any other operator, whose infection the
 *    capture does not measure, so its directive names the input that
 *    distinguishes it. This oracle's grammar has no operator that always
 *    changes a value when reached (`!`, booleans, arithmetic); production
 *    measures those and classes them `not-observed`, which the end-to-end
 *    oracle checks.
 *    A mutant is infected in a test when its mutated expression's value
 *    differs from the original's there. A comparison is infected when the
 *    operators disagree on its operands; an `if` when its condition took the
 *    outcome the mutant forces the other way; any other mutant when reached
 *    (its helper infects on reach).
 * 7. Every survivor's message is one directive from its class's fixed set,
 *    built from the run's data (the test that infected it, the operands
 *    seen, the outcome an `if` took). Messages and lists name tests in
 *    report order: by test file path, and within a file in the order of the
 *    baseline run's records of that file's tests. A message that names one
 *    test names the first that its class's condition holds for: the test
 *    whose value changed, the test that infected the mutant, or the test
 *    that its kill or crash names; an operand list and a list of
 *    nondeterministic tests follow the same order. So do the lists that name
 *    files: a gap's `Owners` line (the owner files that reached the mutant),
 *    and the files that failed with no mutant active (which the run's
 *    refusal names, or results.json's `excluded` and the summary list as
 *    left out), and results.json's nondeterministic tests. An operator
 *    mutant's owner files also run in report order (law 3). A failing test
 *    is ordered by file path too, and within a file in the order the
 *    reporter lists the file's tests, which is the order the file declares
 *    them. A file path's order is the order of its UTF-16 code units, as
 *    JavaScript's `<` compares strings, not a locale's.
 *    Report order depends on none of the orders a run can vary: the order
 *    in which the runner joins the files' baseline records (its context
 *    count sets it), the order in which a mutant run writes a file's
 *    records, and the order in which a mutant's owners were declared. So
 *    the same project and code give the same report on any machine. The
 *    model orders the files by their paths and, within a file, by the
 *    tests' order, in which the driver writes each file's baseline records;
 *    the grammar generates the three other orders. Authority: the gap CLI's determinism requirement,
 *    which the end-to-end oracle's determinism test and its law 9 (a check
 *    reports what a cold run reports) state, and which the runner's
 *    authored loop cites ("listed alike in every run", check.mjs); the
 *    maintainer's decision of 2026-11-11 that the tests a report names
 *    depend on neither `--contexts`, worker timing, nor how the owners were
 *    declared. That a real run writes a file's baseline records in one
 *    order each time is the end-to-end oracle's determinism test's.
 *    A message never offers an exit:
 *    no equivalence, approval, limit, choice, or question. A mutant with the
 *    `boundary: -0` hint adds "Add a boundary history with -0 and 0." to its
 *    message. The summary's message is read as an author reads it.
 *    A `not-observed` survivor was infected, and no recorded observation
 *    changed. The records cannot tell a changed value that nothing observed
 *    from a forced branch that computed the same result as the original on
 *    the generated inputs (infected, not propagated: klona's M6), so its
 *    directive names both next steps: observe the value, and add a history
 *    where the mutated code computes something different (maintainer
 *    finding F22, 2026-11-10). Both are steps, so the message offers no
 *    choice.
 *    Each operand a `not-infected` message names is printed as a code span
 *    of a typed text: two operands that the model treats as different
 *    values never print the same (maintainer finding, 2026-11-10). The
 *    model's values are primitives by SameValue (so `-0` and `0`, `1` and
 *    `"1"`, `1n` and `1`, `undefined`, `null`, and `NaN` all differ, and two
 *    long strings that share a prefix differ), and a non-primitive operand
 *    as its type alone, because the capture records only its type. Each
 *    printed text is the model's own rendering of its operand: a string as
 *    JSON, past 40 code points its first 37, `...`, `#`, and eight hex digits
 *    of its SHA-1; a bigint with `n`; `-0`; another primitive as JavaScript
 *    prints it; a non-primitive as `(object)` or `(function)`.
 * 8. The compressed stdout summary (report.mjs `renderStdout`) lists the
 *    totals, one legend line per class present, and every gap once, one line
 *    each, grouped by function; it names the full report's path. The
 *    streamed gap lines (stream.mjs `gapLine`), printed in the order the
 *    mutants are judged, are the same lines, each once. A gap line is one
 *    line however long its code or intent is: each of the mutant's original
 *    and replacement code, and an authored mutant's intent, is shown with its
 *    whitespace collapsed to single spaces and, past 60 characters (code
 *    points, so an astral-plane character is never split), cut to its first
 *    57 and `...`. An intent is the author's text, so it prints as a code
 *    span, which the exit law does not read. The results keep the full text.
 *    Every line of the stdout is a line of the stream, with the stream's
 *    prefix and its kind (the maintainer's request of 2026-11-12, and the
 *    coordinator's decision on review F1): `oracle-gaps: summary` for the
 *    totals, `oracle-gaps: legend <class>:` for each directive,
 *    `oracle-gaps: function` for each function's heading, `oracle-gaps:
 *    gap`, `oracle-gaps: baseline`, `oracle-gaps: blocked`, `oracle-gaps:
 *    note` (the provisional count, the unowned counts, the files left out,
 *    and the results' path), and `oracle-gaps: done`; only the lines
 *    indented under a failing baseline file have none, and no line is
 *    blank.
 *    The stdout leads with the baseline (law 9's lines), then the one
 *    decisive baseline line (all oracle files pass, or how many of them
 *    failed, provisional), then one `oracle-gaps: blocked`
 *    line for each failing oracle file that names it, its failing test, and
 *    the step that unblocks it (G13), then, when an oracle file failed,
 *    `Provisional:` with the count of blocked mutants; summary.md leads with
 *    the same lines, before its gaps (the freeze's one loop, 2026-11-10).
 *    The legend line for `crashed` says first that a crash is a gap, not a
 *    kill, and that its error is on the gap's Detail line (G3; the freeze,
 *    P3 and C1). The last stdout line is `oracle-gaps: done completed, <n>
 *    gaps[ (provisional)], report <path>` (G6). A replay
 *    line is a command, which the exit law does not read.
 * 9. Before any mutant, each test file's baseline is printed, an ordinary
 *    file marked `(ordinary)`: `pass` with its test count, or `fail` with how
 *    many of its tests failed, its first failing test and that test's error,
 *    the law, difference, and counterexample of a law violation (read from
 *    the framework's message), and the command that replays its first
 *    failing test; a file that did not load says so. That
 *    command, read as a POSIX shell reads it, is `vitest run <file>`, with
 *    a `-t` pattern when a test failed: Vitest then runs exactly that test
 *    of the file, whether it matches the pattern against the names of the
 *    test's suites and its own joined by a space (Vitest 4) or by ` > `
 *    (Vitest 5). A file that failed with no failing test (it did not load)
 *    replays whole, with no `-t`. Every baseline line is one line, even when
 *    a test's name holds a newline or a tab.
 * 6. A survivor or an unreached mutant that ordinary tests reached gets
 *    their outcome for information, where an assertion failure counts on the
 *    test's route; it never changes the class.
 *
 * Law 7 over the classified mutants: the summary lists every gap (every
 * class except `killed` and `unowned`, outside probe code) once under its
 * key, with its kind and line, every unowned mutant as a warning, and counts
 * that agree.
 *
 * Authored mutants (written by someone other than the oracle's author,
 * authored.mjs) follow laws 1 to 4 over every test of their owner files,
 * because their copy is not instrumented and records no reach: no owner is
 * `unowned`, and a `find` that does not apply is `does-not-apply`. A
 * survivor is `not-judged` when a deterministic owner test's observation
 * changed, and `not-observed` otherwise.
 *
 * Authority: the maintainer's gap-check decisions (design runs v11, v14,
 * and v19), as for oracle-gaps.report; ORC-006's outcome kinds; the frozen
 * design's oracle over the checker's pure core (v19 P10, F4); the
 * maintainer's few-seconds budget for an incremental test run (2026-11-05);
 * the maintainer's findings on the report's output (F22 and the leftovers of
 * #12, 2026-11-10); and, for law 9, Vitest's runner, which reads `-t` as a
 * regular expression and matches it against `getTaskFullName`, the suites'
 * names and the test's joined by a space (@vitest/runner 4.1).
 *
 * Limits: the records' shapes are those capture-setup.mjs writes; that a
 * real run writes them correctly is the end-to-end oracle's, and so is
 * which work the capture counts. A test that reaches a site and did no
 * work is generated, though no real run records one. An authored mutant's
 * copy is not instrumented and counts no work, so the work law does not
 * judge it. The driver
 * encodes operands as the capture does (`shown`); that the capture's
 * encoding is lossless is not judged here, and two long strings are told
 * apart by a 32-bit digest. No symbol operand is generated: two symbols of
 * one description print alike. Only the runner's single-file path
 * (`unit()`) records a test's names, and only it feeds the baseline; units
 * from the batch path carry none. Test names hold no backtick and no ` > `, the
 * names within a file are distinct, and the replay's file argument is judged
 * as text, not as Vitest's substring match over every file. Report order
 * within a file is the baseline's record order: that a file whose tests run
 * concurrently writes its records in one order is not judged, and a failing
 * test is ordered within its file as the reporter lists it, which a run cut
 * off by a hang takes from the records. Of the "Changed observations in"
 * list, which holds the first three changed tests, only the first test is
 * compared (it is the not-judged message's). Every test the mutant runs
 * record the baseline recorded too, so a test the baseline did not record,
 * which report order puts after its file's others, is not generated. A file
 * that fails with no mutant active keeps its records here, which the
 * runner drops; the driver leaves a failing owner out of each mutant's
 * targets, as the runner does. A failing test fails by one violation
 * message or one error text. An authored
 * mutant's intent holds no word the exit law forbids, because the stdout
 * prints it as text, and its author is not shortened.
 */
import { createHash } from 'node:crypto'
import fc from 'fast-check'
import { oracleProperty, pass, violation } from '../src/oracle-property.ts'
import {
  baselineOf,
  judgeAuthored,
  judgeMutant,
  judgeOrdinary,
  needsOrdinary,
  outcomeOf,
  passOf,
  targetsOf,
} from './classify.mjs'
import * as core from './classify.mjs'
import { readSummary } from './gap-report-model-oracle.mjs'
import * as report from './report.mjs'

const MUTANTS = 4
const AUTHORED = 2
// Each test's effect under each mutant: the operator mutants first, then
// the authored ones.
const SLOTS = MUTANTS + AUTHORED

// ## History grammar
//
// A history is a package's test files, each an oracle file or an ordinary
// one, up to four mutants of one source, each with its owner files, its
// line, operator, statement anchor (with backticks, which the summary must
// fence), and code, and up to two authored mutants, each with its owners,
// its intent and author, and whether its `find` applies. Each test has a
// registered route or none, may be nondeterministic, and has, for each
// mutant, whether it reached it, which outcomes an `if` there took, the
// operands a comparison there saw, and what it did under it: nothing
// different, a changed asserted or observed value, a law verdict (on the
// route then active, or with none active), an assertion failure, a crash, a
// timeout message, a timed-out run, a setup error, or an unhandled error.
// Each test also has a name and enclosing suites, whose names hold regular
// expression and shell syntax, and each file a baseline: it passes, a test
// of it fails with no mutant active, or it does not load. A law verdict
// names one of two behavioral laws, `L` and `M`, or reach agreement, so
// the laws of a kill can show which owner file decided it.
//
// Each test also has a work count with no mutant active (none, some, or
// much), may have done one more in its second unmutated run, may declare a
// work bound of 1, 1.5, or 2, and has, under each mutant, an amount that
// the mutant adds to its work or takes from it. The amounts straddle the
// bounds: 1 more on 10 or 100 is under every bound but 1, 7 more on 10 is
// past 1.5 and under 2, and 150 more is past every bound. Its time in
// milliseconds varies on its own, as a clock's does, so a classification
// that read time where it owes work would disagree with the model.
//
// The order of the records is also generated, because a real run's order
// depends on how it ran (law 7). The runner deals the files round-robin over
// its contexts and joins their records context by context, so the baseline's
// records come file by file in an order that the context count sets: with
// two contexts, files a, b, and c give the records of a, c, then b. The
// grammar gives each file a place in the baseline's records
// (`baselineOrder`), any order of the files, of which each deal is one. The
// records of one file come from one run, in the order its tests wrote them,
// and a mutant run can write them in another order than the baseline did, so
// each test also has a place among its file's records in a mutant run
// (`runOrder`). The reporter lists a file's tests in the order the file
// declares them, so that list keeps its order. Each mutant, operator or
// authored, lists its owners in the order they were declared, which need
// not be file order: the runner keeps the owner files of an authored mutant
// in the order that its `owns` declarations give them (owners.mjs, entries of
// the function before entries of the whole file). Each file has a name
// (`fileStems`) from a set in which code-unit order and a locale's order
// disagree, by case and by `_`, `-`, and `.`, so a path order that a
// locale's comparison decides is seen.
//
// The code and intents straddle the gap line's 60-character cut (exactly 60,
// 61, and longer), span lines, and hold backticks; one holds an astral-plane
// character (two UTF-16 units) where the cut falls, so a cut by UTF-16 units
// would split it. An intent holds words the exit law forbids, which the gap
// line must keep inside its code span.
const sixty = `value.total > limit.maximum && value.total !== limit.exact`
const codes = [
  [`x > 4`, `true`],
  [`out.push('a')`, `;`],
  [`${sixty}()`, `false`],
  [`${sixty}(1)`, `false`],
  [
    `items\n    .filter((item) => item.ok)\n    .map((item) => item.id)\n    .join(',')`,
    `undefined`,
  ],
  [`\`\${a}\` + b`, `\`\${a}\` - b`],
  [`${`a`.repeat(56)}😀😀 && b.rest()`, `false`],
]
const intents = [
  `pushes a different label`,
  `remembers removed ids it never held, and returns them after a reset of the cache`,
  `skips the write\n  on a retry`,
  `pushes a label that is sixty characters long, as lines read.`,
  `pushes a label that is sixty-one characters long, as lines do`,
  `${`b`.repeat(56)}😀😀 pushes past the cut`,
  `returns null or undefined, whichever comes first?`,
]
// The operands a comparison sees: small numbers, so that ties (which
// separate `>` from `>=`) happen, and typed values that a printer which
// drops the type, the sign of zero, or a long string's tail would conflate.
const longText = `${`the shared prefix of two long operands `.repeat(2)}`
const typedOperands = [
  -0,
  `1`,
  `0`,
  ``,
  `NaN`,
  `undefined`,
  `null`,
  `1n`,
  `a and b`,
  `x; y`,
  `or?`,
  undefined,
  null,
  NaN,
  1n,
  0n,
  true,
  `true`,
  `${longText}one`,
  `${longText}two`,
  // An astral-plane character where a 37-character cut falls.
  `${`c`.repeat(36)}😀😀 and more text past the cut`,
  {},
  [],
]
const operand = fc.oneof(
  { weight: 3, arbitrary: fc.nat({ max: 2 }) },
  { weight: 2, arbitrary: fc.constantFrom(...typedOperands) },
)
const suiteNames = [
  `t0`,
  `s (1)`,
  `a.b`,
  `$x`,
  `it's`,
  `back\\slash`,
  `two\nlines`,
]
const labels = [
  ``,
  ``,
  `(a|b) `,
  `$HOME `,
  `it's `,
  `q"t `,
  `[t0]+ `,
  `^x$ `,
  `tab\there `,
]
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
// File names in which code-unit order and a locale's order disagree: an
// upper-case letter sorts before every lower-case one by code unit and
// beside its lower case in a locale, and `_` sorts after `-` and `.` by code
// unit and before them in a locale. (`-` and `.` sort alike in both.)
const fileStems = [`f0`, `f1`, `f2`, `F1`, `f-2`, `f.2`, `f_2`]
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
  law: fc.constantFrom(`L`, `M`, `reach agreement`),
  // The route active when a verdict fired, when it differs from the test's.
  firedAt: fc.option(fc.constantFrom(...routes.slice(1)), { nil: undefined }),
  // What the mutant adds to the test's work (site evaluations; a negative
  // amount takes work away), and the test's time in milliseconds, which
  // varies as a clock does and judges nothing.
  work: fc.constantFrom(0, 0, 0, -1, 1, 4, 7, 150),
  ms: fc.nat({ max: 40 }),
})
const testRecord = fc.record({
  route: fc.constantFrom(...routes),
  flaky: fc.constantFrom(false, false, false, true),
  reaches: fc.array(fc.boolean(), { minLength: MUTANTS, maxLength: MUTANTS }),
  seen: fc.array(fc.constantFrom(`both`, `both`, `true`, `false`), {
    minLength: MUTANTS,
    maxLength: MUTANTS,
  }),
  under: fc.array(effect, { minLength: SLOTS, maxLength: SLOTS }),
  // The two operands of each comparison the test reached.
  pair: fc.array(fc.tuple(operand, operand), {
    minLength: MUTANTS,
    maxLength: MUTANTS,
  }),
  // The test's enclosing suites and the label before its name, and whether
  // it fails with no mutant active when its file's baseline is `test`.
  suites: fc.array(fc.constantFrom(...suiteNames), { maxLength: 2 }),
  label: fc.constantFrom(...labels),
  // A tail after its index, so that one test's name can end with another's.
  tail: fc.constantFrom(``, ``, ` t0`),
  fails: fc.boolean(),
  // The test's place among its file's records in a mutant run (ties keep the
  // file's order).
  runOrder: fc.nat({ max: 2 }),
  // The test's work with no mutant active, in site evaluations; whether its
  // second unmutated run did one more (its observations still agreeing);
  // the work bound its property declares (`work: { ratio }`), if any, in
  // hundredths; whether its count could follow the clock, and by which
  // path (a timer or interval, a timer of `node:timers/promises`, a read of
  // a clock such as `Date.now()`, or I/O held open), all of which the
  // capture records as one flag, `clocked`, beside `io`; and its time in the
  // two unmutated runs, which judges nothing.
  work: fc.constantFrom(0, 10, 25, 100),
  workFlaky: fc.constantFrom(false, false, false, true),
  bound: fc.constantFrom(undefined, undefined, 100, 116, 150, 200),
  clocked: fc.oneof(
    { weight: 4, arbitrary: fc.constant(`none`) },
    {
      weight: 4,
      arbitrary: fc.constantFrom(
        `timer`,
        `timers/promises`,
        `clock read`,
        `spied clock read`,
        `process.uptime`,
        `os.uptime`,
        `AbortSignal.timeout`,
        `Atomics.wait`,
        `Atomics.waitAsync`,
        `monitorEventLoopDelay`,
        `io`,
      ),
    },
  ),
  ms: fc.nat({ max: 40 }),
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
      // Whether that loaded code changed a measured value of the mutant
      // (an `if`'s outcome or a comparison's operators).
      backgroundInfects: fc.array(fc.boolean(), {
        minLength: MUTANTS,
        maxLength: MUTANTS,
      }),
      // The file with no mutant active: it passes, a test fails, or it does
      // not load.
      baseline: fc.constantFrom(`pass`, `pass`, `test`, `load`),
      // How a failing test fails: a law violation, as the framework reports
      // one, or any other error.
      failure: fc.constantFrom(`violation`, `error`),
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
        `loop-false`,
        `value-undefined`,
        `field-drop`,
        `return-undefined`,
        `optional-chain`,
      ),
      original: fc.constantFrom(`>`, `>=`, `===`, `&&`, `||`, `??`),
      // The code any other operator replaces, and its replacement.
      code: fc.constantFrom(...codes),
      evidence: fc.constantFrom(
        undefined,
        undefined,
        `dead code`,
        `boundary: -0`,
      ),
      // The input class that the type analysis names for a mutant that no
      // input of the declared types distinguishes (maintainer decision,
      // 2026-11-11): a label for the survivor, never a skip.
      outside: fc.constantFrom(
        undefined,
        undefined,
        undefined,
        `a string of the literal's digits`,
        `\`null\``,
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
  authored: fc.array(
    fc.record({
      owners: fc.array(fc.nat({ max: 2 }), { maxLength: 2 }),
      line: fc.nat({ max: 1 }),
      applies: fc.constantFrom(true, true, true, false),
      intent: fc.constantFrom(...intents),
      author: fc.constantFrom(`agent a`, `the reviewer`),
    }),
    { maxLength: AUTHORED },
  ),
  // Each file's place in the baseline's records (ties keep file order).
  baselineOrder: fc.array(fc.nat({ max: 2 }), { minLength: 3, maxLength: 3 }),
  // Each file's name, before `.test.ts`.
  fileStems: fc.uniqueArray(fc.constantFrom(...fileStems), {
    minLength: 3,
    maxLength: 3,
  }),
})

// A file's path, and its path relative to the package.
const relativeName = (h, fi) => `tests/${h.fileStems[fi]}.test.ts`
const fileName = (h, fi) => `/pkg/${relativeName(h, fi)}`
// Report order's file order (law 7): the paths compared by UTF-16 code
// units, as JavaScript's `<` compares strings.
const byPath = (h) => (a, b) =>
  fileName(h, a) < fileName(h, b) ? -1 : fileName(h, a) > fileName(h, b) ? 1 : 0
// A test's names, as the runner reports them: its suites' names, then its
// own. Its own name holds its index, so the names within a file are
// distinct. Its full name joins them with ` > `.
const namesOf = (h, fi, ti) => {
  const t = h.files[fi].tests[ti]
  return [...t.suites, `${t.label}t${ti}${t.tail}`]
}
const nameOf = (h, fi, ti) => namesOf(h, fi, ti).join(` > `)
const keyOf = (h, fi, ti) => `${fileName(h, fi)} > ${nameOf(h, fi, ti)}`
// A test's name as a message prints it: one line, each control character,
// line separator, or paragraph separator as its \\uXXXX escape.
const shownName = (h, fi, ti) =>
  nameOf(h, fi, ti).replace(
    /[\u0000-\u001f\u007f\u2028\u2029]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, `0`)}`,
  )
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

// The swap a comparison or logical mutant states (its replacement): the
// history's data, which the driver gives the mutant and the gap line shows.
const swapFor = { '>': `>=`, '>=': `>`, '===': `!==`, '&&': `||` }

// ## Model
//
// The model states the law above over the records, without the CLI's
// functions: it reads each test's effect under the mutant directly.

// The work law (law 3). A test's work with no mutant active is `t.work`
// site evaluations (its second unmutated run did one more when
// `t.workFlaky`), and under the mutant in slot `slot` it is that plus what
// the effect adds, never below none.
const workUnder = (t, slot) => Math.max(0, t.work + t.under[slot].work)
// Whether a test's work judges operator mutant `mi`: it passed under the
// mutant, it reached the mutant or its file loaded code that did, its
// observations and its work agreed between the unmutated runs, its count
// could not follow the clock (it made no timer by any path, read no clock,
// and held no I/O open: a kill must replay on an idle machine, the
// maintainer's decision of 2026-11-12 under P3), and its
// route is one that `oracleProperty` registers for production, a
// reproducible or a random one, so it can carry a declared bound.
const passedKinds = new Set([`same`, `changed`, `observedChanged`, `unhandled`])
const workJudges = (h, mi, x) =>
  passedKinds.has(x.t.under[mi].kind) &&
  (x.t.reaches[mi] || h.files[x.fi].background[mi]) &&
  !x.t.flaky &&
  !x.t.workFlaky &&
  x.t.clocked === `none` &&
  [`reproducible`, `random`].includes(kindOf(x.t.route))
// A test past its declared bound: more work than `ratio` times its work
// with no mutant active, compared exactly, in hundredths.
const pastBound = (h, mi, x) =>
  workJudges(h, mi, x) &&
  x.t.bound !== undefined &&
  100 * workUnder(x.t, mi) > x.t.bound * x.t.work

// The work bound that rejects a rise from `before` to `after` site
// evaluations: the largest ratio in hundredths below the measured one, and
// 1 when the test did no work before (any ratio rejects a rise from none).
function boundBelow(before, after) {
  if (before === 0) return `1.00`
  let hundredths = 100
  while ((hundredths + 1) * before < 100 * after) hundredths += 1
  return (hundredths / 100).toFixed(2)
}

// Laws 2 to 4 over the tests that judge a mutant, read from each test's
// effect in the mutant's slot: the failure's outcome, if a failure decides,
// and the tests that ran (a file that failed to load, or whose run timed
// out, ran none). `work` says whether the work law judges the slot: it
// judges operator mutants, whose copies count work, and the runner's stop
// at a kill reads no work.
function failureOf(h, slot, tests, work = false) {
  const under = ({ t }) => t.under[slot].kind
  const timedOut = tests.some((x) => under(x) === `runTimeout`)
  const setup = tests.some((x) => under(x) === `setupError`)
  const ran = tests.filter(
    (x) =>
      !h.files[x.fi].tests.some((t) =>
        [`setupError`, `runTimeout`].includes(t.under[slot].kind),
      ),
  )
  const failing = ran.filter(
    (x) =>
      !x.t.flaky &&
      [`verdict`, `assertion`, `crash`, `timeoutMessage`].includes(under(x)),
  )
  // A test past its work bound reports a verdict under `work bound` on its
  // own route; the tests stay in report order.
  const overBound = (x) => work && pastBound(h, slot, x)
  const lawOf = (x) => (overBound(x) ? `work bound` : x.t.under[slot].law)
  const verdictsIn = (kind) =>
    ran.filter(
      (x) =>
        (failing.includes(x) &&
          under(x) === `verdict` &&
          kindOf(x.t.under[slot].firedAt ?? x.t.route) === kind) ||
        (overBound(x) && kindOf(x.t.route) === kind),
    )
  const kills = verdictsIn(`reproducible`).map(lawOf)
  const behavioral = kills.filter((law) => law !== `reach agreement`)
  const decided = (failure) => ({ failure, ran })
  // A gap that names a failing test names the first one its class counts,
  // in report order (law 7).
  const naming = (outcome, tests, extra = {}) =>
    decided({
      outcome,
      mention: [`\`${shownName(h, tests[0].fi, tests[0].ti)}\``],
      ...extra,
    })
  if (behavioral.length > 0)
    return decided({
      outcome: `killed`,
      laws: [...new Set(behavioral)].sort(),
      lawsMayBePart: true,
    })
  if (timedOut) return decided({ outcome: `timeout` })
  if (kills.length > 0)
    return naming(`agreement-only-kill`, verdictsIn(`reproducible`), {
      laws: [`reach agreement`],
    })
  if (verdictsIn(`random`).length > 0)
    return naming(`random-only-kill`, verdictsIn(`random`))
  if (verdictsIn(`unknown`).length > 0)
    return naming(`unregistered-kill`, verdictsIn(`unknown`))
  if (failing.length > 0 && failing.every((x) => under(x) === `timeoutMessage`))
    return decided({ outcome: `timeout` })
  const crashed = failing.filter(
    (x) => under(x) !== `timeoutMessage` && kindOf(x.t.route) !== `framework`,
  )
  if (crashed.length > 0) return naming(`crashed`, crashed)
  if (failing.length > 0) return naming(`framework-error`, failing)
  const unhandled = ran.some((x) => under(x) === `unhandled`)
  if (setup || unhandled) return decided({ outcome: `setup-error` })
  return decided(undefined)
}

// An owner file that fails with no mutant active judges nothing, so a
// mutant it owns that no other owner kills is `blocked`: it waits for the
// file to pass, and its message names the failing owner files in report
// order (maintainer disposition G5, 2026-11-11, and the v20 freeze's
// decision 2: a RED baseline gives a provisional report that lists the
// blocked mutants and judges the rest). A kill by another owner stands.
const failingOwners = (h, owners) =>
  [...owners].filter((fi) => h.files[fi].baseline !== `pass`).sort(byPath(h))
const modelBlocked = (h, judged, blocking) =>
  blocking.length === 0 || judged.outcome === `killed`
    ? judged
    : {
        outcome: `blocked`,
        mention: blocking.map((fi) => `\`${fileName(h, fi)}\``),
        ownerFiles: judged.ownerFiles,
      }

function modelOutcome(h, mi) {
  const m = h.mutants[mi]
  const owners = new Set(
    m.owners.filter((fi) => fi < h.files.length && h.files[fi].oracle),
  )
  if (owners.size === 0) return { outcome: `unowned` }
  const blocking = failingOwners(h, owners)
  const passing = new Set([...owners].filter((fi) => !blocking.includes(fi)))
  return modelBlocked(h, judgedOutcome(h, mi, passing), blocking)
}

// A mutant's outcome by the owner files that passed with no mutant active.
function judgedOutcome(h, mi, owners) {
  const m = h.mutants[mi]
  const reachingIn = (fi) =>
    h.files[fi].background[mi] || h.files[fi].tests.some((t) => t.reaches[mi])
  const ordinary = h.files
    .map((f, fi) => fi)
    .filter((fi) => !h.files[fi].oracle && reachingIn(fi))
  const withOrdinary = (result) =>
    ordinary.length > 0
      ? { ...result, testOutcome: ordinaryOutcome(h, mi, ordinary) }
      : result
  // In report order (law 7): the files by path, and each file's tests in
  // their order. The gap's `Owners` line names these files in this order.
  const targets = [...owners].sort(byPath(h)).filter(reachingIn)
  if (targets.length === 0)
    return withOrdinary({
      outcome: `unreached`,
      mention: [`line ${m.line + 1}`],
    })
  const ownerFiles = targets.map((fi) => fileName(h, fi))
  const tests = targets.flatMap((fi) =>
    h.files[fi].tests.map((t, ti) => ({ t, fi, ti })),
  )
  const { failure, ran } = failureOf(h, mi, tests, true)
  // The runner runs the owner files in report order and stops after the
  // first whose law verdicts kill (its stop reads no work), so a kill names
  // the laws of the files it ran: law verdicts of that file only, and `work
  // bound` when a test of those files exceeded its bound (law 7).
  if (failure?.outcome === `killed`) {
    const stop = targets.findIndex(
      (fi) =>
        failureOf(
          h,
          mi,
          tests.filter((x) => x.fi === fi),
        ).failure?.outcome === `killed`,
    )
    const ranFiles = stop < 0 ? targets : targets.slice(0, stop + 1)
    const inRun = failureOf(
      h,
      mi,
      tests.filter((x) => ranFiles.includes(x.fi)),
      true,
    ).failure
    return { ...failure, laws: inRun.laws, ownerFiles }
  }
  if (failure) return { ...failure, ownerFiles }
  // A survivor. Only reaching, deterministic owner tests judge it; code that
  // ran when a file loaded the module reaches every test of that file.
  const compared = ran.filter(
    (x) => (x.t.reaches[mi] || h.files[x.fi].background[mi]) && !x.t.flaky,
  )
  const changed = compared.find((x) =>
    [`changed`, `observedChanged`].includes(x.t.under[mi].kind),
  )
  const sized = (cls, extra = {}) =>
    withOrdinary({
      outcome: `survived`,
      class: cls,
      mention: [],
      boundary: m.evidence === `boundary: -0`,
      ownerFiles,
      ...extra,
    })
  if (changed)
    return sized(`not-judged`, {
      mention: [
        `Make a law in \`${shownName(h, changed.fi, changed.ti)}\` reject the changed value.`,
      ],
    })
  if (compared.length === 0) {
    // The message names every nondeterministic owner test that reached the
    // mutant, in report order, or, when none did, the line.
    const flaky = reachingTests(h, mi, owners, true).filter(({ t }) => t.flaky)
    return sized(`indeterminate`, {
      mention: [
        flaky.length > 0
          ? `\`${flaky.map(({ fi, ti }) => shownName(h, fi, ti)).join(`, `)}\` deterministic`
          : `runs line ${m.line + 1} `,
      ],
    })
  }
  // A test whose work judges the mutant did more work, and nothing it
  // observed changed: the mutant deleted a shortcut (law 5). The message
  // names the first such test in report order.
  const rose = compared.find(
    (x) => workJudges(h, mi, x) && workUnder(x.t, mi) > x.t.work,
  )
  if (rose)
    return sized(`extra-work`, {
      mention: [
        `\`work: { ratio: ${boundBelow(rose.t.work, workUnder(rose.t, mi))} }\``,
        `\`${shownName(h, rose.fi, rose.ti)}\``,
        `rose from ${rose.t.work} to ${workUnder(rose.t, mi)} site evaluation${workUnder(rose.t, mi) === 1 ? `` : `s`}${rose.t.work > 0 ? ` (${(workUnder(rose.t, mi) / rose.t.work).toFixed(3)}× the unmodified run's)` : ``}.`,
      ],
    })
  if (m.evidence === `dead code`)
    return sized(`dead-code`, { mention: [`line ${m.line + 1}.`] })
  // The type analysis found no input of the declared types that
  // distinguishes it, and names the input class outside them that does.
  if (m.outside)
    return sized(`outside-annotation`, {
      mention: [`line ${m.line + 1} with ${m.outside},`],
    })
  // An `if` mutant forces its condition: an if-true mutant changes a value
  // only where the condition was false, an if-false mutant only where it was
  // true. Its branch is never taken when no deterministic owner test (or the
  // owner file's loaded code) saw that outcome, whatever the sibling did.
  if (isIf(m)) {
    const need = m.operator === `if-true` ? `false` : `true`
    if (!infectedIn(h, mi, owners))
      return sized(`branch-never-taken`, {
        mention: [`the condition on line ${m.line + 1} is ${need},`],
      })
    return sized(`not-observed`, { mention: [observedMention(h, mi, owners)] })
  }
  if (isCompare(m)) {
    if (!infectedIn(h, mi, owners))
      return sized(`not-infected`, { operands: operandsSeen(h, mi, owners) })
    return sized(`not-observed`, { mention: [observedMention(h, mi, owners)] })
  }
  // The other operators' infection is not measured, so the directive says
  // what input distinguishes the mutant, built from its operator.
  return sized(`not-distinguished`, {
    mention: [distinguishingDirective(m)],
  })
}

// An authored mutant's outcome: laws 1 to 4 over every test of its owner
// files (its copy records no reach), and a survivor is not-judged when a
// deterministic owner test's observation changed, not-observed otherwise.
function modelAuthored(h, ai) {
  const a = h.authored[ai]
  if (!a.applies) return { outcome: `does-not-apply` }
  const owners = [
    ...new Set(
      a.owners.filter((fi) => fi < h.files.length && h.files[fi].oracle),
    ),
  ].sort(byPath(h))
  if (owners.length === 0) return { outcome: `unowned` }
  const blocking = failingOwners(h, owners)
  return modelBlocked(
    h,
    judgedAuthored(
      h,
      ai,
      owners.filter((fi) => !blocking.includes(fi)),
    ),
    blocking,
  )
}

// An authored mutant's outcome by its owner files that passed.
function judgedAuthored(h, ai, owners) {
  const slot = MUTANTS + ai
  // In report order (law 7), whatever order the owners were declared in.
  const tests = owners.flatMap((fi) =>
    h.files[fi].tests.map((t, ti) => ({ t, fi, ti })),
  )
  const { failure, ran } = failureOf(h, slot, tests)
  if (failure) return failure
  const changed = ran.find(
    (x) =>
      !x.t.flaky &&
      [`changed`, `observedChanged`].includes(x.t.under[slot].kind),
  )
  return changed
    ? {
        outcome: `survived`,
        class: `not-judged`,
        mention: [
          `Make a law in \`${shownName(h, changed.fi, changed.ti)}\` reject the changed value.`,
        ],
      }
    : {
        outcome: `survived`,
        class: `not-observed`,
        mention: [observedText(undefined)],
      }
}

// The directive for an operator whose infection is not measured: the input
// that makes the mutant's value differ, built from the operator's semantics.
function distinguishingDirective(m) {
  const line = m.line + 1
  if (m.operator === `loop-false`)
    return `Add an owner history that enters the loop on line ${line}, so that forcing its condition to false changes an asserted result, and assert on the result.`
  if (m.operator === `value-undefined`)
    return `Add an owner history where the call on line ${line} returns a value that changes an asserted result when it is \`undefined\`, and assert on the result.`
  if (m.operator === `field-drop`)
    return `Add an owner history that reads the property dropped on line ${line}, so that its absence changes an asserted result, and assert on the result.`
  if (m.operator === `delete-call`)
    return `Add an owner history where the call on line ${line} changes an asserted result when it does not run, and assert on the result.`
  if (m.operator === `return-undefined`)
    return `Add an owner history that uses the value returned on line ${line}, so that \`undefined\` in its place changes an asserted result, and assert on the result.`
  if (m.operator === `optional-chain`)
    return `Add an owner history where the object read with \`?.\` on line ${line} is \`undefined\`, so that a plain read throws, and assert on the result.`
  if (m.original === `??`)
    return `Add an owner history where the left operand of \`??\` on line ${line} is truthy, so \`??\` and \`&&\` give different results, and assert on the result.`
  return `Add an owner history where one operand of \`${m.original}\` on line ${line} is falsy and the other is truthy, so \`&&\` and \`||\` give different results, and assert on the result.`
}
// The observation a survivor with an infection names: its infecting test, or
// the owner tests when only loaded code infected it (or the mutant is
// authored). The second step covers a forced branch that computed the same
// result as the original (F22).
const observedText = (test) =>
  `Observe the value this code changes in ${test === undefined ? `the owner tests` : `\`${test}\``}, and assert on it. Where the mutated code computes the same result as the original, add a history where it computes something different.`
const observedMention = (h, mi, owners) =>
  observedText(infectingTest(h, mi, owners))

// Comparisons and their swaps, as the mutant states them. A comparison is
// infected when its operators disagree on the operands a test reached, or
// when an operand is not a primitive (comparing it might run its code, so
// the capture counts it as a change: capture-setup.mjs).
const comparisons = new Set([`>`, `>=`, `===`])
const swapOf = { '>': `>=`, '>=': `>`, '===': `!==` }
const holds = {
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
  '===': (a, b) => a === b,
  '!==': (a, b) => a !== b,
}
const isPrimitive = (value) =>
  value === null || (typeof value !== `object` && typeof value !== `function`)
// The model's values (law 7): a primitive by SameValue, a non-primitive as
// its type alone.
const sameValue = (a, b) =>
  isPrimitive(a) && isPrimitive(b)
    ? Object.is(a, b)
    : !isPrimitive(a) && !isPrimitive(b) && typeof a === typeof b
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
    if (!isPrimitive(a) || !isPrimitive(b)) return true
    return holds[m.original](a, b) !== holds[swapOf[m.original]](a, b)
  }
  return true
}
// The deterministic owner tests, in report order, that reached the mutant
// (and the nondeterministic ones too, when asked).
function reachingTests(h, mi, owners, withFlaky = false) {
  return [...owners]
    .sort(byPath(h))
    .flatMap((fi) =>
      h.files[fi].tests.flatMap((t, ti) =>
        t.reaches[mi] && (withFlaky || !t.flaky) ? [{ t, fi, ti }] : [],
      ),
    )
}
// Whether a deterministic owner test, or the loaded code of an owner file,
// infected the mutant. A nondeterministic test's infection judges nothing.
function infectedIn(h, mi, owners) {
  return [...owners].some(
    (fi) =>
      (h.files[fi].background[mi] && h.files[fi].backgroundInfects[mi]) ||
      reachingTests(h, mi, new Set([fi])).some(({ t }) => infects(h, mi, t)),
  )
}
// The first deterministic test that infected the mutant, if any test did.
function infectingTest(h, mi, owners) {
  const hit = reachingTests(h, mi, owners).find(({ t }) => infects(h, mi, t))
  return hit ? shownName(h, hit.fi, hit.ti) : undefined
}
// The operand pairs the owners' tests reached, distinct as values, in order,
// up to three.
function operandsSeen(h, mi, owners) {
  const pairs = []
  for (const { t } of reachingTests(h, mi, owners)) {
    const [a, b] = t.pair[mi]
    if (!pairs.some(([x, y]) => sameValue(x, a) && sameValue(y, b)))
      pairs.push([a, b])
  }
  return pairs.slice(0, 3)
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

// A text as a gap line shows it (law 8): whitespace collapsed, and past 60
// characters its first 57 and `...`.
// It counts characters by code point, so an astral-plane character is one
// character and is never split.
const shortened = (text) => {
  const flat = [...String(text).replace(/\s+/g, ` `)]
  return flat.length > 60 ? `${flat.slice(0, 57).join(``)}...` : flat.join(``)
}
// An operand's text as the model renders it (law 7): a string quoted as
// JSON, past 40 characters (code points) its first 37 and `...`, then `#`
// and the first eight hex digits of the SHA-1 of the whole; a bigint with
// `n`; negative zero as `-0`; any other primitive as JavaScript prints it;
// and a value that is not a primitive as its type in parentheses.
function operandOf(value) {
  if (!isPrimitive(value)) return `(${typeof value})`
  if (typeof value === `string`) {
    const chars = [...value]
    return chars.length > 40
      ? `${JSON.stringify(`${chars.slice(0, 37).join(``)}...`)}#${createHash(`sha1`).update(value).digest(`hex`).slice(0, 8)}`
      : JSON.stringify(value)
  }
  if (typeof value === `bigint`) return `${value}n`
  return Object.is(value, -0) ? `-0` : String(value)
}

// Law 9: the tests of a file that `vitest run <file> -t <pattern>` runs.
// Vitest reads the pattern as a regular expression and matches it against
// each test's names joined by a space (Vitest 4) or by ` > ` (Vitest 5).
const selectedBy = (h, fi, pattern, join) =>
  h.files[fi].tests.flatMap((t, ti) =>
    new RegExp(pattern).test(namesOf(h, fi, ti).join(join)) ? [ti] : [],
  )
// The tests of a file whose names, joined, are test ti's.
const sameNamed = (h, fi, ti, join) =>
  h.files[fi].tests.flatMap((_, tj) =>
    namesOf(h, fi, tj).join(join) === namesOf(h, fi, ti).join(join) ? [tj] : [],
  )
// Each oracle file's baseline: whether it fails, and the test its replay
// must run alone (undefined: the whole file, as for a file that did not
// load). A file whose baseline is `test` fails at its first failing test,
// and at its first test when the grammar marked none.
// Each test file's baseline, oracle and ordinary files alike: how many
// tests it has and how many failed, its first failing test (none for a file
// that did not load), and whether that test failed by a law violation.
const baselineOf_ = (h) =>
  h.files.map((f, fi) => {
    const own = { fi, ordinary: !f.oracle, tests: f.tests.length }
    if (f.baseline === `pass`) return { ...own, fails: false }
    if (f.baseline === `load`) return { ...own, fails: true, test: undefined }
    const marked = f.tests.filter((t) => t.fails).length
    const first = f.tests.findIndex((t) => t.fails)
    return {
      ...own,
      fails: true,
      failed: marked > 0 ? marked : 1,
      test: first < 0 ? 0 : first,
      violation: f.failure === `violation`,
    }
  })

// The violation a failing test reports, as the framework words one
// (oracle-property.ts \`failure\`): the property's checkpoint and law on its
// first line, then the law's statement, the difference, the history that
// failed (its counterexample), the authority, the limits, and the rerun.
const VIOLATION = {
  law: `L`,
  checkpoint: `trace`,
  difference: `the output is ["b"], owed ["a"] or none`,
  history: `{"input":7,"name":"one \`tick\` or two"}`,
}
const violationText = () =>
  [
    `OracleViolation: fixture violated at checkpoint "${VIOLATION.checkpoint}" (law: ${VIOLATION.law}).`,
    `Law: the outputs agree.`,
    `Difference: ${VIOLATION.difference}`,
    `History: ${VIOLATION.history}`,
    `Authority: the contract.`,
    `Known limits: none.`,
    `Rerun: -t '^t0$'`,
  ].join(`\n`)
const failureText = (f) =>
  f.failure === `violation` ? violationText() : `Error: violation`

function model(h) {
  const operatorOutcomes = h.mutants.map((m, mi) => modelOutcome(h, mi))
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
  // Each mutant's key, line, id, and function, for the messages and the
  // stdout summary (the driver names mutant mi `m${mi}` in `f${line}`, and
  // authored mutant ai `authored:a${ai}`), and the text its gap line shows.
  operatorOutcomes.forEach((o, mi) => {
    const m = h.mutants[mi]
    o.key = keyOf(m, mi)
    o.line = String(m.line + 1)
    o.id = `m${mi}`
    o.function = `f${m.line}`
    o.probe = m.probe
    o.code =
      m.operator === `binary-swap`
        ? [m.original, swapFor[m.original]]
        : [...m.code]
  })
  const authoredOutcomes = h.authored.map((a, ai) => ({
    ...modelAuthored(h, ai),
    key: `src/x.ts#authored:a${ai}`,
    // A `find` that does not apply has no line: the gap line prints `?`, and
    // the full report the absent value.
    line: a.applies ? String(a.line + 1) : `?`,
    entryLine: a.applies ? String(a.line + 1) : `undefined`,
    id: `authored:a${ai}`,
    probe: false,
    authored: { intent: a.intent, author: a.author },
  }))
  const outcomes = [...operatorOutcomes, ...authoredOutcomes]
  const gapsOf = outcomes.filter(
    (o) => !o.probe && ![`killed`, `unowned`].includes(kindOfResult(o)),
  )
  return {
    outcomes,
    summary: {
      counts: {
        mutants: outcomes.length,
        authored: authoredOutcomes.length,
        killed: outcomes.filter((o) => !o.probe && o.outcome === `killed`)
          .length,
        gaps: gapsOf.length,
        probe: outcomes.filter((o) => o.probe).length,
      },
      gaps: gapsOf.map((o) => o.key).sort(),
      unowned: outcomes
        .filter((o) => !o.probe && o.outcome === `unowned`)
        .map((o) => o.key)
        .sort(),
      entries: gapsOf
        .map((o) => ({
          key: o.key,
          kind: kindOfResult(o),
          line: o.entryLine ?? o.line,
        }))
        .sort((a, b) => (a.key < b.key ? -1 : 1)),
    },
    baseline: baselineOf_(h),
    // The unmutated pass's lists (law 7), in report order: the files that
    // failed with no mutant active (the run refuses over the oracle files
    // among them and leaves the rest out), and the nondeterministic tests.
    pass: {
      failed: h.files
        .map((f, fi) => fi)
        .filter((fi) => h.files[fi].baseline !== `pass`)
        .sort(byPath(h))
        .map((fi) => fileName(h, fi)),
      nondeterministic: h.files
        .map((f, fi) => fi)
        .sort(byPath(h))
        .flatMap((fi) =>
          h.files[fi].tests.flatMap((t, ti) =>
            t.flaky ? [`${fileName(h, fi)} > ${nameOf(h, fi, ti)}`] : [],
          ),
        ),
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
const killsDirective = `Each count credits only the first law that rejected a history: a later law on the same history is not checked. To test a law with no count, add a history that varies the input the law judges, and run the check again.`
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
    /^Observe the value this code changes in (`[^`]+`|the owner tests), and assert on it\. Where the mutated code computes the same result as the original, add a history where it computes something different\.$/,
  'not-judged': /^Make a law in `[^`]+` reject the changed value\.$/,
  'extra-work':
    /^Declare `work: \{ ratio: \d+\.\d\d \}` on the `oracleProperty` that registers `[^`]+`, so that its work bound rejects this mutant: there it changed no observation, and its work rose from \d+ to \d+ site evaluations?( \(\d+\.\d{3}× the unmodified run's\))?\.$/,
  indeterminate:
    /^(Make `[^`]+` deterministic: control its clock and its random seed, so its failures judge this code|Add an owner test that runs line \d+ and asserts on its result)\.$/,
  'dead-code': /^Remove the redundant code on line \d+\.$/,
  'outside-annotation':
    /^Add an owner history that reaches line \d+ with .+, which the annotation excludes, so that it changes an asserted result, and assert on the result\.$/,
  'random-only-kill':
    /^Keep the counterexample that `[^`]+` found in the random campaign as a fixed history\.$/,
  'agreement-only-kill':
    /^Assert on the value this path produces in `[^`]+`\.$/,
  'unregistered-kill':
    /^Register the route of `[^`]+` through the framework, so its failure counts as a kill\.$/,
  'framework-error':
    /^The framework check `[^`]+` failed with `[^`]*`, and a calibration judges no behavior: state the oracle law that decides this input's outcome, and let it reject the change\.$/,
  crashed:
    /^Production threw `[^`]*` in `[^`]+`; record the error as an observation in the driver, and state the law that decides this input's outcome\.$/,
  'not-distinguished':
    /^Add an owner history (where one operand of `[&|]{2}` on line \d+ is falsy and the other is truthy, so `&&` and `\|\|` give different results|where the left operand of `\?\?` on line \d+ is truthy, so `\?\?` and `&&` give different results|that enters the loop on line \d+, so that forcing its condition to false changes an asserted result|where the call on line \d+ returns a value that changes an asserted result when it is `undefined`|that reads the property dropped on line \d+, so that its absence changes an asserted result|where the call on line \d+ changes an asserted result when it does not run|that uses the value returned on line \d+, so that `undefined` in its place changes an asserted result|where the object read with `\?\.` on line \d+ is `undefined`, so that a plain read throws), and assert on the result\.$/,
  timeout:
    /^Bound the run of the owner tests so that they end, and let a law reject a run that does not\.$/,
  'setup-error':
    /^Run an owner test that loads this module and asserts on its exports, so a failed load rejects the mutant\.$/,
  'does-not-apply':
    /^Update the `find` text of this authored mutant so that it occurs exactly once in the source\.$/,
  blocked:
    /^Make `[^`]+`(, `[^`]+`)* pass with no mutant active, then check again: this mutant waits for (it|them)\.$/,
}
// What a legend line says a class is, before its directive, where the
// class's name alone misleads (maintainer disposition G3, 2026-11-11): a
// crash is a gap, not a kill (the v20 freeze, P3 and C1), and its error is
// in the gap's Detail line. The extra-work line says first that a builtin
// counts as one site, so a shortcut whose cost is in one is owed an
// observation of that cost, not a very tight bound (maintainer, 2026-11-12).
const meanings = {
  crashed:
    /^Production threw where no law judged it: a gap, not a kill\. Its error is on the gap's Detail line in summary\.md, and in its `detail` in results\.json\. /,
  'extra-work':
    /^A call to a builtin counts as one site evaluation, whatever it costs \(`Object\.defineProperty`\): where a shortcut's cost is in one, make that cost an observation of the driver, such as a count of those calls, and let a law judge it, in place of a very tight bound\. /,
}
// A count of things, as the report words it.
const counted = (n, thing) => `${n} ${thing}${n === 1 ? `` : `s`}`
// A text without its code spans, read as Markdown reads them (a run of
// backticks opens a span, and the next run of exactly that length closes
// it), so that the run data a span holds is not read as an exit.
function withoutSpans(text) {
  let out = ``
  let rest = text
  for (;;) {
    const at = rest.indexOf(`\``)
    if (at < 0) return out + rest
    out += rest.slice(0, at)
    const span = readSpan(rest.slice(at))
    // A run of backticks that nothing closes is text.
    if (!span) return out + rest.slice(at)
    rest = rest.slice(at + span.length)
  }
}
// The code span that opens a text: its content, with one space of padding
// on each side dropped, and its length; undefined when none opens it.
function readSpan(text) {
  const fence = text.match(/^`+/)?.[0]
  if (!fence) return undefined
  const rest = text.slice(fence.length)
  const close = [...rest.matchAll(/`+/g)].find(
    (run) => run[0].length === fence.length,
  )
  if (!close) return undefined
  const content = rest.slice(0, close.index)
  return {
    content:
      content.startsWith(` `) && content.endsWith(` `) && content.trim()
        ? content.slice(1, -1)
        : content,
    length: fence.length * 2 + close.index,
  }
}
// The operand pairs a not-infected message names, as printed texts:
// `Operands seen: ` then `none recorded`, or code-span pairs joined by
// ` and `, the pairs by `; `. Undefined when the text is not of that form.
function printedOperands(message) {
  const at = message.indexOf(`Operands seen: `)
  if (at < 0) return undefined
  let rest = message
    .slice(at + `Operands seen: `.length)
    .replace(` ${boundaryLine}`, ``)
  if (rest === `none recorded.`) return []
  const pairs = []
  for (;;) {
    const a = readSpan(rest)
    if (!a || !rest.slice(a.length).startsWith(` and `)) return undefined
    rest = rest.slice(a.length + ` and `.length)
    const b = readSpan(rest)
    if (!b) return undefined
    pairs.push([a.content, b.content])
    rest = rest.slice(b.length)
    if (rest === `.`) return pairs
    if (!rest.startsWith(`; `)) return undefined
    rest = rest.slice(2)
  }
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

// Each gap's `Owners` line, by its key: the files it lists, in order.
function ownersLinesOf(summary) {
  const lines = summary.split(`\n`)
  const owners = {}
  lines.forEach((line, i) => {
    const key = line.startsWith(`  - Key: `)
      ? line.slice(`  - Key: `.length).match(/^(`+) (.*) \1; rerun/)?.[2]
      : undefined
    if (key === undefined) return
    for (let j = i + 1; lines[j]?.startsWith(`  - `); j += 1)
      if (lines[j].startsWith(`  - Owners: `))
        owners[key] = lines[j].slice(`  - Owners: `.length).split(`, `)
  })
  return owners
}

// ## Production driver
//
// A runner with no blocking step (`blockedOr`) judges a mutant by its
// passing owners alone, as if no owner had failed.
const blockedOr = core.blockedOr ?? ((judged) => judged)
//
// The driver turns the records into the capture rows and units the CLI's
// runner produces, joins the unmutated passes' units as the runner does
// (`passOf`), calls the CLI's classification for each mutant as the runner
// does (asking for units only of the files it targets, in the order it
// gives them, and stopping at the first that kills), assigns keys, and
// renders the summary.
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
const primitive = (value) =>
  value === null || (typeof value !== `object` && typeof value !== `function`)
// An operand as the capture records it (capture-setup.mjs `shown`): a
// primitive as its kind and its text (`-0` for negative zero), a string past
// 40 characters as its first 37 and a digest of the whole, and any other
// value as its type alone.
function shownByCapture(value) {
  if (!primitive(value)) return [typeof value]
  const chars = typeof value === `string` ? [...value] : undefined
  if (chars !== undefined && chars.length > 40)
    return [
      `string`,
      chars.slice(0, 37).join(``),
      createHash(`sha1`).update(value).digest(`hex`).slice(0, 8),
    ]
  return [
    value === null ? `null` : typeof value,
    Object.is(value, -0) ? `-0` : String(value),
  ]
}
// What the capture records for a reached test: the mutants whose value it
// changed (`infected`), and the operands of each reached comparison. An
// operand that is not a primitive counts as a change.
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
      operands.push([mi, [shownByCapture(a), shownByCapture(b)]])
      const swapped = capturedSwap[m.original]
      if (
        !primitive(a) ||
        !primitive(b) ||
        captured[m.original](a, b) !== captured[swapped](a, b)
      )
        infected.push(mi)
    } else infected.push(mi)
  })
  return { infected, operands }
}
// The files in the order of the baseline's records (`baselineOrder`).
const baselineFileOrder = (h) =>
  h.files
    .map((_, fi) => fi)
    .sort((a, b) => h.baselineOrder[a] - h.baselineOrder[b] || a - b)
// A file's tests in the order a mutant run records them (`runOrder`).
const runTestOrder = (tests) =>
  tests
    .map((t, ti) => ti)
    .sort((a, b) => tests[a].runOrder - tests[b].runOrder || a - b)
// Which tests of a file fail with no mutant active: those marked, or its
// first test when none is marked, when its baseline is `test`.
const failsAlone = (f, t, ti) =>
  f.baseline === `test` && (f.tests.some((x) => x.fails) ? t.fails : ti === 0)
// An unmutated pass's units, one per file, in the order of `baselineOrder`,
// as the runner joins its contexts' units: each file's tests with their
// states, a load failure as a setup error, and its records. A failing file
// keeps its records, which the runner would refuse over or leave out; the
// classification here reads them as if the file passed.
function baselineUnitsOf(h, pass) {
  return baselineFileOrder(h).map((fi) => {
    const f = h.files[fi]
    const loads = f.baseline !== `load`
    const rows = new Map()
    f.tests.forEach((t, ti) => {
      rows.set(keyOf(h, fi, ti), {
        key: keyOf(h, fi, ti),
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
        // The capture's work count and the property's declared bound
        // (capture-setup.mjs `calls` and `work`), and the test's time.
        calls: t.work + (t.workFlaky && pass === 2 ? 1 : 0),
        // The ratio the property declares, as an author writes it.
        work: t.bound === undefined ? undefined : t.bound / 100,
        // A timer the test made, or I/O it held open (capture-setup.mjs).
        ...(t.clocked === `none` ? {} : { clocked: true }),
        ...(t.clocked === `io` ? { io: true } : {}),
        ms: t.ms + pass,
      })
    })
    rows.set(`${fileName(h, fi)} > (background)`, {
      key: `${fileName(h, fi)} > (background)`,
      background: true,
      hits: f.background.flatMap((r, mi) =>
        r && mi < h.mutants.length ? [mi] : [],
      ),
      infected: f.background.flatMap((r, mi) =>
        r && f.backgroundInfects[mi] && mi < h.mutants.length ? [mi] : [],
      ),
    })
    return {
      file: fileName(h, fi),
      timedOut: false,
      seconds: 1,
      setupErrors: loads ? [] : [`Error: cannot load the file`],
      unhandled: [],
      tests: loads
        ? f.tests.map((t, ti) => ({
            key: keyOf(h, fi, ti),
            fullName: nameOf(h, fi, ti),
            state: failsAlone(f, t, ti) ? `failed` : `passed`,
            message: failsAlone(f, t, ti) ? failureText(f) : ``,
          }))
        : [],
      rows: [...rows],
    }
  })
}
// A file's units under the mutant in effect slot `slot`. Its tests are in
// the order the file declares them, as the reporter lists them, and its
// records in the order of the tests' `runOrder`.
function unitOf(h, fi, slot) {
  const f = h.files[fi]
  const under = (t) => t.under[slot]
  if (f.tests.some((t) => under(t).kind === `runTimeout`))
    return { file: fileName(h, fi), timedOut: true, seconds: 1 }
  const loadFailed = f.tests.some((t) => under(t).kind === `setupError`)
  const tests = loadFailed ? [] : f.tests
  return {
    file: fileName(h, fi),
    timedOut: false,
    seconds: 1,
    setupErrors: loadFailed ? [`Error: cannot load the file`] : [],
    unhandled: tests.some((t) => under(t).kind === `unhandled`)
      ? [`unhandled rejection`]
      : [],
    tests: tests.map((t, ti) => {
      const kind = under(t).kind
      return {
        key: keyOf(h, fi, ti),
        fullName: nameOf(h, fi, ti),
        state: messages[kind] ? `failed` : `passed`,
        message: messages[kind] ?? ``,
      }
    }),
    rows: runTestOrder(tests).map((ti) => {
      const t = tests[ti]
      const kind = under(t).kind
      return [
        keyOf(h, fi, ti),
        {
          key: keyOf(h, fi, ti),
          hash: kind === `changed` ? `h-changed` : `h`,
          observed: kind === `observedChanged` ? `o-changed` : `o`,
          hits: [],
          outcomes: [],
          route: t.route,
          // An authored mutant's copy is not instrumented, so it counts no
          // work.
          calls: slot < MUTANTS ? workUnder(t, slot) : 0,
          work: t.bound === undefined ? undefined : t.bound / 100,
          ...(t.clocked === `none` ? {} : { clocked: true }),
          ...(t.clocked === `io` ? { io: true } : {}),
          ms: under(t).ms,
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
// A test as Vitest's reporter gives it to the runner (TestCase): its name,
// and its parent suites up to its module.
function testCaseOf(h, fi, ti) {
  const names = namesOf(h, fi, ti)
  let parent = { type: `module`, moduleId: fileName(h, fi) }
  for (const name of names.slice(0, -1))
    parent = { type: `suite`, name, parent }
  return { type: `test`, name: names.at(-1), parent }
}
// Each test file's baseline, as the runner's first pass gives it to the
// printer: its relative path, whether it is an ordinary file, its first
// failure, and its tests, each with its state, its error, and the names the
// runner read from its TestCase.
function baselineFiles(h, printer) {
  return h.files.flatMap((f, fi) => {
    const file = relativeName(h, fi)
    const ordinary = !f.oracle
    if (f.baseline === `load`)
      return [
        { file, ordinary, failure: `Error: cannot load the file`, tests: [] },
      ]
    // A file whose baseline is `test` fails its marked tests, or its first
    // test when none is marked.
    const marked = f.tests.some((t) => t.fails)
    const fails = (t, ti) =>
      f.baseline === `test` && (marked ? t.fails : ti === 0)
    const tests = f.tests.map((t, ti) => ({
      fullName: nameOf(h, fi, ti),
      state: fails(t, ti) ? `failed` : `passed`,
      message: fails(t, ti) ? failureText(f) : ``,
      names: printer?.testNamesOf?.(testCaseOf(h, fi, ti)),
    }))
    const first = tests.find((x) => x.state === `failed`)
    return [
      {
        file,
        ordinary,
        failure: first
          ? `${first.fullName}: ${first.message.split(`\n`)[0]}`
          : undefined,
        tests,
      },
    ]
  })
}

// Law 7's reach: a list of tests that an order other than file order would
// start with another test. Each order ranks a test's place: file order (the
// file's path, by code unit, then the test's index), the order
// the owners were declared in, the baseline's records (`baselineOrder`), and,
// for the changed tests, a mutant run's records (`runOrder`). A state is
// entered when that order's first test is not file order's (for operands,
// when its first test's operand pair is another value). A mutant run's
// records can reorder only its changed tests: the reporter lists the
// failing ones.
const before = (a, b) => {
  const i = a.findIndex((x, k) => x !== b[k])
  return i >= 0 && a[i] < b[i]
}
function orderStates(h, states, what, places, declared, same = Object.is) {
  if (places.length < 2) return
  const first = (rank) =>
    places.reduce((best, p) => (before(rank(p), rank(best)) ? p : best))
  const inPaths = pathOrder(h)
  const inFileOrder = first((p) => [inPaths.indexOf(p.fi), p.ti])
  const differs = (rank) => !same(first(rank), inFileOrder)
  const inBaseline = baselineFileOrder(h)
  if (declared && differs((p) => [declared.indexOf(p.fi), p.ti]))
    states.add(`owners declared against file order name another first ${what}`)
  if (differs((p) => [inBaseline.indexOf(p.fi), p.ti]))
    states.add(`baseline records against file order name another first ${what}`)
  if (
    what === `changed test` &&
    differs((p) => [
      inPaths.indexOf(p.fi),
      h.files[p.fi].tests[p.ti].runOrder,
      p.ti,
    ])
  )
    states.add(
      `a mutant run's records against the baseline's name another first ${what}`,
    )
}
// The files in report order, and the index of the file at a path.
const pathOrder = (h) => h.files.map((_, fi) => fi).sort(byPath(h))
const fileIndexOf = (h, file) =>
  h.files.findIndex((_, fi) => fileName(h, fi) === file)
// Law 7's reach over lists of files: whether a list in report order would
// read otherwise in another order, given as a comparator of file indices.
const reordered = (h, files, compare) =>
  files.length > 1 &&
  [...files].sort(compare).some((fi, i) => fi !== [...files].sort(byPath(h))[i])
const byLocale = (h) => (a, b) => fileName(h, a).localeCompare(fileName(h, b))
const byBaselineRecords = (h) => {
  const order = baselineFileOrder(h)
  return (a, b) => order.indexOf(a) - order.indexOf(b)
}
// The outcomes whose message names a failing test.
const namesAFailingTest = new Set([
  `agreement-only-kill`,
  `random-only-kill`,
  `unregistered-kill`,
  `crashed`,
  `framework-error`,
])
// The places of the tests whose keys a result's changed tests name.
const placesOfKeys = (h, result) =>
  h.files.flatMap((f, fi) =>
    f.tests.flatMap((t, ti) =>
      result.changedTests?.includes(keyOf(h, fi, ti)) ? [{ fi, ti, t }] : [],
    ),
  )
// The places of the tests a result's `by` names, among the target files.
// A name that two places share is not counted.
function placesOfNames(h, names = [], files) {
  const places = []
  for (const name of new Set(names)) {
    const found = files.flatMap((fi) =>
      h.files[fi].tests.flatMap((t, ti) =>
        nameOf(h, fi, ti) === name ? [{ fi, ti, t }] : [],
      ),
    )
    if (found.length === 1) places.push(found[0])
  }
  return places
}
// The places of the owner tests that reached mutant mi, and of those that
// the capture records as infected by it.
const reachingPlaces = (h, mi, owners) =>
  [...owners].flatMap((file) => {
    const fi = fileIndexOf(h, file)
    return h.files[fi].tests.flatMap((t, ti) =>
      t.reaches[mi] ? [{ fi, ti, t }] : [],
    )
  })
const infectingPlaces = (h, mi, owners) =>
  reachingPlaces(h, mi, owners).filter(
    (p) => !p.t.flaky && capturedRows(h, p.t).infected.includes(mi),
  )

async function driver(h, observe) {
  const oracleFiles = new Set(
    h.files.flatMap((f, fi) => (f.oracle ? [fileName(h, fi)] : [])),
  )
  // The two unmutated passes, each given as one context's units in the
  // order of `baselineOrder` (any order the runner's join can give), and
  // joined as the runner joins its contexts' units (check.mjs `runAcross`).
  const [first, second] = [1, 2].map((pass) =>
    passOf([baselineUnitsOf(h, pass)]),
  )
  const baseline = baselineOf(first.rows, second.rows)
  // The pass's lists that results.json and the refusal print (law 7).
  observe(`pass`, {
    failed: [...first.failed.keys()],
    nondeterministic: [...baseline.nondeterministic],
  })
  // An operator mutant's change: a comparison or logical swap states its
  // operator and the swap, any other operator the code it replaces.
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
      : { original: m.code[0], replacement: m.code[1] }),
    ...(m.evidence ? { evidence: m.evidence } : {}),
    ...(m.outside ? { outside: m.outside } : {}),
    ...(m.probe ? { probeGuard: true } : {}),
  }))
  const fileIndex = (file) => fileIndexOf(h, file)
  const states = new Set()
  const failedFiles = [...first.failed.keys()].map(fileIndex)
  if (reordered(h, failedFiles, byBaselineRecords(h)))
    states.add(`baseline records list the failing files against file order`)
  if (reordered(h, failedFiles, byLocale(h)))
    states.add(`a locale order lists the failing files another way`)
  const flakyFiles = [
    ...new Set(
      [...baseline.nondeterministic].map((key) =>
        fileIndex(key.split(` > `)[0]),
      ),
    ),
  ]
  if (reordered(h, flakyFiles, byBaselineRecords(h)))
    states.add(
      `baseline records list the nondeterministic tests against file order`,
    )
  // The oracle files that fail with no mutant active, which the runner
  // leaves out of every mutant's runs (check.mjs): each blocks the mutants
  // it owns (`blockedOr`).
  const blocking = new Set(
    [...first.failed.keys()].filter((file) => oracleFiles.has(file)),
  )
  const results = mutants.map((mutant, mi) => {
    const owners = new Set(
      h.mutants[mi].owners
        .filter((fi) => fi < h.files.length)
        .map((fi) => fileName(h, fi))
        .filter((file) => oracleFiles.has(file)),
    )
    const passing = new Set([...owners].filter((file) => !blocking.has(file)))
    const targets = targetsOf(mutant, baseline, passing, oracleFiles)
    // The runner runs the owner files in the order the targets give them,
    // and stops at the first file that kills (check.mjs `runOwners`).
    const units = []
    for (const file of targets.oracleTargets) {
      units.push(unitOf(h, fileIndex(file), mi))
      if (
        outcomeOf([units.at(-1)], baseline.nondeterministic).outcome ===
        `killed`
      )
        break
    }
    const result = {
      ...mutant,
      oracleFiles: targets.oracleTargets,
      ...blockedOr(
        judgeMutant(mutant, { owners, targets, units, baseline, mutants }),
        [...owners].filter((file) => blocking.has(file)),
      ),
    }
    if (result.outcome === `killed` && owners.size > passing.size)
      states.add(`killed by one owner beside a failing owner`)
    const targetFiles = targets.oracleTargets.map(fileIndex)
    if (result.class !== undefined || namesAFailingTest.has(result.outcome))
      if (reordered(h, targetFiles, byLocale(h)))
        states.add(`a locale order lists the owner files another way`)
    // Two owner files kill under different laws, so the laws a kill names
    // show which file ran first: each file's behavioral laws on a
    // reproducible route, in a run that neither timed out nor failed to load.
    const lawsIn = (fi) => {
      const tests = h.files[fi].tests
      if (
        tests.some((t) =>
          [`runTimeout`, `setupError`].includes(t.under[mi].kind),
        )
      )
        return ``
      const laws = tests.flatMap((t) =>
        !t.flaky &&
        t.under[mi].kind === `verdict` &&
        t.under[mi].law !== `reach agreement` &&
        kindOf(t.under[mi].firedAt ?? t.route) === `reproducible`
          ? [t.under[mi].law]
          : [],
      )
      return [...new Set(laws)].sort().join()
    }
    if (result.outcome === `killed`) {
      const killing = targetFiles.map(lawsIn).filter(Boolean)
      if (new Set(killing).size > 1)
        states.add(`two owner files kill under different laws`)
    }
    if (result.outcome === `killed` && units.some((u) => u.timedOut))
      states.add(`killed beside a timeout`)
    // The work law's states (laws 3 and 5): a kill by a work bound, alone
    // or beside a changed value that would otherwise be not-judged, a work
    // bound on the random campaign, and survivors whose work rose under a
    // declared bound, rose from none, rose only where work judges nothing,
    // or fell.
    const workTests = targets.oracleTargets
      .map(fileIndex)
      .flatMap((fi) => h.files[fi].tests.map((t, ti) => ({ t, fi, ti })))
      .filter((x) => x.t.reaches[mi] || h.files[x.fi].background[mi])
    const judgedRise = workTests.find(
      (x) => workJudges(h, mi, x) && workUnder(x.t, mi) > x.t.work,
    )
    if (result.laws?.includes(`work bound`)) {
      states.add(`${result.outcome} by a work bound`)
      if (
        result.outcome === `killed` &&
        workTests.some(
          (x) =>
            !x.t.flaky &&
            [`changed`, `observedChanged`].includes(x.t.under[mi].kind),
        )
      )
        states.add(`a work bound kill beside a changed value`)
    }
    if (result.class === `extra-work` && judgedRise) {
      if (judgedRise.t.bound !== undefined)
        states.add(`extra-work under a declared bound`)
      if (judgedRise.t.work === 0) states.add(`extra-work from no work`)
      if (
        judgedRise.t.bound !== undefined &&
        100 * workUnder(judgedRise.t, mi) ===
          judgedRise.t.bound * judgedRise.t.work
      )
        states.add(`a rise exactly at the declared bound`)
      // An unregistered test before it in report order also rose.
      if (
        workTests
          .slice(0, workTests.indexOf(judgedRise))
          .some(
            (x) =>
              kindOf(x.t.route) === `unknown` &&
              passedKinds.has(x.t.under[mi].kind) &&
              !x.t.flaky &&
              workUnder(x.t, mi) > x.t.work,
          )
      )
        states.add(`extra-work named past an unregistered rise`)
    }
    if (result.class !== undefined && result.class !== `extra-work`) {
      if (
        workTests.some(
          (x) =>
            passedKinds.has(x.t.under[mi].kind) &&
            !x.t.flaky &&
            workUnder(x.t, mi) > x.t.work &&
            !workJudges(h, mi, x),
        )
      )
        states.add(`a work rise where work judges nothing`)
      if (
        workTests.some(
          (x) => workJudges(h, mi, x) && workUnder(x.t, mi) < x.t.work,
        )
      )
        states.add(`a survivor whose work fell`)
    }
    const declared = [...new Set(h.mutants[mi].owners)]
    orderStates(h, states, `changed test`, placesOfKeys(h, result), declared)
    if (namesAFailingTest.has(result.outcome))
      orderStates(
        h,
        states,
        `failing test`,
        placesOfNames(h, result.by, [...owners].map(fileIndex)),
        declared,
      )
    if (result.class === `not-infected`)
      orderStates(
        h,
        states,
        `operand pair`,
        reachingPlaces(h, mi, owners).filter((p) => !p.t.flaky),
        undefined,
        (p, q) =>
          p.t.pair[mi].every((value, side) =>
            sameValue(value, q.t.pair[mi][side]),
          ),
      )
    if (result.class === `not-observed`)
      orderStates(h, states, `infecting test`, infectingPlaces(h, mi, owners))
    if (result.class === `indeterminate`)
      orderStates(
        h,
        states,
        `nondeterministic test`,
        reachingPlaces(h, mi, owners).filter((p) => p.t.flaky),
      )
    if (needsOrdinary(result, targets))
      result.testOutcome = judgeOrdinary(
        targets.testTargets.map((file) => unitOf(h, fileIndex(file), mi)),
      )
    return result
  })
  report.assignKeys(results)
  // Authored mutants, as the runner judges them: one that does not apply
  // and one with no owner are decided before any run; the rest run every
  // test of each owner file, whose units come in the order the owners were
  // declared (the runner's owner Set, check.mjs).
  for (const [ai, a] of h.authored.entries()) {
    const result = {
      id: `authored:a${ai}`,
      authored: true,
      authoredId: `a${ai}`,
      source: `src/x.ts`,
      key: report.authoredKey(`src/x.ts`, `a${ai}`),
      operator: `authored`,
      function: `authored mutants`,
      intent: a.intent,
      author: a.author,
      original: `out.push('a')`,
      replacement: `out.push('b')`,
      line: a.applies ? a.line + 1 : undefined,
    }
    results.push(result)
    const owners = [
      ...new Set(
        a.owners.filter((fi) => fi < h.files.length && h.files[fi].oracle),
      ),
    ]
    const failing = owners.filter((fi) => blocking.has(fileName(h, fi)))
    if (!a.applies) result.outcome = `does-not-apply`
    else if (owners.length === 0) result.outcome = `unowned`
    else {
      Object.assign(
        result,
        blockedOr(
          judgeAuthored(
            owners
              .filter((fi) => !failing.includes(fi))
              .map((fi) => unitOf(h, fi, MUTANTS + ai)),
            baseline,
          ),
          failing.map((fi) => fileName(h, fi)),
        ),
      )
      orderStates(h, states, `changed test`, placesOfKeys(h, result), owners)
      if (namesAFailingTest.has(result.outcome))
        orderStates(
          h,
          states,
          `failing test`,
          placesOfNames(h, result.by, owners),
          owners,
        )
    }
  }
  // The streaming printer (stream.mjs) prints each gap as the mutant is
  // judged; the completion order is the reverse here.
  const printer = await import(`./stream.mjs`).catch(() => undefined)
  // Both reports lead with the baseline the runner's first pass gave.
  const baselineGiven = baselineFiles(h, printer)
  const summary = report.renderReport({
    results,
    run: { id: `r`, inputs: `records` },
    excluded: [],
    baseline: baselineGiven,
  })
  observe(`classified`, {
    outcomes: results.map((r) => ({
      outcome: r.outcome,
      class: r.class,
      laws: r.laws && [...r.laws].sort(),
      testOutcome: r.testOutcome,
    })),
    summary: readSummary(summary),
    messages: messagesOf(summary),
    owners: ownersLinesOf(summary),
    stdout: report.renderStdout?.({
      results,
      run: { id: `r`, inputs: `records` },
      excluded: [],
      pkg: `/pkg`,
      baseline: baselineGiven,
      paths: {
        report: `out/summary.md`,
        results: `out/results.json`,
        out: `out`,
      },
    }),
    summaryText: summary,
    streamed: printer
      ? [...report.gapsOf(results)].reverse().map((r) => printer.gapLine(r))
      : undefined,
    killsSection: summary.slice(
      summary.indexOf(`## First law to reject, by law`),
    ),
    // What results.json keeps of each mutant's change, after the printing.
    kept: results.map((r) =>
      r.authored ? r.intent : [String(r.original), String(r.replacement)],
    ),
  })
  // The baseline the printer shows before any mutant (law 9).
  observe(`baseline`, printer?.baselineLines(baselineGiven) ?? [])
  for (const r of results) {
    states.add(
      r.authored ? `authored ${r.class ?? r.outcome}` : (r.class ?? r.outcome),
    )
    if (r.testOutcome === `killed`) states.add(`ordinary killed`)
    if (r.class === `not-infected` && r.evidence)
      states.add(`not-infected with a boundary hint`)
  }
  if (h.mutants.some((m) => m.anchor.includes(`\``) && !m.probe))
    states.add(`a key with backticks`)
  // The gap line's cut (law 8): a gap whose code or intent is longer than
  // 60 characters once collapsed, or spans lines.
  for (const r of report.gapsOf(results)) {
    const texts = r.authored ? [r.intent] : [r.original, r.replacement]
    if (texts.some((text) => String(text).replace(/\s+/g, ` `).length > 60))
      states.add(`a gap line cut at 60 characters`)
    if (texts.some((text) => /\n/.test(String(text))))
      states.add(`a gap line of code on several lines`)
    // A cut by UTF-16 units would split the character at the cut.
    const units = (text) => String(text).replace(/\s+/g, ` `)
    if (texts.some((text) => /[\ud800-\udbff]/.test(units(text).slice(56, 57))))
      states.add(`a gap line cut at an astral character`)
    if (r.authored && exits.test(r.intent))
      states.add(`an authored intent with words the exit law forbids`)
  }
  // Operands a printer that drops types would conflate (law 7): two
  // distinct values with one String() text, or two long strings that share
  // their first 40 characters, in one not-infected message.
  for (const [mi, r] of results.entries())
    if (r.class === `not-infected`) {
      const seen = h.files.flatMap((f) =>
        f.tests.flatMap((t) => (t.reaches[mi] ? t.pair[mi] : [])),
      )
      const conflated = seen.some((a, i) =>
        seen.some(
          (b, j) =>
            j > i &&
            primitive(a) &&
            primitive(b) &&
            !Object.is(a, b) &&
            String(a).slice(0, 40) === String(b).slice(0, 40),
        ),
      )
      if (conflated) states.add(`not-infected operands that String conflates`)
      if (
        seen.some((v) => typeof v === `bigint` || v === null || v === undefined)
      )
        states.add(`a not-infected message with typed operands`)
      if (
        seen.some(
          (v) =>
            typeof v === `string` && /[\ud800-\udbff]/.test(v.slice(36, 37)),
        )
      )
        states.add(`a not-infected operand cut at an astral character`)
    }
  // Law 9: a failing test in a suite whose name holds regular-expression
  // syntax, a test whose full name another test's contains, and a file
  // that did not load.
  for (const [fi, f] of h.files.entries()) {
    if (f.baseline === `test` && !f.oracle)
      states.add(`an ordinary file's failing baseline test`)
    if (f.baseline === `test` && f.failure === `violation`)
      states.add(`a baseline law violation with its counterexample`)
    if (!f.oracle || f.baseline === `pass`) continue
    if (f.baseline === `load`) states.add(`a baseline file that did not load`)
    else {
      states.add(`a baseline failing test`)
      const full = f.tests.map((_, ti) => namesOf(h, fi, ti).join(` `))
      if (full.some((x, i) => full.some((y, j) => j !== i && y.includes(x))))
        states.add(`a baseline test whose name another test's contains`)
      if (
        f.tests.some(
          (t) =>
            t.suites.length > 0 && /[.*+?^${}()|[\]\\]/.test(t.suites.join(``)),
        )
      )
        states.add(`a baseline test in a suite named with regex syntax`)
      if (
        f.tests.some((t, ti) =>
          /[\u0000-\u001f]/.test(namesOf(h, fi, ti).join(``)),
        )
      )
        states.add(`a baseline test whose name holds a newline or a tab`)
    }
  }
  for (const state of states) observe(`reach`, state)
}

// ## Comparison
function check(h, observations, expected) {
  // The unmutated pass's lists, in report order (law 7).
  const unmutated = observations.find((o) => o.checkpoint === `pass`)?.value
  if (JSON.stringify(unmutated) !== JSON.stringify(expected.pass))
    return violation(
      `pass`,
      `the unmutated pass lists ${JSON.stringify(unmutated)}, owed ${JSON.stringify(expected.pass)}`,
      `report order`,
      { actual: unmutated, expected: expected.pass },
    )
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
  // Each operand text the messages printed, with the model value it stood
  // for (law 7).
  const printedAs = new Map()
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
    if (exits.test(withoutSpans(message)))
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
    // The gap's `Owners` line lists the owner files that reached the
    // mutant, in report order (law 7); a gap with none has no line.
    if (
      JSON.stringify(got.owners?.[owed.key]) !== JSON.stringify(owed.ownerFiles)
    )
      return violation(
        `classified`,
        `gap ${owed.key} lists the owners ${JSON.stringify(got.owners?.[owed.key])}, owed ${JSON.stringify(owed.ownerFiles)}`,
        `report order`,
        { actual: got.owners?.[owed.key], expected: owed.ownerFiles },
      )
    // A not-infected message names the operand pairs the model saw, in
    // order, and no printed text stands for two values the model tells
    // apart.
    if (owed.operands) {
      const pairs = printedOperands(message)
      if (pairs?.length !== owed.operands.length)
        return violation(
          `classified`,
          `gap ${owed.key} names ${pairs?.length ?? `no readable`} operand pairs, owed ${owed.operands.length}: ${JSON.stringify(message)}`,
          `operands`,
        )
      for (const [i, pair] of pairs.entries())
        for (const side of [0, 1]) {
          const text = pair[side]
          const value = owed.operands[i][side]
          if (text !== operandOf(value))
            return violation(
              `classified`,
              `gap ${owed.key} prints the operand ${shownValue(value)} as ${JSON.stringify(text)}, owed ${JSON.stringify(operandOf(value))}`,
              `operands`,
            )
          const earlier = printedAs.get(text)
          if (earlier !== undefined && !sameValue(earlier.value, value))
            return violation(
              `classified`,
              `the operand text ${JSON.stringify(text)} stands for two different values: ${earlier.shown} and ${shownValue(value)}`,
              `operands`,
            )
          printedAs.set(text, { value, shown: shownValue(value) })
        }
    }
  }
  // The compressed stdout summary: the totals, one legend line per class
  // present, and every gap once, under its function.
  const stdout = got.stdout
  if (typeof stdout !== `string`)
    return violation(`classified`, `no compressed stdout summary`, `stdout`)
  const stdoutGaps = stdout
    .split(`\n`)
    .filter((line) =>
      /^oracle-gaps: gap \S+ L(\d+|\?) (m\d+|authored:a\d+) /.test(line),
    )
  const kinds = new Set(gapsOfModel.map((o) => o.class ?? o.outcome))
  // Gaps are grouped by function, and the authored ones in one group.
  const groupOf = (o) =>
    o.authored ? `authored mutants (src/x.ts)` : `fn ${o.function} (src/x.ts)`
  const functions = new Set(gapsOfModel.map(groupOf))
  // Every line of the stdout is a line of the stream: its prefix and kind,
  // or an indented line under a failing baseline file (law 15 of the
  // end-to-end oracle; the coordinator's decision on review F1, 2026-11-12).
  // A blank line is none.
  const stray = stdout
    .replace(/\n$/, ``)
    .split(`\n`)
    .find(
      (line) =>
        !/^oracle-gaps: (?:config|note|baseline|blocked|progress|gap|busy|summary|legend|function|done) /.test(
          line,
        ) && !/^  \S/.test(line),
    )
  if (stray !== undefined)
    return violation(
      `classified`,
      `the stdout has a line that is not a line of the stream: ${JSON.stringify(stray)}`,
      `stdout`,
      { actual: stdout },
    )
  // The legend's lines, one per class: `oracle-gaps: legend <class>: …`.
  const legend = stdout
    .split(`\n`)
    .filter((line) => /^oracle-gaps: legend [a-z-]+: /.test(line))
  // Each function's heading over its gap lines.
  const headings = stdout
    .split(`\n`)
    .filter(
      (line) =>
        line.startsWith(`oracle-gaps: function fn `) ||
        line.startsWith(`oracle-gaps: function authored `),
    )
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
                        `oracle-gaps: gap ${o.class ?? o.outcome} L${o.line} ${o.id} `,
                      ),
                    ).length !== 1,
                )
              ? `a gap is not printed once under its class, line, and id`
              : // A gap with no line prints `L?` (stream.mjs), a placeholder,
                // not a question; a replay line is a command, not prose.
                exits.test(
                    withoutSpans(
                      stdout
                        .split(`\n`)
                        .filter((line) => !line.startsWith(`  replay: `))
                        .join(`\n`),
                    ).replace(/ L\? /g, ` L `),
                  )
                ? `the stdout summary has an exit`
                : undefined
  if (stdoutProblem)
    return violation(`classified`, stdoutProblem, `stdout`, {
      actual: stdout,
    })
  // One loop (the v20 freeze, 2026-11-10: test results and gaps together):
  // the stdout leads with the baseline, then names each oracle file that
  // fails with no mutant active and its failing test, with the step that
  // unblocks its mutants (G13), and says the report is provisional, with
  // how many mutants are blocked (the freeze's decision 2; G5). Its last
  // line says that the check completed, and with how many gaps (G6).
  const stdoutLines = stdout.split(`\n`)
  const baselineGot =
    observations.find((o) => o.checkpoint === `baseline`)?.value ?? []
  const failingOracle = expected.baseline.filter((b) => b.fails && !b.ordinary)
  const blockedCount = gapsOfModel.filter((o) => o.outcome === `blocked`).length
  const blockedLines = stdoutLines.filter((line) =>
    line.startsWith(`oracle-gaps: blocked `),
  )
  // The one decisive baseline line, right after the baseline's lines (law
  // 15 of the end-to-end oracle; the maintainer's request of 2026-11-12):
  // every oracle file passed, or how many failed.
  const oracleFiles = expected.baseline.filter((b) => !b.ordinary).length
  const files = (n) => `${n} oracle file${n === 1 ? `` : `s`}`
  const verdict =
    failingOracle.length === 0
      ? `oracle-gaps: baseline all ${files(oracleFiles)} pass`
      : `oracle-gaps: baseline ${failingOracle.length} of ${files(oracleFiles)} failed (provisional)`
  const done = `oracle-gaps: done completed, ${counted(gapsOfModel.length, `gap`)}${failingOracle.length > 0 ? ` (provisional)` : ``}, report out/summary.md`
  const provisional = stdoutLines.filter((line) =>
    line.startsWith(`oracle-gaps: note provisional: `),
  )
  const crashedLegend = legend.find((line) =>
    line.startsWith(`oracle-gaps: legend crashed: `),
  )
  const workLegend = legend.find((line) =>
    line.startsWith(`oracle-gaps: legend extra-work: `),
  )
  const leadProblem =
    stdoutLines.slice(0, baselineGot.length).join(`\n`) !==
    baselineGot.join(`\n`)
      ? `the stdout does not lead with the baseline`
      : stdoutLines[baselineGot.length] !== verdict ||
          stdoutLines.filter((line) => line === verdict).length !== 1
        ? `the stdout's line after the baseline is ${JSON.stringify(stdoutLines[baselineGot.length])}, not the decisive ${JSON.stringify(verdict)}`
        : blockedLines.length !== failingOracle.length
          ? `${blockedLines.length} blocked lines for ${failingOracle.length} failing oracle files`
          : failingOracle.find((b) => {
                const named = blockedLines.find(
                  (l) =>
                    readSpan(l.slice(`oracle-gaps: blocked `.length))
                      ?.content === relativeName(h, b.fi),
                )
                return (
                  named === undefined ||
                  (b.test !== undefined &&
                    !named.includes(
                      ` at ${codeSpanOf(shownName(h, b.fi, b.test))}`,
                    )) ||
                  !named.endsWith(`then check again.`)
                )
              })
            ? `a failing oracle file's blocked line does not name it, its failing test, and the step that unblocks it`
            : provisional.length !== (failingOracle.length > 0 ? 1 : 0) ||
                (failingOracle.length > 0 &&
                  !provisional[0].startsWith(
                    `oracle-gaps: note provisional: ${counted(blockedCount, `mutant`)} ${blockedCount === 1 ? `is` : `are`} blocked`,
                  ))
              ? `the stdout does not say that the report is provisional, with ${blockedCount} blocked mutants`
              : stdoutLines.at(-1) !== done
                ? `the last stdout line is ${JSON.stringify(stdoutLines.at(-1))}, not ${JSON.stringify(done)}`
                : crashedLegend !== undefined &&
                    !meanings.crashed.test(
                      crashedLegend.slice(
                        `oracle-gaps: legend crashed: `.length,
                      ),
                    )
                  ? `the crashed legend line does not say a crash is a gap and where its error is`
                  : workLegend !== undefined &&
                      !meanings[`extra-work`].test(
                        workLegend.slice(
                          `oracle-gaps: legend extra-work: `.length,
                        ),
                      )
                    ? `the extra-work legend line does not say that a builtin counts as one site, and what is owed for its cost`
                    : undefined
  if (leadProblem)
    return violation(`classified`, leadProblem, `stdout`, { actual: stdout })
  // The full report leads with the same baseline, before its gaps.
  const text = got.summaryText ?? ``
  const baselineAt = text.indexOf(`## Baseline`)
  if (
    baselineAt < 0 ||
    baselineAt > text.indexOf(`## Gaps`) ||
    baselineGot.some((line) => !text.slice(baselineAt).includes(line)) ||
    text.includes(`Provisional: `) !== failingOracle.length > 0
  )
    return violation(
      `classified`,
      `summary.md does not lead with the baseline section, and its provisional status, before its gaps`,
      `report`,
      { actual: text },
    )
  // Unowned warnings: one line per function, with its count, so that they
  // do not bury the gaps.
  const unownedFns = new Map()
  for (const o of expected.outcomes)
    if (!o.probe && o.outcome === `unowned`)
      unownedFns.set(groupOf(o), (unownedFns.get(groupOf(o)) ?? 0) + 1)
  const unownedLines = stdout
    .split(`\n`)
    .filter((line) => line.startsWith(`oracle-gaps: note unowned `))
  const unownedText = (group, n) =>
    `oracle-gaps: note unowned ${group}: ${n} ${n === 1 ? `mutant` : `mutants`}`
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
  if (exits.test(withoutSpans(got.killsSection)))
    return violation(
      `classified`,
      `the kills-by-law section offers an exit`,
      `messages`,
      { actual: got.killsSection },
    )
  // The streamed lines are the stdout's gap lines, each once.
  const printed = [...stdoutGaps].sort()
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
  // Law 8: each gap line is one line, and shows its change shortened: an
  // operator mutant's original and replacement as two code spans, an
  // authored mutant's intent as a code span and its author. The results keep the full text.
  for (const owed of gapsOfModel) {
    const head = `oracle-gaps: gap ${owed.class ?? owed.outcome} L${owed.line} ${owed.id} `
    const line = streamed.find((l) => l.startsWith(head))
    const rest = line?.slice(head.length)
    let shown
    if (owed.authored) {
      // The intent is the author's text, so it sits in a code span.
      const intent = rest === undefined ? undefined : readSpan(rest)
      shown =
        intent?.content === shortened(owed.authored.intent) &&
        rest.slice(intent.length) === ` (authored by ${owed.authored.author})`
    } else {
      const a = rest === undefined ? undefined : readSpan(rest)
      const arrow = a && rest.slice(a.length).startsWith(` → `)
      const b = arrow ? readSpan(rest.slice(a.length + 3)) : undefined
      shown =
        b !== undefined &&
        a.length + 3 + b.length === rest.length &&
        a.content === shortened(owed.code[0]) &&
        b.content === shortened(owed.code[1])
    }
    if (!shown || /\n/.test(line))
      return violation(
        `classified`,
        `the gap line of ${owed.id} is ${JSON.stringify(line)}, which does not show its change on one line, shortened to 60 characters`,
        `gap line`,
        { actual: line, expected: owed.authored ?? owed.code },
      )
  }
  const owedKept = expected.outcomes.map((o) =>
    o.authored ? o.authored.intent : o.code.map(String),
  )
  if (JSON.stringify(got.kept) !== JSON.stringify(owedKept))
    return violation(
      `classified`,
      `the results do not keep each mutant's full change`,
      `gap line`,
      { actual: got.kept, expected: owedKept },
    )
  if (JSON.stringify(got.summary) !== JSON.stringify(expected.summary))
    return violation(
      `classified`,
      `the summary does not list exactly the owed gaps, unowned warnings, and counts`,
      `report completeness`,
      { actual: got.summary, expected: expected.summary },
    )
  return baselineBreach(h, observations, expected) ?? pass
}

// Law 9: each oracle file's baseline line, and for a failing file the
// replay command, read as a POSIX shell reads it, which runs exactly the
// owed test of the file under either Vitest's join of its names.
function baselineBreach(h, observations, expected) {
  const lines = observations.find((o) => o.checkpoint === `baseline`)?.value
  if (!Array.isArray(lines))
    return violation(`baseline`, `no baseline was printed`, `baseline`)
  const breach = (difference) =>
    violation(`baseline`, difference, `baseline`, {
      actual: lines,
      expected: expected.baseline,
    })
  // Each printed line is one line, whatever a test's name holds.
  const broken = lines.find((line) => /[\r\n\u2028\u2029]/.test(line))
  if (broken !== undefined)
    return breach(`a baseline line spans lines: ${JSON.stringify(broken)}`)
  for (const owed of expected.baseline) {
    const file = `${relativeName(h, owed.fi)}${owed.ordinary ? ` (ordinary)` : ``}`
    const at = lines.findIndex(
      (line) =>
        line.startsWith(`oracle-gaps: baseline pass ${file}: `) ||
        line.startsWith(`oracle-gaps: baseline fail ${file}: `),
    )
    if (at < 0) return breach(`no baseline line for ${file}`)
    // Each file's line gives its test counts; a failing file's lines under
    // it name its failing test and its error, and, for a law violation, the
    // law, the difference, and the counterexample, then the replay.
    const block = []
    for (let i = at + 1; lines[i]?.startsWith(`  `); i += 1)
      block.push(lines[i])
    if (!owed.fails) {
      if (
        lines[at] !==
        `oracle-gaps: baseline pass ${file}: ${counted(owed.tests, `test`)}`
      )
        return breach(
          `${file} passes ${owed.tests} tests, and its line is ${lines[at]}`,
        )
      continue
    }
    const head =
      owed.test === undefined
        ? `oracle-gaps: baseline fail ${file}: did not load: `
        : `oracle-gaps: baseline fail ${file}: ${owed.failed} of ${counted(owed.tests, `test`)} failed`
    if (
      owed.test === undefined ? !lines[at].startsWith(head) : lines[at] !== head
    )
      return breach(`${file} fails, and its line is ${lines[at]}, not ${head}`)
    if (owed.test !== undefined) {
      const failing = block.find((line) => line.startsWith(`  failing: `))
      const name = failing && readSpan(failing.slice(`  failing: `.length))
      const error =
        name && readSpan(failing.slice(`  failing: `.length + name.length + 2))
      const firstLine = owed.violation
        ? violationText().split(`\n`)[0]
        : `Error: violation`
      if (
        name?.content !== shownName(h, owed.fi, owed.test) ||
        error?.content !== firstLine
      )
        return breach(
          `${file}'s failing line ${JSON.stringify(failing)} does not name ${shownName(h, owed.fi, owed.test)} and its error`,
        )
      const law = block.find((line) => line.startsWith(`  law: `))
      const counterexample = block.find((line) =>
        line.startsWith(`  counterexample: `),
      )
      const owedLaw = `  law: ${codeSpanOf(VIOLATION.law)} at ${codeSpanOf(VIOLATION.checkpoint)}: ${codeSpanOf(VIOLATION.difference)}`
      const owedCounterexample = `  counterexample: ${codeSpanOf(VIOLATION.history)}`
      if (
        owed.violation
          ? law !== owedLaw || counterexample !== owedCounterexample
          : law !== undefined || counterexample !== undefined
      )
        return breach(
          owed.violation
            ? `${file} fails by a law violation, and its baseline does not give its law, difference, and counterexample: ${JSON.stringify(block)}`
            : `${file} fails by an error, and its baseline names a law: ${JSON.stringify(block)}`,
        )
    }
    const command = block
      .find((line) => line.startsWith(`  replay: `))
      ?.slice(`  replay: `.length)
    const words = command === undefined ? undefined : shellWords(command)
    if (!words)
      return breach(
        `the replay of ${file} is ${JSON.stringify(command)}, which a POSIX shell does not read as plain words`,
      )
    const [vitest, run, target, flag, pattern, ...more] = words
    const path = relativeName(h, owed.fi)
    if (vitest !== `vitest` || run !== `run` || target !== path)
      return breach(`the replay of ${file} is not \`vitest run ${path}\``)
    if (owed.test === undefined) {
      if (flag !== undefined)
        return breach(
          `${file} did not load, and its replay selects tests: ${command}`,
        )
      continue
    }
    if (flag !== `-t` || pattern === undefined || more.length > 0)
      return breach(
        `the replay of ${file} has no single -t pattern: ${command}`,
      )
    for (const join of [` `, ` > `]) {
      let selected
      try {
        selected = selectedBy(h, owed.fi, pattern, join)
      } catch (error) {
        return breach(
          `the replay pattern ${pattern} is not a regular expression: ${error.message}`,
        )
      }
      // The owed test, and any test whose joined names equal its own, which
      // no pattern can tell apart from it.
      const owedSet = sameNamed(h, owed.fi, owed.test, join)
      if (JSON.stringify(selected) !== JSON.stringify(owedSet))
        return breach(
          `the replay pattern ${JSON.stringify(pattern)} of ${file} runs tests ${JSON.stringify(selected)} when Vitest joins names with ${JSON.stringify(join)}, owed ${JSON.stringify(owedSet)}`,
        )
    }
  }
  return undefined
}

// A command line as a POSIX shell splits it into words (POSIX.1-2017, Shell
// Command Language 2.2 and 2.6), when nothing in it expands, globs, or
// redirects: plain characters, single-quoted text, backslash escapes, and
// double-quoted text with neither `$` nor a backtick (whose meaning there
// can depend on what follows, unspecified for some). Undefined otherwise.
function shellWords(line) {
  const words = []
  let word
  for (let i = 0; i < line.length;) {
    const c = line[i]
    if (c === ` `) {
      if (word !== undefined) words.push(word)
      word = undefined
      i += 1
      continue
    }
    word ??= ``
    if (c === `'`) {
      const end = line.indexOf(`'`, i + 1)
      if (end < 0) return undefined
      word += line.slice(i + 1, end)
      i = end + 1
    } else if (c === `\\`) {
      if (i + 1 >= line.length) return undefined
      word += line[i + 1]
      i += 2
    } else if (c === `"`) {
      let j = i + 1
      for (; j < line.length && line[j] !== `"`; j += 1) {
        if (line[j] === `$` || line[j] === `\``) return undefined
        if (line[j] === `\\` && /[$`"\\]/.test(line[j + 1] ?? ``)) j += 1
        word += line[j]
      }
      if (j >= line.length) return undefined
      i = j + 1
    } else if (/[\w./,:@%+=-]/.test(c)) {
      word += c
      i += 1
    } else return undefined
  }
  if (word !== undefined) words.push(word)
  return words
}

// A text as a code span whose fence outruns any backticks in it, as
// Markdown reads one (CommonMark 6.1).
function codeSpanOf(text) {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((r) => r.length))
  const fence = `\``.repeat(longest + 1)
  return `${fence} ${text} ${fence}`
}

// A model value, as a violation names it.
const shownValue = (value) =>
  typeof value === `bigint`
    ? `${value}n`
    : Object.is(value, -0)
      ? `-0`
      : typeof value === `string`
        ? JSON.stringify(value)
        : isPrimitive(value)
          ? String(value)
          : `a value of type ${typeof value}`

// ## Calibrations
const corrupt = (change) => (trace) => {
  const index = trace.findIndex((o) => o.checkpoint === `classified`)
  if (index < 0) return undefined
  const value = structuredClone(trace[index].value)
  if (change(value) === false) return undefined
  return trace.map((o, i) => (i === index ? { ...o, value } : o))
}
// A change to the compressed stdout, for the one-loop laws (law 8).
const corruptStdout = (change) => (trace) => {
  const index = trace.findIndex((o) => o.checkpoint === `classified`)
  if (index < 0 || typeof trace[index].value.stdout !== `string`)
    return undefined
  const value = structuredClone(trace[index].value)
  const changed = change(value.stdout)
  if (changed === undefined) return undefined
  value.stdout = changed
  return trace.map((o, i) => (i === index ? { ...o, value } : o))
}
const calibrations = [
  {
    name: `the stdout ends without its completion line`,
    law: `stdout`,
    corrupt: corruptStdout((stdout) =>
      stdout.split(`\n`).slice(0, -1).join(`\n`),
    ),
  },
  {
    name: `the stdout leaves a failing oracle file's blocked line out`,
    law: `stdout`,
    corrupt: corruptStdout((stdout) =>
      stdout.includes(`\noracle-gaps: blocked `) ||
      stdout.startsWith(`oracle-gaps: blocked `)
        ? stdout
            .split(`\n`)
            .filter((line) => !line.startsWith(`oracle-gaps: blocked `))
            .join(`\n`)
        : undefined,
    ),
  },
  {
    name: `the stdout's baseline comes after its gaps`,
    law: `stdout`,
    // The baseline's lines, everything before the totals, moved after the
    // rest of the stdout.
    corrupt: corruptStdout((stdout) => {
      const lines = stdout.split(`\n`)
      const totals = lines.findIndex((line) =>
        line.startsWith(`oracle-gaps: summary `),
      )
      if (totals <= 0) return undefined
      return [...lines.slice(totals), ...lines.slice(0, totals)].join(`\n`)
    }),
  },
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
        .find((l) => /^oracle-gaps: gap \S+ L\d+ m\d+ /.test(l))
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
    name: `a survivor that only did more work is reported as not observed`,
    law: `classification`,
    corrupt: corrupt((v) => {
      const o = v.outcomes.find((x) => x.class === `extra-work`)
      if (!o) return false
      o.class = `not-observed`
    }),
  },
  {
    name: `a kill by a work bound is reported as a survivor`,
    law: `classification`,
    corrupt: corrupt((v) => {
      const o = v.outcomes.find(
        (x) => x.outcome === `killed` && x.laws?.includes(`work bound`),
      )
      if (!o) return false
      o.outcome = `survived`
      o.class = `extra-work`
      o.laws = undefined
    }),
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
  `owners declared against file order name another first changed test`,
  `baseline records against file order name another first changed test`,
  `a mutant run's records against the baseline's name another first changed test`,
  `owners declared against file order name another first failing test`,
  `baseline records against file order name another first failing test`,
  `baseline records against file order name another first infecting test`,
  `baseline records against file order name another first operand pair`,
  `baseline records against file order name another first nondeterministic test`,
  `baseline records list the failing files against file order`,
  `a locale order lists the failing files another way`,
  `baseline records list the nondeterministic tests against file order`,
  `a locale order lists the owner files another way`,
  `two owner files kill under different laws`,
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
  `not-distinguished`,
  `dead-code`,
  `outside-annotation`,
  `ordinary killed`,
  `a key with backticks`,
  `authored not-observed`,
  `authored not-judged`,
  `authored killed`,
  `authored random-only-kill`,
  `authored does-not-apply`,
  `authored unowned`,
  `a gap line cut at 60 characters`,
  `a gap line of code on several lines`,
  `not-infected operands that String conflates`,
  `a baseline failing test`,
  `a baseline test in a suite named with regex syntax`,
  `a baseline test whose name another test's contains`,
  `a baseline file that did not load`,
  `a gap line cut at an astral character`,
  `an authored intent with words the exit law forbids`,
  `a not-infected operand cut at an astral character`,
  `a baseline test whose name holds a newline or a tab`,
  `a not-infected message with typed operands`,
  `blocked`,
  `authored blocked`,
  `killed by one owner beside a failing owner`,
  `a baseline law violation with its counterexample`,
  `an ordinary file's failing baseline test`,
  `extra-work`,
  `extra-work under a declared bound`,
  `extra-work from no work`,
  `killed by a work bound`,
  `a work bound kill beside a changed value`,
  `random-only-kill by a work bound`,
  `a work rise where work judges nothing`,
  `a survivor whose work fell`,
  `extra-work named past an unregistered rise`,
  `a rise exactly at the declared bound`,
]

// One constructed history per outcome class: one mutant judged by one
// oracle file's test, with the effect that makes the class, and an ordinary
// file whose assertion fails beside a survivor.
const four = (value) => Array.from({ length: MUTANTS }, () => value)
const slots = (value) => Array.from({ length: SLOTS }, () => value)
// A test of the grammar: on a fixed seed, deterministic, reaching every
// mutant with no effect, at the top of its file, passing its baseline.
const plainTest = (effect = {}, test = {}) => ({
  route: `fixed seed`,
  flaky: false,
  reaches: four(true),
  seen: four(`both`),
  under: slots({
    kind: `same`,
    law: `L`,
    firedAt: undefined,
    work: 0,
    ms: 0,
    ...effect,
  }),
  pair: four([0, 1]),
  suites: [],
  label: ``,
  tail: ``,
  fails: false,
  runOrder: 0,
  work: 10,
  workFlaky: false,
  bound: undefined,
  clocked: `none`,
  ms: 0,
  ...test,
})
const single = (
  name,
  enters,
  {
    mutant = {},
    test = {},
    effect = {},
    ordinary = false,
    background = four(false),
    backgroundInfects = four(false),
    more = [],
    baseline = `pass`,
    authored = [],
  } = {},
) => ({
  name,
  enters,
  build: () => ({
    files: [
      {
        oracle: true,
        tests: [plainTest(effect, test), ...more],
        background,
        backgroundInfects,
        baseline,
        failure: `error`,
      },
      ...(ordinary
        ? [
            {
              oracle: false,
              tests: [plainTest({ kind: `assertion` })],
              background: four(false),
              backgroundInfects: four(false),
              baseline: `pass`,
              failure: `error`,
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
        code: codes[1],
        evidence: undefined,
        outside: undefined,
        anchor: `out . push ( 'a' ) ;`,
        probe: false,
        ...mutant,
      },
    ],
    authored: authored.map((a) => ({
      owners: [0],
      line: 0,
      applies: true,
      intent: intents[0],
      author: `agent a`,
      ...a,
    })),
    baselineOrder: [0, 0, 0],
    fileStems: [`f0`, `f1`, `f2`],
  }),
})
// Law 7: two owner files whose tests have one effect, named apart so that a
// message shows which test it names. The mutants, operator and authored,
// declare the owners in `owners`, and the baseline records the files in
// `baselineOrder`. `second` changes the second file's test.
const twoOwners = (
  name,
  enters,
  {
    owners = [0, 1],
    baselineOrder = [0, 0, 0],
    fileStems = [`f0`, `f1`, `f2`],
    second = {},
    ...rest
  },
) => ({
  name,
  enters,
  build: () => {
    const base = single(`x`, [], rest).build()
    const [file] = base.files
    return {
      ...base,
      files: [
        file,
        { ...file, tests: [{ ...file.tests[0], label: `it's `, ...second }] },
      ],
      mutants: [{ ...base.mutants[0], owners }],
      authored: base.authored.map((a) => ({ ...a, owners })),
      baselineOrder,
      fileStems,
    }
  },
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
  // The only owner fails with no mutant active, by a law violation, and an
  // ordinary file fails too: the operator and the authored mutant are
  // blocked, and the baseline gives the law and its counterexample.
  {
    name: `a mutant whose only owner fails its baseline`,
    enters: [
      `blocked`,
      `authored blocked`,
      `a baseline law violation with its counterexample`,
      `an ordinary file's failing baseline test`,
    ],
    build: () => {
      const base = single(`x`, [], {
        effect: { kind: `verdict` },
        ordinary: true,
        baseline: `test`,
        authored: [{}],
      }).build()
      return {
        ...base,
        files: [
          { ...base.files[0], failure: `violation` },
          { ...base.files[1], baseline: `test`, failure: `error` },
        ],
      }
    },
  },
  // One owner fails with no mutant active; the other kills. The kill stands.
  {
    name: `a kill by one owner beside a failing owner`,
    enters: [`killed`, `killed by one owner beside a failing owner`],
    build: () => {
      const base = twoOwners(`x`, [], {
        effect: { kind: `verdict` },
      }).build()
      return {
        ...base,
        files: [{ ...base.files[0], baseline: `test` }, base.files[1]],
      }
    },
  },
  {
    // One owner file's run times out; the next kills. The kill decides.
    // (The runner stops at the first file that kills, so the timeout comes
    // first.)
    name: `a kill beside a timed-out run`,
    enters: [`killed beside a timeout`],
    build: () => {
      const base = single(`x`, [], { effect: { kind: `verdict` } }).build()
      return {
        ...base,
        files: [
          {
            ...base.files[0],
            tests: [
              {
                ...base.files[0].tests[0],
                under: slots({
                  kind: `runTimeout`,
                  law: `L`,
                  firedAt: undefined,
                  work: 0,
                  ms: 0,
                }),
              },
            ],
          },
          base.files[0],
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
  // The work law (laws 3 and 5): klona's shapes. A forced `if` that
  // deletes an early return, and a skipped call whose absence costs work
  // elsewhere, change no observation and cost more work.
  single(`a forced branch that only costs work`, [`extra-work`], {
    mutant: { operator: `if-false` },
    test: { work: 100 },
    effect: { work: 150 },
  }),
  single(`a skipped call that only costs work`, [`extra-work`], {
    effect: { work: 7 },
  }),
  single(
    `a rise under the declared bound`,
    [`extra-work`, `extra-work under a declared bound`],
    {
      mutant: { operator: `if-false` },
      test: { work: 100, bound: 200 },
      effect: { work: 7 },
    },
  ),
  // A test that reaches a site does work, so a rise from none comes from
  // code that ran when the file loaded the module: the mutant changed what
  // the loaded module does in a test that reaches none of its sites.
  single(`a rise from no work`, [`extra-work`, `extra-work from no work`], {
    mutant: { operator: `if-true` },
    test: { work: 0, reaches: four(false) },
    background: four(true),
    backgroundInfects: four(true),
    effect: { work: 1 },
  }),
  single(`a rise past the declared bound`, [`killed by a work bound`], {
    mutant: { operator: `if-false` },
    test: { bound: 150 },
    effect: { work: 7 },
  }),
  single(
    `a rise past the declared bound beside a changed value`,
    [`killed by a work bound`, `a work bound kill beside a changed value`],
    { test: { bound: 200 }, effect: { kind: `changed`, work: 150 } },
  ),
  single(
    `a rise past the declared bound in the random campaign`,
    [`random-only-kill by a work bound`],
    { test: { route: `random seed`, bound: 100 }, effect: { work: 1 } },
  ),
  single(
    `a rise in a test whose work varied`,
    [`a work rise where work judges nothing`],
    {
      mutant: { operator: `if-false` },
      test: { workFlaky: true, bound: 100 },
      effect: { work: 7 },
    },
  ),
  single(`a rise in a calibration`, [`a work rise where work judges nothing`], {
    mutant: { operator: `if-false` },
    test: { route: `calibration`, bound: 100 },
    effect: { work: 150 },
  }),
  // A test that no oracleProperty registered (an unknown route) can carry
  // no bound, so its rise judges nothing, and the mutant keeps its class.
  single(
    `a rise on a route that carries no bound`,
    [`a work rise where work judges nothing`],
    {
      mutant: { operator: `if-false` },
      test: { route: undefined },
      effect: { work: 7 },
    },
  ),
  // The unregistered test rises first in report order; the directive names
  // the registered test after it, whose bound can reject the mutant.
  single(
    `a rise on an unregistered route before a registered one`,
    [`extra-work`, `extra-work named past an unregistered rise`],
    {
      mutant: { operator: `if-false` },
      test: { route: undefined },
      effect: { work: 7 },
      more: [plainTest({ work: 150 })],
    },
  ),
  // 29 is exactly 1.16 times 25: not past the bound, though a product in
  // binary floating point is a little below 29.
  single(
    `a rise exactly at the declared bound`,
    [
      `extra-work`,
      `extra-work under a declared bound`,
      `a rise exactly at the declared bound`,
    ],
    {
      mutant: { operator: `if-false` },
      test: { work: 25, bound: 116 },
      effect: { work: 4 },
    },
  ),
  // A test that made a timer by any path, read a clock, or held I/O open
  // can do work that follows the clock: a polling or a deadline loop. Its
  // rise judges nothing, so a bound cannot kill on it, which an idle replay
  // would not reproduce, and the mutant is not extra-work.
  ...[
    [`timer`, `made a timer`],
    [`timers/promises`, `slept through node:timers/promises`],
    [`clock read`, `read the clock`],
    [`spied clock read`, `read the clock through a spy`],
    [`process.uptime`, `polled process.uptime`],
    [`os.uptime`, `polled os.uptime`],
    [`AbortSignal.timeout`, `polled an AbortSignal.timeout`],
    [`Atomics.wait`, `waited with Atomics.wait and a timeout`],
    [`Atomics.waitAsync`, `waited with Atomics.waitAsync and a timeout`],
    [`monitorEventLoopDelay`, `polled monitorEventLoopDelay`],
    [`io`, `held I/O open`],
  ].map(([clocked, did]) =>
    single(
      `a rise past the bound in a test that ${did}`,
      [`a work rise where work judges nothing`],
      {
        mutant: { operator: `if-false` },
        test: { clocked, bound: 100 },
        effect: { work: 150 },
      },
    ),
  ),
  single(`a forced branch that saves work`, [`a survivor whose work fell`], {
    mutant: { operator: `if-false` },
    effect: { work: -1 },
  }),
  twoOwners(
    `a value changed in two owner files declared against file order`,
    [
      `not-judged`,
      `authored not-judged`,
      `owners declared against file order name another first changed test`,
    ],
    { owners: [1, 0], effect: { kind: `changed` }, authored: [{}] },
  ),
  twoOwners(
    `a value changed in two owner files that the baseline records against file order`,
    [
      `not-judged`,
      `authored not-judged`,
      `baseline records against file order name another first changed test`,
    ],
    { baselineOrder: [1, 0, 0], effect: { kind: `changed` }, authored: [{}] },
  ),
  // The same, with names that differ only by a tail (`t0` and `t0 t0`),
  // declared and recorded against file order: a random seed on main found
  // this shape when the model followed the declaration order.
  twoOwners(
    `a value changed in two owner files whose test names differ by a tail`,
    [
      `not-judged`,
      `authored not-judged`,
      `owners declared against file order name another first changed test`,
      `baseline records against file order name another first changed test`,
    ],
    {
      owners: [1, 0],
      baselineOrder: [1, 0, 0],
      second: { label: ``, tail: ` t0` },
      effect: { kind: `changed` },
      authored: [{}],
    },
  ),
  // Two tests of one file change a value, and a mutant run records the
  // second first.
  single(
    `two changed values that a mutant run records against the baseline's order`,
    [
      `not-judged`,
      `authored not-judged`,
      `a mutant run's records against the baseline's name another first changed test`,
    ],
    {
      effect: { kind: `changed` },
      test: { runOrder: 1 },
      more: [plainTest({ kind: `changed` }, { label: `it's ` })],
      authored: [{}],
    },
  ),
  twoOwners(
    `random-only kills in two owner files declared against file order`,
    [
      `random-only-kill`,
      `authored random-only-kill`,
      `owners declared against file order name another first failing test`,
    ],
    {
      owners: [1, 0],
      effect: { kind: `verdict`, firedAt: `random seed` },
      authored: [{}],
    },
  ),
  twoOwners(
    `random-only kills in two owner files that the baseline records against file order`,
    [
      `random-only-kill`,
      `baseline records against file order name another first failing test`,
    ],
    {
      baselineOrder: [1, 0, 0],
      effect: { kind: `verdict`, firedAt: `random seed` },
    },
  ),
  twoOwners(
    `an if infected in two owner files that the baseline records against file order`,
    [
      `not-observed`,
      `baseline records against file order name another first infecting test`,
    ],
    { baselineOrder: [1, 0, 0], mutant: { operator: `if-true` } },
  ),
  // Two files fail with no mutant active, and the baseline records them in
  // another order than their paths', which a locale order would also
  // change (`F1` before `f0` by code unit).
  twoOwners(
    `two files that fail with no mutant active, recorded and named against file order`,
    [
      `a baseline failing test`,
      `baseline records list the failing files against file order`,
      `a locale order lists the failing files another way`,
    ],
    { fileStems: [`f0`, `F1`, `f2`], baseline: `test` },
  ),
  // Owner files that a locale order sorts another way: `f-2` before `f_2`
  // by code unit, after it in a locale.
  twoOwners(
    `a value changed in owner files that a locale order sorts another way`,
    [`not-judged`, `a locale order lists the owner files another way`],
    { fileStems: [`f_2`, `f-2`, `f0`], effect: { kind: `changed` } },
  ),
  // Both owner files kill, under different laws: the laws a kill names are
  // the first file's in report order.
  twoOwners(
    `two owner files that kill under different laws`,
    [`killed`, `two owner files kill under different laws`],
    {
      effect: { kind: `verdict` },
      second: {
        under: slots({
          kind: `verdict`,
          law: `M`,
          firedAt: undefined,
          work: 0,
          ms: 0,
        }),
      },
    },
  ),
  // `>` and `>=` agree on both pairs, so the comparison is not infected.
  twoOwners(
    `a comparison's operands in two owner files that the baseline records against file order`,
    [
      `not-infected`,
      `baseline records against file order name another first operand pair`,
    ],
    {
      baselineOrder: [1, 0, 0],
      mutant: { operator: `binary-swap`, original: `>` },
      test: { pair: four([1, 2]) },
      second: { pair: four([0, 2]) },
    },
  ),
  twoOwners(
    `nondeterministic tests in two owner files that the baseline records against file order`,
    [
      `indeterminate`,
      `baseline records against file order name another first nondeterministic test`,
      `baseline records list the nondeterministic tests against file order`,
    ],
    { baselineOrder: [1, 0, 0], test: { flaky: true } },
  ),
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
  single(
    `a comparison that only an input outside its annotation distinguishes`,
    [`outside-annotation`],
    {
      mutant: {
        operator: `binary-swap`,
        original: `>`,
        outside: `a string of the literal's digits`,
      },
    },
  ),
  single(`a logical swap that is dead code`, [`dead-code`], {
    mutant: {
      operator: `binary-swap`,
      original: `&&`,
      evidence: `dead code`,
    },
  }),
  // The field witness (issue 2254): an infected survivor that no recorded
  // observation shows. Its message named the exits the report offered.
  single(`an infected survivor that no observation shows`, [`not-observed`], {
    mutant: { operator: `binary-swap`, original: `>` },
    test: { pair: four([2, 2]) },
  }),
  single(
    `a survivor an ordinary test fails`,
    [`not-observed`, `ordinary killed`],
    {
      mutant: { operator: `binary-swap`, original: `>` },
      test: { pair: four([2, 2]) },
      ordinary: true,
    },
  ),
  // An if-false whose condition was always true is infected (its forced
  // outcome changes the value), so it is not a branch never taken.
  single(`an if-false that always saw true`, [`not-observed`], {
    mutant: { operator: `if-false` },
    test: { seen: four(`true`) },
  }),
  // Operators whose infection is not measured name the input that
  // distinguishes them.
  single(`a logical swap is not distinguished`, [`not-distinguished`], {
    mutant: { operator: `binary-swap`, original: `&&` },
  }),
  single(`a loop-false is not distinguished`, [`not-distinguished`], {
    mutant: { operator: `loop-false` },
  }),
  // Infected at module load only: loaded code reaches every test of the file,
  // so the comparison is not not-infected.
  single(`a comparison infected only at module load`, [`not-observed`], {
    mutant: { operator: `binary-swap`, original: `>` },
    test: { pair: four([1, 2]) },
    background: four(true),
    backgroundInfects: four(true),
  }),
  single(`a key with backticks`, [`a key with backticks`], {
    mutant: { anchor: `x \`\` y` },
    effect: { kind: `changed` },
  }),
  // Authored mutants: judged by every test of their owners.
  single(`an authored mutant no observation shows`, [`authored not-observed`], {
    authored: [{ intent: intents[1] }],
  }),
  single(`an authored mutant that changes a value`, [`authored not-judged`], {
    effect: { kind: `changed` },
    authored: [{}],
  }),
  single(`an authored mutant a verdict rejects`, [`authored killed`], {
    effect: { kind: `verdict` },
    authored: [{}],
  }),
  single(
    `an authored mutant that does not apply`,
    [`authored does-not-apply`],
    {
      authored: [{ applies: false }],
    },
  ),
  single(`an authored mutant with no owner`, [`authored unowned`], {
    authored: [{ owners: [] }],
  }),
  // Law 8: code past the cut and across lines, and an intent past it.
  single(
    `a gap whose code is long and spans lines`,
    [`a gap line cut at 60 characters`, `a gap line of code on several lines`],
    { mutant: { code: codes[4] } },
  ),
  single(`a gap whose code is exactly 60 characters`, [`not-distinguished`], {
    mutant: { code: codes[2] },
  }),
  single(
    `a gap whose code is 61 characters`,
    [`a gap line cut at 60 characters`],
    {
      mutant: { code: codes[3] },
    },
  ),
  // Law 7: operands whose String() texts agree, in one not-infected
  // message: the string "0" and the number 0, and two long strings that
  // share their first 40 characters. `>` and `>=` agree on each pair.
  single(
    `operands that String conflates`,
    [`not-infected`, `not-infected operands that String conflates`],
    {
      mutant: { operator: `binary-swap`, original: `>` },
      test: { pair: four([`0`, 1]) },
      more: [
        plainTest({}, { pair: four([0, 1]) }),
        plainTest({}, { pair: four([`${longText}one`, `true`]) }),
      ],
    },
  ),
  single(
    `negative zero and zero`,
    [`not-infected operands that String conflates`],
    {
      mutant: { operator: `binary-swap`, original: `>` },
      test: { pair: four([-0, 1]) },
      more: [plainTest({}, { pair: four([0, 1]) })],
    },
  ),
  single(
    `long operands that share a prefix`,
    [`not-infected operands that String conflates`],
    {
      mutant: { operator: `binary-swap`, original: `>` },
      test: { pair: four([`${longText}one`, `true`]) },
      more: [plainTest({}, { pair: four([`${longText}two`, `true`]) })],
    },
  ),
  // Law 9: a failing test in a suite named with regular-expression syntax,
  // beside a test whose full name contains the failing one's, and a file
  // that does not load.
  single(
    `a failing baseline test in a suite with regex syntax`,
    [
      `a baseline failing test`,
      `a baseline test in a suite named with regex syntax`,
    ],
    {
      baseline: `test`,
      test: { suites: [`s (1)`], label: `(a|b) `, fails: true },
      more: [plainTest({}, { suites: [`$x`, `a.b`], label: `it's ` })],
    },
  ),
  single(
    `a failing baseline test whose name another test's contains`,
    [`a baseline test whose name another test's contains`],
    {
      baseline: `test`,
      test: { suites: [`t0`], fails: true },
      more: [plainTest({}, { suites: [`t0`, `t0`] })],
    },
  ),
  // Another test's name ends with the failing test's.
  single(
    `a failing baseline test whose name ends another test's`,
    [`a baseline test whose name another test's contains`],
    {
      baseline: `test`,
      test: { fails: true },
      more: [plainTest({}, { tail: ` t0` })],
    },
  ),
  // The review round's states: a cut at an astral-plane character in code,
  // an intent, and an operand; an intent with exit words; and test names
  // with a newline and a tab.
  single(
    `a gap whose code is cut at an astral character`,
    [`a gap line cut at an astral character`],
    { mutant: { code: codes[6] } },
  ),
  single(
    `an authored intent cut at an astral character, beside exit words`,
    [
      `a gap line cut at an astral character`,
      `an authored intent with words the exit law forbids`,
    ],
    {
      authored: [{ intent: intents[5] }, { intent: intents[6] }],
    },
  ),
  // Each operand kind a not-infected message can print, three to a message,
  // each beside 2, where `>` and `>=` agree.
  ...[
    [1n, -0, undefined],
    [null, NaN, true],
  ].map((values) =>
    single(
      `operands of the kinds ${values.map(String).join(`, `)}`,
      [`not-infected`, `a not-infected message with typed operands`],
      {
        mutant: { operator: `binary-swap`, original: `>` },
        test: { pair: four([values[0], 2]) },
        more: values.slice(1).map((v) => plainTest({}, { pair: four([v, 2]) })),
      },
    ),
  ),
  single(
    `an operand cut at an astral character`,
    [`not-infected`, `a not-infected operand cut at an astral character`],
    {
      mutant: { operator: `binary-swap`, original: `>` },
      test: { pair: four([typedOperands[20], `true`]) },
    },
  ),
  single(
    `a failing baseline test whose names hold a newline and a tab`,
    [
      `a baseline failing test`,
      `a baseline test whose name holds a newline or a tab`,
    ],
    {
      baseline: `test`,
      test: { suites: [`two\nlines`], label: `tab\there `, fails: true },
      more: [plainTest({}, { suites: [`two\nlines`] })],
    },
  ),
  single(
    `a baseline file that does not load`,
    [`a baseline file that did not load`],
    {
      baseline: `load`,
    },
  ),
]

oracleProperty({
  id: `oracle-gaps.report-classify`,
  law: {
    statement: `From the records of the runs that judged it, each mutant, operator or authored, gets the outcome the law assigns: kills only by law verdicts on reproducible routes, agreement-only, random-only, and unregistered kills, timeouts, crashes, framework and setup errors as gaps, survivors split into not-judged, indeterminate, extra-work, dead-code, outside-annotation, branch-never-taken, not-infected, not-observed, and not-distinguished, and ordinary tests for information only; a test whose property declares a work bound, whose work judges the mutant, and whose work (site evaluations, never time) passes the bound's ratio of its unmutated work reports a verdict under law work bound on its route, and a survivor whose work rose in such a test, with no changed observation, is extra-work, whose directive names that test, both counts, and the bound to declare that rejects it. Every gap has one directive message from its kind's fixed set, with no exit; a not-observed directive also directs a history where the mutated code computes something different, and a not-infected message never prints two different operand values alike. A message or list that names tests or files (a gap's Owners line, the files that failed with no mutant active, and the nondeterministic tests included) names them in report order, by test file path compared by code unit and within a file in the baseline's record order, whatever order the runner joined the baseline's files in, a mutant run wrote a file's records in, or the owners were declared in; an operator mutant's owner files run in that order, and a kill names laws of the first that kills. The summary lists every gap and unowned mutant once with consistent counts; the stdout summary and the streamed gap lines cover every gap once, each on one line with its code or intent cut at 60 characters, and the results keep the full text. Each failing oracle file's baseline replay command, read by a POSIX shell, runs exactly its first failing test under Vitest 4's and Vitest 5's name joins, and the whole file when no test failed.`,
    authority: `The maintainer's gap-check decisions in design runs v11, v14, and v19 (2026-11-04 and 2026-11-05), as for oracle-gaps.report; the oracle rubric's outcome kinds (ORC-006); the frozen design's oracle over the checker's pure core (v19 P10, F4); the maintainer's few-seconds budget for an incremental test run (2026-11-05); the maintainer's findings F22 and the leftovers of #12 (2026-11-10); for the work law, the maintainer's decision of 2026-11-12 that a speed shortcut reported as not-observed is a gap CLI bug, and the design decided with it: a cost law, never an exit, judged by a deterministic count; for report order, the gap CLI's determinism requirement (oracle-gaps.report's determinism test and law 9, and the runner's "listed alike in every run") and the maintainer's decision of 2026-11-11 that the tests a report names depend on neither --contexts, worker timing, nor how owners are declared; Vitest's runner (@vitest/runner 4.1: -t is a regular expression matched against getTaskFullName, the suites' names and the test's joined by a space); POSIX.1-2017 Shell Command Language 2.2 and 2.6 for the replay's quoting.`,
    limits: `That real runs produce these records is oracle-gaps.report's, and so is a real replay. The driver encodes operands as capture-setup.mjs \`shown\` does, by a copy of it; long strings are told apart by a 32-bit digest; no symbol operand is generated, and two symbols of one description print alike. Only the runner's single-file path records a test's names, and only it feeds the baseline. Test names hold no backtick and no \` > \`, and names within a file are distinct; the replay's file argument is judged as text, not as Vitest's substring filter over every file. Authored intents hold no word that the exit law forbids, and an author is not shortened. Report order within a file is the baseline's record order: that a file whose tests run concurrently writes its records in one order is not judged, and a failing test is ordered within its file as the reporter lists it, which a run cut off by a hang takes from the records. The "Changed observations in" list is the changed tests' first three, and only its first is compared. A test that only a mutant run records is not generated. A file that fails with no mutant active keeps its records and its mutants are classified; the refusal text and the summary's left-out list are not judged, only the list of failing files they print. Work arrives as counts: that the capture counts site evaluations, and which work it does not count, is oracle-gaps.report's; a test that reaches a site but did no work is generated, which no real run records; an authored mutant's copy counts no work, so the work law does not judge it.`,
  },
  histories: {
    arbitrary: records,
    states: required,
    // An authored mutant's other outcomes, measured.
    measured: [
      ...[
        `timeout`,
        `agreement-only-kill`,
        `unregistered-kill`,
        `crashed`,
        `framework-error`,
        `setup-error`,
      ].map((kind) => `authored ${kind}`),
    ],
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
