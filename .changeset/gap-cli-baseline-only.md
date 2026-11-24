---
'@tanstack/oracles': minor
---

`oracle-gaps` takes `--baseline-only`: the run is the baseline alone. Every test file runs once with no mutant active, ordinary files too, as a full check's baseline runs them, and no mutant is judged. The run prints the same baseline lines as a full check (each file's result, its failing test, the decisive `baseline` line, and a `blocked` line per failing law), writes `results.json` with `"baselineOnly": true` and no results, and `summary.md`, and ends with `oracle-gaps: done completed, baseline only, report <path>`. It exits 0 whether the baseline passed or failed. Before, the only way to see every oracle file's baseline was `--sample 1`, which also runs a mutant per source, since `--only` runs only the selected mutants' owners. `--baseline-only` refuses `--only`, `--sample`, `--mutants`, and `--diff-base`, which choose or mark mutants; `--daemon` and `--ordinary` are accepted.
