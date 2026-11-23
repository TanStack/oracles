---
'@tanstack/oracles': patch
---

Scope a gap mutant's anchor to the declaration that holds it. A mutant in a default parameter, a property declaration, an enum member, a decorator, or a heritage clause used to anchor to the whole file, so its gap key changed on every edit to that file. It now anchors to its declaration.

This changes the gap key of those mutants once. A gap recorded under the old key shows as new in the next run, and the gap report is otherwise unchanged. On the gap CLI's own sources, 17 of 7,158 mutants (in 5 files) get new keys.
