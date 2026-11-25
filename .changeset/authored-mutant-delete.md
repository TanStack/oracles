---
'@tanstack/oracles': patch
---

An authored mutant can now delete code: an empty `replace` removes the text that its `find` names. Before, `oracle-gaps` refused a mutant whose `replace` was the empty string ("lacks replace"), so a mutant that puts back a removed call had to replace it with a newline. The other fields (`id`, `source`, `find`, `intent`, `author`) must still be non-empty strings, and a mutant with no `replace` at all is still refused. An empty `find` stays refused because it names no place in the source. The report shows an authored mutant by its `intent` and author, and never quotes its `find` or `replace`, so a deletion shows the same way as any other edit. `results.json` keeps its `replacement` as `""`.
