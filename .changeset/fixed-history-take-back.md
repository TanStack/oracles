---
'@tanstack/oracles': patch
---

`oracleProperty` checks, when it registers a generated source, that its arbitrary can take back each fixed history and each constructed history that the first fixed seed builds (`canShrinkWithoutContext`). If it cannot, the property fails to load with an error that names the property, the history (a fixed history's index and name, or a constructed history's name), and the fix. Before, the check ran only when the history's test ran, after the campaigns, and its message blamed the language. In fast-check 4, a `.map` without an unmapper takes no value back, at the whole history or anywhere inside it, so a history inside the language failed too. Give that `.map` an unmapper (its second argument), or build the history from `fc.record`, `fc.tuple`, or `fc.constantFrom`.
