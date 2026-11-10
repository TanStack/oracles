# Oracle glossary

This glossary owns the terms for oracle work with `@tanstack/oracles`. The
project's own glossary or architecture documents own its domain terms. Use one
term for one concept. Do not rotate synonyms for style.

## Laws and evidence

| Term                   | Meaning                                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| law                    | A promised behavior, stated so that a reader could predict an observation without reading production. An `oracleProperty` states it in `law.statement`.                                             |
| authority              | Where a law comes from: an API or contract document and section, or a dated maintainer decision. Production output is evidence, never authority.                                                    |
| limits                 | What a property does not establish. Unresolved parts of a law go here.                                                                                                                              |
| law sheet              | The first output of oracle design: each law with its authority, status, rival, distinguishing witness, and checkpoint. A human reviews it before any code.                                          |
| law status             | `adopted` (has an authority), `observed` (production does it, nobody has adopted it), or `open` (a question for the maintainer). Only an adopted law becomes an expected result.                    |
| rival                  | A plausible different law that predicts a different observation for some history.                                                                                                                   |
| witness                | A history that shows something: that a state is reached, that two laws differ, or that a distinction matters.                                                                                       |
| distinguishing witness | A legal history where a law and its rival, or two model states, predict different observations.                                                                                                     |
| allowed set            | The answers a model accepts where the contract leaves a choice open, such as an order of independent events. The check accepts any member. This is how an oracle keeps an implementation's freedom. |
| oracle                 | The parts that judge production behavior: law, histories, model, driver, and check.                                                                                                                 |
| oracle file            | A test file whose tests are oracles. Its name contains `oracle`.                                                                                                                                    |

## The parts of an `oracleProperty`

| Term                   | Meaning                                                                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| history                | Starting conditions plus a sequence of actions or events, including timing.                                                                                                 |
| history grammar        | The values, actions, constraints, and schedules that can form legal histories: the fast-check arbitrary and its resolver.                                                   |
| plan                   | The concrete actions that `resolve(history)` gives. The driver runs it, and the model and check read it. It never holds expected observations.                              |
| model                  | The part that gives the expected result of a plan without production. It is pure. It may read the inputs that the driver recorded in the trace, never production's outputs. |
| driver                 | The part that runs a plan through the real production entry point and records observations. It returns nothing, so it cannot decide a verdict.                              |
| observation            | One recorded public fact, recorded with `observe(checkpoint, value)`. It must be data.                                                                                      |
| trace                  | The ordered observations of one history.                                                                                                                                    |
| checkpoint             | The exact point where the contract owes an observation.                                                                                                                     |
| check                  | The part that compares the trace with the model and reports a violation. Only the check can fail a law.                                                                     |
| violation              | A check's report that a history broke a law at a checkpoint.                                                                                                                |
| calibration            | A named wrong answer (a corrupted trace or a mutant driver) and the law that must reject it.                                                                                |
| campaign               | One run of a generated `oracleProperty`: a fixed-seed test or the random test.                                                                                              |
| replay                 | Rerunning a recorded failure from the command that the failure prints.                                                                                                      |
| shrinking              | Reducing a failing history while it still fails the same way.                                                                                                               |
| bounded exhaustiveness | Running every case inside stated finite bounds, with an enumerated history source.                                                                                          |

## Reach

| Term                | Meaning                                                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| reach               | The declared states that a history entered.                                                                                                                      |
| declared state      | A state in `states`. A constructed history must enter it.                                                                                                        |
| measured state      | A state in `measured`. The run reports how often histories enter it, but nothing requires it.                                                                    |
| constructed history | A history built from a generated one so that it enters named declared states. Only constructed histories make reach required.                                    |
| fixed history       | A named history, such as a regression. It is not reach.                                                                                                          |
| state probe         | A production call, `probing && globalThis.__oracleProbe?.(name, condition)`, that reports where production decides to enter a state. Production builds strip it. |
| probe-only code     | The probe statements and their guard. The gap check does not mutate them.                                                                                        |

## Gaps

| Term              | Meaning                                                                                                                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| owns              | The production files or functions an oracle answers for, listed in the `owns` option of `oracleProperty`. The gap check judges owned code only.                                                                         |
| gap check         | The loop that runs the oracle files against production and against mutants of the owned code. It reports every gap with one instruction.                                                                                |
| mutant            | A small deliberate change to owned production code. Every mutant is deliberately wrong, so do not qualify the word. The original defect is a common mutant to check.                                                    |
| kill              | A mutant that a law rejects through a registered `oracleProperty` route. A plain test in an oracle file is an unregistered kill, and it does not count.                                                                 |
| survivor          | A mutant that no law rejects. Every survivor is a gap.                                                                                                                                                                  |
| gap               | Owned behavior that the oracles do not judge. It closes only when a law kills it or the code is removed.                                                                                                                |
| exit              | Any reasoning that puts a gap out of reach: calling a mutant equivalent or unobservable, or accepting a gap. None is allowed.                                                                                           |
| framework bug     | A gap that no kill or removal can close. The agent stops work on that gap and reports its key and evidence.                                                                                                             |
| exclusion control | ORC-004's control: a nearby invalid history that the grammar rejects. It is required, and distinct from a quiet exclusion, which is a finding.                                                                          |
| dead code         | Code whose removal no legal history can observe. Remove it.                                                                                                                                                             |
| invalid mutant    | A mutant that no oracle could possibly detect. The framework must not generate one, so meeting one is a framework bug to report. The author never decides that a mutant is invalid, and the label does not close a gap. |
| unowned           | Production code that no oracle owns. The gap check reports it as a warning, not as judged.                                                                                                                              |
| RED               | The extended oracle failing on unchanged production. It shows that the oracle can see the defect.                                                                                                                       |
| GREEN             | The same oracle passing after the change.                                                                                                                                                                               |

There is no "equivalent mutant" and no "unobservable effect". A survivor
shows a missing history, observation, or law, or dead code. An effect that
no check sees is an effect that the driver does not record.

## Model alignment rule

For every model state, action, and observation, apply one of these rules:

1. If it represents a production concept, use the production term.
2. If it combines production concepts, name the abstraction and list what it
   combines.
3. If it splits one production concept, qualify each part and state the split.
4. If it exists only in the model, say so. Do not give it a production name.

Aligned names do not mean copied logic. A model should not use production
queues, caches, or helpers merely to share their names.
