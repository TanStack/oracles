---
'@tanstack/oracles': patch
---

A failing campaign unit's message now says why it failed. Before, it held only fast-check's report (`Property failed after N tests`, the seed and path, the counterexample) and the rerun and replay lines. The violation was only the error's `cause`, which Vitest's JSON reporter (`failureMessages`) drops. After fast-check's report, the message now holds the violation of the counterexample it reports: the line that names the property, checkpoint, and law, then `Law:`, `Difference:`, and, when the check gave values, `Observed:` and `Owed:`. The cause is unchanged, so the default reporter still prints the whole violation under `Caused by:`.
