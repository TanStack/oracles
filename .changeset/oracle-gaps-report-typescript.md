---
'@tanstack/oracles': minor
---

The `oracle-gaps` CLI now checks the TypeScript oracle files of a package that has a `tsconfig.json`, and reports what it finds in the output. An oracle file that no config covers (following `projectReferences`) is named as uncovered, and each TypeScript error in a covered oracle file is named with its file, line, column, and TypeScript code. The findings are greppable `oracle-gaps: note typecheck: ...` lines, printed after the baseline lines on both streams and in `stream.log`, a `Typecheck notes` section in `summary.md`, and a `typecheck` field in `results.json`. They never refuse or fail a run: the exit status and the done line are the same whether or not the oracle files type-check. A package without a `tsconfig.json` gets no typecheck output.

Use `--tsconfig <file>` to name a config other than `tsconfig.json`. A path that is not a file of the package is an argument refusal, as `--config` is.
