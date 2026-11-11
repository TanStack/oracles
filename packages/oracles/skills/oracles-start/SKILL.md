---
name: oracles-start
description: Run a first session with @tanstack/oracles in an engineer's codebase. Say what the session will do, look around a part of the code they name or the whole repository, probe the real API to prove each finding, propose a potential oracle and its potential laws, then build it and run it until it finds a bug and the engineer has settled some design questions. Present the work, and explain the path to production. Use when someone is trying @tanstack/oracles, or asks where an oracle would help.
---

# A first session with oracles

## Your goal

Be an engaging teacher. The engineer is trying this tool, often in the mood
of "impress me". Show, don't tell. Bring up interesting findings about their
own code, and explain what you are doing and why as you go. Tie each
explanation to something you just showed them: a probe, a finding, a law, or
the oracle file. Do not explain what oracles are unless they ask.
[What an oracle is](../../docs/intro.md) is there for when they do.

The session ends at one moment: an oracle that runs on their code, has found
a bug, and has pushed them to settle some design questions. Then you present
what you built, and explain how to take it to production.

An agent that only says things is often wrong, and one wrong claim costs the
tool its credibility. So every finding needs a probe that the engineer can
run again.

## How to talk

- Use these terms, and use them every time: a **probe**, a **finding**, a
  **potential oracle** that owns a public behavior, its **potential laws**,
  and the **oracle file**. Once the engineer approves a potential law, it is
  a **law**; once the oracle runs, it is the **oracle**.
- Explain a framework term in a line the first time you use it (a
  calibration is a wrong answer planted in a run to show that the check
  rejects it), or leave the term out.
