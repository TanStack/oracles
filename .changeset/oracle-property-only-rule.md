---
'@tanstack/eslint-plugin-oracles': minor
---

Add the `oracle/oracle-property-only` rule, enabled in `configs.recommended`. In an oracle file it reports a raw property campaign (`fc.assert`, `fc.check`, or a `.prop` registration) and an import of `createOracleReach` or `runOracleCampaign`: generated histories run through `oracleProperty`, whose constructed histories make each required state's reach required. Framework implementation modules are exempt. A file that still migrates can be named in `settings.oracles.legacyCampaigns` as `{ file, reason }`; an entry without a reason is reported, and an entry with no legacy use left is reported as stale.
