// The gap report's classification: what each mutant's outcome is, from the
// plain records of the runs that judged it (check.mjs runs them). Every
// function here is pure, so the CLI's own oracle, in its repository, checks
// the classification on generated records in-process.
//
// A run record (a unit) holds one test file's tests under one mutant: each
// test's state and error text, its setup and unhandled errors, whether it
// timed out, and its capture rows (capture-setup.mjs): the sites each test
// reached, the outcomes each `if` took, the hashes of what it asserted on
// and observed, its registered route, and its law verdicts.
import { codeSpan } from './stream.mjs'

// Which kind of test produced a failure: the route the framework registered
// for it through `__oracleRoute` (capture-setup.mjs), never its name. A kill
// counts only on a reproducible route. The random campaign draws a new seed
// in every CI run, so a kill only it finds is a gap until it is kept as a
// fixed history. The `calibration` route (calibrations, probe calibrations,
// and the determinism test) checks the oracle itself, not the law. The names
// are the framework's route vocabulary (oracle-route.ts); a test that
// registered no route, or a name outside it, has an unknown one, and cannot
// kill.
export const reproducibleRoutes = new Set([
  `fixed seed`,
  `fixed history`,
  `case`,
])
const frameworkRoutes = new Set([`calibration`])
function routeOf(registered) {
  if (registered === undefined) return `unknown`
  if (reproducibleRoutes.has(registered)) return `reproducible`
  if (registered === `random seed`) return `random`
  if (frameworkRoutes.has(registered)) return `framework`
  return `unknown`
}

/**
 * A mutant's outcome from its units. A test whose observations varied
 * between the two unmutated runs is nondeterministic: its failures judge
 * nothing, so a mutant that only such tests fail is not killed.
 */
export function outcomeOf(
  units,
  nondeterministic = new Set(),
  assertions = false,
) {
  // A run that timed out recorded nothing. A kill in another run still
  // decides; failing that, the mutant is `timeout`.
  const timeout = units.some((unit) => unit.timedOut)
    ? { outcome: `timeout`, detail: `run time limit` }
    : undefined
  const failures = []
  // By file path (report order, `inReportOrder`), in whatever order the
  // runner gathered the units.
  for (const unit of [...units].sort((a, b) => byPath(a.file, b.file))) {
    if (unit.timedOut) continue
    const rows = new Map(unit.rows)
    for (const message of unit.setupErrors)
      failures.push({ setup: true, message })
    for (const test of unit.tests) {
      if (test.state !== `failed`) continue
      if (nondeterministic.has(test.key)) continue
      const row = rows.get(test.key)
      // Each verdict keeps the route active when it fired.
      const verdicts = (row?.verdicts ?? []).map((v) => ({
        ...v,
        route: routeOf(v.route ?? row?.route),
      }))
      failures.push({
        test: test.fullName,
        route: routeOf(row?.route),
        verdicts,
        assertion:
          // fast-check's wrapper text ("Property failed …") is not an
          // assertion; the wrapped error, which its message quotes, decides.
          /AssertionError|expected .+ to /.test(test.message),
        timeout: /Test timed out/.test(test.message),
        // fast-check quotes the error its predicate threw after its own
        // header; that error is the cause the report shows.
        message: (
          test.message.match(/Got error: (.*)/)?.[1] ?? test.message
        ).slice(0, 300),
      })
    }
    for (const message of unit.unhandled) failures.push({ message })
  }
  if (failures.length === 0) return timeout ?? { outcome: `survived` }
  const judged = (route) =>
    failures
      .filter(
        (f) =>
          f.verdicts?.some((v) => v.route === route) ||
          (assertions &&
            f.assertion &&
            f.route === route &&
            f.route !== `framework`),
      )
      .map((f) => ({
        ...f,
        verdicts: f.verdicts.filter((v) => v.route === route),
      }))
  const lawsOf = (rows) => [
    ...new Set(rows.flatMap((f) => f.verdicts.map((v) => v.law))),
  ]
  const reproducible = judged(`reproducible`)
  const random = judged(`random`)
  const unregistered = judged(`unknown`)
  // A behavioral verdict on a reproducible route kills: any law but reach
  // agreement, or an ordinary test's assertion. Reach agreement alone shows
  // that production took another path, not that any behavioral law saw a
  // different result.
  const behavioral = (law) => law !== `reach agreement`
  const killing = reproducible.filter(
    (f) => f.verdicts.some((v) => behavioral(v.law)) || f.verdicts.length === 0,
  )
  if (killing.length > 0)
    return {
      outcome: `killed`,
      by: killing.map((f) => f.test),
      laws: lawsOf(killing).filter(behavioral),
      randomAlso: random.length > 0,
    }
  if (timeout) return timeout
  if (reproducible.length > 0)
    return {
      outcome: `agreement-only-kill`,
      by: reproducible.map((f) => f.test),
      laws: lawsOf(reproducible),
    }
  if (random.length > 0)
    return {
      outcome: `random-only-kill`,
      by: random.map((f) => f.test),
      laws: lawsOf(random),
    }
  if (unregistered.length > 0)
    return {
      outcome: `unregistered-kill`,
      by: unregistered.map((f) => f.test),
      laws: lawsOf(unregistered),
    }
  const tests = failures.filter((f) => f.test)
  if (tests.length > 0 && tests.every((f) => f.timeout))
    return { outcome: `timeout`, by: tests.map((f) => f.test) }
  const crashed = tests.filter((f) => f.route !== `framework` && !f.timeout)
  if (crashed.length > 0)
    return {
      outcome: `crashed`,
      by: crashed.map((f) => f.test),
      detail: crashed[0].message,
    }
  if (tests.length > 0)
    return {
      outcome: `framework-error`,
      by: tests.map((f) => f.test),
      detail: tests[0].message,
    }
  return { outcome: `setup-error`, detail: failures[0].message }
}

