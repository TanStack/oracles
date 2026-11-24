---
'@tanstack/oracles': minor
---

A law that fails now shows its observed and owed values without a plain Vitest run.

- A violation that compares two values (`differs`, or `violation` given `values`) names them in its message, after its `Difference:` line, as `Observed: <value>` and `Owed: <value>`. Each is the value's data encoding on one line, as the `History:` line spells a history, so `-0` and `0`, and the string `"0"` and the number `0`, print differently. Vitest's diff can print each of these pairs alike.
- The `oracle-gaps` baseline lists every failing test of a failing file, in file order. Before, it listed only the first. Under each failing test it prints the test and its error, then the law, difference, observed and owed values (`observed:` and `owed:`), and counterexample of a law violation, then a `replay:` command that runs that test alone. A value longer than 400 code points is cut, and a control character prints as its `\uXXXX` escape. `summary.md` holds the same lines.
