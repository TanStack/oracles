---
'@tanstack/oracles': patch
---

`oracle-gaps --only` accepts a mutant's key beside its id. The key is `key` in `results.json` and `Key:` in `summary.md`. An id counts a source's mutants in order, so any edit that adds or removes a mutant before it renumbers it, and a stale id still in range names another mutant. A key names the function, the operator, and the statement, so an edit elsewhere in the source leaves it alone. A comma inside a key's statement does not split it. A key that names no mutant of the run is refused like an unknown id. An entry that names more than one mutant is refused too, naming the key of each one. This happens with an id that two sources share, such as `src/a.ts` and `a.ts`, which both give `a.ts:M1`. Before, such an id selected both mutants.
