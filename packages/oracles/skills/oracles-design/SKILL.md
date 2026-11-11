---
name: oracles-design
description: Design, write, or change an oracle with @tanstack/oracles. Choose the boundary, write the oracle file's prose laws first, choose a model, and build histories that reach the states the law needs. Show the evidence the change needs, and close every gap. Use for a new oracle, an oracle repair, or a production change in owned code. Also use for any change to a model, history grammar, driver, or check.
---

# Design an oracle

An oracle states a law, generates the histories where the law matters, and
checks production against an independent model. Make the law clear enough
that someone could predict an observation without reading production. The
code comes after that.

Read this skill in full, then read the [glossary](../../docs/glossary.md)
in full. It defines the terms that the sheet and the evidence use.
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

| Question                           | What to establish                                                                             |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| What promise belongs together?     | One caller-visible behavioral contract.                                                       |
| Where is it observed?              | The public entry points and the checkpoints where it is owed.                                 |
| What does it assume?               | What providers, the environment, and neighboring components must supply.                      |
| What else witnesses it?            | Other drivers for the same law: component, integration, end-to-end, or replay.                |
| Where does another contract begin? | A different authority, lifecycle, observation boundary, or composition rule.                  |
| Which source implements it?        | The `owns` list that the gap check uses.                                                      |
| What public state does it expose?  | Each readable field or getter needs a law or a stated limit. A limit leaves its mutants open. |

Example: an oracle for optimistic publication can hold several related laws
(an optimistic write is visible at once, a confirmation keeps it, and a
rollback removes it) and several drivers (an in-memory provider and a real one). It
keeps its identity if the code moves between files. One source file can also
serve several contracts. A new failure belongs to the oracle whose law covers
its promise.

**Decide whether the user must approve.**

- **Strengthening an adopted law** (a missing history, observation, driver
  path, or check) reuses the law as it is. Do not write a new sheet, and do
  not stop. Name the law in the evidence. Widening the histories inside the
  law's stated domain is strengthening. Changing the stated domain, a
  checkpoint, or `limits` is a law change.
- **Changing a law** (its promise, domain, checkpoint, assumptions, or the
  freedoms it allows) needs a law delta. Edit the law block's prose in the
  oracle file, and add review notes with the old and the new block for each
  changed law. Stop for the user's review.
- **A new law, or missing or contradictory authority,** needs the full law
  sheet below. Stop for the user's review. An analogy to another documented
  rule is not authority: mark that law `open`.

**Write the oracle file's prose first.** The law sheet is the new oracle
file before it has any code. Create it at its final path, with two comments
and nothing else:

1. **The law block**, the file's opening comment. The oracle file is a
   literate program (ORC-003), so write it as prose for a reader who has not
   seen the review. Do not paste the template's fields or a list of law IDs.
   Write it as continuous prose in this order. Do not label the parts with
   the names below ("The hook", "The mechanism"): they are for you, not the
   reader.
   1. **What this oracle owns**, in two or three plain sentences: the
      concrete promise it maintains, the public entry point and checkpoints
      where the promise is owed, and the owned code. A reader who stops here
      knows what the file is for. Name the promise itself. "The stylesheet
      matches the options the README documents" names no promise. "`klona`
      returns a copy with the source's kind, prototype, and values at every
      depth, sharing no object with it" does. For example: "This oracle owns
      `klona`'s deep-copy promise for the default mode: the copy has the
      source's kind, prototype, and values at every depth, and shares no
      object with it. It checks the value that `klona(x)` returns. It owns
      `src/index.js#klona`."
   2. **The hook:** the one concrete case that shows where the promise is
      easy to get wrong. Write it as code where you can. Choose its form by
      the oracle's shape:

      | Shape                                          | Hook                                                                                                                                             |
      | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
      | State, timing, or order with a surprising rule | A question that names the surprise: "Why does a ready transaction wait?"                                                                         |
      | A pure function with documented examples       | The documented example, then the nearby case that a careless reading gets wrong: ratio 2 and base 16px give 32px, so what does base 15.5px give? |
      | The obvious implementation is wrong            | The plausible implementation and the one input where it fails: why a deep copy is not a JSON round trip                                          |

      When two forms fit, choose the one whose case a reader is most likely
      to get wrong.

   3. **The mechanism:** the two or three moving parts that make the
      behavior necessary, in plain sentences. Give each a short name (the
      window, the head, the applied receipt), and use the same name in the
      law names. When you write the code, use it in the `states` and the
      calibrations too.
   4. **The laws:** each one sentence over its domain ("For every ..."), with
      the source of its promise in the documentation's own words where you
      can. Then the edges where it is easy to get wrong, and what a caller
      sees when the law breaks.
   5. **How the oracle knows:** what the model reads to predict each law,
      which histories reach the edges, what the driver observes and does not
      observe and why, and where the check compares.
   6. **Limits and open questions**, last, each with its reason.

   Avoid the two generic openings: a summary that says the code does what
   its documentation promises, and a law that restates the implementation. A
   model of that law would be the same code, so it could not catch a defect.

