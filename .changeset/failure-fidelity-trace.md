---
'@tanstack/oracles': patch
---

`createOracleFailureFidelity` now describes a history, by default, as an `oracleProperty` failure's History line does, in full. JSON data still prints as its JSON text. Before, the default was `JSON.stringify`, so a trace printed `-0` as `0`, NaN and the infinities as `null`, dropped an `undefined` field, printed a Map or a Set as `{}`, and a history holding a bigint threw a `TypeError` in place of the failure. A `describeHistory` passed in works as before.