const fileOf = (key) => key.split(` > `)[0]
const byPath = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

// Report order, the order of every list of tests that a result names: by
// test file path, and within a file in the order of the baseline run's
// records of that file's tests, with a test the baseline did not record
// after them. An unmutated pass's units and records are joined in report
// order (`passOf`), so the files that failed, the nondeterministic tests,
// and the tests that reached a mutant (and so its owner files, the test
// that infected it, its operands, and its nondeterministic tests) are in it.
// A mutant's changed tests are put in it here. Its failing tests are by
// file path too (`outcomeOf`), and within a file in the order the reporter
// lists the file's tests, except in a batch that a hang cut off, whose tests
// come from the run's records. The runner joins the baseline's files in an
// order that depends on its context count, and an authored mutant's owner
// files in the order the owners were declared; this order depends on
// neither, so the same project and code give the same report on any machine
// (the classify oracle's law 7).
const inReportOrder = (keys, baseline) =>
  [...keys].sort(
    (a, b) =>
      byPath(fileOf(a), fileOf(b)) ||
      (baseline.rank.get(a) ?? Infinity) - (baseline.rank.get(b) ?? Infinity) ||
      0,
  )

/** A unit's first failure: a failing test and its error, or why it did not run. */
function failureOf(unit) {
  if (unit.timedOut) return `its run timed out`
  const test = unit.tests.find((t) => t.state === `failed`)
  const text = test
    ? `${test.fullName}: ${test.message.split(`\n`)[0]}`
    : (unit.setupErrors[0] ?? unit.unhandled[0] ?? `it failed`)
  return text.slice(0, 300)
}

/**
 * An unmutated pass from its contexts' units (one list per context): its
 * units and records in report order (by file path, each file's records in
 * the order its run wrote them), and each file that
 * failed with no mutant active, in that order, with its first failure, so a
 * refusal says why. The contexts' order depends on their count; this order
 * does not, so the refusal, the files left out, and the nondeterministic
 * tests are listed alike on any machine.
 */
export function passOf(parts) {
  const units = parts.flat().sort((a, b) => byPath(a.file, b.file))
  return {
    units,
    rows: new Map(units.flatMap((u) => u.rows ?? [])),
    failed: new Map(
      units
        .filter((u) => outcomeOf([u]).outcome !== `survived`)
        .map((u) => [u.file, failureOf(u)]),
    ),
  }
}

/**
 * What the two unmutated runs show: which tests are nondeterministic (their
 * values differed between the runs, so their failures judge nothing), which
 * tests reached each site, and which `if` outcomes each oracle file saw. The
 * first run's records come in report order (`passOf`), and so do these lists.
 */
export function baselineOf(firstRows, secondRows) {
  const nondeterministic = new Set()
  for (const [key, row] of firstRows) {
    const again = secondRows.get(key)
    if (
      !row.background &&
      (again?.hash !== row.hash || again?.observed !== row.observed)
    )
      nondeterministic.add(key)
  }
  const reachedBy = new Map()
  for (const [key, row] of firstRows)
    for (const id of row.hits)
      reachedBy.set(id, [...(reachedBy.get(id) ?? []), key])
  const rank = new Map([...firstRows.keys()].map((key, i) => [key, i]))
  return { firstRows, nondeterministic, reachedBy, rank }
}

