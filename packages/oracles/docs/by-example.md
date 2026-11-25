# Oracles by example

The examples below use `insertSorted` from
[`examples/quick-reference`](https://github.com/TanStack/oracles/tree/main/packages/oracles/examples/quick-reference),
a package that CI compiles, runs, and gap-checks. The TypeScript blocks come
from `src/insert-sorted.ts` and
`tests/insert-sorted.oracle.property.test.ts`, and a test keeps them in sync
with those files. Outputs come from running the package with `--seed 42`;
sections that modify the code to show a failure say what changed. See the
[glossary](glossary.md) for short definitions and the
[quick reference](quick-reference.md) for the API.

## The function and its promise

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

The doc comment is the only place the promise is written, and it includes a
detail that is easy to miss: "after every element equal to it".

## Probe first

A **probe** is a small script that calls the real code with chosen inputs
and prints the result. Every finding includes a probe so anyone can rerun
it. Run this from the example's directory (Node 22.18 or newer runs the
TypeScript file directly):

```sh
node --input-type=module -e "
import { insertSorted } from './src/insert-sorted.ts'
for (const [sorted, value] of [[[1, 3], 2], [[2, 2], 2], [[], 5], [[1, 2, 2, 3], 2]]) {
  const array = [...sorted]
  const index = insertSorted(array, value)
  console.log(JSON.stringify(sorted), value, '->', index, JSON.stringify(array))
}"
```

```text
[1,3] 2 -> 1 [1,2,3]
[2,2] 2 -> 2 [2,2,2]
[] 5 -> 0 [5]
[1,2,2,3] 2 -> 3 [1,2,2,2,3]
```

In the second line, `[2, 2, 2]` looks the same wherever the new `2` landed.
A test that checks only the array cannot distinguish inserting after equal
elements from inserting before them; you have to check the returned index.

## From a promise to a law

A **law** states one promise as a "For every …" sentence that lets a reader
predict the result without reading the implementation. Each law names its
**authority**, meaning the place where the promise is written: a doc, a
changelog entry, a test name, or a maintainer's decision with a name and a
date. Current code behavior is only evidence, so it cannot be an authority.
A law's **limits** state what it leaves out.

```ts
  law: {
    statement: `For every ascending array and value, insertSorted puts the value after every element equal to it: it returns the number of elements less than or equal to the value, and the array becomes the old array with the value at that index.`,
    authority: `the doc comment of insertSorted in src/insert-sorted.ts`,
    limits: `Integers from -50 to 50, arrays of up to 8 elements; -0, NaN and fractions are not generated.`,
  },
```

An agent proposes a law as a _potential law_, and it becomes a law once the
maintainers approve it. Only maintainers can change a law; an agent can only
propose changes.

## The oracle and what it owns

An **oracle** judges production code against a law using five parts: the
law, the histories, the model, the driver, and the check. One
`oracleProperty` call holds all five inside an **oracle file**, a test file
whose name contains `oracle`. The file's opening comment states the law in
prose.

The **owns** field names the production code the oracle covers. The gap
check mutates only owned code.

```ts
  id: `example.insert-sorted`,
  owns: [`src/insert-sorted.ts#insertSorted`],
```

## Histories and plans

A **history** is a generated input, here a list of integers and a value.
fast-check draws it from an arbitrary, shrinks it on failure, and replays it
from a seed.

```ts
    arbitrary: fc.record({
      elements: fc.array(integer, { maxLength: 8 }),
      value: integer,
    }),
    runs: 100,
    fixedSeeds: [1],
```

fast-check draws the integers in any order, while `insertSorted` requires an
ascending array. `resolve` turns each history into a **plan**, the concrete
input passed to the test. Sorting the integers in `resolve` means every
history satisfies the precondition, including shrunk ones.

```ts
  resolve: (history: History): Plan => ({
    sorted: [...history.elements].sort((a, b) => a - b),
    value: history.value,
  }),
```

## The model

The **model** computes the expected result of a plan independently of the
production code, using the simplest logic available. While production
searches for the first larger element, the model counts how many elements
are less than or equal to the value. Computing the same answer two different
ways makes it unlikely that both share the same mistake.

```ts
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
```

## The driver

The **driver** runs a plan through the real code and records what happens.
Each record is an **observation** at a named **checkpoint**, and the ordered
list of observations for a history is its **trace**. Because the driver
returns nothing, it cannot decide pass or fail. Here it passes a copy of the
array to `insertSorted` so production cannot mutate what the model reads,
and it records both the returned index and the resulting array because the
probe showed that the array alone hides a tie.

```ts
  driver: (plan, observe) => {
    const array = [...plan.sorted]
    observe(`index`, insertSorted(array, plan.value))
    observe(`array`, array)
  },
