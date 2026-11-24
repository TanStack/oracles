---
'@tanstack/oracles': patch
---

Scope a gap mutant's anchor to the innermost statement or declaration that holds it. A mutant in a default parameter, a property declaration, an enum member, a decorator, a heritage clause, or a computed member name of a class member, an object method, or an object accessor used to anchor to the whole file, so its gap key changed on every edit to that file. It now anchors to that declaration. A computed name on an object-literal property still anchors to its statement, as before.

This changes gap keys once, and stored gaps for the changed keys should be re-baselined. Gaps recorded under the old keys show as new once. Measured on the 17 non-test gap-CLI sources as this branch ships them (base origin/main at fbb99aad, 7,269 mutants), 17 keys change in 5 files: 11 were whole-file anchors. One mutant in `classify.mjs`, a `value-undefined` on a default parameter inside a `const` statement, moved from its statement's anchor to its parameter. Five keys in `classify.mjs` (the `~2` to `~5` suffixes of one anchor) changed only their index, so a stored key for one of them now names a different mutant. The maintainers accepted these key changes ("slight change to gap keys is fine", 2026-11-23).

Shipped bytes: the two shipped CLI files change by +469 bytes raw and +134 bytes gzip (`schemata.mjs` +454 raw, `report.mjs` +15 raw; the test file is not shipped).