/**
 * The owner tests and the ordinary tests that reached a mutant's site, in
 * report order: the baseline's order, which `passOf` joined.
 */
export function targetsOf(mutant, baseline, owners, oracleFiles) {
  const keys = baseline.reachedBy.get(mutant.number) ?? []
  const oracleKeys = keys.filter((k) => owners.has(fileOf(k)))
  const testKeys = keys.filter((k) => !oracleFiles.has(fileOf(k)))
  return {
    oracleKeys,
    testKeys,
    oracleTargets: [...new Set(oracleKeys.map(fileOf))],
    testTargets: [...new Set(testKeys.map(fileOf))],
  }
}

// The operators the capture measures: an `if`'s condition (its forced value
// changes the condition only where the condition took the other outcome), a
// comparison's operands (its operators disagree on them), and the operators
// that always change a value when reached (`!`, booleans, arithmetic). The
// rest are not measured: a logical operator, a loop's condition, an
// `undefined` call value, a dropped property, a skipped call, a returned
// value made `undefined`, and a plain read in place of `?.` change a value
// only on some inputs, and no capture shows which.
const comparisonOps = new Set([`===`, `!==`, `<`, `<=`, `>`, `>=`])
const unmeasuredOps = new Set([
  `loop-false`,
  `value-undefined`,
  `field-drop`,
  `delete-call`,
  `return-undefined`,
  `optional-chain`,
])
const isIf = (mutant) =>
  mutant.operator === `if-true` || mutant.operator === `if-false`
const isComparison = (mutant) =>
  mutant.operator === `binary-swap` && comparisonOps.has(mutant.original)
const isUnmeasured = (mutant) =>
  unmeasuredOps.has(mutant.operator) ||
  (mutant.operator === `binary-swap` && !isComparison(mutant))

// Whether a deterministic owner test, or the loaded code of an owner file,
// infected the mutant (the capture's `infected` rows; a nondeterministic
// test's infection judges nothing). `infectedBy` names the first owner test
// with one; undefined when only loaded code did.
function infectionOf(mutant, targets, baseline) {
  const id = mutant.number
  const infected = targets.oracleKeys.filter(
    (k) =>
      !baseline.nondeterministic.has(k) &&
      baseline.firstRows.get(k)?.infected?.includes(id),
  )
  const test = infected.find((k) => !k.endsWith(` > (background)`))
  return { infected: infected.length > 0, infectedBy: test }
}

/**
 * An operand as the capture recorded it (capture-setup.mjs `shown`), as a
 * typed text: a string quoted, with a digest after a long one's cut, a bigint
 * with `n`, a number as JavaScript prints it but `-0`, and a value that is
 * not a primitive as its type in parentheses. Two values the capture records
 * differently never print alike.
 */
export function operandText([kind, text, digest]) {
  if (text === undefined) return `(${kind})`
  if (kind === `string`)
    return digest === undefined
      ? JSON.stringify(text)
      : `${JSON.stringify(`${text}...`)}#${digest}`
  return kind === `bigint` ? `${text}n` : text
}

// The operand pairs that the owner tests' comparison recorded for a mutant,
// as code spans: distinct, in test order, up to three. A nondeterministic
// test's do not count.
function operandsOf(mutant, targets, baseline) {
  const pairs = []
  for (const k of targets.oracleKeys)
    if (!baseline.nondeterministic.has(k))
      for (const [id, pair] of baseline.firstRows.get(k)?.operands ?? [])
        if (id === mutant.number)
          pairs.push(pair.map((o) => codeSpan(operandText(o))).join(` and `))
  return [...new Set(pairs)].slice(0, 3)
}

// A changed asserted value or a changed property observation, with no
// failure, is a difference that the check did not judge. In report order,
// not in the order the mutant's runs wrote their records.
const changedIn = (rows, keys, baseline) =>
  inReportOrder(
    keys.filter(
      (k) =>
        rows.get(k)?.hash !== baseline.firstRows.get(k)?.hash ||
        rows.get(k)?.observed !== baseline.firstRows.get(k)?.observed,
    ),
    baseline,
  )

