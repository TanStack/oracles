---
'@tanstack/oracles': patch
---

Fix four parts of the `oracle-gaps` output.

- The baseline's replay command now runs the failing test. Before, its `-t` pattern was the test's `>`-joined name in JSON quotes: Vitest 4 matches `-t` against names joined by a space, so a test in a `describe` ran nothing, and a name with regular-expression syntax, `$`, or a backtick broke the pattern or the shell. The pattern is now the suites' and the test's names, escaped, joined to match Vitest 4 and Vitest 5, anchored, and in single quotes. A file that fails with no failing test (it did not load) replays whole, with no `-t`, where before it printed `-t undefined`. A control character in a test's name or failure, such as a newline, prints as its `\uXXXX` escape, in the baseline and in messages, so each stays one line.
- A gap line stays one line: the code of an operator mutant and the intent of an authored mutant have their whitespace collapsed and are cut at 60 characters with `...`, counted by code point so that a cut never splits an emoji. An authored intent prints as a code span. `results.json` keeps the full text.
- A `not-infected` message prints each operand as a code span of a typed value: strings quoted, `-0` as `-0`, bigints with `n`, and `undefined`, `null`, `NaN`, and a value that is not a primitive kept apart. A string longer than 40 characters (code points) prints its first 37 and a digest. Before, `1` and `"1"`, `0` and `-0`, and two long strings with one prefix printed alike.
- A `not-observed` directive also tells the author to add a history where the mutated code computes something different, because the run cannot tell a value nothing observed from a forced branch that computed the original's result.
