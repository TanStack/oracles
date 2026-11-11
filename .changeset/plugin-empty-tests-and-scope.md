---
'@tanstack/eslint-plugin-oracles': patch
---

`oracle/no-unit-test` now reports a test whose body is an empty function in an oracle file, such as `it('x', () => {})`, `test('x', async () => {})`, or `it.skip('x', () => {})`, with "This test's body is empty, so it checks nothing. Remove it, or use it.todo." Before, an empty body was exempt as a placeholder, so an oracle file could hold tests that judge nothing. A replay placeholder can register with `it.todo` instead.

The `recommended` and `production` configs no longer apply to tool config files (`*.config.{js,mjs,cjs,ts,mts,cts}`), such as `eslint.oracle.config.mjs`, whose names match the oracle-file globs. Companion oracle modules such as `foo-oracle.ts` keep the rules.

The rules' source comments no longer cite files that the package does not ship, such as this repository's scripts and the `@tanstack/oracles` sources.