2. **Review notes**, a second comment headed "Review notes (delete when
   approved)". Docs, tests, and bug reports give examples. A law is a
   statement over the whole domain. The template below makes you write the
   step from one to the other. Copy it once for each law, and fill in every
   field. Then list the open questions.

```markdown
### L1 <short name>

- Examples: <each concrete case, with its source>
- What varies, what stays: <the parts that can change without changing the answer; the part that decides it>
- Law: For every <domain>, <promise>.
- Domain edges: <where the domain stops>
- New case: <an input in none of the sources, with its predicted result>
- Rebuilt examples: <each example derived from the law sentence alone; any that it gets wrong, and why>
- Dynamics: <how the result or state changes with each action or input>
- Constraints: <what holds in every history>
- Boundary conditions: <each edge; each one gets a constructed history>
- Authority: <document and section, or a dated maintainer decision>
- Status: adopted | observed | open
- Rival: <a plausible different law>
- Witness: <a legal history where the law and the rival predict different observations>
- Checkpoint: <where the contract owes the observation>
```

How to fill in the fields:

- **Examples** and **What varies, what stays:** for example, `ms('2 hrs')`
  is `7200000` (README, Examples). The number, the spelling, and the spacing
  can change. The unit's length decides the answer.
- **Law:** one sentence over the domain. For example: "For every finite
  number `n` and every unit name `u` in the table, in any case and with or
  without a space, `parse(n + u)` is `n` times the length of `u`."
- **New case:** if you cannot write one, the law is still a list of
  examples. Write it again. A new case that only renames a value in the
  example (`/:id` for `/:foo`) does not count.
- **Domain edges:** wider than the examples. A block whose domain is only its
  own examples is not a law. Keep those examples as `fixed` histories, and as
  rebuilt examples of the general law that explains them.
- **Rebuilt examples:** an example that the law gets wrong shows a missing
  condition, a second law, or a source that disagrees. Say which.
- **Dynamics** are the model's rules, and the histories vary them. For a pure
  function, write "none: one call", and put the variation into the domain.
- **Constraints** hold whatever happens: a count never above its limit, an
  equality that is symmetric, a read that returns the last write. The check
  tests them at every checkpoint.
- **Boundary conditions** are the edges, where real behavior and most
  defects live: empty, zero, `-0`, the size limit, at capacity, the first and
  the last item, keys that shadow prototype names, cleanup. A boundary that
  the law does not decide goes under open questions. Do not leave it out of
  the grammar.
- **Status:** `adopted` if it has an authority, `observed` if production does
  it but nobody adopted it, `open` if it is a question. Only `adopted` laws
  become expected results. An `observed` or `open` law goes to the user as a
  question.
- **Production output is evidence, never authority.** A rule that you write
  only because production does it is model hacking. Mark that rule
  `observed`, and ask the user. An analogy to another documented rule is not
  authority either: mark that law `open`.

**Required blocks: the laws people forget.** The review notes have a block
for each of these, or one line that says why it does not apply:

- **No throw on valid input.** When the contract says a call returns a value,
  it promises not to throw for valid input. State that as a law, with the same
  authority, so a mutant that throws is a kill, not a crash.
- **The laws of the kind of function.** An equality check is reflexive and
  symmetric. A parser and a serializer round-trip. A setter is idempotent when
  set to the same value. Their authority is the function's documented purpose.

The task already approved these laws? Do not ask again.

