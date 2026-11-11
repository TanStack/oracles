---
'@tanstack/oracles': patch
---

The tests that an `oracle-gaps` report names no longer depend on how the run was made. A message, the `Owners` and `Changed observations in` lists, the operands of a `not-infected` message, and the tests of an `indeterminate` message now name tests by file path, and within a file in the order of the baseline run's records. Before, they followed the order in which the runner joined its contexts' records, so `--contexts` (whose default depends on the machine's cores) could change which test a message named, and an authored mutant's lists followed the order in which its owners were declared.
