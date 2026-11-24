---
'@tanstack/oracles': patch
---

Scope a gap mutant's anchor to the declaration that holds it. A mutant outside a statement's range (a default parameter, a property declaration, an enum member, a decorator, a heritage clause, a computed member name, or an `export default` expression) used to anchor to the whole file, so its gap key changed on every edit to that file. It now anchors to that declaration.

This changes gap keys once, and stored gaps for those keys should be re-baselined. On the gap CLI's own sources (17 files, 7,188 mutants), 17 keys change in 5 files. 11 of them were whole-file anchors. One mutant in `classify.mjs`, a `value-undefined` on a default parameter inside a `const` statement, moved from its statement's anchor to its parameter. Five keys in `classify.mjs` (the `~2` to `~5` suffixes of one anchor) changed only their index, so a stored key for one of them now names a different mutant. Gaps recorded under the old keys show as new once.
