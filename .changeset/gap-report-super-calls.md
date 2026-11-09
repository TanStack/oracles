---
'@tanstack/oracles': patch
---

Fix `oracle-gaps` instrumenting `super(...)` calls. Its statement-deletion mutant wrapped an expression statement that calls `super(...)` (`m(15) || super()`), so a derived class's constructor could skip `super()` or read `this` before it, and every construction failed with no mutant active. The instrumenter no longer makes a `super(...)` call a mutation site, so no mutant can make it conditional, remove it, or move it.
