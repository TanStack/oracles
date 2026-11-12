---
'@tanstack/oracles': minor
---

The `oracle-gaps` report no longer reports a shortcut for speed as `not-observed`. A survivor that changed no observation but made a test do more work is now `extra-work`. Before, its directive said to observe a value or widen the oracle, which cannot work for a branch whose fast and general paths give the same result, and an author who removed the code instead made it slower. Work is the number of site evaluations that the test's instrumented production code makes, a deterministic count, never a time. The `extra-work` directive names the test, its work before and after, and the bound to declare. `oracleProperty` takes a new `work: { ratio }` option. Under the gap report, a mutant whose work in one of the property's tests is more than `ratio` times the unmodified code's work is killed under the law `work bound`. `ratio` must be a finite number of at least 1. A plain Vitest run has no unmodified run to compare with, so there the bound judges nothing.
