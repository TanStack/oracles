# Design and review instruments

Use an instrument when a specific uncertainty makes ordinary implementation or
review insufficient. Read only the relevant card. Choose and use it within the
developer's authorized task; these cards do not require a separate approval for each
reasoning step or a fixed workflow.

| Uncertainty                                                                               | Instrument                                | Result                                                                                                                                |
| ----------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| What behavior should this subsystem promise?                                              | [Law discovery](law-discovery.md)         | A sourced candidate law, competing predictions, and a distinguishing witness.                                                         |
| Could the implementation, model, or law itself be wrong?                                  | [Challenge review](challenge-review.md)   | Concrete challenges at named levels, their evidence, and repair conditions.                                                           |
| Would a plausible wrong implementation still pass the oracle?                             | [Mutant gap hunt](mutant-gap-hunt.md)     | A semantic mutant and what its survival shows: a missing history, observation, or law, dead code, a law question, or a framework bug. |
| Do sound obligations conflict under the same conditions?                                  | [Tension scan](tension-scan.md)           | A traced collision, missing distinction, or no supported tension.                                                                     |
| Should these laws or concepts be merged, split, replaced, or removed?                     | [Law restructuring](law-restructuring.md) | An alternative organization and a check of what it preserves or loses.                                                                |
| Is this model the smallest one that keeps the law, and what does a simplification change? | [Design grammar](design-grammar.md)       | Parts with jobs and witnesses, open rule conflicts, a reduced model, and a two-way comparison for each simplification.                |

These are reasoning aids, not additional oracle conformance requirements. The
[checklist](../oracle-checklist.md) owns testing requirements. Use the
[glossary](../glossary.md) and the relevant architecture and contract sources.
The `oracles-design` and `oracles-review` skills route oracle work here; the cards can also help
with architecture and other design questions.

Keep these apart: source statements, observed behavior, generated examples,
hypotheses, and design judgments. An existing contract constrains correctness
claims, and a design proposal may challenge it. Only the authority
appropriate to the task can change a contract. An instrument result does not
change product expectations by itself.

Record the question, the operation, the source pointers, the concrete
witness, and the open part in the task's normal notes. No finding, no
supported tension, and a failed simplification are useful results. A
reasoning witness is not an executed test. Passing sampled histories is not
proof.

Adapted from Field Lab instruments. The challenge review card also permits
criticism of a candidate's standard and concepts. No Field Lab install is needed.
