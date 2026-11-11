---
'@tanstack/oracles': patch
---

Fix stale results from the gap CLI's daemon (`--daemon`). A warm context now records every module that a batch of mutant runs loads, so the next check invalidates a module that changed. Before, only single runs recorded what they loaded. A hang can replace the context that recorded a module. Another context could then keep the old module after an edit. The daemon then reported results from before the edit, such as a kill that the cold run no longer finds.

A stored run now also lists the modules that its copy evaluated. A module that only a mutated branch imports at run time is then one of its inputs. Before, an edit of such a module left the stored verdict in place. A run whose known inputs change while it runs is no longer stored.
