---
'@tanstack/oracles': patch
---

The `oracle-gaps` directive for a `not-observed` gap now names a third case: where every path overwrites the changed value before anything reads it, such as an initializer written only for the type checker, the code is dead: the value is to be removed, keeping any call it makes. Before, the directive pointed only at the oracle (observe the value, or add a history where the mutated code computes something different), and neither step can kill a mutant of a value that nothing ever reads. The design skill says the same.
