---
'@tanstack/oracles': patch
---

With `--ordinary`, a gap that an ordinary test fails under is marked: its gap line ends with `(an ordinary test kills it)`, a legend line says what the mark means, `results.json` lists the failing ordinary tests in `ordinaryBy` beside `testOutcome`, and its gap in `summary.md` has an `Ordinary tests:` line that names the first of them and says to read that test and add a history like it to an owner oracle. Such a gap points straight at the history the oracle lacks. The setup, explore, and design skills now say to pass `--ordinary` when a package has ordinary tests.
