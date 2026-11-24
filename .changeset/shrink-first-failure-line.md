---
'@tanstack/oracles': patch
---

A failing campaign unit whose reported counterexample is not its first failing history now prints a `First failure:` line beside fast-check's report. The line gives the first violation's checkpoint, law, difference, and history. Shrinking keeps the first failure's law, as before. A smaller history can break that law at another checkpoint, or for another reason, and the report used to show only the smaller failure. A unit whose counterexample is its first failing history prints no such line. So does a path replay, and a unit whose first failure is not a law violation.
