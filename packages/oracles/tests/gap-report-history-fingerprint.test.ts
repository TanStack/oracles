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
// list; no earlier line changes. A constant field that becomes drawn
// (randomness wins for new fields, maintainer decision, 2026-11-16) changes
// its own line and the lines of the fields drawn after it, and no earlier
// one. It guards the fields' draws, not the
// resolved plans: a new field may still change what a plan does (the plan
// takes `laterSteps` after a history's steps). The default fixed-seed
// campaign draws 2 histories; since `warmReplaced`, `testRoot` and
// `loadPlugin` are drawn, those resolve with these fields' draws.
const FIXED_SEED = 20261105
const DRAWS = 500

const fingerprints = (
  arbitrary: fc.Arbitrary<unknown>,
): Array<[string, string]> => {
  // Each history is a record of its fields, read here by name.
  const samples = fc.sample(arbitrary, {
    seed: FIXED_SEED,
    numRuns: DRAWS,
  }) as Array<Record<string, unknown>>
  return Object.keys(samples[0] ?? {}).map((key) => [
    key,
    createHash(`sha1`)
      .update(JSON.stringify(samples.map((history) => history[key])))
      .digest(`hex`)
      .slice(0, 16),
  ])
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

  // Randomness wins for new fields (maintainer decision, 2026-11-16; v21.2
  // R54, I16): a field that changes what a history runs is drawn, except that
  // no drawn field switches a test-only hook on. The hooks are read off what
  // the driver would set for a history, by value, here, not from the model,
  // so a model that starts to draw one fails:
  // - its constant hook fields hold their neutral values (#57's among them);
  // - no step arms a daemon pause: `dieMidCheck` sets ORACLE_GAPS_TEST_PAUSE_AT
  //   (daemon-reply), _PAUSE_MARK, _SERVED_MARK, _WAIT_MS and _WAIT_MARK, and
  //   `resetBeforeRead` sets ORACLE_GAPS_TEST_PAUSE_AT (daemon-read),
  //   _PAUSE_ARM and _SERVED_MARK; `pauseEngages` only disarms those, so it is
  //   no neutral value of its own;
  // - no stop switches a hook: a stop after the completed line holds the run's
  //   exit (ORACLE_GAPS_TEST_HOLD_UNTIL), and a stop while the config warms
  //   waits at the warm probe (ORACLE_GAPS_TEST_WARM_PROBE); on win32 the
  //   driver runs a stop through the test stop file (ORACLE_GAPS_TEST_STOP)
  //   only for a history that sets `hookStops`.
  // It reads `histories`, the histories the oracle takes, at three seeds, and
  // the drawn records, which hold no stop after the completed line at all.
  // `loadPlugin` is fixture text (LOAD_PLUGIN), not a hook, so it is drawn.
  test(`draws no value that switches a test-only hook`, () => {
    const neutral: Record<string, unknown> = {
      overlap: false, // ORACLE_GAPS_TEST_HOLD_UNTIL
      spawnStop: false, // ORACLE_GAPS_TEST_STARTED
      spawnOnStart: false, // ORACLE_GAPS_TEST_PAUSE_AFTER_STARTED
      logLost: false, // ORACLE_GAPS_TEST_PAUSE_AT=note
      supervisorDeath: false, // ORACLE_GAPS_TEST_PAUSE_AT=child
      unsupervised: false, // ORACLE_GAPS_TEST_UNSUPERVISED
      tornRows: false, // ORACLE_GAPS_TEST_TORN_ROWS
      rejectBatch: 0, // ORACLE_GAPS_TEST_REJECT_BATCH
      replyHeld: false, // ORACLE_GAPS_TEST_PAUSE_AT=daemon-check, with a release
      hookStops: false, // ORACLE_GAPS_TEST_STOP on win32
    }
    const hookSteps = [`dieMidCheck`, `resetBeforeRead`]
    const hookStops = [`after`, `warm`]
    for (const seed of [FIXED_SEED, 1, 2]) {
      const samples = fc.sample(histories, { seed, numRuns: DRAWS }) as Array<
        Record<string, unknown> & {
          steps: Array<string> | null
          stopRuns: Array<{ when: string }>
        }
      >
      for (const history of samples) {
        for (const [field, value] of Object.entries(neutral))
          expect([field, history[field]]).toEqual([field, value])
        for (const step of history.steps ?? [])
          expect(hookSteps).not.toContain(step)
        for (const stop of history.stopRuns)
          expect(hookStops).not.toContain(stop.when)
      }
      const records = fc.sample(drawn, { seed, numRuns: DRAWS }) as Array<{
        stopRuns: Array<{ when: string }>
      }>
      for (const record of records)
        for (const stop of record.stopRuns) expect(stop.when).not.toBe(`after`)
    }
  })
})
