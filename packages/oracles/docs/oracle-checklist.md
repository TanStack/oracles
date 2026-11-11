# Oracle checklist

Version 1 (2026-11-10). Cite requirements as `ORC-NNN (checklist v1)`.

This is the complete list of requirements for an oracle that uses
`@tanstack/oracles`. The review skill reads it in full. The design skill
cites it by ID. Other guides explain techniques; they do not add
requirements unless they cite an ID here.

It was ported from TanStack DB's oracle rubric. The IDs are the same, so
existing citations keep working. [Changes from the rubric](#changes-from-tanstack-dbs-rubric)
lists every difference.

## How to read a requirement

`MUST` is required when its trigger applies. `SHOULD` is expected, unless a
review accepts an explicit, technically grounded reason to do otherwise.
`MAY` is optional.

Only these uppercase words inside a requirement block create a requirement.
Lowercase words such as "must" in explanations do not.

Each requirement says what **the framework enforces** and what is left for
the author and the reviewer. Do not work around an enforced part. A
workaround is a finding, even when the tests pass.

An **important generated property** is an `oracleProperty` that protects a
reusable law, claims coverage beyond named examples, or demonstrates a
bug-class repair. A fixed regression or a bounded enumeration is not one
merely because it uses test data.

Score the stated obligation. Do not score the presence of a heading, comment
template, or helper.

## There are no exits

No requirement here can be met by declaring something out of reach.

- There are no equivalent mutants. A surviving mutant shows a missing
  history, observation, or law, or dead code.
- An effect that no check observes means that the driver does not record it.
  Record it, or remove the code that causes it.
- The only exclusions are probe-only code and the `super()` region of a
  derived constructor.
- A gap that nobody can kill or remove is a framework bug. Stop and report it
  to the maintainer with its key and evidence. A mutant that no oracle could
  possibly detect is invalid, and the framework must not generate it. The
  author does not decide that a mutant is invalid, and the label does not
  close a gap.

---

### ORC-001: Contract authority and limits

- **Trigger:** A test computes or constrains an expected product result.
- **Obligation:** The oracle MUST identify the promised law, its authority,
  and the limits of the claimed result.
- **Framework:** `law.statement`, `law.authority`, and `law.limits` are
  required fields.
- **Acceptance evidence:** A reviewer can trace the expected result to an
  approved API, contract document and section, or a decision with who
  made it (name and GitHub login) and its date,
  and can say what the oracle does not establish. Production output is
  evidence; it is never authority.
- **Not required:** A complete list of every behavior outside the subsystem.

### ORC-002: Independent judgment

- **Trigger:** An oracle compares production with an expected result.
- **Obligation:** The expected result MUST be derived independently of the
  production semantic machinery that it judges.
- **Author:** The model receives the plan and the trace. It may read the
  inputs that the driver recorded, never production's outputs. The framework
  does not enforce this; a review checks it.
- **Acceptance evidence:** The model, alternate implementation, or relation
  does not import or reproduce the relevant production classifier,
  transition, comparator, or state machine without a separately justified
  trusted base.
- **Not required:** Independence of the driver. The driver is expected to call
  the real production entry point.

### ORC-003: Distinguishable oracle responsibilities

- **Trigger:** Any oracle.
- **Obligation:** The oracle MUST be a literate program.
  - Opening prose MUST state the law and its limits before the mechanics.
  - Prose beside the model MUST explain why its independent rule predicts the
    promised result.
  - The oracle MUST explain its legal histories, production path, public
    observations, and the checkpoint where the check compares, beside the
    relevant code.
  - The contract, model, history grammar, driver, and check MUST remain
    distinguishable.
  - A change to the executable law MUST update its prose in the same change.
- **Framework:** `oracleProperty` takes these as separate parts: `law`,
  `histories`, `model`, `driver`, and `check`. Only the check can report a
  violation.
- **Acceptance evidence:** A reader learns the contract from the prose and
  code together. A compact oracle may use one opening comment and short notes
  beside its code.
- **Does not satisfy:** Code alone, headings without explanations, or
  explanations that exist only in a pull request.

### ORC-004: Generated-history grammar controls

- **Trigger:** A generated property claims coverage of a legal history or
  input grammar.
- **Obligation:** The change MUST account for reconstruction, ablation, range,
  and exclusion for that grammar.
- **Acceptance evidence:**
  - **Reconstruction:** every known valid witness within the claimed scope can
    be generated.
  - **Ablation:** each declared axis, rule, or overlap has a stated semantic
    contribution.
  - **Range:** the bounded domains and marginal cases are stated.
  - **Exclusion:** a nearby invalid history or state is named, and the grammar
    rejects it.
- **Contract changes:** A change that narrows the grammar, a filter, or a
  validity predicate removes histories from the claim. It is a contract
  change, and it MUST say which previously legal histories it removes and why.
- **Evidence location:** Executable checks are preferred when they are cheap
  to keep. Comments or pull-request evidence MAY carry the rest.
- **Not required:** One test per control, or a Cartesian product of unrelated
  axes.

### ORC-005: Production path and observation

- **Trigger:** Any oracle used as product evidence.
- **Obligation:** The driver MUST exercise the named production entry point
  and MUST record the promised public observation at the named checkpoint.
- **Framework:** The driver records observations with
  `observe(checkpoint, value)`. Observations must be data; anything else fails
  its history with an `OracleDataError`.
- **Acceptance evidence:** The intended path ran, and the check ran at the checkpoint. The observations
  can represent the violations relevant to the law, including duplicates,
  omissions, order, or partial output when those are contractual.
- **Information sufficiency:** When a concrete hypothesis says a public result
  is owed at a checkpoint before the production path has the facts it needs,
  the evidence MUST show whether those facts arrive by then. If they do not,
  the claim is unresolved. A green comparison after later delivery MUST NOT be
  cited as proof of the earlier result.
- **Not required:** Observing internal facts that the contract does not
  expose.

### ORC-006: Checker calibration

- **Trigger:** An important generated property, or a claimed oracle repair.
- **Obligation:** The evidence MUST name at least one plausible wrong answer
  or design and show that the relevant law rejects it.
- **Framework:** A `calibration` names a wrong answer, as a `corrupt` trace or
  a mutant `driver`, and the law that must reject it. The calibration test
  fails if that law does not report it.
- **Acceptance evidence:** The wrong answer reaches the intended checkpoint
  and the law reports the distinguishing failure.
- **Conditional obligation:** When a production mutant is run, the evidence
  MUST classify its outcome as one of: assertion failure, timeout, setup
  failure, runtime failure outside the intended comparison, unreached path, or
  survival. A survivor is a gap (see [There are no exits](#there-are-no-exits)).
- **Not required:** Checking in a mutant.

### ORC-007: Fixed and random campaigns with direct replay

- **Trigger:** An important generated property.
- **Obligation:** The same property, generators, driver, check, and budget
  MUST run with fixed seeds and without a seed, and a failure MUST be
  replayable directly.
- **Framework:** Enforced. A generated `oracleProperty` runs one test per
  fixed seed and one random test with the same arbitrary, check, and budget.
  A failure prints how to replay it.
- **Author:** Do not work around this with a raw `fc.assert`, `fc.check`, or `.prop`
  in an oracle file. The `oracle/oracle-property-only` lint rule reports them.

### ORC-008: Stateful-model minimality

- **Trigger:** A change introduces, removes, combines, or splits state in a
  stateful model.
- **Obligation:** The change MUST explain whether a legal continuation (one
  or more actions) can distinguish states that the model proposes to treat as
  equal, by a later observation or by which actions are legal.
- **Acceptance evidence:** A distinguishing history justifies retained state.
  Removed state needs a reasoned argument that it cannot change a promised
  observation or the legality of an action.
- **Not required:** An executable mutant for every model field.

### ORC-009: Vocabulary mapping

- **Trigger:** A model combines or splits production concepts, or introduces
  a model-only term that could be mistaken for a production concept.
- **Obligation:** The oracle MUST map the differing concepts explicitly. It
  MUST use the project's term for a shared domain concept, and the
  [package glossary](glossary.md)'s term for an oracle concept.
- **Acceptance evidence:** A reviewer can translate model actions, states, and
  checkpoints to production boundaries without guessing.
- **Not required:** A mapping for local data holders whose meaning is
  unambiguous.

### ORC-010: Failure fidelity and cleanup

- **Trigger:** Shrinking, capture, or cleanup can replace or erase an oracle
  failure.
- **Obligation:** The harness MUST preserve the original violated law and
  checkpoint, keep cleanup diagnostics distinguishable, and release its
  resources.
- **Framework:** Enforced for shrinking. Once a history fails one way, a
  smaller history that fails another way counts as passing, so the reported
  counterexample still shows the first failure.
- **Author:** The driver releases what it created before it returns or
  throws. An `AggregateError` whose `cause` and `errors` keep the distinctions
  satisfies this requirement.

### ORC-011: Independent second formulation

- **Trigger:** A reviewer names a plausible semantic fault that production and
  the model could share, and a meaningfully different formulation could
  distinguish it.
- **Obligation:** The change SHOULD add that formulation. If it does not, the
  evidence MUST say why it is impractical and keep the risk in the oracle's
  limits.
- **Acceptance evidence:** The second formulation states its equivalence or
  metamorphic relation, including differences in ordering, projection,
  duplicates, and empty results.
- **Does not satisfy:** Agreement between two structurally identical paths.

### ORC-012: Review evidence

- **Trigger:** A change claims that an oracle is new, repaired, or fully
  audited against this checklist.
- **Obligation:** The review evidence MUST record the outcome of every other
  applicable requirement and MUST name the requirements that do not apply,
  each with a reason tied to its trigger.
- **Bug-class closure:** A claim that a change eliminates a bug class MUST name
  its contract × history × production path × observation boundary, the
  original and nearby distinguishing witnesses, and a wrong design rejected at
  the intended checkpoint. Unresolved in-scope combinations of contract, history, production path,
  and observation boundary go in the oracle's
  `limits`. A known reachable counterexample prevents a closure claim.
- **Evidence location:** Evidence that decides the verdict and lives outside
  the oracle MUST be in a versioned record tied to the reviewed commit. An
  editable pull-request description alone does not satisfy this requirement.

### ORC-013: Distinguishing witness for a reusable boundary law

- **Trigger:** An oracle is cited as protecting a reusable conditional,
  threshold, or range law beyond its named examples.
- **Obligation:** The evidence MUST show a legal witness that reaches the
  law's premise, and a nearby in-domain witness whose observation
  distinguishes the law from a plausible wrong boundary or consequence. If
  those witnesses are unavailable, the claim MUST be limited to the tested
  cases, and the gap MUST be stated in `limits`.
- **Acceptance evidence:** The evidence names the wrong rule and the case that
  rejects it. For a numeric threshold, cases on opposite sides are not enough
  if a misplaced threshold still produces every expected result.

### ORC-014: Controlled-premise handoff

- **Trigger:** A controlled provider or host supplies a premise that matters to
  an oracle result, and that result is cited as evidence for behavior with the
  real provider or host.
- **Obligation:** The evidence MUST identify that premise. It MUST either
  point to a receiving witness in which the real provider supplies the same
  premise, or state the cross-boundary claim as unresolved in `limits`.
- **Shared law:** When both environments check the same law, the receiving
  witness SHOULD be another driver for the same oracle. It reuses the law,
  model, histories, and check, and supplies only its entry point, premise
  control, and observations.
- **Not required:** An end-to-end run inside every component oracle. An oracle
  whose claim is limited to the controlled boundary needs no real-provider
  witness.

### ORC-015: Declared reach

- **Trigger:** A change adds or changes an important generated property, its
  histories, or its driver, or cites one as evidence for a bug-class repair.
- **Obligation:** The property MUST declare the states that its laws depend
  on, and a history MUST be constructed to enter each one.
- **Framework:** Enforced. Every state in `states` must be named by a
  constructed history. Every campaign runs each constructed history, and one
  that does not enter its named state fails. Half of the generated histories
  are also constructed, so the histories after each state are explored. A
  state that random histories reach only by chance goes in `measured`, which
  is reported but not required.
- **Author:** Reach is a predicate over the plan or trace, or a production
  probe. A literal example is not reach. A `fixed` history is a regression,
  not reach. A law that needs a state entered at least N times in each
  campaign needs N constructed histories that enter it.
- **Acceptance evidence:** The run reports each declared state and how many
  histories entered it.

### ORC-016: Law-only oracle files

- **Trigger:** A file defines an oracle, its histories, or a campaign,
  including a compile-time type oracle.
- **Obligation:** The file MUST NOT contain ordinary example-based unit tests
  or standalone concrete type assertions. Fixed regressions MUST be inputs to
  the same model, driver, and check as the campaign, and MUST NOT state their
  own expected answers. A type oracle MUST apply a reusable independent type
  law to generated legal inputs.
- **Framework:** The `oracle/no-unit-test` lint rule reports unit tests in
  oracle files. The gap check counts only kills through a registered
  `oracleProperty` route; a plain test in an oracle file is reported as an
  unregistered kill.
- **Does not satisfy:** Renaming a unit test, adding contract prose, or
  wrapping fixed expectations in a property runner.

---

## Changes from TanStack DB's rubric

Each change below keeps the requirement's purpose. A citation of the
rubric's ID still names the same requirement.

| ID      | Change                                                                     | Reason                                                                                                      |
| ------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| All     | "Framework" and "Author" notes added                                       | Say what `@tanstack/oracles` enforces, so nobody re-implements or works around it.                          |
| All     | Coverage-map owner entries replaced by the oracle's `limits`               | Adopters have no coverage map; code ownership belongs to tools such as CODEOWNERS (maintainer, 2026-11-10). |
| ORC-004 | Narrowing a grammar, filter, or validity predicate is a contract change    | Maintainer, 2026-11-10.                                                                                     |
| ORC-006 | "Equivalence within the tested domain" removed from mutant outcomes        | There are no equivalent mutants (maintainer, 2026-11-10).                                                   |
| ORC-007 | Rewritten as an enforced requirement                                       | `oracleProperty` runs the campaigns and prints the replay command.                                          |
| ORC-008 | "A legal next action" becomes "a legal continuation (one or more actions)" | Two states can agree after one action and differ after two, such as a FIFO queue's tail.                    |
| ORC-009 | Oracle terms come from the package glossary                                | The project glossary keeps domain terms.                                                                    |
| ORC-015 | Reach comes from constructed histories, not `createOracleReach`            | `oracleProperty` is the only campaign API (maintainer, 2026-11-09).                                         |

TanStack DB adds its own requirements, such as its coverage map, on top of
this checklist in its repository.
