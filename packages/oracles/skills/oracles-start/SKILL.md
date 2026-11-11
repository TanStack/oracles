---
name: oracles-start
description: Introduce @tanstack/oracles to an engineer and find a first oracle in their codebase. Give a short introduction, look around a subsystem they name or the whole repository, explore one area with probes that prove each finding, and write sketches of candidate oracles for the engineer to choose from. Use when someone is trying @tanstack/oracles, asks where an oracle would help, or wants a new oracle and has no approved sketch yet.
---

# Start with oracles

The engineer is trying this tool, often in the mood of "impress me". Earn it
with evidence about their own code: a probe that shows a bug, an
inconsistency between the docs and the code, or a behavior that no test
checks. An agent that only says things is often wrong, and one wrong claim
costs the tool its credibility. So never claim what a probe has not shown.

Probes are the small first instrument. They bootstrap the oracle: each probe
finds a constraint (or its absence), a dynamic, or a boundary, and those
become the oracle's laws and histories. The oracle then explores the whole
design space and checks the production code far more thoroughly than any
probe can.

Work in these four steps. Stop after each one, show the result, and wait for
the engineer. Then `oracles-design` builds the oracle that the engineer
chooses.

## 1. Ask, then introduce

Ask one question first: is there something specific they want to try this
on? Then introduce the tool in a few sentences and one example, from the
[introduction](../../docs/intro.md). Keep it short: the engineer came to see
it work.

Offer two ways to start:

- **A subsystem they name:** look closely at that part of the code.
- **No preference:** look around the repository for a good first oracle.

Say what you will do: read the repository, run small scripts against its
code from a scratch directory, and change no file in the repository until
the engineer chooses an oracle to build.

## 2. Look around

Make it quick. Read the public API and its docs (the README, the API docs,
the JSDoc), the existing tests, and the git history of fixes (for example
`git log --oneline -i --grep fix`, and the files that fixes change most).

Look for behavior that is easy to break, and whose right answer is simpler
to state than the code that produces it. Good signs:

- a round trip (parse and serialize, encode and decode, copy and compare)
- documented examples and defaults
- a cache, a queue, or other state that changes over a sequence of calls
- an ordering, timing, or normalization rule
- an invariant stated in a comment
- code that git history shows was fixed more than once

Avoid an internal helper whose only law would restate its code. Avoid
behavior that nothing documents, unless the engineer wants to decide it.

Report two or three spots, a short paragraph each: what the code seems to
promise and where that is stated, and why it makes a good first oracle.
Recommend one. The engineer picks.

## 3. Explore with probes

Read the chosen spot's docs, code, tests, and fix history. Then probe it.

**A probe** is a small script that calls the real public API with chosen
inputs and prints what happens. Run it from a scratch directory, outside the
repository or in an ignored path, against the unchanged code. Keep each
probe and its output, so the engineer can run it again.

**Every finding needs a probe.** A claim without one is a suspicion: label
it as a suspicion, or leave it out.

**Probe to find the design, not only bugs.** Look for:

- **Constraints:** what holds whatever the input or the sequence (a round
  trip, an order, uniqueness, a bound), and where it stops holding.
- **Dynamics:** how the result or the state changes with each call or
  input.
- **Boundaries:** empty, zero, `-0`, limits, the first and the last item,
  capacity, time, and odd input (digits, unicode, lone surrogates, keys that
  shadow prototype names).
- **Inconsistencies:** places where the docs, the code, the tests, and the
  examples disagree, and behavior that nobody decided, where two readings
  predict different results.

When a probe is cheap, run it over a grid or a random sample of inputs,
count the failures, and show the smallest one.

**Report each finding with its kind:**

| Kind            | What it means                                                           |
| --------------- | ----------------------------------------------------------------------- |
| Bug             | The code breaks a promise that a document states.                       |
| Inconsistency   | Two sources disagree: say which ones, and what each says.               |
| Test gap        | A probe shows behavior that no existing test checks.                    |
| Design question | Nothing decides the behavior: give two readings and what each predicts. |

For each finding, give the promise and its source, the input, what
happened, the command that reproduces it, and why the existing tests miss
it. For a bug, ask the engineer two questions: is it unintended, and did
they already know?

Then say why an oracle would help here: it would generate the whole domain
instead of a few probes, state the law that the probes point at, settle the
open questions, and hold the answer for every later change. For example:

> Column mapping between snake_case and camelCase. The JSDoc promises a
> round trip. The tests cover `user_id` and `created_at`. A probe over
> 21,844 names found 3,518 that do not round-trip, for example
> `address2_line → address2Line → address2line`. The JSDoc also shows
> `userHTTPSURL → user_https_url`, but the code gives `user_httpsurl`. An
> oracle would generate every name shape, state the round trip as a law,
> settle the acronym rule, and hold it.

If the probes find nothing, say so plainly: "No confirmed defect in the
paths examined." Then report what they did find: the constraints that held,
and the design questions.

## 4. Sketch candidate oracles

Write one to three candidate oracles for the chosen spot in
`oracles/SKETCHES.md`. Create the file if it does not exist, and add to it
if it does: it is the repository's list of oracle ideas. Mark a sketch
"built" once its oracle exists.

Each sketch establishes the boundary:

| Question                           | What to establish                                                                             |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| What promise belongs together?     | One caller-visible behavioral contract.                                                       |
| Where is it observed?              | The public entry points and the checkpoints where it is owed.                                 |
| What does it assume?               | What providers, the environment, and neighboring components must supply.                      |
| What else witnesses it?            | Other drivers for the same law: component, integration, end-to-end, or replay.                |
| Where does another contract begin? | A different authority, lifecycle, observation boundary, or composition rule.                  |
| Which source implements it?        | The `owns` list that the gap check uses.                                                      |
| What public state does it expose?  | Each readable field or getter needs a law or a stated limit. A limit leaves its mutants open. |

Then each sketch gives:

- **The promise,** in one or two sentences, and what the oracle would own.
- **The contract,** as `call // → result` lines (see `oracles-design` step 1).
- **One block for each law,** from this template. It is where examples
  become a general law.

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

The sketch also gives:

- **What the probes found,** sorted into constraints, dynamics, and
  boundaries. Each one becomes a law, a history dimension, or a constructed
  history. Link each probe.
- **The laws people forget,** as blocks, or one line that says why each does
  not apply:
  - **No throw on valid input.** When the contract says a call returns a
    value, it promises not to throw for valid input.
  - **The laws of the kind of function.** An equality check is reflexive and
    symmetric. A parser and a serializer round-trip. A setter is idempotent
    when set to the same value.
- **Open design questions,** each with its two readings and what the probe
  showed.

Check each sketch: from its contract and laws alone, a reader can predict
one observation of each law, and no law restates the code.

**Stop here.** The engineer picks a sketch and answers its questions. Record
the answers in the sketch. A sketch has no default: with no engineer
present, write it and stop. When the chosen sketch has no open question
left, its direction is settled. Then load `oracles-setup` if the repository
is not configured yet, and then `oracles-design` to build it.