```

## The check

The **check** compares the trace against the model and is the only part that
can fail a law. Any mismatch produces a **violation** recording the law, the
checkpoint, what was seen, and what was owed.

```ts
  check: (_plan, trace, expected) =>
    differs(`index`, LAW, seen(trace, `index`), expected.index) ??
    differs(`array`, LAW, seen(trace, `array`), expected.array) ??
    pass,
```

## Calibrations

A check that compares nothing passes forever. A **calibration** is a
planted wrong answer that the check must reject, either a mutant driver
(a wrong implementation) or a `corrupt` function that damages a good trace.
The example has one of each; here is the mutant driver:

```ts
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
```

If you delete the `index` line from the check, every other test still passes
while this calibration fails:

```text
failing: ` example.insert-sorted > calibration: inserts before equal elements `: ` Error: example.insert-sorted: calibration "inserts before equal elements" on constructed history: a tie (seed 106542608): but the check passed it. It must report law "after equal elements". `
```

## Constructed histories and reach

Random generation rarely hits the exact case a law cares about. At seed 1,
only 4 of the 100 generated histories contain a tie. To cover those cases,
the oracle declares the states it needs and builds a **constructed history**
for each one by modifying a generated history so it enters a named
**declared state**.

```ts
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
```

`reached` reports which states a plan entered, and each run prints its
**reach**, the count of histories that entered each state:

```ts
  reached: (plan) => [
    ...(plan.sorted.includes(plan.value) ? [`a tie`] : []),
    ...(plan.sorted.length === 0 ? [`an empty array`] : []),
  ],
```

```text
example.insert-sorted fixed seed 1: a tie reach {"a tie":5,"an empty array":0}
example.insert-sorted fixed seed 1: an empty array reach {"a tie":0,"an empty array":5}
example.insert-sorted fixed seed 1: generated reach {"a tie":4,"an empty array":11}
```

If a constructed history fails to enter its declared states, its test fails,
which guarantees every run tests a tie. Constructed histories must also stay
within the arbitrary's bounds. That is why `a tie` replaces the first
element instead of adding one: fast-check cannot shrink a history it could
not have drawn, and the oracle rejects out-of-bounds histories.

## RED, then GREEN

Suppose the first version of `insertSorted` used `>=` instead of `>`,
inserting before equal elements. The oracle goes RED: it fails on the
unchanged production code, showing it can catch the defect.

```text
oracle-gaps: baseline fail tests/insert-sorted.oracle.property.test.ts: 5 of 13 tests failed
  failing: ` example.insert-sorted > fixed seed 1: a tie `: ` OracleViolation: example.insert-sorted violated at checkpoint "index" (law: after equal elements). `
  law: ` after equal elements ` at ` index `: ` the observed value differs from the owed value `
  counterexample: ` {"elements":[1],"value":1} `
  replay: vitest run tests/insert-sorted.oracle.property.test.ts -t '^example\.insert-sorted(?: | > )fixed seed 1: a tie$'
