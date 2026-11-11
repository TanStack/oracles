---
'@tanstack/eslint-plugin-oracles': minor
---

Remove `settings.oracles.legacyCampaigns`. `oracle/oracle-property-only` now reports every raw campaign and legacy campaign import in an oracle file, and only a framework implementation module is exempt. A configuration that still sets `legacyCampaigns`, to any value, exempts nothing and gets one `removedSetting` report at line 1 of each oracle file: "`legacyCampaigns` is removed: convert the listed files to `oracleProperty`". The `baselineWithoutReason`, `staleBaseline`, `malformedList`, `malformedEntry`, and `refusedEntry` reports are gone with the setting.
