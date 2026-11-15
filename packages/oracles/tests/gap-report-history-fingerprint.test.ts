import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
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
  // later history's draw. The register's generator rule (2026-11-14) says new
  // constructed histories are appended at the end. The recorded names are
  // the list the oracle registered on main; the current list must begin with
  // them, so a new name can only follow.
  test(`appends new constructed histories, and never inserts one before a recorded one`, () => {
    const recorded = JSON.parse(
      readFileSync(
        new URL(`../oracle-gaps/constructed-order.json`, import.meta.url),
        `utf8`,
      ),
    ) as { constructed: Array<string> }
    const listing = spawnSync(
      `pnpm`,
      [
        `exec`,
        `vitest`,
        `list`,
        `--json`,
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
    expect(listing.status).toBe(0)
    const tests = JSON.parse(
      listing.stdout.slice(listing.stdout.indexOf(`[`)),
    ) as Array<{ name: string }>
    const unit = `oracle-gaps.report > fixed seed ${FIXED_SEED}: `
    const current = tests
      .map(({ name }) => name)
      .filter((name) => name.startsWith(unit))
      .map((name) => name.slice(unit.length))
      .filter((name) => name !== `generated`)
    expect(current.slice(0, recorded.constructed.length)).toEqual(
      recorded.constructed,
    )
  })
})
