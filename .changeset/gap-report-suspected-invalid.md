---
'@tanstack/oracles': patch
---

The `oracle-gaps` report lists suspected invalid mutants with the generator's own evidence. When a static rule over one module shows that no caller can tell a mutant from the original, the mutant carries that evidence as `invalid` in `results.json`. Its survivor gets the class `suspected-invalid` instead of `not-distinguished`, and `summary.md` lists each such gap once more, in a new "Suspected invalid mutants" section, by key, line and evidence, ready to paste into a framework bug report. The mutant is still emitted and judged, and still counts as a gap. Its directive says to check the evidence and report it, and that a caller which tells the two apart refutes it. Four rules, read by syntax and the binder alone, never by types:

- a returned value in an unexported, synchronous, non-generator function (declared, a `const` arrow or anonymous function, or a private method) in an ES module, that only direct calls reach, each of which discards the value;
- the same, where each call reads the value as a condition at most and the returned value is a falsy literal;
- a `null` property of an object literal bound to an unexported `const` that is only read through named properties, where every read of that property is `== null`, `!= undefined`, `?.`, `??` or a condition;
- a property of such an object that no code reads, whose value is a literal or a local read.
