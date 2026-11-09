---
'@tanstack/oracles': minor
---

Remove `createOracleReach` and `runOracleCampaign`. Both ran a generated campaign whose reach came from a seed, so a passing run showed no reach. Declare the law with `oracleProperty` instead: its `histories.constructed` build each declared state, so that reach is required, and states it only measures go in `histories.measured`. `oracle/oracle-property-only` (in `@tanstack/eslint-plugin-oracles`) reports the removed APIs and any raw fast-check campaign in an oracle file.
