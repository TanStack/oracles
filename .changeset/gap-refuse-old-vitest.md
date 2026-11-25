---
'@tanstack/oracles': patch
---

Refuse a Vitest older than the peer range (`^4.1.0 || ^5.0.0`) up front. The gap check reads the version from the Vitest that the package's `vitest/node` resolves to, the copy it would load, and before loading it refuses with exit 2: `refused:` names the installed version, its path, and the peer range, and `fix:` says to upgrade Vitest as step 2 of the oracles-setup skill says and to run the package's existing tests before and after the upgrade. Before, Vitest 1.6 stopped with `context.getRootProject is not a function` and Vitest 3.2 with Vite 5 stopped after its baseline, both reported as a bug in oracle-gaps. `oracleProperty` refuses the same Vitest when a test file registers, naming the Vitest that the package imports, where Vitest 1.6 failed each generated test with `Cannot read properties of undefined (reading 'aborted')`. Vitest 3.2 with Vite 6 or 7, which passed a plain run and a gap check before, is now refused by both.
