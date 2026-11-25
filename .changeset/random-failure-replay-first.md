---
'@tanstack/oracles': patch
---

A failing random-seed campaign unit (`random seed: <name>`) now says, on the line before its `Replay:` line: "A random-seed failure: replay this seed before rerunning; a passing rerun draws other histories and proves nothing." A rerun draws a new random seed, so a rerun that passes does not show that the failure was flaky. Fixed-seed units are unchanged.
