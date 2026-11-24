---
'@tanstack/oracles': patch
---

An `oracle-gaps` gap now names every place that can close it, not only the first. An `extra-work` gap's `Work bounds that reject it` line in `summary.md` lists each test whose work rose, with the bound that rejects the mutant on that test's property (`workTests` in `results.json`); before, only the first test in report order was named, which could be in an oracle file its author may not edit. A `not-observed` gap's `Infected in` line lists the first test of each owner file that infected the mutant (`infectedTests`). The directives are unchanged.
