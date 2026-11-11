---
'@tanstack/oracles': patch
---

The tests and files that an `oracle-gaps` report names no longer depend on how the run was made. They are now in report order: by file path, compared by code unit, and within a file in the order of the baseline run's records. This applies to a message's test, the `Owners` and `Changed observations in` lists, the operands of a `not-infected` message, the tests of an `indeterminate` message, the files that a refusal names or that the report leaves out (`excluded`), and results.json's `nondeterministic` tests. Kill, crash, and framework-error messages also order files by path. Within a file, they use the order in which the reporter lists the file's tests. A batch that a hang cut off uses the order of the mutant run's records. An operator mutant's owner files also run in path order, so a kill names the laws of the first file that kills.

Before, these lists followed the order in which the runner joined its contexts' units. So `--contexts`, whose default depends on the machine's cores, could change which test a message named. An authored mutant's lists followed the order in which its owners were declared.