```

The counterexample is **shrunk**: fast-check reduced the failing history to
a single element equal to the value. The `replay:` line reruns that test.
The calibration bound to `a tie` fails as well, because a calibration runs
its history against production first.

Changing `>=` back to `>` turns the same oracle GREEN, with all 13 tests
passing. Turning a bug into a failing oracle before fixing production means
the oracle itself proves the fix.

## Green is not done: the gap check

A passing run shows that every law held on the tested histories, but it does
not show whether the oracle would catch a wrong change to the code. The
**gap check** (`oracle-gaps`) tests that by making a **mutant** (one small
edit to a copy of the owned code), running the oracle against it, and
repeating for every mutant it can generate.

```sh
pnpm exec oracle-gaps --package . --source src/insert-sorted.ts --seed 42
```

On `insertSorted`, it produces five mutants:

| Mutant | Line | Change                                                         |
| ------ | ---- | -------------------------------------------------------------- |
| M1     | 6    | `sorted.findIndex((element) => element > value)` → `undefined` |
| M2     | 6    | `>` → `>=`                                                     |
| M3     | 7    | `===` → `!==`                                                  |
| M4     | 8    | `sorted.splice(index, 0, value)` deleted                       |
| M5     | 9    | `return index` → `return undefined`                            |

A mutant rejected by a law is a **kill**. A mutant that slips past every law
is a **survivor**, and every survivor is a **gap**: behavior in the owned
code that no law judges yet. Here the oracle kills all five mutants,
starting on the `a tie` history:

```text
oracle-gaps: summary 2b0beb1ef751: 5 mutants, 5 killed, 0 gaps, 0 unowned (warnings). 1 source files, 1 oracle files, 0 ordinary test files, 0 authored mutants, seed 42, pool threads.
oracle-gaps: done completed, 0 gaps, report …/summary.md
```

There are no "equivalent mutants". Behind every survivor, look first for a
missing history, a missing observation, or a missing law; dismissing one as
harmless hides real bugs. Dead code is the last explanation, and it needs
evidence: every public entry point that reaches the code is owned by a law
that decides the value exactly, and the gap runs before and after the
removal keep every kill, compared by mutant key
([`oracles-design` step 7](../skills/oracles-design/SKILL.md#7-show-the-evidence-that-fits-the-change)).

## The gap classes

Each gap reports a class and one instruction. You can trigger them by
weakening the example's oracle one step at a time and rerunning the gap
check.

`not-judged`: the mutant changed an observation that no law checked. Delete
the `index` line from the check (which also fails the calibration):

```text
oracle-gaps: gap not-judged L9 insert-sorted.ts:M5 ` index ` → ` undefined `
oracle-gaps: gap not-judged L6 insert-sorted.ts:M2 ` > ` → ` >= `
```

`not-observed` and `not-distinguished`: also stop the driver from recording
the index (`insertSorted(array, plan.value)` with no `observe`), so the
change happens without being recorded:

```text
oracle-gaps: gap not-distinguished L9 insert-sorted.ts:M5 ` index ` → ` undefined `
oracle-gaps: gap not-observed L6 insert-sorted.ts:M2 ` > ` → ` >= `
```

`not-observed` means the mutated code computed a different result that the
driver ignored. `not-distinguished` means no history carried the changed
value to an asserted result because nothing reads the returned index.

`not-infected`: the mutated code ran, but no history made it compute a
different result. Remove the `a tie` constructed history and its
calibration, move `a tie` from `states` to `measured` (a **measured state**
is counted without being required), and lower `runs` to 5 so no history
contains a tie:

```text
oracle-gaps: gap not-infected L6 insert-sorted.ts:M2 ` > ` → ` >= `
```

The instruction asks for "a history whose operands are equal, where `>` and
`>=` disagree", and lists the operands it saw (50 and 1, -31 and 0, -49 and
-24).

`blocked`: a test that fails with no mutant active cannot judge mutants. The
RED run above lists each failing test in a `blocked` line and marks the
report provisional. Any mutant reached only by failing tests becomes a
`blocked` gap until the failure is fixed.

`unowned` is a warning separate from gaps, flagging code in a `--source`
file that no oracle owns. A package with a second module and no oracle for
it prints `note unowned fn <name> (<file>): N mutants`. Run the gap check
once across every source file in the package before treating it as covered.

The remaining classes do not appear on `insertSorted` because the function
is too small:

| Class                | What the mutant showed                                         |
| -------------------- | -------------------------------------------------------------- |
| `unreached`          | no history runs the mutated line                               |
| `branch-never-taken` | the line runs, but one side of its condition never happens     |
| `extra-work`         | the same results with more work: a shortcut for speed was lost |
| `crashed`            | production threw where no law judged the error                 |
| `timeout`            | the owner tests no longer end                                  |
| `framework-error`    | only a framework check, such as a calibration, failed          |
| `random-only-kill`   | only the random campaign killed it: keep that history          |

The gap check's legend line prints the full instruction for each class.

## How a session goes

1. Probe the public API. Report each finding as a class of inputs with a
   count, instead of listing a single bad input.
2. Propose potential laws with their authorities so the maintainer can
   approve them and answer open questions.
3. Write the oracle and run it through the gap check on unchanged code. A
   RED test under an approved law indicates a possible bug; once the
   maintainer confirms it, fix production and verify the run goes GREEN.
4. Close gaps one at a time, then run once over every source file. Closing
   gaps often turns up new questions and bugs.

## What newcomers trip over

- The first red run is often a mistake in the oracle itself: a bad import, a
  driver that calls the code incorrectly, or a model that disagrees with an
  approved law. Run the counterexample by hand before calling it a bug.
- A calibration needs a history that passes cleanly, and a constructed
  history must stay within the arbitrary's bounds.
- Run oracles through the gap check, which prints the test results before
  the gaps.
- Never dismiss a survivor as equivalent. Find the missing history,
  observation, or law. Call the code dead only last, with the evidence
  above.

## Where to go next

[What an oracle is](intro.md) introduces the idea in a few paragraphs. The
[quick reference](quick-reference.md) has the API and the full example file,
the [glossary](glossary.md) defines every term, and the [guide](guide.md)
and [checklist](oracle-checklist.md) cover the techniques. The files in
`skills/` describe how an agent runs the method.
