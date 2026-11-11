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
 *    seen, the outcome an `if` took). A message never offers an exit:
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
 * 9. Before any mutant, each oracle file's baseline is printed: `pass`, or
 *    `fail` with the command that replays its first failing test. That
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
 * real run writes them correctly is the end-to-end oracle's. The driver
 * encodes operands as the capture does (`shown`); that the capture's
 * encoding is lossless is not judged here, and two long strings are told
 * apart by a 32-bit digest. No symbol operand is generated: two symbols of
 * one description print alike. Only the runner's single-file path
 * (`unit()`) records a test's names, and only it feeds the baseline; units
 * from the batch path carry none. Test names hold no backtick and no ` > `, the
 * names within a file are distinct, and the replay's file argument is judged
 * as text, not as Vitest's substring match over every file. An authored
 * mutant's intent holds no word the exit law forbids, because the stdout
 * prints it as text, and its author is not shortened.
 */
import { createHash } from 'node:crypto'
import fc from 'fast-check'
import { declareOracle } from '../src/oracle-declaration.ts'
import { oracleProperty, pass, violation } from '../src/oracle-property.ts'
import {
  baselineOf,
  judgeAuthored,
  judgeMutant,
  judgeOrdinary,
  needsOrdinary,
  targetsOf,
} from './classify.mjs'
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
// expression and shell syntax, and each oracle file a baseline: it passes,
// a test of it fails with no mutant active, or it does not load.
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
})

const fileName = (index) => `/pkg/tests/f${index}.test.ts`
// A test's names, as the runner reports them: its suites' names, then its
// own. Its own name holds its index, so the names within a file are
// distinct. Its full name joins them with ` > `.
const namesOf = (h, fi, ti) => {
  const t = h.files[fi].tests[ti]
  return [...t.suites, `${t.label}t${ti}${t.tail}`]
}
const nameOf = (h, fi, ti) => namesOf(h, fi, ti).join(` > `)
const keyOf = (h, fi, ti) => `${fileName(fi)} > ${nameOf(h, fi, ti)}`
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

