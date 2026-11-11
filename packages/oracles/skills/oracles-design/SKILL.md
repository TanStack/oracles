---
name: oracles-design
description: Design, write, or change an oracle with @tanstack/oracles. Start from approved potential laws, write the oracle file with its law block and code, choose a model, and build histories that reach the states the law needs. Show the evidence the change needs, and close every gap. Use for a new oracle, an oracle repair, or a production change in owned code. Also use for any change to a model, history grammar, driver, or check.
---

# Design an oracle

An oracle states a law, generates the histories where the law matters, and
checks production against an independent model. Make the law clear enough
that someone could predict an observation without reading production. The
code comes after that.

Read this skill in full, then read the [glossary](../../docs/glossary.md)
in full. It defines the terms that the laws and the evidence use.
The [checklist](../../docs/oracle-checklist.md) is the complete list of
requirements. This skill cites it by ID, such as ORC-004.

**Work in this order.** Reviewers check the order as well as the result. A
shortcut moves the work into review, where each finding costs a fix, a new
witness, and another round. The common shortcuts are changing production
first, editing the model to match production, narrowing histories until a
failure goes away, and pinning one example. `oracles-review` §2 lists them all.

## 1. Start from approved potential laws, then write the oracle file

**A new oracle starts from potential laws that the developer approved**, usually
in a first session (`oracles-start`): the laws that the authority decides.
Open design questions may still be open: they are limits until the developer
settles them. If no laws are approved yet, probe the behavior and propose
them first, as `oracles-start` does, and stop for approval. Exploration and
review stay in the conversation, never in the oracle file. The file is
written with its law block and its code together.

**Decide whether the developer must approve.**

- **Strengthening an adopted law** (a missing history, observation, driver
  path, or check) reuses the law as it is. Do not propose new laws, and do
  not stop. Name the law in the evidence. Widening the histories inside the
  law's stated domain is strengthening. Changing the stated domain, a
  checkpoint, or `limits` is a law change.
- **Changing a law** (its promise, domain, checkpoint, assumptions, or the
  freedoms it allows) needs a law delta. Show the developer the old and the new
  law, with the probe or result that shows why. Stop for their review, then
  rewrite the law block in the same change.
- **A new law, or missing or contradictory authority,** needs the developer's
  approval of that potential law. An analogy to another documented rule is
  not authority.
- **The developer's answer to an open question is its review.** Rewrite the law
  block in the same step, and continue. A change the developer did not ask for
  (you found that a law is wrong) needs the delta and a stop.
- **The task already approved these laws?** Do not ask again. An approved
  potential law is an adopted law.

**Production output is evidence, never authority.** A rule that exists only
because production does it is model hacking. When the law and the code
disagree, the adopted law decides, not the code.

When the promise is unclear, or two readings predict different behavior, use
the [law discovery](../../docs/instruments/law-discovery.md) card.

**Use the [design grammar](../../docs/instruments/design-grammar.md) card
when any of these is true.** Do not judge whether the law is hard. Check the
list when you propose the laws, and again after each gap check:

- there are more than five laws for one boundary (adopted, observed, and
  open ones all count; an open question that the oracle file states only as
  a limit is not a law)
- a law has no new case that it predicts
- the model has more than one branch per law
- the work changes or simplifies an existing model
- the gap check leaves three or more gaps in one function

Say in the evidence which trigger fired, or that none did. When a trigger
fires before the oracle is written, show the developer the design the card
produced, and get their approval with the laws.

**Write the law block.** The law block is the file's opening comment. The oracle file is a literate
program (ORC-003), so write it as prose. That reader is a maintainer, or a developer who uses the library seriously and knows
the codebase. Name internal parts without introducing them, and do not
explain the language, the library's basic ideas, or what a reader of the
code can see at once. Spend the words on what such a reader could get
wrong. Do not write about "a careless reader": state the case. Do not paste the template's fields or a list of law IDs.
Write it as continuous prose in this order. Do not label the parts with
the names below ("The hook", "The mechanism"): they are for you, not the
reader.

1. **What this oracle owns**, in one or two plain sentences, about 40 words
   in all: the concrete promise it maintains, the public entry point and
   checkpoints where the promise is owed, and the owned code. A reader who
   stops here knows what the file is for. Name the promise itself. "The
   stylesheet matches the options the README documents" names no promise. For
   example: "This oracle owns `slugify`'s promise for titles, checked on the
   string that `slugify(title)` returns. It owns `src/slugify.ts#slugify`."

2. **The contract at a glance:** a short code block, right after those
   sentences, that shows the public API promises this oracle maintains. A
   reader takes it in at one look. Give it no title, and no sentence that
   introduces it. Write each line as `call // → result`:
   - the call is the public API, written the way a caller writes it, with
     concrete values where they make the promise clear.
   - the result is what the caller gets back or sees: a value, or a short
     phrase.
   - a condition goes at the end of the line, as "when ...".
   - an open law ends with `(open)`.
   - when several laws share one call, write the call once, and put one
     `// → result` line under it for each law.

   Keep it to about five results. A call may span several lines. Never write
   an assertion, a test helper, or a checkpoint expression there: those
   belong in the code. The block never shows how production computes the
   answer. For example:

   ```ts
   slugify('Hello, World!') // → 'hello-world': lowercase words joined by '-'
   typography({ scaleRatio: 2, baseFontSize: '16px' }) // → h1 font size 32px (ratio × base)
   typography({ scaleRatio: 2, baseFontSize: '15.5px' }) // → h1 font size 31px (open)
   ```

