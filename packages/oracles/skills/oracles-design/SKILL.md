---
name: oracles-design
description: Design, write, or change an oracle with @tanstack/oracles - write a law sheet first, choose a model, build histories that reach the states the law needs, show RED on unchanged production, change production, and close every gap. Use for a new oracle, an oracle repair, any production change in code that an oracle owns, and any change to a model, history grammar, driver, or check.
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

## 1. Write the law sheet, then stop

Before any code, write one row per law and give the sheet to the user.

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

**Stop here.** Do not write the oracle until the user has reviewed the sheet.

## 2. Freeze what the oracle must preserve

Write these down. They stay fixed while you build the oracle.

- The laws and their checkpoints, from the sheet.
- The owned production code: the files or functions the oracle answers for.
- The freedoms the contract leaves open, such as the order of independent
  events, scheduling, or representation. The oracle must accept every
  allowed choice.

Do not weaken a check, history, or law in the same step that clears a
failure. Make each weakening its own decision, with its own reason.

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
| B3: `fc.pre` in an oracle file; legality belongs in the grammar or `resolve`    | review (lint pending)              |
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
- **A model state or field:** give a legal next action where two states that
  differ only in it must behave differently (ORC-008).
- **A branch or exception:** give the history that needs it. If none exists,
  remove it.

If you cannot find a witness, look for a simpler representation before
adding more machinery. For example, three disjoint sets of ids that move
between each other may be one map from id to status. Count complexity that
you move into helpers, adapters, or mappings. Moving it does not remove it.

**Laws stay simple; history generators may be elaborate.** Reaching a hard
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
- **Ownership.** Put the owned files or functions on the property's `owns`
  list. The gap check judges only owned code.

Keep the law, its authority, and its limits in `law`, and prose beside each
part that says why it predicts the promised result (ORC-003).

Techniques: [guide § The driver and the check](../../docs/guide.md#the-driver-and-the-check).

## 7. RED, change, GREEN, mutant

When the task changes production:

1. Run the extended oracle file on **unchanged** production. It must fail on
   the defect. This is RED. A setup failure is not RED: fix the oracle first.
   (Until the gap check reports a failing baseline, run the oracle file with
   Vitest for this step.)
2. Change production, and rerun the oracle after each attempt. It also shows
   when an attempt breaks a neighboring law.
3. Run the oracle again. It passes. This is GREEN.
4. Show that a mutant, such as the original defect, fails the
   oracle.

Do not change production before step 1. A later run does not make up for a
skipped RED.

Techniques: [guide § Evidence](../../docs/guide.md#evidence).

## 8. Close every gap

Run the gap check on the owned code, then work from its report. Every gap
comes with one instruction. Do what it says, within the rules below.

- **There are no equivalent mutants.** A surviving mutant shows a missing
  history, observation, or law, or it shows dead code.
- **An effect that no check sees is one that the driver does not record.**
  Record it.
- **Code whose removal no legal history can observe is dead.** Remove it.
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

The evidence counts only as a set. One item alone proves little.

- **Law:** the law and its authority.
- **Reach:** each declared state and how many histories entered it.
- **RED:** the command and the failure on unchanged production.
- **GREEN:** the command and the result after the change.
- **Mutant:** the mutant, such as the original defect, and the law that
  rejected it.
- **Gaps:** the gap check's totals, and any gap reported as a framework bug.
- **Limits:** the states, paths, and observations that the evidence does not
  cover.

## Instruments

Use a card when one of these uncertainties is real. There is no required
sequence.

| Uncertainty                                                        | Card                                                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| The promise is unclear, or two readings predict different behavior | [Law discovery](../../docs/instruments/law-discovery.md)         |
| Production and the model may share a mistake                       | [Challenge review](../../docs/instruments/challenge-review.md)   |
| Two obligations collide under some condition                       | [Tension scan](../../docs/instruments/tension-scan.md)           |
| Laws overlap, or their concepts seem wrong                         | [Law restructuring](../../docs/instruments/law-restructuring.md) |
| The oracle is green but may accept a wrong implementation          | [Mutant gap hunt](../../docs/instruments/mutant-gap-hunt.md)     |