- Talk naturally. Never name a skill, a step, or a section ("step 3", "the
  skill's fallback"). Say what you are doing, in your own words.
- Ask in plain words. Explain any term the engineer may not know in one
  line (for example, a lone surrogate is half of a character that takes two
  UTF-16 units).
- Ask one clear question when you need a decision. For a possible bug, ask
  "Is this a bug, or is it intended?" When several decisions are waiting,
  end with a short numbered list of them, most important first, so the
  engineer can answer by number.
- Show the engineer only what they decide on. Your private notes, their
  labels, and their statuses ("adopted", "open") stay private. Until the
  engineer approves it, a potential law is only a potential law.

## Where you stop

Stop and wait only when the engineer must decide:

- which part of the code to look at
- whether a finding is a bug, or intended
- a design question
- whether to approve the potential laws
- whether to approve a more complex design (see below)
- whether to take the oracle to production

Between those points, keep working, and keep telling them what you are doing.

## What you change

Until the engineer chooses to take an oracle to production, change only
these:

- the minimal installs that an oracle needs to run: `@tanstack/oracles`,
  `fast-check`, and `vitest` when they are missing
- a minimal Vitest config that picks up the oracle file, only when the
  repository's own config does not
- oracle files, with their prose

Findings, potential oracles, and potential laws stay in the chat. Keep
probes in a scratch directory outside the repository. Change production code
only when the engineer asks you to.

## 1. Open

Your first message starts with two or three sentences on what this session
will do, before any question. For example: "I'll
look around your code for a behavior that's easy to break, try it with small
scripts that call your real API, and show you what I find. Then I'll write
an oracle for it with you and run it."

Then ask one question: is there a part of the code they want to try this on,
or should you look around? Stop for the answer. If their first message
already named a part of the code, say that you will start there, and go on.
A request about the whole repository ("what can it find in this repo")
names no part: ask.

## 2. Look around

If the engineer named a part of the code, look closely there. Otherwise,
look around the repository, and make it quick. Read the public API and its
docs (the README, the API docs, the JSDoc), the existing tests, and the git
history of fixes. The files that fixes change most often tell you more than
a search for "fix":
`git log -i --grep fix --name-only --format= | sort | uniq -c | sort -rn | head`.
It is a starting point: skip build and config files, and read the commits
that changed the public API.

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

Tell them about two or three spots, a short paragraph each: what the code
seems to promise, where that is stated, and why it would make a good oracle.
Recommend one, and let them choose. If they asked you to choose ("surprise
me"), say in a line which spot you picked and why, and go on to probe it.
They can redirect you.

## 3. Probe

Read the spot's docs, code, tests, and fix history. Then probe it.

**A probe** is a small script that calls the real public API with chosen
inputs and prints what happens. Import the code the way the repository's own
tests do. If they import a build that is not built yet, import the source
it comes from. Run the probe from a scratch directory against the unchanged
code, with `node` (or `npx tsx` for TypeScript). If Node warns about the
module type, give the scratch directory a `package.json` with
`"type": "module"`. Keep each probe and its output.

**Every finding needs a probe.** A claim without one is a suspicion: say so,
or leave it out.

**Probe to find the design, not only bugs.** Look for:

- **Constraints:** what holds whatever the input or the sequence (a round
  trip, an order, uniqueness, a bound), and where it stops holding.
- **Dynamics:** how the result or the state changes with each call or
  input.
- **Boundaries:** empty, zero, `-0`, limits, the first and the last item,
  capacity, time, and odd input (digits, unicode, lone surrogates, keys that
  shadow prototype names).
- **Inconsistencies:** places where the docs, the code, the tests, and the
  examples disagree, and behavior that nobody decided.

When a probe is cheap, run it over a grid or a random sample of inputs,
count the failures, and show the smallest one.

**Find the authority for each promise, and show it.** Look in the README,
the API docs, the JSDoc, the tests' names and bodies, the changelog, source
comments, and any standard that the docs name. Quote it, with the file and
line. The authority is what makes a finding credible, and it becomes the
documentation in the oracle file. When nothing decides a behavior, it is a
design question, not a bug.

The engineer's answer to a design question is an authority too. Once they
decide it, it becomes a potential law, and the oracle can find where the
code breaks it, just as with a law from the docs. In a repository with few
docs, this is the usual way to a bug: ask the question, and let the oracle
check the answer.

**Present each finding** in this shape, a light touch, with each finding
called a possible bug or a question, never a certainty:

1. A title that names the behavior: "Object Map key: replay throws".
2. The smallest case, expected against observed, as a short snippet the
   engineer can run.
3. **Why I think it's wrong:** the authority, quoted, with its file and line.
4. **Why the tests miss it:** what the existing tests check instead.
5. **How often:** how many of the probe's inputs failed, out of how many.

Give each finding its kind:

| Kind            | What it means                                                           |
| --------------- | ----------------------------------------------------------------------- |
| Possible bug    | The code breaks a promise that a document or a test states.             |
| Inconsistency   | Two sources disagree: say which ones, and what each says.               |
| Test gap        | A probe shows behavior that no existing test checks.                    |
| Design question | Nothing decides the behavior: give two readings and what each predicts. |

For example:

> **Column names with a digit don't round-trip.**
>
> ```ts
> camelToSnake(snakeToCamel('address2_line')) // expected 'address2_line', got 'address2line'
> ```
>
> **Why I think it's wrong:** the JSDoc of `snakeToCamel` says the transform
> is "round-trippable via `camelToSnake`" (`src/column-mapper.ts:71`).
> **Why the tests miss it:** they check `user_id` and `created_at`, which
> have no digits and no single-letter parts. **How often:** 3,518 of the
> 21,844 names I tried.

For a possible bug, ask: "Is this a bug, or is it intended?"

If the probes find nothing, say so plainly: "No confirmed defect in what I
tried." Show what held, and the design questions that came up.

## 4. Propose a potential oracle

Say why an oracle would help here. It tries the whole space of inputs and
sequences, not a few probes, states the rule that the probes point at, and
holds the answer for every later change.

Then present it in the chat: "Here's a potential oracle that owns
<the public behavior>, and its potential laws as I see them." If two
potential oracles fit the spot well (two public behaviors, or two ways to
draw the boundary), name the second one in a sentence, say what it would
own instead, and recommend one.

- What it would own, in one or two sentences.
- The contract, as a few lines of public calls and their results:

  ```ts
  klona(x) // → a deep copy: same kind, prototype, and values as x, sharing no object with it
  ```

- Each potential law, as one "For every …" sentence, with its authority
  quoted, and what the probes showed about it.
- The laws people forget, or one line on why each does not apply:
  - **No throw on valid input.** When the contract says a call returns a
    value, it promises not to throw for valid input.
  - **The laws of the kind of function.** An equality check is reflexive and
    symmetric. A parser and a serializer round-trip. A setter is idempotent
    when set to the same value.
- The open design questions, each with its two readings, and what the probe
  showed. Say that these can wait: the oracle's results will help decide
  them. List them apart from the potential laws, and do not number them as
  laws. Until the engineer decides one, the oracle file states it as a
  limit.

**Work out each law privately before you propose it.** Fill in this
worksheet for each one, for yourself. Do not show it. It is how you get from
a few examples to a general law:

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

Settle these privately too:

- **What it assumes:** what providers, the environment, or neighboring code
  must supply.
- **What else witnesses it:** other ways to observe the same law (a
  component, an integration, a replay).
- **What public state it exposes:** each readable field or getter needs a
  law or a stated limit.
- **What each probe found:** each constraint, dynamic, or boundary becomes a
  law, a history dimension, or a constructed history. Keep a pointer to the
  probe that showed it.

The law must say more than the code does. If a model of it would only repeat
the implementation, look for the public promise that the code serves.

**A more complex design needs sign-off.** Before you propose, read the
trigger list in `oracles-design` step 1. When a trigger for the
[design grammar](../../docs/instruments/design-grammar.md) card fires (for
example, more than five laws, or a
law with no new case that it predicts), work through the card. Then show
the engineer the design it produced, in a few plain lines: what the model
keeps, how the laws share it, and any choice between two designs, with your
recommendation. Leave out the card's own terms (preservation relation,
primitives, ablation). Ask them to approve it with the laws.

Then ask the engineer to approve the potential laws that the authority
decides. An approved potential law is an adopted law. Potential laws have no
default: with no engineer present, propose them and stop.

## 5. Build and run

1. **Install what is missing**, and nothing more: `fast-check` and `vitest`
   when the repository does not have them. Use the repository's own package
   manager. If the repository's own Vitest config would not pick up the oracle
   file, add a minimal config for it (or add its glob to the existing
   `include`). Add no scripts, lint, or other config yet. The `oracles-setup`
   skill's install and "where oracle files go" sections have the details:
   from them, take only what these packages and the config need. The lint
   plugin waits for production.

   The framework needs Vitest 4.1 or later. Check before you install:

   - **The repository uses another runner** (mocha, uvu, Jest, node:test):
     add Vitest for the oracles only, with a config whose `include` is only
     the oracle files. Their own suite and runner stay as they are. Tell
     the engineer this in one line as you install.
   - **The repository runs an older Vitest:** this is a decision for the
     engineer. Tell them that the oracle needs Vitest 4.1 or later, and that
     upgrading changes the runner for their own suite too. Offer to upgrade
     and then run their suite, to show whether it still passes. Do not
     upgrade until they agree.
   - **An install fails:** show the error in a line or two, say what you
     think caused it, and ask before you try anything that changes more than
     the packages above.

2. **Write the oracle file.** Follow `oracles-design` from its first step:
   the law block's prose, then the model, the histories, the driver, and the
   check. As you build, tell the engineer briefly what each part is for: the
   model computes the expected answer the simple way, the histories are the
   generated inputs and sequences, the driver calls their real code, and the
   check compares the two at each step.
3. **Run it on the unchanged code.** A failure under an approved law is a
   possible bug. Present it like a probe finding, with the oracle's smallest
   failing case as the snippet.
4. **As the engineer settles questions, change the law** and rewrite the law
   block's prose in the same step. Before you show results, check that the
   prose still says what the code does.

Do not run the gap check yet, and do not change production code. Both belong
to taking the oracle to production.

If the oracle finds no bug, say so plainly, show what held, and offer to
build the next oracle at another spot.

## 6. Present

When the oracle has found a bug and the engineer has settled some design
questions, stop and present:

- what you built, and what it found
- an offer to walk through how it works: how the reference model was built,
  how the histories are generated, and how the driver calls their code.
  Engineers often want this, and it is the best part to teach.

When they take the walk-through, follow one bug the oracle found through
the file: the history that produced it, what the driver did and saw, what
the model expected, and how the check reported the difference and shrank it.
Show a few lines of the file at each part, not a description of it.

- an invitation to ask questions

Then explain how to take the oracle to production: a lint preset that keeps
oracle files honest, a block in `AGENTS.md` (or `CLAUDE.md`) so every agent
follows the same rules, and the gap check, which makes small changes to a copy of the
production code and shows each change that no law catches. That is how the
oracle grows toward full coverage. If they want to go ahead, load
`oracles-setup`.
