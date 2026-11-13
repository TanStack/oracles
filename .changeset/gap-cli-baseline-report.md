---
'@tanstack/oracles': minor
---

The `oracle-gaps` report leads with the baseline, and a failing oracle file no longer stops the run.

- An oracle file that fails with no mutant active (a RED law, or a file that cannot load or launch) blocks only the mutants it owns. A mutant it owns that no passing owner kills is a new `blocked` gap, which names the failing file. The other mutants are judged, and the report says it is provisional. Before, the run refused with exit 2. A setup file that throws now blocks every owned mutant in the same way.
- A `blocked` line names each failing oracle file and its failing test, and says to make it pass and check again.
- With `--only`, the baseline runs only the owners of the selected mutants, so another file's failure no longer blocks the run.
- stdout and `summary.md` start with the baseline: each test file's result with its test counts, ordinary test files included, and for a failing file its failing test, its error, the law, difference, and counterexample of a law violation, and its replay command. Ordinary test files now run once in the baseline; they run against mutants only with `--ordinary`. `results.json` gains `provisional` and `baseline`.
- The legend says that a `crashed` gap is a gap, not a kill, and that its error is on the gap's Detail line in `summary.md` and in its `detail` in `results.json`.
- The last stdout line says that the check completed, with its gap count and its report (`oracle-gaps: done completed, <n> gaps, report <path>`). Exit codes do not change: 0 means the check completed, whatever its gaps.
