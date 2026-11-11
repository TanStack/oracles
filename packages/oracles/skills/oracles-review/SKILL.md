---
name: oracles-review
description: Review oracle work done with @tanstack/oracles. Challenge whether an oracle enforces its law, whether it is the right law, and whether the work took a shortcut. Use for a new or changed oracle, or a production change in owned code. Also use for a proposed change to what an oracle promises.
---

# Review oracle work

Ask two questions: does the oracle enforce its stated law, and is that the
right law to promise? A passing oracle can coexist with a wrong law. A
failing one can coexist with correct production.

Read the [checklist](../../docs/oracle-checklist.md) and the
[glossary](../../docs/glossary.md) in full before you judge anything. Judge
conformance by the checklist's requirements, not by headings or templates.
After a handoff or a context reset, read them again: another agent's claim
that it read them does not give you their definitions.

The repository may add its own review rules on top of this skill, in its
`AGENTS.md` or its own review skill. Apply both.

## 1. Rebuild one observation yourself

- Follow the law's authority to its source. Read the neighboring promises
  there. The oracle's summary can omit an obligation that it should check.
- From the contract alone, without production, predict one promised
  observation for one history.
- Then trace what the oracle actually does with that history:
  - the model's rule
  - the legal histories that reach it
  - the production path the driver calls
  - what the driver records
  - the check at the checkpoint

Every claimed model output must reach the check at its promised
checkpoint. A final state can hide a wrong intermediate observation.

## 2. Check the order of the work

These are the shortcuts. Report each one as a finding. A change that
contains one is not ready.

| Shortcut                          | What to look for                                                                                                                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Law after code**                | No law sheet before the oracle was written, a law with no authority, or a law block that disagrees with the `law` option or the model.                                                                           |
| **Law as examples**               | A law written as a list of cases, not one sentence over the domain. Or a sheet with no new case that the law predicts.                                                                                           |
| **Skipped design grammar**        | A trigger from `oracles-design` step 1 fired, and the design grammar card was not used.                                                                                                                          |
| **Production first**              | A defect fix in owned code without a RED result from the extended oracle on the code before the change. A later run does not count.                                                                              |
| **Unproven refactor**             | A refactor of owned code without the refactor evidence in `oracles-design` step 7. A refactor needs no RED.                                                                                                      |
| **Re-asking an adopted law**      | Stopping for approval to strengthen enforcement of a law that is already adopted, or that the task already approved.                                                                                             |
| **Model hacking**                 | A model rule changed to match production output without an authority. Production output is evidence, not authority.                                                                                              |
| **Unreachable claim**             | A claim about a state that no constructed history enters, or a reach count nobody measured. Also a state that a law depends on but that sits in `measured`, where nothing requires it.                           |
| **Quiet exclusion**               | Any skip, narrowed grammar, added filter or validity predicate, relaxed comparison, or exemption, other than probe-only code and the `super()` region of a derived constructor. Adopters have no exclusion list. |
| **Pinned only**                   | A fixed example where the law needs a generator dimension.                                                                                                                                                       |
| **Lowered budget**                | Fewer `runs`, a removed fixed seed, or a removed constructed history, without a stated reason.                                                                                                                   |
| **Inserted, not refactored**      | A production change that adds a branch, flag, or path beside a similar old one. Or a change that leaves code that no law needs.                                                                                  |
| **Unit test in an oracle file**   | An ordinary test or a fixed expected answer in an oracle file.                                                                                                                                                   |
| **"Pre-existing" as a dismissal** | A reachable counterexample labeled as older than the change, and then left without a fix or a decision from the user.                                                                                            |
| **No mutant**                     | A claim that a defect is closed, without a mutant, such as the original defect, that fails the oracle.                                                                                                           |
| **An exit**                       | Any reasoning that calls a mutant "equivalent", an effect "unobservable", or a gap acceptable. A gap is closed only by a kill or by removing dead code. A gap that can be neither is a framework bug to report.  |

The evidence counts only as a set, chosen by the kind of change
(`oracles-design` step 7): law, reach, before-and-after runs, mutant, gaps,
limits. A missing item is a finding, even when the rest is strong.

## 3. Hunt what the tools cannot see

Lint, reach counts, the gap check, and calibrations miss the weaknesses
below. Hunt for each one across the whole oracle, not only the diff. This
hunt is your main job.

- **Run but not checked.** A history executes the code, but the check
  never observes its effect. Reach passes anyway. Find a line that the oracle
  claims, and name the mutant on it that would survive.
