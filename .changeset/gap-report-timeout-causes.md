---
'@tanstack/oracles': patch
---

The `oracle-gaps` legend and directive for a `timeout` gap now tell its three causes apart. Before, the directive said to bound the run of the owner tests, while the design skill said a timeout is a production loop that the CLI does not judge yet and that a driver must not time out. Both were right for one cause only. The legend now says that an owner test's run did not end because production loops forever in its own code, because a driver awaits a promise that the mutant never settles, or because a driver's loop over what production hands out never ends. The directive tells the author to wait with `withinTurns(promise, turns)` and record a promise still pending, to stop a loop over what production hands out one item past what the history can produce and record that item, and to report a loop in production's own code as a known CLI shortfall. The design skill says the same, and its driver section now names `withinTurns`.
