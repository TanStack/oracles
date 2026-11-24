---
'@tanstack/oracles': patch
---

The `oracle-gaps` legend line for a `not-judged` gap now says what happened before its directive: an owner test recorded different observations under the mutant, and every law of that test still passed, so the driver saw the difference and no law judges it. Before, the line held only the directive, "Make a law in `<test>` reject the changed value.", which did not say that the class is a seen but unjudged difference.
