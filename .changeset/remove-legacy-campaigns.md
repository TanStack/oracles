---
'@tanstack/eslint-plugin-oracles': patch
---

`oracle/oracle-property-only` reports every raw campaign and legacy campaign import in an oracle file, and only a framework implementation module is exempt. No setting exempts a file. A configuration that sets `settings.oracles.legacyCampaigns`, to any value, gets one `removedSetting` report at line 1 of each oracle file, which says to convert the listed files to `oracleProperty` and delete the setting.
