---
'@tanstack/oracles': minor
---

The `oracle-gaps` CLI keeps its working files out of the repository. The daemon's state (its lock, log, and evidence), the one-file bundles of workspace dependencies, and the default output directory now live in the OS temp directory, in a directory keyed by the package (`oracle-gaps-<hash>`, never a shared directory), which the OS cleans. A state that the OS removed is a cold start. `--out` is honored as before, and the run still prints its output path. While a run runs, its capture setup and Vitest configs are in `<package>/.oracle-gaps-<pid>/`, which it removes when it ends; one that a killed run left is removed by the next run. A run leaves nothing in the package, so there is nothing to add to `.gitignore` or to delete. Before, every run wrote `<package>/.oracle-gaps/` and `<dependency>/.oracle-gaps/bundle-*.mjs`.
