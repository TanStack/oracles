---
'@tanstack/eslint-plugin-oracles': patch
---

`oracle/no-unit-test` now reports a test whose body is an empty function in an oracle file, such as `it('x', () => {})`, `test('x', async () => {})`, or `it.skip('x', () => {})`, with "This test's body is empty, so it checks nothing. Remove it, or use it.todo." Before, an empty body was exempt as a placeholder, so an oracle file could hold tests that judge nothing. A replay placeholder can register with `it.todo` instead. `it.todo('x', () => {})` is reported with "it.todo takes no body; remove the body."

The `recommended` and `production` configs no longer apply to tool config files: the configs of ESLint, Vite, and Vitest (`vite.config.ts`, `vitest.unit.config.mjs`) and any `*.oracle.config.*`, such as `eslint.oracle.config.mjs`, whose names match the oracle-file globs. Companion oracle modules such as `foo-oracle.ts`, and source modules such as `src/foo.config.ts`, keep the rules. A config that spreads a preset and sets its own `ignores` must merge them with the preset's (`[...preset.ignores, ...own]`), as the README shows.

The rules' source comments no longer cite files that the package does not ship, such as this repository's scripts and the `@tanstack/oracles` sources.