// Laws 2 to 4 over the tests that judge a mutant, read from each test's
// effect in the mutant's slot: the failure's outcome, if a failure decides,
// and the tests that ran (a file that failed to load, or whose run timed
// out, ran none).
function failureOf(h, slot, tests) {
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
  const verdictsOn = (kind) =>
    failing
      .filter(
        (x) =>
          under(x) === `verdict` &&
          kindOf(x.t.under[slot].firedAt ?? x.t.route) === kind,
      )
      .map((x) => x.t.under[slot].law)
  const kills = verdictsOn(`reproducible`)
  const behavioral = kills.filter((law) => law !== `reach agreement`)
  const decided = (failure) => ({ failure, ran })
  if (behavioral.length > 0)
    return decided({
      outcome: `killed`,
      laws: [...new Set(behavioral)].sort(),
      lawsMayBePart: true,
    })
  if (timedOut) return decided({ outcome: `timeout` })
  if (kills.length > 0)
    return decided({
      outcome: `agreement-only-kill`,
      laws: [`reach agreement`],
    })
  if (verdictsOn(`random`).length > 0)
    return decided({ outcome: `random-only-kill` })
  if (verdictsOn(`unknown`).length > 0)
    return decided({ outcome: `unregistered-kill` })
  if (failing.length > 0 && failing.every((x) => under(x) === `timeoutMessage`))
    return decided({ outcome: `timeout` })
  if (
    failing.some(
      (x) => under(x) !== `timeoutMessage` && kindOf(x.t.route) !== `framework`,
    )
  )
    return decided({ outcome: `crashed` })
  if (failing.length > 0) return decided({ outcome: `framework-error` })
  const unhandled = ran.some((x) => under(x) === `unhandled`)
  if (setup || unhandled) return decided({ outcome: `setup-error` })
  return decided(undefined)
}

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
  const { failure, ran } = failureOf(h, mi, tests)
  if (failure) return failure
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
      ...extra,
    })
  if (changed)
    return sized(`not-judged`, {
      mention: [
        `Make a law in \`${shownName(h, changed.fi, changed.ti)}\` reject the changed value.`,
      ],
    })
  if (compared.length === 0) return sized(`indeterminate`)
  if (m.evidence === `dead code`)
    return sized(`dead-code`, { mention: [`line ${m.line + 1}.`] })
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
  const slot = MUTANTS + ai
  if (!a.applies) return { outcome: `does-not-apply` }
  const owners = [
    ...new Set(
      a.owners.filter((fi) => fi < h.files.length && h.files[fi].oracle),
    ),
  ].sort((x, y) => x - y)
  if (owners.length === 0) return { outcome: `unowned` }
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
// The deterministic owner tests, in file order, that reached the mutant.
function reachingTests(h, mi, owners) {
  return [...owners]
    .sort((a, b) => a - b)
    .flatMap((fi) =>
      h.files[fi].tests.flatMap((t, ti) =>
        t.reaches[mi] && !t.flaky ? [{ t, fi, ti }] : [],
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
const baselineOf_ = (h) =>
  h.files.flatMap((f, fi) => {
    if (!f.oracle) return []
    if (f.baseline === `pass`) return [{ fi, fails: false }]
    if (f.baseline === `load`) return [{ fi, fails: true, test: undefined }]
    const first = f.tests.findIndex((t) => t.fails)
    return [{ fi, fails: true, test: first < 0 ? 0 : first }]
  })

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
    /^Observe the value this code changes in (`[^`]+`|the owner tests), and assert on it\. Where the mutated code computes the same result as the original, add a history where it computes something different\.$/,
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
    /^The framework check `[^`]+` failed with `[^`]*`, and a calibration judges no behavior: state the oracle law that decides this input's outcome, and let it reject the change\.$/,
  crashed:
    /^Production threw `[^`]*` in `[^`]+`; record the error as an observation in the driver, and state the law that decides this input's outcome\.$/,
  'not-distinguished':
    /^Add an owner history (where one operand of `[&|]{2}` on line \d+ is falsy and the other is truthy, so `&&` and `\|\|` give different results|where the left operand of `\?\?` on line \d+ is truthy, so `\?\?` and `&&` give different results|that enters the loop on line \d+, so that forcing its condition to false changes an asserted result|where the call on line \d+ returns a value that changes an asserted result when it is `undefined`|that reads the property dropped on line \d+, so that its absence changes an asserted result|where the call on line \d+ changes an asserted result when it does not run), and assert on the result\.$/,
  timeout:
    /^Bound the run of the owner tests so that they end, and let a law reject a run that does not\.$/,
  'setup-error':
    /^Run an owner test that loads this module and asserts on its exports, so a failed load rejects the mutant\.$/,
  'does-not-apply':
    /^Update the `find` text of this authored mutant so that it occurs exactly once in the source\.$/,
}
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
function rowsOf(h, pass) {
  const rows = new Map()
  h.files.forEach((f, fi) => {
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
      })
    })
    rows.set(`${fileName(fi)} > (background)`, {
      key: `${fileName(fi)} > (background)`,
      background: true,
      hits: f.background.flatMap((r, mi) =>
        r && mi < h.mutants.length ? [mi] : [],
      ),
      infected: f.background.flatMap((r, mi) =>
        r && f.backgroundInfects[mi] && mi < h.mutants.length ? [mi] : [],
      ),
    })
  })
  return rows
}
// A file's units under the mutant in effect slot `slot`.
function unitOf(h, fi, slot) {
  const f = h.files[fi]
  const under = (t) => t.under[slot]
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
        key: keyOf(h, fi, ti),
        fullName: nameOf(h, fi, ti),
        state: messages[kind] ? `failed` : `passed`,
        message: messages[kind] ?? ``,
      }
    }),
    rows: tests.map((t, ti) => {
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
  let parent = { type: `module`, moduleId: fileName(fi) }
  for (const name of names.slice(0, -1))
    parent = { type: `suite`, name, parent }
  return { type: `test`, name: names.at(-1), parent }
}
// Each oracle file's baseline, as the runner's first pass gives it to the
// printer: its relative path, its first failure, and its tests, each with
// its state and the names the runner read from its TestCase.
function baselineFiles(h, printer) {
  return h.files.flatMap((f, fi) => {
    if (!f.oracle) return []
    const file = `tests/f${fi}.test.ts`
    if (f.baseline === `load`)
      return [{ file, failure: `Error: cannot load the file`, tests: [] }]
    // A file whose baseline is `test` fails its marked tests, or its first
    // test when none is marked.
    const marked = f.tests.some((t) => t.fails)
    const fails = (t, ti) =>
      f.baseline === `test` && (marked ? t.fails : ti === 0)
    const tests = f.tests.map((t, ti) => ({
      fullName: nameOf(h, fi, ti),
      state: fails(t, ti) ? `failed` : `passed`,
      names: printer?.testNamesOf?.(testCaseOf(h, fi, ti)),
    }))
    const first = tests.find((x) => x.state === `failed`)
    return [
      {
        file,
        failure: first ? `${first.fullName}: Error: violation` : undefined,
        tests,
      },
    ]
  })
}

async function driver(h, observe) {
  const oracleFiles = new Set(
    h.files.flatMap((f, fi) => (f.oracle ? [fileName(fi)] : [])),
  )
  const baseline = baselineOf(rowsOf(h, 1), rowsOf(h, 2))
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
  // Authored mutants, as the runner judges them: one that does not apply
  // and one with no owner are decided before any run; the rest run every
  // test of each owner file, in the owners' order.
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
    ].sort((x, y) => x - y)
    if (!a.applies) result.outcome = `does-not-apply`
    else if (owners.length === 0) result.outcome = `unowned`
    else
      Object.assign(
        result,
        judgeAuthored(
          owners.map((fi) => unitOf(h, fi, MUTANTS + ai)),
          baseline,
        ),
      )
  }
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
    // What results.json keeps of each mutant's change, after the printing.
    kept: results.map((r) =>
      r.authored ? r.intent : [String(r.original), String(r.replacement)],
    ),
  })
  // The baseline the printer shows before any mutant (law 9).
  observe(`baseline`, printer?.baselineLines(baselineFiles(h, printer)) ?? [])
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
    .filter((line) => /^  \S+ L(\d+|\?) (m\d+|authored:a\d+) /.test(line))
  const kinds = new Set(gapsOfModel.map((o) => o.class ?? o.outcome))
  // Gaps are grouped by function, and the authored ones in one group.
  const groupOf = (o) =>
    o.authored ? `authored mutants (src/x.ts)` : `fn ${o.function} (src/x.ts)`
  const functions = new Set(gapsOfModel.map(groupOf))
  const legend = stdout.split(`\n`).filter((line) => /^  [a-z-]+: /.test(line))
  const headings = stdout
    .split(`\n`)
    .filter((line) => line.startsWith(`fn `) || line.startsWith(`authored `))
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
              : // A gap with no line prints `L?` (stream.mjs), a placeholder,
                // not a question.
                exits.test(withoutSpans(stdout).replace(/ L\? /g, ` L `))
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
      unownedFns.set(groupOf(o), (unownedFns.get(groupOf(o)) ?? 0) + 1)
  const unownedLines = stdout
    .split(`\n`)
    .filter((line) => line.startsWith(`  unowned `))
  const unownedText = (group, n) =>
    `  unowned ${group}: ${n} ${n === 1 ? `mutant` : `mutants`}`
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
  // Law 8: each gap line is one line, and shows its change shortened: an
  // operator mutant's original and replacement as two code spans, an
  // authored mutant's intent as a code span and its author. The results keep the full text.
  for (const owed of gapsOfModel) {
    const head = `${owed.class ?? owed.outcome} L${owed.line} ${owed.id} `
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
    const file = `tests/f${owed.fi}.test.ts`
    const at = lines.findIndex(
      (line) => line === `pass ${file}` || line.startsWith(`fail ${file}: `),
    )
    if (at < 0) return breach(`no baseline line for ${file}`)
    if (!owed.fails) {
      if (lines[at] !== `pass ${file}`)
        return breach(`${file} passes, and its line is ${lines[at]}`)
      continue
    }
    if (!lines[at].startsWith(`fail ${file}: `))
      return breach(`${file} fails, and its line is ${lines[at]}`)
    const command = lines[at + 1]?.match(/^  replay: (.*)$/)?.[1]
    const words = command === undefined ? undefined : shellWords(command)
    if (!words)
      return breach(
        `the replay of ${file} is ${JSON.stringify(command)}, which a POSIX shell does not read as plain words`,
      )
    const [vitest, run, target, flag, pattern, ...more] = words
    if (vitest !== `vitest` || run !== `run` || target !== file)
      return breach(`the replay of ${file} is not \`vitest run ${file}\``)
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

declareOracle({
  check: [check, baselineBreach],
  model: [model, modelOutcome, modelAuthored, ordinaryOutcome],
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
  `not-distinguished`,
  `dead-code`,
  `ordinary killed`,
  `a key with backticks`,
  `authored not-observed`,
  `authored not-judged`,
  `authored killed`,
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
  under: slots({ kind: `same`, law: `L`, firedAt: undefined, ...effect }),
  pair: four([0, 1]),
  suites: [],
  label: ``,
  tail: ``,
  fails: false,
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
      },
      ...(ordinary
        ? [
            {
              oracle: false,
              tests: [plainTest({ kind: `assertion` })],
              background: four(false),
              backgroundInfects: four(false),
              baseline: `pass`,
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
                under: slots({
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
    statement: `From the records of the runs that judged it, each mutant, operator or authored, gets the outcome the law assigns: kills only by law verdicts on reproducible routes, agreement-only, random-only, and unregistered kills, timeouts, crashes, framework and setup errors as gaps, survivors split into not-judged, indeterminate, dead-code, branch-never-taken, not-infected, not-observed, and not-distinguished, and ordinary tests for information only. Every gap has one directive message from its kind's fixed set, with no exit; a not-observed directive also directs a history where the mutated code computes something different, and a not-infected message never prints two different operand values alike. The summary lists every gap and unowned mutant once with consistent counts; the stdout summary and the streamed gap lines cover every gap once, each on one line with its code or intent cut at 60 characters, and the results keep the full text. Each failing oracle file's baseline replay command, read by a POSIX shell, runs exactly its first failing test under Vitest 4's and Vitest 5's name joins, and the whole file when no test failed.`,
    authority: `The maintainer's gap-check decisions in design runs v11, v14, and v19 (2026-11-04 and 2026-11-05), as for oracle-gaps.report; the oracle rubric's outcome kinds (ORC-006); the frozen design's oracle over the checker's pure core (v19 P10, F4); the maintainer's few-seconds budget for an incremental test run (2026-11-05); the maintainer's findings F22 and the leftovers of #12 (2026-11-10); Vitest's runner (@vitest/runner 4.1: -t is a regular expression matched against getTaskFullName, the suites' names and the test's joined by a space); POSIX.1-2017 Shell Command Language 2.2 and 2.6 for the replay's quoting.`,
    limits: `That real runs produce these records is oracle-gaps.report's, and so is a real replay. The driver encodes operands as capture-setup.mjs \`shown\` does, by a copy of it; long strings are told apart by a 32-bit digest; no symbol operand is generated, and two symbols of one description print alike. Only the runner's single-file path records a test's names, and only it feeds the baseline. Test names hold no backtick and no \` > \`, and names within a file are distinct; the replay's file argument is judged as text, not as Vitest's substring filter over every file. Authored intents hold no word that the exit law forbids, and an author is not shortened.`,
  },
  histories: {
    arbitrary: records,
    states: required,
    // An authored mutant's other outcomes, measured.
    measured: [
      `timeout`,
      `agreement-only-kill`,
      `random-only-kill`,
      `unregistered-kill`,
      `crashed`,
      `framework-error`,
      `setup-error`,
    ].map((kind) => `authored ${kind}`),
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
