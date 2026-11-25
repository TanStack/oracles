---
'@tanstack/oracles': patch
---

`oracle-gaps`'s cluster note now lists the public entry points that statically reach its function: every export of a `--source` file whose call tree holds it, by its owns name, with the oracle files that own it, or `owned by nothing` (`Reached from: src/a.ts#parse (owned by tests/parse.oracle.test.ts), src/b.ts#format (owned by nothing).`). When an entry point is owned by nothing, the note adds that no law judges what it returns, so the survivors are no evidence that it does not need the function. Before, a downstream project read survivors in a helper as code no law needs and removed it, which changed the result of a second export that no oracle owned. The analysis finds the entry points only when a report has a cluster note.
