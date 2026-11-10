---
'@tanstack/oracles': patch
---

`oracleProperty` takes an `owns` list: the production files or functions (`src/x.ts`, `src/x.ts#fn`) whose static call tree the oracle owns. A file that calls `oracleProperty` is an oracle file, so `declareOracle` is no longer needed to declare ownership. `declareOracle` still works during the migration. The `oracle-gaps` CLI reads `owns` from either place. It refuses a run that has no oracle file, or in which no file owns a selected source, with one diagnostic. Before, such a run reported zero gaps without judging anything. `law.owner` is removed. Each run writes its output under `<package>/.oracle-gaps/out/<run>/` and its bundles under `<package>/.oracle-gaps/bundles/` by default, not in a shared `/tmp/oracle-gaps` or in a workspace dependency's folder. Add `.oracle-gaps/` to `.gitignore`.