/**
 * An operator mutant's outcome from the units of its owner files. A mutant
 * with no owner is `unowned`, and one that no owner test reached is
 * `unreached`. A survivor gets one class from what the run measured (the
 * classes are in the design's decision 11): `not-judged` (a changed value
 * no law rejected), `indeterminate` (only nondeterministic tests reached
 * it), `dead-code` (no input distinguishes it), `outside-annotation` (no
 * input of the annotations distinguishes it; `input` names the input class
 * outside them that does), `branch-never-taken` (an
 * `if` one of whose outcomes never occurred; `wanted` names the missing
 * one), `not-infected` (a comparison whose operators agreed on every
 * operand the owners reached; `operands` names them), and `not-observed`
 * (infected, and no recorded observation changed; `infectedBy` names the
 * test that infected it).
 */
export function judgeMutant(mutant, { owners, targets, units, baseline }) {
  if (owners.size === 0) return { outcome: `unowned` }
  if (targets.oracleKeys.length === 0) return { outcome: `unreached` }
  const result = {
    ...outcomeOf(units, baseline.nondeterministic),
    seconds: units.reduce((sum, u) => sum + u.seconds, 0),
  }
  if (result.outcome !== `survived`) return result
  const rows = new Map(units.flatMap((u) => u.rows ?? []))
  // Only owner tests that reach the site can judge it. Code that ran when a
  // file loaded the module reaches every test of that file (maintainer
  // decision, 2026-11-06).
  const reaching = new Set(targets.oracleKeys)
  const loadedIn = new Set(
    targets.oracleKeys.filter((k) => k.endsWith(` > (background)`)).map(fileOf),
  )
  const compared = [...rows.keys()].filter(
    (k) =>
      (reaching.has(k) || loadedIn.has(fileOf(k))) &&
      !rows.get(k).background &&
      !baseline.nondeterministic.has(k),
  )
  result.changedTests = changedIn(rows, compared, baseline)
  if (result.changedTests.length > 0) result.class = `not-judged`
  else if (compared.length === 0) {
    result.class = `indeterminate`
    result.nondeterministicBy = targets.oracleKeys.filter((k) =>
      baseline.nondeterministic.has(k),
    )
  } else if (mutant.evidence === `dead code`) result.class = `dead-code`
  else if (mutant.outside) {
    // No input of the annotations distinguishes it: the type analysis names
    // the input outside them that does (maintainer decision, 2026-11-11).
    result.class = `outside-annotation`
    result.input = mutant.outside
  } else if (isUnmeasured(mutant)) result.class = `not-distinguished`
  else {
    const { infected, infectedBy } = infectionOf(mutant, targets, baseline)
    if (isIf(mutant) && !infected) {
      // The mutant changes its condition only where the condition took the
      // other outcome: an if-true where it was false, an if-false where true.
      result.class = `branch-never-taken`
      result.wanted = mutant.operator === `if-true` ? `false` : `true`
    } else if (isComparison(mutant) && !infected) {
      result.class = `not-infected`
      result.operands = operandsOf(mutant, targets, baseline)
    } else {
      result.class = `not-observed`
      result.infectedBy = infectedBy
    }
  }
  return result
}

/** Whether the ordinary tests run, for information: only for a survivor. */
export const needsOrdinary = (result, targets) =>
  (result.outcome === `survived` || result.outcome === `unreached`) &&
  targets.testKeys.length > 0

/**
 * The ordinary tests' outcome. They have no verdicts, so their assertions
 * are reported; an ordinary test never closes a gap.
 */
export const judgeOrdinary = (units) =>
  outcomeOf(units, new Set(), true).outcome

/**
 * An authored mutant's outcome from its owners' units. Its copy is not
 * instrumented, so no `if` outcomes or infections are measured for it: a
 * survivor is `not-judged` (a changed observation) or `not-observed`.
 */
export function judgeAuthored(units, baseline) {
  const result = {
    ...outcomeOf(units, baseline.nondeterministic),
    seconds: units.reduce((sum, u) => sum + u.seconds, 0),
  }
  if (result.outcome !== `survived`) return result
  const rows = new Map(units.flatMap((u) => u.rows ?? []))
  result.changedTests = changedIn(
    rows,
    [...rows.keys()].filter(
      (k) => !rows.get(k).background && !baseline.nondeterministic.has(k),
    ),
    baseline,
  )
  // An authored mutant is not instrumented, so only its changed observations
  // are measured: the rest is `not-observed`, the patch changed the code.
  result.class = result.changedTests.length > 0 ? `not-judged` : `not-observed`
  return result
}
