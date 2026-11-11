---
'@tanstack/oracles': patch
---

A calibration can now require the violation's difference as well as its law. Give it `difference`, a string that the violation's difference must contain, or a `RegExp` that it must match. The check must then reject the wrong answer for that reason. Before, a calibration could require only the law, so an oracle that judges several faults under one law had to put the fault in the law's name. The law is judged first. A corrupted trace that fails with another difference fails the calibration and names the difference that the check reported. A mutant driver goes on to the next candidate history, as it does for another law. A calibration without `difference` works as before.
