---
'@tanstack/oracles': minor
---

`oracleProperty` no longer infers the plan type from the plan parameter of `check`, `reached`, or `predict`. A shared helper typed `(plan: unknown, …)` passed as `check` used to make the plan `unknown`, and the errors appeared inside `model` and `driver`. The plan type now comes from `resolve`, `model`, `driver`, and calibrations, and otherwise is the history type.

**Breaking (types only).** A `check`, `reached`, or `predict` whose annotated plan parameter does not accept that plan type no longer compiles; the error is reported at that option. This includes a parameter narrower than the history, and a mutable-array type on a history that a literal infers (read-only since `const` inference). Migrate by widening the annotation to the plan type, or by annotating `model` the same way.
