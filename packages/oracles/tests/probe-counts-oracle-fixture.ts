/**
 * The synthetic properties that the probe-counts oracle runs in a child
 * Vitest process. A history is a list of integers; the driver calls four
 * probes for each item, logs which test ran which history, and observes the
 * items. The check fails a history that holds a 5. Nothing here is judged:
 * `probe-counts-oracle.property.test.ts` is the oracle.
 */
import { appendFileSync } from 'node:fs'
import fc from 'fast-check'
import { expect } from 'vitest'
import { oracleProperty, pass, violation } from '../src/index.js'

/**
 * The probes the driver calls for each item, with their conditions: `even`
 * when the item is even, `item` with the item itself (truthy unless 0),
 * `unlisted` with true. `never` is never called.
 */
export const syntheticProbes = [
  `s#even`,
  `s#item`,
  `s#never`,
  `s#unlisted`,
] as const
export type SyntheticProbe = (typeof syntheticProbes)[number]

export interface Synthetic {
  /** The `counted` option, absent when undefined. */
  counted?: ReadonlyArray<SyntheticProbe>
  runs: number
  /** Whether the property has a fixed-seed campaign, at the history's seed. */
  fixedSeed: boolean
  /** The items are integers between `low` and `high`, in either order. */
  low: number
  high: number
  minLength: number
  /** How many items a history may hold beyond `minLength`. */
  extra: number
}

export const syntheticId = (index: number) => `probe-counts.synthetic-${index}`

/** Registers synthetic property `index` with its campaigns at `seed`. */
export function syntheticProperty(
  spec: Synthetic,
  index: number,
  seed: number,
): void {
  const id = syntheticId(index)
  oracleProperty({
    id,
    law: {
      statement: `A history holds no 5.`,
      authority: `synthetic`,
      limits: `synthetic`,
    },
    histories: {
      arbitrary: fc.array(
        fc.integer({
          min: Math.min(spec.low, spec.high),
          max: Math.max(spec.low, spec.high),
        }),
        { minLength: spec.minLength, maxLength: spec.minLength + spec.extra },
      ),
      runs: spec.runs,
      fixedSeeds: spec.fixedSeed ? [seed] : [],
      ...(spec.counted ? { counted: spec.counted } : {}),
    },
    model: (items: ReadonlyArray<number>) => items,
    driver: (items: ReadonlyArray<number>, observe) => {
      // The probe form production uses, guarded in the probing function.
      const probing =
        typeof process === `undefined`
          ? false
          : process.env.NODE_ENV !== `production`
      for (const item of items) {
        probing && globalThis.__oracleProbe?.(`s#even`, item % 2 === 0)
        probing && globalThis.__oracleProbe?.(`s#item`, item)
        probing && globalThis.__oracleProbe?.(`s#unlisted`, true)
      }
      appendFileSync(
        process.env.PROBE_COUNTS_LOG!,
        `${JSON.stringify({ test: expect.getState().currentTestName, items })}\n`,
      )
      observe(`items`, items)
    },
    check: (items) =>
      items.includes(5)
        ? violation(`items`, `the history holds a 5`, `no five`)
        : pass,
  })
}
