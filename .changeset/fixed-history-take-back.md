---
'@tanstack/oracles': patch
---

`oracleProperty` checks, when it registers a generated source, that its arbitrary can take back (`canShrinkWithoutContext`) each fixed history and each constructed history built from the first fixed seed (or seed 0 when there is none). If it cannot, the property fails to load with an error that names the property, the history (a fixed history's index and name, or a constructed history's name), and the fix. Before, the check ran only when the history's test ran, after the campaigns, and its message blamed the language. In fast-check 4, a `.map` without an unmapper takes no value back, at the whole history or anywhere inside it, so a history inside the language failed too. Give that `.map` an unmapper (its second argument). `fc.constant` and `fc.constantFrom` take back only primitives or the same object reference, so build objects with `fc.record` or `fc.tuple` over primitive leaves. `.chain`, `fc.func`, and `fc.commands` cannot take a value back.

The check runs when the test file loads. One history that the arbitrary cannot take back now fails the load of the whole file, so it also blocks the file's other properties. Constructed histories are now built at import: a `build` that throws there fails the load with an error that names the property and the constructed history, with the build's error as its `cause`.
