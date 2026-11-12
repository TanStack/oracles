---
'@tanstack/eslint-plugin-oracles': patch
---

**Breaking (unreleased package):** `settings.oracles.unknownSources: 'ignore'` is removed. An unknown source never passes silently, and a global ignore mode contradicted that. The modes are now `'report'` (the default) and `'test'`. A configuration that still says `'ignore'` gets `malformedSetting` at line 1, with a message that names `settings.oracles.nonTestPackages`, and the rules read the setting as unset. To silence a specific package, list it in `settings.oracles.nonTestPackages`.

The malformed-setting report has one message id, `malformedSetting`, in both `oracle/no-unit-test` and `oracle/oracle-property-only`. It replaces `malformedSourceSetting`, which `oracle/no-unit-test` reported before this change.
