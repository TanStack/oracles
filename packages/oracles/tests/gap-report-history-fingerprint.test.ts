import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { drawn, histories } from '../oracle-gaps/gap-report-model-oracle.mjs'

// The generator rule (coordinator decision, 2026-11-13): a new field of the
// gap oracle's history grammar is drawn last, so a fixed seed keeps the
// history it had. fast-check draws a record's fields in order, so a field
// inserted before another changes every later field's draws, and a fixed
// seed's counterexample, reach, and replay no longer mean what they did.
// This canary draws the first histories of the fixed seed and compares each
// field's fingerprint with the committed lists (history-fingerprint.json),
// whose first fields are main's: once for the drawn record, and once for
// the histories that the oracle takes, after the grammar's own mapping, so
// a mapping that folds a new field into an old one shows too. A new field
// goes at the end of the grammar and gets its own line at the end of each
// list; no earlier line changes. It guards the fields' draws, not the
// resolved plans: a new field may still change what a plan does (the plan
// takes `laterSteps` after a history's steps). The default fixed-seed
// campaign draws 2 histories, and those resolve as on main. Under M
// "Randomness wins" (2026-11-16) a new field that changes what runs is drawn,
// so the fields after it shift: the PR that adds it records the lists anew
// and reports the fixed seed's reach states lost and gained (#99 drew the
// deterministic-cuts fields).
const FIXED_SEED = 20261105
const DRAWS = 500
// The constructed-only test fields: constants in every drawn test record,
// which no generated history sets. Since M "Randomness wins" (2026-11-16)
// only a field that switches a test-only hook stays one (`pendingIo`); the
// deterministic-cuts fields `slowMs`, `loops`, `timerWait` and `pulse` are
// drawn, and their draws shifted the later fields' lines (recorded anew). A
// test's record hashes without the constructed fields, and each one is
// recorded as its own line after the others, with its neutral value checked.
const CONSTRUCTED_TEST_FIELDS = [`pendingIo`]
const NEUTRAL_TEST_VALUES: Record<string, unknown> = {
  pendingIo: null,
}
type Sample = Record<string, unknown>

const hashOf = (value: unknown): string =>
  createHash(`sha1`).update(JSON.stringify(value)).digest(`hex`).slice(0, 16)

const fingerprints = (
  arbitrary: fc.Arbitrary<unknown>,
): Array<[string, string]> => {
  // Each history is a record of its fields, read here by name.
  const samples = fc.sample(arbitrary, {
    seed: FIXED_SEED,
    numRuns: DRAWS,
  }) as Array<Sample>
  const testsOf = (history: Sample) => history.tests as Array<Sample>
  const withoutConstructed = (record: Sample) =>
    Object.fromEntries(
      Object.entries(record).filter(
        ([key]) => !CONSTRUCTED_TEST_FIELDS.includes(key),
      ),
    )
  const lines: Array<[string, string]> = Object.keys(samples[0] ?? {}).map(
    (key) => [
      key,
      hashOf(
        samples.map((history) =>
          key === `tests`
            ? testsOf(history).map(withoutConstructed)
            : history[key],
        ),
      ),
    ],
  )
  for (const field of CONSTRUCTED_TEST_FIELDS) {
    const values = samples.flatMap((history) =>
      testsOf(history).map((record) => record[field]),
    )
    // Generated tests hold the neutral value: only a constructed history sets it.
    expect(values.every((value) => value === NEUTRAL_TEST_VALUES[field])).toBe(
      true,
    )
    lines.push([`tests.${field}`, hashOf(values)])
  }
  return lines
}

describe(`the gap oracle's history grammar`, () => {
  test(`draws each recorded field as it was, and new fields only after them`, () => {
    const recorded = JSON.parse(
      readFileSync(
        new URL(`../oracle-gaps/history-fingerprint.json`, import.meta.url),
        `utf8`,
      ),
    ) as Record<`drawn` | `histories`, Array<[string, string]>>
    for (const [kind, arbitrary] of [
      [`drawn`, drawn],
      [`histories`, histories],
    ] as const) {
      const current = fingerprints(arbitrary)
      expect(current.slice(0, recorded[kind].length)).toEqual(recorded[kind])
      // A field added at the end is recorded at the end of the list too.
      expect(current.map(([key]) => key)).toEqual(
        recorded[kind].map(([key]) => key),
      )
    }
  })

  // The maintainer's decision "Randomness wins for new fields" (2026-11-16):
  // a field that changes what a history runs is drawn, except that a drawn
  // field never switches a test-only hook. Each field below switches one
  // (named beside it), so every drawn history holds its neutral value, and no
  // drawn stop is the stop after the completed line, which holds the run's
  // exit (ORACLE_GAPS_TEST_HOLD_UNTIL). The list is written here, not read
  // from the model, so a model that starts to draw one of them fails.
  test(`draws no value that switches a test-only hook`, () => {
    const neutral: Record<string, unknown> = {
      overlap: false, // ORACLE_GAPS_TEST_HOLD_UNTIL
      spawnStop: false, // ORACLE_GAPS_TEST_STARTED
      spawnOnStart: false, // ORACLE_GAPS_TEST_PAUSE_AFTER_STARTED
      logLost: false, // ORACLE_GAPS_TEST_PAUSE_AT=note
      supervisorDeath: false, // ORACLE_GAPS_TEST_PAUSE_AT=child
      unsupervised: false, // ORACLE_GAPS_TEST_UNSUPERVISED
      tornRows: false, // ORACLE_GAPS_TEST_TORN_ROWS
      loadPlugin: false, // LOAD_PLUGIN
      rejectBatch: 0, // ORACLE_GAPS_TEST_REJECT_BATCH
    }
    // A test's own hook switch (#99): what is pending while it waits, which
    // switches ORACLE_GAPS_TEST_SAMPLES, ORACLE_GAPS_TEST_RUNNER_WRITE or
    // ORACLE_GAPS_TEST_RUNNER_TIMER.
    const neutralTest: Record<string, unknown> = { pendingIo: null }
    for (const seed of [FIXED_SEED, 1, 2]) {
      const samples = fc.sample(drawn, { seed, numRuns: DRAWS }) as Array<
        Record<string, unknown> & {
          stopRuns: Array<{ when: string }>
          tests: Array<Record<string, unknown>>
        }
      >
      for (const history of samples) {
        for (const [field, value] of Object.entries(neutral))
          expect([field, history[field]]).toEqual([field, value])
        for (const t of history.tests)
          for (const [field, value] of Object.entries(neutralTest))
            expect([`tests.${field}`, t[field]]).toEqual([
              `tests.${field}`,
              value,
            ])
        for (const stop of history.stopRuns) expect(stop.when).not.toBe(`after`)
      }
    }
  })
})