3. **The hook:** the one concrete case that shows where the promise is
   easy to get wrong. Write it as code where you can. Choose its form by
   the oracle's shape:

   | Shape                                          | Hook                                                                                                                                             |
   | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
   | State, timing, or order with a surprising rule | A question that names the surprise: "Why does a ready transaction wait?"                                                                         |
   | A pure function with documented examples       | The documented example, then the nearby case that a careless reading gets wrong: ratio 2 and base 16px give 32px, so what does base 15.5px give? |
   | The obvious implementation is wrong            | The plausible implementation and the one input where it fails: why a deep copy is not a JSON round trip                                          |

   When two forms fit, choose the one whose case a reader is most likely
   to get wrong.

4. **The mechanism:** the two or three moving parts that make the
   behavior necessary, in plain sentences. Give each a short name (the
   window, the head, the applied receipt), and use the same name in the
   law names. When you write the code, use it in the `states` and the
   calibrations too.
5. **The laws:** each one sentence over its domain ("For every ..."), with
   the source of its promise in the documentation's own words where you
   can. Then the edges where it is easy to get wrong, and what a caller
   sees when the law breaks.
6. **How the oracle knows:** what the model reads to predict each law,
   which histories reach the edges, what the driver observes and does not
   observe and why, and where the check compares.
7. **Limits and open questions**, last, each with its reason.

Avoid the two generic openings: a summary that says the code does what
its documentation promises, and a law that restates the implementation. A
model of that law would be the same code, so it could not catch a defect.

Keep the law block to about 40 lines of prose, plus the contract code block.
It never mentions a review or an open question: a point the developer has not
decided appears only as a limit, with its reason. Nor does it tell the story
of the session: no "the maintainer approved", "the developer deferred", or
"as the probe showed". A developer's decision is stated as the rule it made, and
a limit's reason is about the code ("`slugify` drops every character
outside ASCII"), not about who has not decided yet. When a developer's decision is
the authority for a law, write it as "Decision by <name> (GitHub
<login>), <date>: <the rule>", the same way in the `law` option's
`authority`. On a team, a reader needs to know whom to ask. Take the login
from `gh api user --jq .login`, or ask the developer. Write the login without an
`@`, so that a copy into a pull request does not notify anyone.

**Then write the code under it.** Each boundary condition from the probes
and the law worksheet becomes a constructed history. If there was no first
session, fill in the worksheet from `oracles-start` for each law first. Each `oracleProperty` carries one law: give
each law its own property, so a failure names the law it breaks. The
properties can share one model, grammar, and driver. Each law's sentence,
authority, and limits go in that property's `law` option. Put prose beside the model, the histories,
the driver, and the check that says why each one predicts or tests the
promised result.

**Check the law block:**

- From the prose alone, a reader can predict one observation of each law.
  For a no-throw law, the observation is that the call returns.
- It starts with one or two sentences on what the oracle owns, then the
  contract code block: public API calls and their results, with no assertion
  or helper. Each line states the same law as its sentence.
- No law restates the code.
- Each law sentence matches the law the developer approved. If they disagree, the
  adopted law decides: fix the prose, and tell the developer. A new heading for
  a law is not a law change. A changed sentence, domain, or checkpoint is.

Keep the law block, the `law` option, and the model in step: a change to one
updates the others in the same change (ORC-003). When a decision changes a
law during the work, rewrite the law block at once, not at the end.

## 2. Freeze what the oracle must preserve

Write these down. They stay fixed while you build the oracle.

- The laws and their checkpoints, as the developer approved them.
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
  developer. Do not pick a winner.

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

When two styles fit the law, draft both briefly, keep the one that states
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
  - It waits on events, never on the wall clock. Control time with fake
    timers, a virtual clock, or deferred promises, so that load on the
    machine cannot change a result.
  - When something else needs the model (a probe, a second oracle, a
    reconstruction), keep the model in a test-free companion module, such
    as `parse-model-oracle.ts`. An oracle file registers tests when it is
    imported.
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
`oracleProperty`. An oracle file registers its tests only through
`oracleProperty`, or through a project helper that forwards a literal `owns`
list to it.

The options of `oracleProperty` are typed in
`node_modules/@tanstack/oracles/src/oracle-property.ts`
(`OraclePropertyOptions`). Read them there.

**Lint as you go.** Run the repository's lint on each oracle file and each
changed production file after you edit it, and again before you finish. Fix
every report. Do not disable a rule.
In a first session, the oracles lint plugin is not installed yet: run the
repository's own lint, if it covers the oracle file, and go on.

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
- For a larger cleanup, draft two or three designs that pass the same oracle
  (a table instead of branches, one state field instead of three, a
  recompute instead of a cache). Give each one's trade-off, and let the developer
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
  framework recognizes allowed sets. The developer decides whether that blocks the
  work.
- **A stated limit does not close a gap.** If a survivor differs from the
  original only on inputs that the law's limits leave out (a null-prototype
  object, say), the gap is open. Report it with that reason, and recommend
  widening the grammar and the law to say what the code promises there. If
  that behavior is truly not part of the contract, the code that the mutant
  changes is a production question for the owner. Either way, the developer
  decides.
- **A gap that existed before your change still counts** when it is in a
  function you changed. Report it with its law question. Do not take an exit.
- **Never propose an exit.** If a gap can be neither killed nor removed, it is
  a framework bug. Stop work on that gap, report its key and evidence to the
  developer, and keep working on the other gaps.
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
