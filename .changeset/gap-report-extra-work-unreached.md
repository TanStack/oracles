---
'@tanstack/oracles': patch
---

The `oracle-gaps` legend for an `extra-work` gap now says first what the class means: every history the owner tests ran gave the same observations under the mutant, with more work. A mutant that changes behavior only in a state that no history reaches lands there too, such as an `if (!map.has(key))` forced to `true`, which differs only on a second registration of the same key. The legend says to look for a history that reaches the difference before declaring a bound. Before, the class read as a speed shortcut only, and an author could declare a work bound where a history was missing. The README and the design and explore skills say the same.
