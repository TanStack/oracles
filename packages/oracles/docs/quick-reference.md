# Quick reference

The API on one page: one complete oracle file, every option of
`oracleProperty`, and the gap check. Read it before you write the first
oracle. The skills say how to find and approve the laws, and the
[guide](guide.md) explains each technique; the table below links to both.
Terms follow the [glossary](glossary.md).

## One complete oracle

A tiny module under test, `src/insert-sorted.ts`:

<!-- example: examples/quick-reference/src/insert-sorted.ts -->

```ts
/**
 * Inserts `value` into `sorted`, an array in ascending order, after every
 * element equal to it, and returns the index where it put it.
 */
export function insertSorted(sorted: Array<number>, value: number): number {
  const after = sorted.findIndex((element) => element > value)
  const index = after === -1 ? sorted.length : after
  sorted.splice(index, 0, value)
  return index
}
```

Its oracle file, `tests/insert-sorted.oracle.property.test.ts`. The opening
comment is the law block that [`oracles-design` step 1](../skills/oracles-design/SKILL.md#1-start-from-approved-potential-laws-then-write-the-oracle-file) describes:

<!-- example: examples/quick-reference/tests/insert-sorted.oracle.property.test.ts -->

````ts
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
````

Both files are in
[`examples/quick-reference`](https://github.com/TanStack/oracles/tree/main/packages/oracles/examples/quick-reference), a private
package of this repository. Its `vitest.config.ts` includes
`tests/**/*oracle*.test.ts`. CI typechecks and lints it, runs it, runs the
gap check on it and requires 0 gaps, and checks that the two code blocks
above are the files, byte for byte.

`vitest --run` registers these tests for the one property: a unit for each
constructed history and one for the generated histories, once at each fixed
seed and once at a random seed, then one test per calibration, then the
determinism tests that rerun a few histories and compare their traces.

## Options

`oracleProperty(options)` takes these. **Required** ones are marked.

| Option                   | Meaning                                                                                                                                                                                    | Read                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id` **required**        | A stable name, used in failures, the manifest, and replay commands.                                                                                                                        | [glossary: replay](glossary.md#the-parts-of-an-oracleproperty)                                                                                                                   |
| `law` **required**       | `{ statement, authority, limits }`: the promise, where it comes from, and what this property does not establish.                                                                           | [ORC-001](oracle-checklist.md#orc-001-contract-authority-and-limits)                                                                                                             |
| `owns`                   | A literal list of owned code: `src/x.ts`, or `src/x.ts#fn` and its static call tree. The gap check judges only owned code.                                                                 | [glossary: owns](glossary.md#gaps), [`oracles-design` step 6](../skills/oracles-design/SKILL.md#6-write-the-driver-and-the-check)                                                |
| `histories` **required** | A generated source (below), an enumerated source `{ enumerated, states?, measured? }` where every history runs, or a plain array of histories.                                             | [guide: Histories](guide.md#histories)                                                                                                                                           |
| `resolve`                | `(history) => plan`: turns a drawn history into the concrete, legal actions. Required when the plan's type is not the history's.                                                           | [guide: Build legal histories](guide.md#build-legal-histories)                                                                                                                   |
| `model` **required**     | `(plan, trace) => expected`: the expected result, computed without production. Pure; reads only the plan and the inputs the driver recorded.                                               | [guide: The model](guide.md#the-model), [model styles](model-styles.md)                                                                                                          |
| `driver` **required**    | `(plan, observe) => void \| Promise<void>`: runs the plan through the real entry point and records data with `observe(checkpoint, value)`. Returns nothing, so it cannot decide a verdict. | [guide: Observe what the contract promises](guide.md#observe-what-the-contract-promises)                                                                                         |
| `check` **required**     | `(plan, trace, expected) => Verdict`: the only part that can fail a law. Usually `differs(...) ?? differs(...) ?? pass`.                                                                   | [guide: Let observations represent violations](guide.md#let-observations-represent-violations)                                                                                   |
| `reached`                | `(plan, trace, expected) => states`: the declared states a history entered. Without it, the trace's `reach` observations.                                                                  | [ORC-015](oracle-checklist.md#orc-015-declared-reach)                                                                                                                            |
| `calibrations`           | Wrong answers that a law must reject: `{ name, law, history?, difference?, corrupt }` (a corrupted trace) or `{ …, driver }` (a mutant driver). Bind each to a history with `history`.     | [guide: Make the comparison prove its usefulness](guide.md#make-the-comparison-prove-its-usefulness)                                                                             |
| `label`                  | `(history) => name`: a short, unique test name for an enumerated history.                                                                                                                  | [glossary: bounded exhaustiveness](glossary.md#the-parts-of-an-oracleproperty)                                                                                                   |
| `timeout`                | Each test's limit in ms; 120 000 by default, none at 0. Shrinking stops at half of it.                                                                                                     | [`oracles-design` step 5](../skills/oracles-design/SKILL.md#5-build-histories-that-reach-the-law)                                                                                |
| `work`                   | `{ ratio }`: a work bound. Under the gap check, a mutant that makes more than `ratio` times the site evaluations fails law `work bound`.                                                   | [guide: Vary machinery and premises separately](guide.md#vary-machinery-and-premises-separately), [`oracles-design` step 8](../skills/oracles-design/SKILL.md#8-close-every-gap) |
| `predict`                | `(plan) => { [state]: boolean }`: whether the history enters each probe-bound state, from the plan alone.                                                                                  | [glossary: state probe](glossary.md#reach)                                                                                                                                       |
| `probeHistories`         | `{ [state]: { entered?, notEntered } }`: the histories for a probe-bound state's forced controls.                                                                                          | [glossary: state probe](glossary.md#reach)                                                                                                                                       |

A generated source, `histories: { … }`:

| Field                     | Meaning                                                                                                                                    | Read                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `arbitrary` **required**  | The fast-check arbitrary of legal histories. Every fixed and constructed history must go back through it, so give each `.map` its inverse. | [guide: Describe the input domain as a grammar](guide.md#describe-the-input-domain-as-a-grammar)       |
| `runs` **required**       | Each campaign's base budget, scaled by `ORACLE_RUNS_MULTIPLIER`. Start at 100 for a fast synchronous driver.                               | [`oracles-design` step 5](../skills/oracles-design/SKILL.md#5-build-histories-that-reach-the-law)      |
| `fixedSeeds` **required** | One fixed-seed campaign per seed; a random campaign always runs beside them.                                                               | [ORC-007](oracle-checklist.md#orc-007-fixed-and-random-campaigns-with-direct-replay)                   |
| `states`                  | The declared states the law needs. Each must be entered by a constructed history, on every base.                                           | [ORC-015](oracle-checklist.md#orc-015-declared-reach)                                                  |
| `measured`                | States that are counted but not required. A reached state in neither list fails, so a misspelling cannot pass.                             | [guide: Generate histories that reach the problem](guide.md#generate-histories-that-reach-the-problem) |
| `constructed`             | `{ name, enters, build, drawnBases? }`: `build(generated)` returns a history that enters the states in `enters`.                           | [guide: Build legal histories](guide.md#build-legal-histories)                                         |
| `bases`, `drawnBases`     | How many generated bases each constructed history is built from: `bases` fixed (5 by default), then `drawnBases` from the random seed (0). | [ORC-015](oracle-checklist.md#orc-015-declared-reach)                                                  |
| `fixed`                   | `{ name, history, enters? }`: a named history, such as a regression. It runs through the same model and check. It is not reach.            | [ORC-016](oracle-checklist.md#orc-016-law-only-oracle-files)                                           |

## Exports

All from `@tanstack/oracles`.

| Export                             | Use                                                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `oracleProperty`                   | Registers the property's tests. An oracle file registers tests only through it.                                                            |
| `differs(checkpoint, law, a, e)`   | One exact comparison: a violation with a diff when `a` is not the same data as `e`, otherwise `undefined`, so comparisons chain with `??`. |
| `pass`, `violation(cp, why, law?)` | The two verdicts. Use `violation` for a judgment that is not one equality, such as membership in an allowed set.                           |
| `Observation`, `Verdict` (types)   | A trace entry `{ checkpoint, value }`, and what `check` returns.                                                                           |
| `withinTurns(promise, turns)`      | For an async driver: whether a promise settles within `turns` event-loop turns, never a wall-clock wait.                                   |
| `scheduleFrom(choices)`            | For an async driver: a promise schedule as plain data in the history, so it shrinks and replays.                                           |
| `useOracleClock({ maxTimers })`    | For a driver with timers: virtual timers and `Date` for the rest of the history; call `release()` in `finally`.                            |
| `configureOracles(options)`        | Only to change the `ORACLE` variable prefix or add a property registry, in a Vitest setup file.                                            |

## The gap check

The gap check is how you run the oracles: it runs every oracle file, then
mutants of the owned code. From the example's package:

```sh
pnpm exec oracle-gaps --package . --source src/insert-sorted.ts --seed 42
```

Add `--config <file>` when the Vitest config has another name. Every line
starts with `oracle-gaps:`. The `baseline` and `done` lines go to both stdout
and stderr, so a log of `2>&1` holds each twice. The lines to read, in the
order they come:

```text
oracle-gaps: config vitest.config.ts
oracle-gaps: baseline pass tests/insert-sorted.oracle.property.test.ts: 13 tests
oracle-gaps: baseline all 1 oracle file pass
oracle-gaps: summary 2b0beb1ef751: 5 mutants, 5 killed, 0 gaps, 0 unowned (warnings). …
oracle-gaps: done completed, 0 gaps, report <dir>/summary.md
```

- `config` names the Vitest config it loaded.
- One `baseline` line per oracle file, then one decisive line. Act on a
  `baseline fail` line first: indented lines under it name the law, the
  counterexample, and a replay command. A failing law judges nothing.
- `gap <class> L<line> <id> <change>` lines come as each gap is judged.
  `summary.md` gives each one instruction; `--only <id>` reruns one.
- Exactly one `done` line ends the run: `done completed, <n> gaps` (exit 0),
  `done refused` (exit 2: do what its `fix:` line says), `done error` (exit
  3: a CLI bug, with `error.log`), or `done stopped`.

A longer run can take minutes: start it in the background with its output in
a log of its own, and read new lines as they come ([`oracles-setup` step 7](../skills/oracles-setup/SKILL.md#7-run-the-gap-check)).
