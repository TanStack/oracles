---
'@tanstack/oracles': patch
---

Fix a stale result from the gap CLI's daemon (`--daemon`). A warm context now records every module that a batch of mutant runs loads, so the next check invalidates a module that changed. Before, only single runs recorded what they loaded. A hang can replace the context that recorded a module. Another context could then keep the old module after an edit. The daemon then reported results from before the edit, such as a kill that the cold run no longer finds.
