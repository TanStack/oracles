---
'@tanstack/oracles': patch
---

`oracle-gaps --compare <results.json>` prints a refactor's evidence: it compares the run with an earlier full run's results by mutant key, and says how many keys killed there are still killed, which are no longer killed, how many are gone, and which new keys survive, in a `note` line on stdout, a section of `summary.md`, and `compare` in `results.json`. It refuses a file that is no completed full run's results.json, and `--only` or `--sample` beside it.