The law block and the review notes must agree: each law in the prose has its
block, with the same sentence.

When the promise is unclear, or two readings predict different behavior, use
the [law discovery](../../docs/instruments/law-discovery.md) card.

**Use the [design grammar](../../docs/instruments/design-grammar.md) card
when any of these is true.** Do not judge whether the law is hard. Check the
list at the sheet, and again after each gap check:

- the sheet has more than five laws for one boundary (adopted, observed, and
  open ones all count)
- a law has no new case that it predicts
- the model has more than one branch per law
- the work changes or simplifies an existing model
- the gap check leaves three or more gaps in one function

Say in the evidence which trigger fired, or that none did.

**Check the law block before you stop:**

- From the prose alone, a reader can predict one observation of each law.
  For a no-throw law, the observation is that the call returns.
- The opening names the promise that the oracle owns.
- No law restates the code.
- Each law sentence matches its block in the review notes. If they disagree,
  the review notes decide: fix the prose, and tell the user. A new heading
  for a law is not a law change. A changed sentence, domain, or checkpoint is.

**Stop here** when the sheet or a law delta is needed. Do not stop with an
empty field: each law has a filled block first. Do not add code to the file
until the user has reviewed it. With no user present, write the file and
stop. A law sheet has no default. Until it has code, the file fails Vitest
with "No test suite found", so keep it off a branch whose CI must pass, or
say in the review request that it will fail.

**Once the user approves it:**

- Apply the review's changes to the law block first. The approved review
  notes are the anchor: a later edit to the prose that changes a law's
  domain, checkpoint, or strength ("may" to "does") is a law change.
- Delete the review notes. They stay in the review record.
- Add the code under the law block. Each boundary condition becomes a
  constructed history, and each law's sentence, authority, and limits go in
  that property's `law` option.
- Put prose beside the model, the histories, the driver, and the check that
  says why each one predicts or tests the promised result.

Keep the law block, the `law` option, and the model in step: a change to one
updates the others in the same change (ORC-003).

## 2. Freeze what the oracle must preserve

Write these down. They stay fixed while you build the oracle.

- The laws and their checkpoints, from the approved law block.
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

For the design grammar card, see the triggers in step 1.

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

