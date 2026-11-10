---
name: oracles-design
description: Design, write, or change an oracle with @tanstack/oracles. Choose the boundary, write a law sheet first, choose a model, and build histories that reach the states the law needs. Show the evidence the change needs, and close every gap. Use for a new oracle, an oracle repair, or a production change in owned code. Also use for any change to a model, history grammar, driver, or check.
---

# Design an oracle

An oracle states a law, generates the histories where the law matters, and
checks production against an independent model. Make the law clear enough
that someone could predict an observation without reading production. The
code comes after that.

Read this skill in full, then read the [glossary](../../docs/glossary.md).
The [checklist](../../docs/oracle-checklist.md) is the complete list of
requirements. This skill cites it by ID, such as ORC-004.

**Work in this order.** Reviewers check the order as well as the result. A
shortcut moves the work into review, where each finding costs a fix, a new
witness, and another round. The common shortcuts are changing production
first, editing the model to match production, narrowing histories until a
failure goes away, and pinning one example. `oracles-review` §2 lists them all.

## 1. Choose the boundary, then write the law sheet

**Choose the boundary first.** An oracle maintains one caller-visible
promise, not one file. Before the law sheet, establish:

| Question                           | What to establish                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| What promise belongs together?     | One caller-visible behavioral contract.                                        |
| Where is it observed?              | The public entry points and the checkpoints where it is owed.                  |
| What does it assume?               | What providers, the environment, and neighboring components must supply.       |
| What else witnesses it?            | Other drivers for the same law: component, integration, end-to-end, or replay. |
| Where does another contract begin? | A different authority, lifecycle, observation boundary, or composition rule.   |
| Which source implements it?        | The `owns` list that the gap check uses.                                       |

Example: an oracle for optimistic publication can hold several related laws
(an optimistic write is visible at once, a confirmation keeps it, and a
rollback removes it) and several drivers (an in-memory provider and a real one). It
keeps its identity if the code moves between files. One source file can also
serve several contracts. A new failure belongs to the oracle whose law covers
its promise.

**Decide whether the user must approve.**

- **Strengthening an adopted law** (a missing history, observation, driver
  path, or check) reuses the law as it is. Do not write a new sheet, and do
  not stop. Name the law in the evidence.
- **Changing a law** (its promise, domain, checkpoint, assumptions, or the
  freedoms it allows) needs a law delta: the old and new row for each changed
  law. Stop for the user's review.
- **A new law, or missing or contradictory authority,** needs the full law
  sheet below. Stop for the user's review.
- **The task already approved these laws?** Do not ask again.

Write one row per law and give the sheet to the user.

| Field      | What to write                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------- |
| Law        | The promise, stated so that a reader could predict an observation.                                                    |
| Authority  | The API or contract document and section, or a dated maintainer decision.                                             |
| Status     | `adopted` if it has an authority, `observed` if production does it but nobody adopted it, `open` if it is a question. |
| Rival      | A plausible different law.                                                                                            |
| Witness    | A legal history where the law and its rival predict different observations.                                           |
| Checkpoint | Where the contract owes the observation.                                                                              |

- **Production output is evidence, never authority.** A rule that you write
  only because production does it is model hacking. Mark that rule
  `observed`, and ask the user.
- Only `adopted` laws become expected results. An `observed` or `open` law
  goes to the user as a question.
- When the promise is unclear, or two readings predict different behavior, use
  the [law discovery](../../docs/instruments/law-discovery.md) card.

**Stop here** when the sheet or a law delta is needed. Do not write the oracle
until the user has reviewed it.

Once the user approves it, the sheet becomes the **law block**: the opening
comment of the oracle file, beside the model that enacts it. Each row's law,
authority, and limits also go in that property's `law` option. Keep the
block, the `law` option, and the model in step: a change to one updates the
others in the same change (ORC-003).

## 2. Freeze what the oracle must preserve

Write these down. They stay fixed while you build the oracle.

- The laws and their checkpoints, from the sheet.
- The owned production code: the files or functions the oracle answers for.
- The freedoms the contract leaves open, such as the order of independent
  events, scheduling, or representation. The oracle must accept every
  allowed choice.

Do not weaken a check, history, or law in the same step that clears a
failure. Make each weakening its own decision, with its own reason.

**Name the parts, then reconstruct.** Before you trust a model:

- List its actions, its state, and its observations. Give each one its job:
  the law sentence it serves, or the legality it decides.
