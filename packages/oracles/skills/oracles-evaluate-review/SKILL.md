---
name: oracles-evaluate-review
description: Evaluate a review of oracle work done with @tanstack/oracles. Keep a lossless ledger of every finding, and check each claim against the code. Extend the oracle so it shows each confirmed bug on unchanged production, then fix production and close the bug class. Use when review findings arrive for a branch that touches an oracle or owned code.
---

# Evaluate a review

Use a review to close the class of bug it reveals, not only the reported
case. A passing reproduction or a complete ledger is a diagnosis. Closure
needs an oracle that rejects the original behavior and its neighbors.

Read this skill in full. Before you edit any oracle, load `oracles-design`.
Use the [glossary](../../docs/glossary.md) terms in the ledger and the report.

## 1. Write the ledger first

Before you test or edit anything, write an append-only ledger of the raw
review in a task-local scratch file. Do not commit it unless the user asks.

- Give every item a stable ID in source order: each finding, footnote, capped
  item, non-blocking comment, and testing idea.
- Keep the original claim and the proposed fix. Do not merge overlapping
  items. Cross-reference them.
- Record the file and line, the severity, and the commit you check against.

For every item, keep three judgments apart:

1. **Is it true** on the reviewed or the current commit?
2. **What does this change do about it:** fix now, already fixed, ask for a
   decision, or no action?
3. **What lasting value does it have:** a test idea, a law, a cleanup, or a
   later investigation?

Use only these dispositions: `fixed-now`, `confirmed-open`, `stale` (with the
surviving idea recorded), `refuted` (with evidence), `accepted-design` (only
for behavior an adopted law or decision covers, cited), `design-decision`
(with the exact question), and `duplicate` (linked, with its unique details
kept). There is no `skip`.

Deferral is rare. A confirmed, in-scope defect stays `confirmed-open` until it
is fixed, unless the user agrees to postpone it. A deferral records the open
work, why it cannot be done now, the remaining risk, an owner, and the
condition for resuming.

## 2. Sort the findings

For each confirmed behavioral finding, decide which kind it is.

- **An enforcement gap: fix it, do not ask.** The adopted law is right, but
  the oracle does not enforce it or production breaks it. The cause is a
  missing generator dimension, a missing history or timing, a missing
  observation, an unreached path, a driver seam, a check that passes when it
  should fail, or a production defect against an adopted law.
- **A law change: present it and wait.** The finding questions what is
  promised: a new law, a narrower or revised law, a new checkpoint, an
  obligation on a collaborator, two laws in conflict, or a rule with no
  authority. Give the user the candidate law and its rival, the evidence,
  what each choice changes for users, and your recommendation.

A finding can contain both. Fix the enforcement part, and present the law
question.

An enforcement gap reuses the adopted law, so `oracles-design` step 1 does not
stop for it. Name the law in the ledger and the evidence.

## 3. Plan the oracle changes for the whole review

Before you work on single findings, look at all of them together. Findings
that look separate often share one missing history dimension, schedule,
driver path, or observation.

1. Group the findings by the state, boundary, history dimension, or
   observation they share.
2. For each finding, name the oracle change that would have generated it,
   and why the current oracle missed it.
3. Choose the smallest set of oracle changes that generates every finding.
   Prefer one dimension that reaches several findings and their neighbors
   over one pinned example per finding.
4. Make those changes first. Run the extended oracle on **unchanged**
   production. Record which findings it reproduces (RED), which it misses, and
   any new counterexamples. A miss is a gap in the plan: revise the plan.
5. Then fix production, with the extended oracle as feedback on all findings
   at once.

## 4. Turn each bug into a family

A reviewer's bug shows one history. The oracle must cover the family it
belongs to.

- **State the causal condition:** the relationship that makes the history
  fail, such as "a completion outlives the operation that started it".
- **Add it to the grammar:** a generator dimension or a constructed history
  that varies the incidental details (counts, order, values, timing) and
  keeps the condition. A pinned example alone is not the fix. Keep the
  original history as a `fixed` regression.
- **Search the neighbors:** run the extended oracle and look for related
  failures that the reviewer did not report. Record each one as a separate
  ledger item.
- **Keep a nearby passing case:** a history close to the bug that must still
  pass, such as the same operations in a legal order. It stops the repair from
  rejecting valid behavior.

## 5. Use the right evidence

Do not accept or reject a behavioral claim from reading code alone.

| Claim                                   | Evidence                                                              |
| --------------------------------------- | --------------------------------------------------------------------- |
| Wrong product behavior                  | A failing oracle history or focused probe on the same path.           |
| A check that passes when it should fail | A wrong implementation or corrupted trace that the check accepts.     |
| Missing generator coverage              | Reach counts or a sample showing that the regime never occurs.        |
| Async or lifecycle                      | Controlled promises, events, or a controlled clock, not timing alone. |
| Work or performance                     | Deterministic counts, not elapsed time.                               |
| Docs or maintainability                 | Direct source evidence and a focused check.                           |

If the current code passes, check whether the review targeted an older
commit, missed a precondition, or found a bug that a later change turned into
another one. Mark a claim `refuted` only when a probe reaches the same path
and every stated precondition and disproves it. Otherwise ask the reviewer for
the smallest failing history.

For each confirmed bug:

1. Show RED: the extended oracle fails on unchanged production.
2. Make the simplest production change that enforces the law across its
   histories.
3. Show GREEN: the same oracle and its neighbors pass.
4. Show that a mutant, such as the original defect, fails the oracle.
5. Run the gap check on the owned code, and close every gap
   (`oracles-design` step 8).

Mark the item `fixed-now` only when the repair and the oracle coverage are
both complete. If only the reported history is fixed, keep the class open.

## 6. Account for the whole law

For each law the review touched, answer:

- Is it fully in the model and in reachable histories?
- Is it checked at every checkpoint the contract owes?
- Which mutant shows that the check is sensitive?
- Which neighboring laws does the repair keep?

A missing link is open work. A neighboring green test does not supply it.

If the branch moves during the evaluation, mark earlier evidence stale and
rerun the affected items on the new commit.

## 7. Audit for losses

Before the final report:

1. Return to the raw review, not a summary.
2. Account for every item, including footnotes and items you dismissed.
3. Compare each item with the final diff.
4. Recheck every law and sibling failure against the final model, histories,
   driver, checkpoints, and calibration.
5. Check the totals: raw items = fixed-now + confirmed-open + stale +
   refuted + accepted-design + design-decision + duplicate (+ any agreed
   deferral).

## 8. Report

Lead with the law changes that need a decision. Then:

- **Laws:** for each law, what the oracle proves, the decisive experiment
  (RED, the neighbor, the mutant), why the suite missed it, and what remains
  open.
- **The ledger:** every item, with its verdict, action, and lasting value.
- **The reviewer:** accuracy, depth, signal-to-noise, and fix quality, with a
  hire recommendation and evidence.
- **Changes:** what you changed and the exact verification. Keep RED, a
  mutant's result, and the repaired branch's GREEN separate.
- **Losses:** the totals by disposition, and every open evidence or coverage
  gap.

If the user asks whether the pull request is ready, give a separate verdict:
`ready`, `not ready` (a confirmed in-scope defect or an open decision blocks
it), `readiness unproven` (a decisive witness is missing), or `not assessed`.
A complete ledger and a green run do not make a pull request ready.
