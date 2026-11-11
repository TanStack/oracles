---
'@tanstack/oracles': minor
---

An enumerated source can declare the states its laws depend on: `histories: { enumerated, states, measured }`, where `enumerated` is the list a plain enumerated source passes, and `states` and `measured` are state names. Every enumerated history runs, so a required state needs no constructed history. A `reach` test after the histories fails when no enumerated history entered a state in `states`, and otherwise prints how many entered each declared state, as `<id> enumerated reach {...}`. A history counts once it is judged, passing or violating its law. The reach test runs any history that no earlier test of the run judged, such as one that a `-t` filter left out. A judged history that enters a state outside `states` and `measured` fails its test. A plain list of histories is unchanged and registers no `reach` test. Only a generated source binds a probe to a state.
