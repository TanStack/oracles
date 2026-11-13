import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { drawn } from '../oracle-gaps/gap-report-model-oracle.mjs'

// The generator rule (coordinator decision, 2026-11-13): a new field of the
// gap oracle's history grammar is drawn last, so a fixed seed keeps the
// history it had. fast-check draws a record's fields in order, so a field
// inserted before another changes every later field's draws, and a fixed
// seed's counterexample, reach, and replay no longer mean what they did.
// This canary draws the first histories of the fixed seed and compares each
// field's fingerprint with the committed list (history-fingerprint.json),
// whose first fields are main's. A new field goes at the end of the grammar
// and gets its own line at the end of the list; no earlier line changes.
const FIXED_SEED = 20261105
const DRAWS = 50

const fingerprints = (): Array<[string, string]> => {
  // Each history is a record of its fields, read here by name.
  const samples = fc.sample(drawn, {
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
    ) as Array<[string, string]>
    const current = fingerprints()
    expect(current.slice(0, recorded.length)).toEqual(recorded)
    // A field added at the end is recorded at the end of the list too.
    expect(current.map(([key]) => key)).toEqual(recorded.map(([key]) => key))
  })
})
