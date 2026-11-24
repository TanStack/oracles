/**
 * This oracle owns `insertSorted`'s promise to keep an ascending array
 * ascending, checked on the index it returns and on the array after the
 * call. It owns `src/insert-sorted.ts#insertSorted`.
 *
 * ```ts
 * insertSorted([1, 3], 2) // → 1, and the array is [1, 2, 3]
 * insertSorted([2, 2], 2) // → 2: after every element equal to the value
 * insertSorted([], 5) // → 0, and the array is [5]
 * ```
 *
 * Where does a value go when the array already holds it? Before the equal
 * elements is as sorted as after them, so a wrong index there still leaves
 * a sorted array: only the returned index tells the two apart.
 *
 * The law, from the doc comment of `insertSorted`: for every ascending array
 * and every value, the value goes after every element equal to it. So the
 * index is the number of elements less than or equal to the value, and the
 * array after the call is the old array with the value at that index.
 *
 * The model counts the elements that are less than or equal to the value,
 * which is not how production finds the place. A history draws any integers
 * and a value, and `resolve` sorts the integers, so every history, shrunk
 * ones too, meets the precondition. Constructed histories put a copy of the
 * value in the array, and empty the array. The driver calls `insertSorted`
 * on a copy of the plan's array, so production cannot change what the model
 * reads, and records the index and the array. The check compares both.
 *
 * Limits: integers from -50 to 50 and arrays of up to 8 elements; `-0`,
 * `NaN` and fractions are not generated.
 */
import fc from 'fast-check'
import { differs, oracleProperty, pass } from '@tanstack/oracles'
import { insertSorted } from '../src/insert-sorted'
import type { Observation } from '@tanstack/oracles'

// The history is what fast-check draws and shrinks; the plan is what runs.
type History = { elements: Array<number>; value: number }
type Plan = { sorted: Array<number>; value: number }
type Expected = { index: number; array: Array<number> }

const integer = fc.integer({ min: -50, max: 50 })
const LAW = `after equal elements`

oracleProperty({
  id: `example.insert-sorted`,
  owns: [`src/insert-sorted.ts#insertSorted`],
  law: {
    statement: `For every ascending array and value, insertSorted puts the value after every element equal to it: it returns the number of elements less than or equal to the value, and the array becomes the old array with the value at that index.`,
    authority: `the doc comment of insertSorted in src/insert-sorted.ts`,
    limits: `Integers from -50 to 50, arrays of up to 8 elements; -0, NaN and fractions are not generated.`,
  },
  histories: {
    arbitrary: fc.record({
      elements: fc.array(integer, { maxLength: 8 }),
      value: integer,
    }),
    runs: 100,
    fixedSeeds: [1],
    states: [`a tie`, `an empty array`],
    constructed: [
      {
        name: `a tie`,
        enters: [`a tie`],
        // Replace the first element, so the length stays in the arbitrary's bounds.
        build: (generated) => ({
          elements: [generated.value, ...generated.elements.slice(1)],
          value: generated.value,
        }),
      },
      {
        name: `an empty array`,
        enters: [`an empty array`],
        build: (generated) => ({ elements: [], value: generated.value }),
      },
    ],
  },
  // Legality lives here: the precondition is an ascending array.
  resolve: (history: History): Plan => ({
    sorted: [...history.elements].sort((a, b) => a - b),
    value: history.value,
  }),
  model: (plan): Expected => {
    const index = plan.sorted.filter((element) => element <= plan.value).length
    return {
      index,
      array: [
        ...plan.sorted.slice(0, index),
        plan.value,
        ...plan.sorted.slice(index),
      ],
    }
  },
  reached: (plan) => [
    ...(plan.sorted.includes(plan.value) ? [`a tie`] : []),
    ...(plan.sorted.length === 0 ? [`an empty array`] : []),
  ],
  driver: (plan, observe) => {
    const array = [...plan.sorted]
    observe(`index`, insertSorted(array, plan.value))
    observe(`array`, array)
  },
  check: (_plan, trace, expected) =>
    differs(`index`, LAW, seen(trace, `index`), expected.index) ??
    differs(`array`, LAW, seen(trace, `array`), expected.array) ??
    pass,
  calibrations: [
    {
      // A wrong design: before the equal elements. Its array is still sorted.
      name: `inserts before equal elements`,
      law: LAW,
      history: { constructed: `a tie` },
      driver: (plan, observe) => {
        const array = [...plan.sorted]
        const index = array.filter((element) => element < plan.value).length
        array.splice(index, 0, plan.value)
        observe(`index`, index)
        observe(`array`, array)
      },
    },
    {
      // A wrong answer: the value is dropped from the array.
      name: `drops the value`,
      law: LAW,
      history: { constructed: `an empty array` },
      corrupt: (trace, plan) =>
        trace.map((o) =>
          o.checkpoint === `array` ? { ...o, value: plan.sorted } : o,
        ),
    },
  ],
})

function seen(trace: ReadonlyArray<Observation>, checkpoint: string) {
  return trace.find((o) => o.checkpoint === checkpoint)?.value
}
