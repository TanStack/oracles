---
'@tanstack/oracles': patch
---

An `oracle-gaps` gap now says how often the random budget reached its code. Its `Reach` line in `summary.md` reads `ran in 3 of 400 histories of its owner tests`: of the fast-check histories that the deterministic tests of its owner files ran with no mutant active, the number in which the mutated code ran. For an `if` or a comparison it adds in how many of them the mutant changes its value, so a `>` that differs from `>=` only at one operand shows `changes its value in 2 of them`. `results.json` keeps the counts as `reach: { histories, ran, changed }`. Before, a gap count that rose when a grammar widened, because each variant got a smaller share of the same runs, had nothing in the report to explain it. The capture now counts each outermost property run in the unmutated runs; mutant runs count nothing. The design skill and the report's "How to use this report" say what a low count asks for: a constructed history for that line.
