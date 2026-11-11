---
'@tanstack/oracles': patch
---

Add the `oracle-gaps` CLI, which reports the gaps in a package's oracles. It runs operator mutants of the code that each oracle file owns (its `owns` lists) against only that file's tests, and classifies each surviving mutant: a comparison gap, a generator gap, no observed difference, or unowned code. A daemon (`--daemon`) reuses evidence across runs. `--env-prefix` names the project's oracle environment variables.
