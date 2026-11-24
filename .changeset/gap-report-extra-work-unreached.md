---
'@tanstack/oracles': patch
---

The `oracle-gaps` legend for an `extra-work` gap now says first what the class means: no observation of the owner tests changed under the mutant, and a test did more work. A mutant that changes state which no history goes on to read lands there too, such as an `if (!map.has(key))` forced to `true`, which replaces the first registration's state on a second registration of the same key. The legend says to look for a history that reads what the mutated code changed before declaring a bound. Before, the class read as a speed shortcut only, and an author could declare a work bound where a history was missing. The README and the design and explore skills say the same.
