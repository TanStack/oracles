---
'@tanstack/oracles': minor
---

Add counted probes. A generated source can name state probes in `counted` to measure how often production does something, such as the passes of a loop, without a law: a history's count of a probe is the number of its calls with a truthy condition. Each campaign unit that passes prints one more line after its reach line, `<id> <unit> counts {...}`: for each counted probe, in name order, the `min`, `median` (the lower middle), `max`, and `total` of its counts over the histories the unit judged, and how many `histories` it judged (`min`, `median`, and `max` are null when it judged none). A counted probe needs no `predict` and no calibration, judges nothing, and changes no test's outcome. A property without `counted` prints nothing new.
