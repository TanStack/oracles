---
'@tanstack/eslint-plugin-oracles': patch
---

Add ESLint rules for oracle tests: no disabled oracles, no unit tests in oracle files, pure models, replayable seeds, and the production probe form. `settings.oracles` sets the environment prefix and the modules that count as implementation and replay-witness modules.

Add the `oracle/oracle-property-only` rule, enabled in `configs.recommended`. In an oracle file it reports a raw property campaign (`fc.assert`, `fc.check`, or a `.prop` registration, through `fast-check` or `@fast-check/vitest`) and an import of `createOracleReach` or `runOracleCampaign`, so a generated-history law runs through `oracleProperty` and its constructed histories. Framework implementation modules are exempt. `settings.oracles.legacyCampaigns` lists `{ file, reason }` entries for files that still migrate; an entry without a reason, an entry with no legacy use left, and an entry the rule cannot judge (a file outside the oracle-file glob, or an implementation module) are each reported. The rule sees one file at a time, so it cannot stop a baseline from growing; a project enforces shrink-only in its own diff check.
