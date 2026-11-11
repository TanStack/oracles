---
'@tanstack/oracles': patch
'@tanstack/eslint-plugin-oracles': patch
---

Messages now direct authors to `oracleProperty` only. `declareOracle` is legacy and marked `@deprecated`: use `oracleProperty`, which takes `owns` and its parts. The `oracle-gaps` CLI's "no oracle file" refusal and its fix name only `oracleProperty`, and `oracle/no-unit-test`'s messages no longer tell authors to call `declareOracle`. The CLI and the rule still read both forms.

The published sources of both packages no longer cite files that their package does not ship, such as the CLI's and the framework's own oracle tests and the plugin's rule source.
