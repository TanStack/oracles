---
'@tanstack/oracles': patch
---

`oracle-gaps` gives a surviving `return-undefined` mutant of a returned `false` its own class, `falsy-return`, in place of `not-distinguished`. A caller that tests the result only for truthiness cannot tell `false` from `undefined`, so these gaps made up a large share of a project's `not-distinguished` count, and each had to be read by hand. The class's legend line says what the mutant did, and its directive names the callers that tell the two apart (`=== false`, `typeof`, `??`, `JSON.stringify`), the driver observation that an exported function owes, and the step where no caller tells them apart: return nothing there, and declare the result type `boolean | undefined`. The mutant is still emitted and judged: a caller outside the module can tell the values apart.
