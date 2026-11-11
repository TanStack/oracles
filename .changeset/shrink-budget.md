---
'@tanstack/oracles': patch
---

A failing campaign now reports its law violation before its test times out, however slow its histories are. Before, fast-check shrank a failure without a limit. A slow property could then outlast its `timeout`, and Vitest reported only "Test timed out", with no law and no counterexample. Now a campaign starts no shrink run once half of the property's `timeout` has passed. It then reports the smallest counterexample that it found, with the first failure's law, and that counterexample replays. A counterexample that the limit stopped can be larger than the smallest that fails. To shrink further, raise `timeout`. A path replay now runs its counterexample and does not shrink it again, so it reports the counterexample that it replays. A property whose runs each take less than half its `timeout` no longer needs `fc.limitShrink` to report its law in time.
