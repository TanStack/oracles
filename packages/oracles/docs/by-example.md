# Oracles by example

This page is for people who were not there when an oracle was built: a
maintainer or a reviewer of oracle work, or a talk audience. It follows one small function
from the first probe to the last gap, and introduces each term where it
first matters. The [glossary](glossary.md) has the short definitions, and the
[quick reference](quick-reference.md) has the API.

The function is `insertSorted`, the example package in
[`examples/quick-reference`](https://github.com/TanStack/oracles/tree/main/packages/oracles/examples/quick-reference).
CI compiles it, runs its oracle, and gap-checks it. Every TypeScript block
below is cut from its two files, `src/insert-sorted.ts` and
`tests/insert-sorted.oracle.property.test.ts`, and a test holds each block
to them. The outputs come from running that package with `--seed 42`. Where
a section changes the example to show a failure, it says what it changed.

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

The doc comment is the only place the promise is written, and it holds a
detail that is easy to miss: "after every element equal to it".

## Probe first

A **probe** is a small script that calls the real code with chosen inputs
and prints what happens. Every finding comes with one, so that anyone can
run it again. Run from the example's directory (Node 22.18 or newer runs the
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

Look at the second line. `[2, 2, 2]` looks the same wherever the new `2`
went, so a test that checks only the array cannot tell "after the equal
elements" from "before them". Only the returned index can.

## From a promise to a law

A **law** is one promise, written as a "For every …" sentence that a reader
could use to predict a result without reading the code. Each law names its
**authority**, where the promise is written: a doc, a changelog entry, a
test name, or a maintainer's decision with a name and a date. What the code
does today is evidence, never an authority. Its **limits** say what the law
does not cover.

```ts
  law: {
    statement: `For every ascending array and value, insertSorted puts the value after every element equal to it: it returns the number of elements less than or equal to the value, and the array becomes the old array with the value at that index.`,
    authority: `the doc comment of insertSorted in src/insert-sorted.ts`,
    limits: `Integers from -50 to 50, arrays of up to 8 elements; -0, NaN and fractions are not generated.`,
  },
```

An agent proposes a law as a _potential law_. It becomes a law when the
people who maintain the code approve it. The laws belong to them: the agent
can propose a change to a law, never make one.

## The oracle and what it owns

An **oracle** is what judges production against a law: the law, the
histories, the model, the driver, and the check, each described below. One
`oracleProperty` call holds them, in an **oracle file**, a test file whose
name contains `oracle`. Its opening comment states the law in prose for a
human reader.

**Owns** names the production code the oracle answers for. The gap check
(below) changes only owned code.

```ts
  id: `example.insert-sorted`,
  owns: [`src/insert-sorted.ts#insertSorted`],
```

## Histories and plans

A **history** is one generated input: here, a list of integers and a value.
fast-check draws it from an arbitrary, shrinks it when it fails, and
replays it from a seed.

```ts
    arbitrary: fc.record({
      elements: fc.array(integer, { maxLength: 8 }),
      value: integer,
    }),
    runs: 100,
    fixedSeeds: [1],
```

The integers are drawn in any order, but `insertSorted` needs an ascending
array. `resolve` turns each history into a **plan**, the concrete input
that runs. Here it sorts the integers, so every history meets the
precondition, shrunk ones too.

```ts
  resolve: (history: History): Plan => ({
    sorted: [...history.elements].sort((a, b) => a - b),
    value: history.value,
  }),
```

## The model

The **model** gives the expected result of a plan without the code under
test, computed the simple way. Production searches for the first larger
element. The model counts the elements that are less than or equal to the
value. Both say the same thing, by different routes, so a mistake in one is
unlikely to be repeated in the other.

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

The **driver** runs a plan through the real code and records what it saw.
Each record is an **observation** at a named **checkpoint**, and a
history's observations in order are its **trace**. The driver returns
nothing, so it cannot decide a verdict. It calls `insertSorted` on a copy,
so the production code cannot change what the model reads, and it records
the index as well as the array, because the probe showed that the array
alone hides a tie.

```ts
  driver: (plan, observe) => {
    const array = [...plan.sorted]
    observe(`index`, insertSorted(array, plan.value))
    observe(`array`, array)
  },
```

## The check

The **check** compares the trace with the model, and it is the only part
that can fail a law. A difference is a **violation**: which law, at which
checkpoint, what was seen, and what was owed.

```ts
  check: (_plan, trace, expected) =>
    differs(`index`, LAW, seen(trace, `index`), expected.index) ??
    differs(`array`, LAW, seen(trace, `array`), expected.array) ??
    pass,
```

## Calibrations

A check that compares nothing passes forever. A **calibration** is a
planted wrong answer that the check must reject: a mutant driver, which is
a wrong implementation, or a `corrupt` function that damages a good trace.
The example has one of each. This is the first:

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

To see one work, delete the `index` line from the check. Every other test
still passes, and this calibration fails:

```text
failing: ` example.insert-sorted > calibration: inserts before equal elements `: ` Error: example.insert-sorted: calibration "inserts before equal elements" on constructed history: a tie (seed 106542608): but the check passed it. It must report law "after equal elements". `
```

## Constructed histories and reach

Random generation rarely hits the case a law cares about. At seed 1, only 4
of the 100 generated histories hold a tie. So the oracle names the states
it needs and builds a **constructed history** for each one: a history made
from a generated one so that it enters a named **declared state**.

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

`reached` says which states a plan entered, and each run prints its
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

A constructed history that does not enter its states fails its test, so
the tie is tested on every run, not only when the generator is lucky. It
must also stay inside the arbitrary's bounds, which is why `a tie` replaces
the first element and does not add one: fast-check cannot shrink a history
it could not have drawn, and the oracle refuses it.

## RED, then GREEN

Suppose the first version of `insertSorted` had `>=` in place of `>`, so it
inserted before equal elements. The oracle goes **RED**: it fails on the
unchanged production code, and so shows it can see the defect.

```text
oracle-gaps: baseline fail tests/insert-sorted.oracle.property.test.ts: 5 of 13 tests failed
  failing: ` example.insert-sorted > fixed seed 1: a tie `: ` OracleViolation: example.insert-sorted violated at checkpoint "index" (law: after equal elements). `
  law: ` after equal elements ` at ` index `: ` the observed value differs from the owed value `
  counterexample: ` {"elements":[1],"value":1} `
  replay: vitest run tests/insert-sorted.oracle.property.test.ts -t '^example\.insert-sorted(?: | > )fixed seed 1: a tie$'
```

The counterexample is **shrunk**: fast-check cut the failing history down
to one element equal to the value. The `replay:` line runs that test again.
The calibration bound to `a tie` fails too, because a calibration first
runs its history on production, and that run now fails.

Change `>=` back to `>` and the same oracle goes **GREEN**: 13 tests pass.
The order matters. A bug becomes a failing oracle first, then production is
fixed, so the oracle, not the probe, proves the fix.

## Green is not done: the gap check

A pass says every law held on every history tried. It does not say whether
the laws would notice a wrong change to the code. The **gap check**
(`oracle-gaps`) measures that. It makes a **mutant**, one small change to a
copy of the owned code, runs the oracle against it, and repeats for every
mutant it can make.

```sh
pnpm exec oracle-gaps --package . --source src/insert-sorted.ts --seed 42
```

On the example it makes five mutants:

| Mutant | Line | Change                                                         |
| ------ | ---- | -------------------------------------------------------------- |
| M1     | 6    | `sorted.findIndex((element) => element > value)` → `undefined` |
| M2     | 6    | `>` → `>=`                                                     |
| M3     | 7    | `===` → `!==`                                                  |
| M4     | 8    | `sorted.splice(index, 0, value)` deleted                       |
| M5     | 9    | `return index` → `return undefined`                            |

A mutant that some law rejects is a **kill**. A mutant that no law notices
is a **survivor**, and every survivor is a **gap**: behavior of the owned
code that no law judges yet. Here every mutant dies, first at the `a tie`
history:

```text
oracle-gaps: summary 2b0beb1ef751: 5 mutants, 5 killed, 0 gaps, 0 unowned (warnings). 1 source files, 1 oracle files, 0 ordinary test files, 0 authored mutants, seed 42, pool threads.
oracle-gaps: done completed, 0 gaps, report …/summary.md
```

There are no "equivalent mutants". A survivor shows a missing history, a
missing observation, a missing law, or dead code. Labeling a survivor
harmless is how real bugs are hidden.

## The gap classes

Each gap comes with a class and one instruction. To see them, weaken the
example's oracle one step at a time and rerun the gap check.

**`not-judged`**: the mutant changed an observation, and no law looked at
it. Delete the `index` line from the check (the calibration also fails, as
above):

```text
oracle-gaps: gap not-judged L9 insert-sorted.ts:M5 ` index ` → ` undefined `
oracle-gaps: gap not-judged L6 insert-sorted.ts:M2 ` > ` → ` >= `
```

**`not-observed`** and **`not-distinguished`**: also stop the driver from
recording the index (`insertSorted(array, plan.value)` with no `observe`).
Now the change happens, but nothing records it:

```text
oracle-gaps: gap not-distinguished L9 insert-sorted.ts:M5 ` index ` → ` undefined `
oracle-gaps: gap not-observed L6 insert-sorted.ts:M2 ` > ` → ` >= `
```

`not-observed` means the mutated code computed something different and the
driver did not record it. `not-distinguished` means no history carried the
changed value to an asserted result: nothing reads the returned index any
more.

**`not-infected`**: the mutated code ran, but no history made it compute
anything different. Remove the `a tie` constructed history and its
calibration, move `a tie` from `states` to `measured` (a **measured state**
is counted but not required), and lower `runs` to 5, so no history holds a
tie:

```text
oracle-gaps: gap not-infected L6 insert-sorted.ts:M2 ` > ` → ` >= `
```

Its instruction asks for "a history whose operands are equal, where `>`
and `>=` disagree", and lists the operands it saw (50 and 1, -31 and 0,
-49 and -24). That is the tie again: the constructed history is what keeps
this gap closed.

**`blocked`**: a test that fails with no mutant active judges nothing. The
RED run above names each such test in a `blocked` line, and its report is
provisional. A mutant that only such tests reach is a `blocked` gap: fix
the failure first.

**`unowned`** is a warning, not a gap: code in a `--source` file that no
oracle owns. A package with a second module and no oracle for it prints
`note unowned fn <name> (<file>): N mutants`. Run the gap check once with
every source file of the package before you call it covered.

The example's code is too small to show the other classes. Each one points
at a missing part of the oracle:

| Class                | What the mutant showed                                         |
| -------------------- | -------------------------------------------------------------- |
| `unreached`          | no history runs the mutated line                               |
| `branch-never-taken` | the line runs, but one side of its condition never happens     |
| `extra-work`         | the same results with more work: a shortcut for speed was lost |
| `crashed`            | production threw where no law judged the error                 |
| `timeout`            | the owner tests no longer end                                  |
| `framework-error`    | only a framework check, such as a calibration, failed          |
| `random-only-kill`   | only the random campaign killed it: keep that history          |

The gap check's legend line gives each class's instruction in full.

## How a session goes

1. Probe the public API. Report each finding as a class of inputs with a
   count, not as one bad input.
2. Propose potential laws with their authorities. The maintainer approves
   them, and answers the open questions.
3. Write the oracle and run it through the gap check on the unchanged code.
   A RED test under an approved law is a possible bug: once the maintainer
   confirms it, fix production and show the run go GREEN.
4. Close gaps one at a time, and run once over every source file. Closing
   a gap is where new questions and new bugs turn up.

## What newcomers trip over

- **The first red run is often the oracle's own fault**: an import, a
  driver that calls the code wrongly, or a model that disagrees with an
  approved law. Run the counterexample by hand before calling it a bug.
- **A calibration needs a history that passes cleanly**, and a constructed
  history must stay inside the arbitrary's bounds.
- **Run the oracles through the gap check**: it prints the test results
  before the gaps.
- **Never call a survivor equivalent.** Find the missing history,
  observation, or law, or show that the code is dead.

## Where to go next

[What an oracle is](intro.md) gives the idea in a few paragraphs, the
[quick reference](quick-reference.md) the API and the whole example file,
the [glossary](glossary.md) every term, and the [guide](guide.md) and
[checklist](oracle-checklist.md) the techniques. The skills in `skills/`
say how an agent runs the method.