When two styles fit the law, sketch both briefly, keep the one that states
the law most directly, and name the other in the law block, so a reader can
choose it later.

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
  reach. A constructed history must be one the arbitrary could generate,
  within its bounds. Use a constant when the arbitrary can generate it and it
  cannot collide with a generated value (a fixed boundary shape). Otherwise
  derive it from the generated history (for example "the initial value plus
  one").
- **Every arbitrary must take its histories back.** Each `fixed` and
  constructed history goes back through the arbitrary, and one that cannot
  fails when the file loads, naming the history. Give each `.map` its inverse
  (`.map(f, unmap)`, where `unmap` throws on a value it cannot map back), and
  avoid `.chain`. Build objects with `fc.record` or `fc.tuple` over primitive
  leaves. `fc.constant` and `fc.constantFrom` take back only primitives, or
  the same object reference.
- **Choose the string unit that covers the law's domain.** fast-check's
  default strings include lone surrogates, and slicing by code unit splits
  astral characters. `fc.string({ unit: 'binary' })` gives every code point
  except lone surrogates, control characters included. `unit: 'grapheme'`
  gives printable graphemes only, so it leaves out control characters, and
  a `fixed` history that uses one is refused. When the law is about any
  JavaScript string, lone surrogates are a boundary condition that the law
  must decide.
- **Cover the law's whole domain.** A mutant can only show what the histories
  vary. If the grammar covers part of the domain the law states (for example,
  fractions in quarter steps only), say so in `limits`. Better, widen it.
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
  production decides to enter it. Never raise `runs` to reach a state. With
  an enumerated source (`histories: { enumerated, states, measured }`), every
  history runs, so a required state needs no constructed history: the `reach`
  test fails if no history entered it. No enumerated history's label may be
  `reach` or `determinism`: those name the framework's own tests.
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
  - It records production errors, unhandled rejections, and warnings as
    observations, so the check can reject them. A mutant that crashes
    production is not a kill.
  - It observes the contract's return values.
  - It records only data: primitives other than symbols, plain arrays and
    objects, Maps, Sets, and Errors. A symbol, a Date, a function, or a class
    instance throws `OracleDataError`. Convert it first, for example to its
    description or its time value.
  - It identifies kinds with brand checks (`node:util` `types`, or
    `Object.prototype.toString`), not `instanceof`, when a law is about
    prototypes. `instanceof` follows a corrupted prototype chain.
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
  - A method of an object that a function returns (`mitt().emit`) has no name
    of its own. Own it through the enclosing function (`src/index.ts#mitt`).
    That entry also brings in the sibling methods: cover them, or report their
    gaps as outside this oracle's scope.
  - The tree follows what the TypeScript checker resolves. A call whose
    target is typed only by an interface or a type parameter (`this.#queue.filter`
    where `#queue: QueueType`) reaches no function body, so it is not followed.
    If the law depends on that method, own the implementation too
    (`source/priority-queue.ts#PriorityQueue.filter`).
  - A default export is named `default`, in any form (`export default
function`, `export default () => ...`, `module.exports = fn`):
    `index.js#default`. `exports.name = fn` is named `name`.
  - Module-level data (`const UNIT_MS = {...}`) is its own unit, named by its
    variable. An owned function that reads it owns it, and what its
    initializer refers to. An entry can also name it: `src/index.ts#UNIT_MS`.
    A destructured declaration (`const { a, b } = ...`) is not a unit: if a law
    depends on one, own the whole file.
  - When an entry pulls in another contract (a batching API in the same
    file, or a helper in a default export's call tree that serves another
    promise), write that contract's own oracle, or report its gaps as
    outside this oracle's scope.
  - Owned code that serves another module's contract belongs to that module's
    oracle. Owned code with no behavior anyone observes is possible dead code:
    investigate it as step 8 says.
  - Several oracles may own the same function. A mutant counts as killed when
    any of its owners kills it.

Keep the law, its authority, and its limits in `law`, and prose beside each
part that says why it predicts the promised result (ORC-003).

Put `owns`, the law, the model, the histories, the driver, and the check on
`oracleProperty`. Do not call `declareOracle`: it is legacy, kept only for
TanStack DB's migration. If a repository's existing oracles already use it,
leave them as they are.

The options of `oracleProperty` are typed in
`node_modules/@tanstack/oracles/src/oracle-property.ts`
(`OraclePropertyOptions`). Read them there.

**Lint as you go.** Run the repository's lint on each oracle file and each
changed production file after you edit it, and again before you finish. Fix
every report. Do not disable a rule.

Techniques: [guide § The driver and the check](../../docs/guide.md#the-driver-and-the-check).

## 7. Show the evidence that fits the change

The evidence depends on the kind of work:

| Work                                                    | Evidence                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fix a defect**                                        | The extended oracle fails on unchanged production (RED). The repaired production passes (GREEN). Neighboring laws still pass. The original defect, as a mutant, fails the oracle.                                                                                                                                                                   |
| **Refactor without changing behavior**                  | The oracle files are unchanged, or only strengthened, and pass on old and new production with the same seed. Every mutant key present in both gap runs that was killed on the old code is still killed. Every new key in a changed function is killed, or its survivor directive is acted on. Keys that disappear need nothing. No RED is expected. |
| **Add or strengthen an oracle over correct production** | Production passes. A calibration (a wrong answer or a corrupted trace) and a mutant fail the intended law. No RED is expected.                                                                                                                                                                                                                      |

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
- For a larger cleanup, sketch two or three designs that pass the same oracle
  (a table instead of branches, one state field instead of three, a
  recompute instead of a cache). Give each one's trade-off, and let the user
  choose when the choice is theirs. Do not keep only the first design you
  find.
- Rerun the oracle and the gap check after each cleanup.

Techniques: [guide § Evidence](../../docs/guide.md#evidence).

## 8. Close every gap

Run the gap check on the owned code, then work from its report. Exit 2 is a
refusal: do what its `fix:` line says. Exit 3 is a CLI bug: report it with
`<out>/error.log`, and do not change the oracle. Every gap
comes with one instruction. Do what it says, within the rules below.

- **There are no equivalent mutants.** A surviving mutant shows a missing
  history, observation, or law, or it shows dead code.
- **An effect that no check sees** is one that the driver does not record,
  or one that no history makes different. A changed condition can still lead
  to the same result when both branches agree on every generated input. Then
  add a history where they diverge. Otherwise, record the effect. The
  `not-observed` directive gives both steps.
- **Code whose removal no legal history can observe is dead.** The gap check
  alone cannot show this, because its histories are a sample. First rule out
  a missing history, observation, or law. Then remove the code in the same
  change, give the contract's reason in the evidence (it is a production
  change), and rerun the oracle and the gap check.
- **A law that kills nothing** owns no mutated code, or its witness never
  varies in the histories. Check its witness and its constructed history. If
  the law still kills nothing, it may restate another law: compare the two.
  If every change that breaks it also breaks the other law, it restates
  that law: merge them, as a law change. The report's "First law to reject,
  by law" table credits a kill only to the first law that rejects a
  history. A later law on the same history is not checked, so a law with no
  count is not shown to be useless. Before you restate or delete it, run hand
  mutants aimed at that law alone.
- **The only exclusions are probe-only code and the `super()` region of a
  derived constructor.**
- **A survivor that the adopted law allows is an allowed alternative.** If a
  mutant only moves production to another member of an allowed set, report it
  with its key, the clause, and the history, apart from the kills. Do not
  strengthen the law or change production to kill it. It stays open until the
  framework recognizes allowed sets. The user decides whether that blocks the
  work.
- **A stated limit does not close a gap.** If a survivor differs from the
  original only on inputs that the law's limits leave out (a null-prototype
  object, say), the gap is open. Report it with that reason, and recommend
  widening the grammar and the law to say what the code promises there. If
  that behavior is truly not part of the contract, the code that the mutant
  changes is a production question for the owner. Either way, the user
  decides.
- **A gap that existed before your change still counts** when it is in a
  function you changed. Report it with its law question. Do not take an exit.
- **Never propose an exit.** If a gap can be neither killed nor removed, it is
  a framework bug. Stop work on that gap, report its key and evidence to the
  user, and keep working on the other gaps.
- **A mutant that no oracle could possibly detect is an invalid mutant.** The
  framework must not generate it, so it is a framework bug: report it the same
  way. You do not decide that a mutant is invalid, and the label does not close
  its gap.
- **Validity follows the types.** The framework judges a mutant over the
  domain that the TypeScript types admit, so `number` includes `-0` and `NaN`.
  A narrower domain stated only in the law's prose, such as "positive
  integers", does not make a mutant invalid. Cover the type's whole domain,
  or narrow the type.
- **Never write "equivalent" or "needs a maintainer's decision" in your
  report.** For a survivor you cannot kill, give the histories you tried and
  what they showed, and follow its directive.
- **Temporary, a CLI limitation:** a mutant that makes production loop forever
  synchronously shows as a timeout. The framework's breakage laws will judge
  it, and they are not built yet. Report it as a known CLI limitation, not an
  oracle gap. Do not add driver timeouts for it, and keep working.
- **Temporary, a known CLI bug:** a gap on a guard that is constant under
  TypeScript's narrowing is an invalid mutant that the CLI should not have
  generated. Two forms: a branch after `x satisfies never`, and the test for
  the last member of an exhaustive union (after the other members' branches
  return or continue). Record it in your report under CLI limitations, with
  its line, and keep working. Do not remove the guard and do not change
  production: the guard protects untyped callers. Every other mutant on that
  line must still be killed.

- **Few mutants are weak evidence.** If the gap check generates few mutants
  for an owned function, or none on a law's decisions (such as a return
  expression), write authored mutants for the laws it misses. Put them in a
  directory and pass it with `--mutants <dir>`. The form is in the
  [mutant gap hunt](../../docs/instruments/mutant-gap-hunt.md) card.
- **Three or more gaps in one function** fire the design grammar trigger
  (step 1). Stop, read the card, and write its parts list for that function
  before you add a history. Adding histories first is the shortcut "Skipped
  design grammar".

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
  new production with the same seed. For a new oracle over correct code,
  production passing.
- **Mutant:** a mutant, such as the original defect, and the law that
  rejected it, plus the calibrations that fail. For a refactor, the shared
  keys still killed, and each new key killed or acted on.
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