- Write each model rule as one sentence of the law. Mark any rule that you
  added rather than found in the authority.
- Rebuild the known examples (docs, issues, existing tests) with the
  histories and the model. A known example that the model cannot reproduce
  shows a missing part or a wrong rule.
- When two rules conflict, record the conflict as an open question for the
  user. Do not pick a winner.

For a hard law or a model that keeps growing, use the
[design grammar](../../docs/instruments/design-grammar.md) card.

## 3. Choose the model

Pick by the shape of the law, in this order, and use the first style that
can state it:

1. **The observation is a function of the inputs or the whole history.**
   Write a pure function from the plan to the expected observation. This is
   the default.
2. **A data structure with a simple abstract view.** Write a naive reference
   structure, such as an array, a Map, or a sorted copy, and compare
   production's observable state with it at each checkpoint.
3. **A lifecycle or protocol with named phases.** Write a transition table
   whose rows are `{ from, event, guard, to, effect }`.
4. **A stateful API without natural phases.** Write a pure step function,
   `(state, action) → { state, expected }`, that is defined for every legal
   action.
5. **The exact output is hard to compute.** State relations between runs,
   such as a round trip, incremental equals recompute, or order independence.
   Each relation needs a calibration that shows it can fail.
6. **The contract allows several outcomes.** Predict the **allowed set**, and
   cite the contract clause for each choice. Never pick one outcome that the
   contract leaves open.

Mixing styles is fine. [Model styles](../../docs/model-styles.md) shows a
small example of each style.

**Structure rules:**

- One dispatch per role. The resolver, model, and driver may each branch on
  the action kind once.
- The model is pure. It takes the plan and returns expectations. It never
  reads production or driver values, never mutates its input, and keeps no
  hidden state.
- Reach is a predicate over the plan or trace, or a production probe. It is
  not a side effect inside the model.
- Every model rule cites its authority.
- Use the project's terms for domain concepts. For anything the model
  combines, splits, or invents, apply the glossary's model alignment rule
  (ORC-009).

**Banned patterns** (each is a finding):

| Pattern                                                                         | Enforced by                        |
| ------------------------------------------------------------------------------- | ---------------------------------- |
| B1: expected values captured from production (`toMatchSnapshot` and similar)    | review (lint pending)              |
| B2: a raw campaign (`fc.assert`, `fc.check`, `.prop`) in an oracle file         | lint `oracle/oracle-property-only` |
| B3: `fc.pre` in an oracle file. Legality belongs in the grammar or `resolve`.   | review (lint pending)              |
| B4: a model that imports runtime code from production                           | review (lint pending)              |
| B6: a check whose only assertions are "does not throw", "defined", or "settles" | review (warning)                   |
| B7: the same expression on both sides of a comparison                           | review (lint pending)              |
| B8: a model that branches on a case name or a literal id from the grammar       | review (warning)                   |
| Unit tests or fixed expected answers in an oracle file                          | lint `oracle/no-unit-test`         |

B1, B3, B4, and B7 are review checks until lint ships them.

