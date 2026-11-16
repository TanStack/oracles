---
'@tanstack/oracles': patch
---

The `oracle-gaps` report's `evidence` in `results.json` has a new count, `ran`: the units a check computed that ended without a cut. `cut` counts cut events (a cut copy that is confirmed alone is cut in its batch and again if its confirmation is cut), so `computed - cut` is not a count of runs.