- **A model that copies production.** The model mirrors production's
  branches, classifications, or helpers, so both agree on the same wrong
  answer. Compare the model's structure with production, not only its
  results.
- **A grammar narrower than the law.** The law claims a value domain, action,
  or case that the grammar never generates. Examples:
  - a type that the generator never produces
  - an exclusion stated in prose but missing from `limits`
  - a size setting that makes part of the claimed range unreachable

  Check each claim in the law against a generator dimension.

- **Easy declared states and probes.** A declared state or probe sits where
  it is always true, or uses a weaker condition than the state it names. Its
  count rises without showing that histories enter the interesting state.
  Check each definition against the state that the law needs.
- **A late or coarse checkpoint.** The check runs only at the end of a
  history, or observes only a summary, so a wrong intermediate observation
  disappears. Ask whether a user could see the wrong value before the
  checkpoint.
- **A limit that hides in-scope work.** A stated limit excludes a legal case
  that the law promises. Check that each limit excludes exactly what its
  reason covers.
- **A dismissed survivor.** A surviving mutant is called equivalent,
  unobservable, or out of scope, or is called invalid and treated as closed.
  That is an exit, and a finding. The survivor shows a missing history,
  observation, or law, dead code, or a framework bug. Reporting a suspected
  invalid mutant as a framework bug, with its key and evidence, is correct and
  is not an exit.
- **An invariant guard without a witness.** A throw for a contradictory
  collaborator signal or an impossible state has no history that reaches it.
  Require a history step that simulates the contradictory signal.
  Expect production to fail at the boundary, before it releases established
  state or publishes success.

## 4. Choose challenges for the real uncertainty

Use the [instrument cards](../../docs/instruments/) when they fit. Do not run
every card, and do not require a finding at every level.

- **[Challenge review](../../docs/instruments/challenge-review.md):**
  challenges enforcement, the law's statement, its suitability, or its
  concepts. Name the level each challenge addresses.
- **[Law discovery](../../docs/instruments/law-discovery.md):** for a law with
  no clear authority, or two readings that predict different behavior.
- **[Tension scan](../../docs/instruments/tension-scan.md):** for demands that
  collide under a concrete condition.
- **[Law restructuring](../../docs/instruments/law-restructuring.md):** for
  whether merging, splitting, or replacing laws gives a better account.
- **[Design grammar](../../docs/instruments/design-grammar.md):** for a
  simplification or a growing model: what each part does, and what the change
  newly allows or rejects.
- **[Mutant gap hunt](../../docs/instruments/mutant-gap-hunt.md):** for whether
  a plausible wrong implementation can pass.

Ask these questions of every model and grammar:

- **What does each distinction contribute?** For each law, model field, and
  branch, is there a legal history that needs it? If not, it is a candidate
  for removal or for a simpler representation (ORC-008).
- **Is the complexity in the right place?** Laws stay simple, and generators may
  be elaborate (`oracles-design` §4).
- **Did the domain shrink?** A changed filter, validity predicate, or grammar
  bound removes histories from the claim. That is a contract change, and it
  needs its own reason (ORC-004).
- **Does the oracle keep the contract's freedoms?** Where the contract allows
  several outcomes, the model must predict the allowed set. An oracle that
  accepts only the current implementation's choice is a finding.

When you can, use a fresh reviewer for an independent challenge. Give it the
work, the sources, and the task, but not the author's preferred verdict.
Label a self-review as one.

Techniques: [guide](../../docs/guide.md), especially [§ Evidence](../../docs/guide.md#evidence) and [§ Reusable boundary laws](../../docs/guide.md#reusable-boundary-laws).

## 5. Report findings

For each finding, give:

1. The claim you challenge.
2. Its source or authority.
3. The smallest legal witness, or a concrete design consequence.
4. The evidence status: run, read from source, or a proposed experiment.
5. The repair, or the next experiment.

- **A confirmed bug:** say why the existing oracle missed it, and name the
  smallest general improvement: a generator dimension, an observation, or a
  law. A pinned example alone is not the repair.
- **Defects and proposals stay separate.** A defect breaks an accepted
  contract. A proposal changes the contract. A proposal must name the
  external standard or engineering reason behind it, and its cost. Existing
  behavior does not prove itself correct, and a preference does not prove a
  violation.
- **Setup failures and timeouts are not kills.** Nor are they evidence that a
  law rejected a mutant.

Report the supported findings and the remaining uncertainty. Do not invent findings, retire laws, or rewrite expectations to look
decisive.

If the review leads to oracle edits, load `oracles-design` before you edit.
To act on the findings, load `oracles-evaluate-review`.