Techniques: [guide § The model](../../docs/guide.md#the-model).

## 4. Account for every distinction

Show what each law, model field, and model branch contributes.

- **A law:** give a legal history that the other laws allow and this law
  rejects.
- **A model state or field:** give a legal continuation (one or more
  actions) after which two states that differ only in it must give different
  observations, or allow different actions (ORC-008). A FIFO queue holding
  `[1, 2]` and one holding `[1, 3]` agree after one dequeue and differ after
  two.
- **A branch or exception:** give the history that needs it. If none exists,
  remove it.

If you cannot find a witness, look for a simpler representation before
adding more machinery. For example, three disjoint sets of ids that move
between each other may be one map from id to status. Count complexity that
you move into helpers, adapters, or mappings. Moving it does not remove it.
The [design grammar](../../docs/instruments/design-grammar.md) card shows how
to compare a simplification with the model it replaces.

**Laws stay simple. History generators may be elaborate.** Reaching a hard
state can need a sophisticated generator. Put that work in the histories, not
in the model.

## 5. Build histories that reach the law

- **Grammar.** The fast-check arbitrary and `resolve` produce only legal
  histories. Legality belongs here, never in a filter after generation.
- **Changing a filter or validity predicate is a contract change.** Narrowing
  the grammar removes histories from the claim. Say which previously legal
  histories it removes and why (ORC-004).
- **Reach.** Declare in `states` each state that a law needs, and give each
  one a constructed history that enters it (ORC-015). Put a state that you
  only count in `measured`. A literal example or a `fixed` history is not
  reach.
- **Probes.** Where production decides to enter a state, bind the state to a
  production probe, and predict entry from the plan alone.
- **ORC-004 controls.** For a claim about generated coverage, account for:
  - reconstruction: every known valid example can be generated
  - ablation: what each axis or rule contributes
  - range: the bounded domains and marginal cases
  - exclusion: a nearby invalid history that the grammar rejects

**Choose the run budget.** Random runs explore around the critical states.
They do not reach them.

- **Cover every critical state by construction.** Each state that a law
  needs is a declared state with a constructed history, and a probe where
  production decides to enter it. Never raise `runs` to reach a state.
- **Need a state at least N times?** Give it N constructed histories.
- **Give at least one fixed seed** in `fixedSeeds`. The random campaign always
  runs beside it. A kill that only the random campaign finds is a gap until you
  keep its history as a fixed or constructed history.
- **Start `runs` at 100** for a fast, synchronous driver, and at 25 to 50
  for a driver that awaits timers or I/O.
- **Keep it fast.** The gap check runs every owning oracle once for each
  mutant, so oracle time multiplies. Aim for each oracle file to finish in a
  few seconds in a normal run. Lower `runs` before you remove a dimension.
- **Read the reach counts.** If a measured state is rare, add a constructed
  history or change the generator's weights. Do not only add runs.
- **Run longer sweeps with the run multiplier** (`<PREFIX>_RUNS_MULTIPLIER`),
  locally or on a schedule, not by raising `runs` in the file.
- **Lowering `runs`, removing a fixed seed, or removing a constructed history
  is a weakening.** Give its reason in the change.

Techniques: [guide § Histories](../../docs/guide.md#histories).

## 6. Write the driver and the check

- **The driver** calls the real production entry point and records public
  observations with `observe(checkpoint, value)`.
  - It records production errors, unhandled rejections, and warnings that
    the law cares about.
  - It observes the contract's return values.
  - It awaits the work it starts.
  - It bounds its own run time and work, and throws a structured error when
    a bound is passed.
  - It releases what it created.
- **The check** compares observations with the model at each checkpoint. It
  is the only place that reports a violation. For exact values, use
  `differs(...) ?? pass`. For an allowed set, accept any member.
- **Calibration.** Give at least one `calibration`: a wrong answer, as a
  corrupted trace or a mutant driver, and the law that must reject it
  (ORC-006).
- **Ownership.** Put the owned code on the property's `owns` list. An entry is
  a file (`src/x.ts`) or one function and its static call tree
  (`src/x.ts#run`, `src/x.ts#Class.method`). Own only what the laws cover. The
  gap check judges only owned code, and the gap check's `--source` selects
  files.

Keep the law, its authority, and its limits in `law`, and prose beside each
part that says why it predicts the promised result (ORC-003).

**Lint as you go.** Run the repository's lint on each oracle file and each
changed production file after you edit it, and again before you finish. Fix
every report. Do not disable a rule.

Techniques: [guide § The driver and the check](../../docs/guide.md#the-driver-and-the-check).

## 7. Show the evidence that fits the change

The evidence depends on the kind of work:

| Work                                                    | Evidence                                                                                                                                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Fix a defect**                                        | The extended oracle fails on unchanged production (RED). The repaired production passes (GREEN). Neighboring laws still pass. The original defect, as a mutant, fails the oracle.                      |
| **Refactor without changing behavior**                  | Old and new production pass the same oracle: the same laws, histories, and checkpoints. The gap check on both kills at least the same mutants, compared by key with the same seed. No RED is expected. |
| **Add or strengthen an oracle over correct production** | Production passes. A calibration (a wrong answer or a corrupted trace) and a mutant fail the intended law. No RED is expected.                                                                         |

A refactor that needs a changed law, check, or history is not a pure
refactor: treat the law change first (step 1).

**To fix a defect:**

1. Run the extended oracle file on **unchanged** production. It must fail on
   the defect. This is RED. A setup failure is not RED: fix the oracle first.
   (Until the gap check reports a failing baseline, run the oracle file with
   Vitest for this step.)
2. Change production, and rerun the oracle after each attempt. It also shows
   when an attempt breaks a neighboring law.
3. Run the oracle again. It passes. This is GREEN.
4. Show that a mutant, such as the original defect, fails the
   oracle.

For a defect fix, do not change production before step 1. A later run does
not make up for a skipped RED.

**Clean up production once GREEN.** The oracle now protects the law, so use
it to simplify:

- Refactor the code around the change. Do not insert a new branch beside an
  old one that does almost the same thing.
- Remove states, flags, branches, and recovery paths that no law needs. A
  surviving mutant shows only that the current histories did not expose the
  code. Before you remove it, use the mutant gap hunt to rule out a missing
  history, observation, or law, and give the contract's reason that no legal
  history can observe it. A green rerun of the same oracle is not that
  reason.
- Prefer a change that shrinks the code, or leaves its size the same. If the
  repository sets a size rule, such as a net-negative diff, follow it.
- Rerun the oracle and the gap check after each cleanup.

Techniques: [guide § Evidence](../../docs/guide.md#evidence).

## 8. Close every gap

Run the gap check on the owned code, then work from its report. Every gap
comes with one instruction. Do what it says, within the rules below.

- **There are no equivalent mutants.** A surviving mutant shows a missing
  history, observation, or law, or it shows dead code.
- **An effect that no check sees is one that the driver does not record.**
  Record it.
- **Code whose removal no legal history can observe is dead.** The gap check
  alone cannot show this, because its histories are a sample. First rule out
  a missing history, observation, or law. Then remove the code in the same
  change, give the contract's reason in the evidence (it is a production
  change), and rerun the oracle and the gap check.
- **A law that kills nothing** owns no mutated code, or its witness never
  varies in the histories. Check its witness and its constructed history. If
  the law still kills nothing, it may restate another law: compare the two.
- **The only exclusions are probe-only code and the `super()` region of a
  derived constructor.**
- **Never propose an exit.** If a gap can be neither killed nor removed, it is
  a framework bug. Stop work on that gap, report its key and evidence to the
  user, and keep working on the other gaps.
- **A mutant that no oracle could possibly detect is an invalid mutant.** The
  framework must not generate it, so it is a framework bug: report it the same
  way. You do not decide that a mutant is invalid, and the label does not close
  its gap.
- **Temporary, until the report's messages change:** if a message calls a
  mutant "equivalent", asks for a "maintainer's approval", or offers a limit
  that "needs a maintainer's decision", do not follow that part. Find the
  history and the law.

Use the [mutant gap hunt](../../docs/instruments/mutant-gap-hunt.md) card for
a survivor whose missing history is not obvious.

## 9. Report the evidence

The evidence counts only as a set. One item alone proves little. Give the
items that fit the kind of change (step 7).

- **Law:** the law and its authority, and whether it was reused, changed, or
  new.
- **Reach:** each declared state and how many histories entered it.
- **Before and after:** for a defect fix, RED on unchanged production and
  GREEN after the change. For a refactor, the same oracle passing on old and
  new production. For a new oracle over correct code, production passing.
- **Mutant:** a mutant, such as the original defect, and the law that
  rejected it, plus the calibrations that fail. For a refactor, the kill
  sets before and after.
- **Gaps:** the gap check's totals, and any gap reported as a framework bug.
- **Limits:** the states, paths, and observations that the evidence does not
  cover.

Put the evidence block in the pull request description. When a change claims
that an oracle is new, repaired, or fully audited (ORC-012), also keep the
evidence in a versioned record tied to the reviewed commit.

When review findings arrive, load `oracles-evaluate-review`.

## Instruments

Use a card when one of these uncertainties is real. There is no required
sequence.

| Uncertainty                                                                                  | Card                                                             |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| The promise is unclear, or two readings predict different behavior                           | [Law discovery](../../docs/instruments/law-discovery.md)         |
| Production and the model may share a mistake                                                 | [Challenge review](../../docs/instruments/challenge-review.md)   |
| Two obligations collide under some condition                                                 | [Tension scan](../../docs/instruments/tension-scan.md)           |
| Laws overlap, or their concepts seem wrong                                                   | [Law restructuring](../../docs/instruments/law-restructuring.md) |
| The model keeps growing, a simplification is proposed, or the law has many interacting rules | [Design grammar](../../docs/instruments/design-grammar.md)       |
| The oracle is green but may accept a wrong implementation                                    | [Mutant gap hunt](../../docs/instruments/mutant-gap-hunt.md)     |
