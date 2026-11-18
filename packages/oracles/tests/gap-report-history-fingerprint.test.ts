import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { version as vitestVersion } from 'vitest/package.json'
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
// campaign draws 2 histories, and those resolve as on main.
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

  // The constructed histories of the end-to-end gap oracle, in the order the
  // oracle registers them: each one is built from the fixed seed and its index
  // (`seed + index`), so a history inserted before a recorded one changes every
  // later history's draw. The register's rule (C-6, ratified) appends new
  // constructed histories at the end. The recorded names are the list the
  // oracle registered on main, with any entry a pull request renamed in place
  // (a rename keeps its index, so no base moves; #90 renamed the witness
  // sequence's first half). The current list must begin with them, so a new
  // name can only follow. The canary cannot see an edit to its own record:
  // it guards an insertion only while a review keeps the record to main's.
  // The gap oracle loads under Vitest 4; the Vitest 5 job runs no gap oracle
  // (its listing finds no suite in this file), so the canary runs there only
  // where the file loads.
  const gapOracleLoads = Number(vitestVersion.split(`.`)[0]) < 5
  test.skipIf(!gapOracleLoads)(
    `appends new constructed histories, and never inserts one before a recorded one`,
    () => {
      const recorded = JSON.parse(
        readFileSync(
          new URL(`../oracle-gaps/constructed-order.json`, import.meta.url),
          `utf8`,
        ),
      ) as { constructed: Array<string> }
      // Vitest writes the listing to a file, so no package manager's stdout
      // line can reach the JSON (as pr-shards.mjs does).
      const dir = mkdtempSync(join(tmpdir(), `constructed-order-`))
      let tests: Array<{ name: string }>
      try {
        const file = join(dir, `list.json`)
        const packageDir = dirname(
          createRequire(import.meta.url).resolve(`vitest/package.json`),
        )
        const listing = spawnSync(
          process.execPath,
          [
            join(packageDir, `vitest.mjs`),
            `list`,
            `--json=${file}`,
            `--config`,
            `oracle-gaps/vitest.config.mjs`,
            `gap-report-oracle`,
          ],
          {
            cwd: fileURLToPath(new URL(`..`, import.meta.url)),
            encoding: `utf8`,
            maxBuffer: 64 * 1024 * 1024,
          },
        )
        expect(listing.status, listing.stderr).toBe(0)
        tests = JSON.parse(readFileSync(file, `utf8`)) as Array<{
          name: string
        }>
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
      const unit = `oracle-gaps.report > fixed seed ${FIXED_SEED}: `
      const current = tests
        .map(({ name }) => name)
        .filter((name) => name.startsWith(unit))
        .map((name) => name.slice(unit.length))
        .filter((name) => name !== `generated`)
      expect(current.slice(0, recorded.constructed.length)).toEqual(
        recorded.constructed,
      )
    },
  )

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
    for (const seed of [FIXED_SEED, 1, 2]) {
      const samples = fc.sample(drawn, { seed, numRuns: DRAWS }) as Array<
        Record<string, unknown> & { stopRuns: Array<{ when: string }> }
      >
      for (const history of samples) {
        for (const [field, value] of Object.entries(neutral))
          expect([field, history[field]]).toEqual([field, value])
        for (const stop of history.stopRuns) expect(stop.when).not.toBe(`after`)
      }
    }
  })
})
