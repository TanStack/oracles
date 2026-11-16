---
'@tanstack/oracles': patch
---

The `oracle-gaps` work count no longer includes probe code. A site in probe-only code (the probe guard, a probe statement, or a probe helper) counts nothing toward a test's work, so a work bound no longer kills a mutant whose only extra work is a probe, such as an `if` forced into a branch that only calls `report()`.
