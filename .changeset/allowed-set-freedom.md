---
'@tanstack/oracles': patch
---

Add `notAllowed(checkpoint, law, actual, allowed, freedom)`, the allowed-set comparison. It is a violation of `law` at `checkpoint` when `actual` is the same data as no member of `allowed` (the equality `differs` uses), with `{ actual, expected: allowed }` attached, and undefined otherwise, so it chains as `differs` does. `freedom` names the choice the set rests on, in the words of the law's `limits`. In a property's check, a freedom that is blank, or that `limits` does not contain verbatim, throws an `OracleFreedomError` naming the property, the checkpoint, and the freedom, so that property's history tests fail and the file's other properties still run. An allowed set can then never be wider than the limits its law states. `docs/model-styles.md` (section 6) and the design skill now say so, and ask for a calibration at each freedom's edge.
