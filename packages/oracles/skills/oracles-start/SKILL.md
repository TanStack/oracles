---
name: oracles-start
description: Run a first session with @tanstack/oracles in a developer's codebase. Say what the session will do, look around and present a few spots, probe the real API to prove each finding, propose a potential oracle and its potential laws, then build it and run it, fix confirmed bugs oracle first, and close gaps until it finds bugs or design questions. Present the work, and say what finishing the repository's setup would add. Use when someone is trying @tanstack/oracles, or asks where an oracle would help.
---

# A first session with oracles

## Your goal

Be an engaging teacher. The developer is trying this tool, often in the mood
of "impress me". Show, don't tell. Bring up interesting findings about their
own code, and explain what you are doing and why as you go. Tie each
explanation to something you just showed them: a probe, a finding, a law, or
the oracle file. Do not explain what oracles are unless they ask.
[What an oracle is](../../docs/intro.md) is there for when they do.

Work toward these milestones, in order: findings from probes of their real
code; a potential oracle whose laws they approve; an oracle that runs on
their code; and that oracle finding a bug, or closing gaps until one turns
up, while they settle some design questions. Do not wrap up before the
oracle has found a bug or brought up a design question. The developer can
stop you at any time.

Part of what the session shows, without saying so, is how an oracle works
through a codebase: each bug goes into the oracle first, the fix follows,
and the gap check points at the next thing to cover.

Probes are how you learn what reading the code does not tell you: its
dynamics, boundary conditions, and constraints. You need that understanding
to build the oracle. Bugs and inconsistencies that the probes find along the
way are a welcome side effect. They also keep you honest: an agent that only
says things is often wrong, and one wrong claim costs the tool its
credibility. So every finding needs a probe that the developer can run again.

## How to talk

- Use these terms, and use them every time: a **probe**, a **finding**, a
  **potential oracle** that owns a public behavior, its **potential laws**,
  and the **oracle file**. Once the developer approves a potential law, it is
  a **law**; once the oracle runs, it is the **oracle**.
- Explain each uncommon word in one line the first time you use it, tied to
  what is on the screen. Do not explain them all up front. The words, and a
  line for each:

  | Word                | One line                                                                                              |
  | ------------------- | ----------------------------------------------------------------------------------------------------- |
  | probe               | a small script that calls your real code with chosen inputs and prints what happens                   |
  | finding             | something a probe showed: a possible bug, two sources that disagree, untested behavior, or a question |
  | law                 | one promise the code makes, as a "for every …" sentence, with where the promise is written            |
  | oracle              | a test that checks the laws against your real code over many generated inputs                         |
  | oracle file         | the file that holds the oracle: the laws in prose first, then the code                                |
  | model               | the expected answer, computed the simple way, without your code                                       |
  | history             | one generated input or sequence of calls that the oracle tries                                        |
  | constructed history | a history written by hand to reach one edge case every run                                            |
  | driver              | the part that calls your real code and records what it does                                           |
  | check               | the part that compares what your code did with the model                                              |
  | shrinking           | cutting a failing history down to the smallest one that still fails                                   |
  | seed                | the number that makes a run's random histories the same every time                                    |
  | calibration         | a wrong answer planted in a run, to show that the check rejects it                                    |
  | owns                | the functions an oracle answers for                                                                   |
  | gap check           | makes small changes to a copy of the owned code, and shows each change that no law notices            |
  | gap                 | one such change: behavior the oracle does not check yet                                               |
  | authority           | where a promise is written: the docs, a test, a comment, or your decision                             |
  | limit               | what the oracle does not check, and why                                                               |

  Use the same word for the same thing every time. Leave out a word the
  session does not need.

- Talk naturally. Never name a skill, a step, or a section ("step 3", "the
  skill's fallback"). Say what you are doing, in your own words.
- Talk about their code in its own terms, not in this skill's words. Words
  such as "dynamics", "constraints", "boundaries", "a behavior that's easy to
  break", or "a simple rule behind it" are for you. The developer should hear
  about timeouts, retries, cache entries, or whatever their code does.
- Ask in plain words. Explain any term the developer may not know in one
  line (for example, a lone surrogate is half of a character that takes two
  UTF-16 units).
- Ask one clear question when you need a decision. For a possible bug, ask
  "Is this a bug, or is it intended?" When several decisions are waiting,
  end with a short numbered list of them, most important first, so the
  developer can answer by number.
- Show the developer only what they decide on. Your private notes, their
  labels, and their statuses ("adopted", "open") stay private. Until the
  developer approves it, a potential law is only a potential law.

## Where you stop

Stop and wait only when the developer must decide:

- which of the spots you present to dig into
- whether a finding is a bug, or intended
- a design question
- whether to approve the potential laws
- whether to approve a more complex design (see below)
- whether to finish setting up the repository for oracles, when they want to
  keep the work (a commit, or a pull request)

Between those points, keep working, and keep telling them what you are doing.

## What you change

Until the developer wants to keep the work and finish setting up the
repository, change only these:

- the minimal installs that an oracle needs to run: `@tanstack/oracles`,
  `fast-check`, and `vitest` when `package.json` does not list them
- a minimal Vitest config that picks up the oracle file, only when the
  repository's own config does not
- oracle files, with their prose
- the feedback log, `oracles-feedback.md`, while this is a preview
- the smallest production fix for a bug the developer confirmed, after the
  oracle fails on it (see step 5)

Findings, potential oracles, and potential laws stay in the chat. Keep
probes, and the gap check's report, in a temporary directory outside the
repository (`mktemp -d`). Say nothing about cleaning them up.

## A feedback log, while this is a preview

`@tanstack/oracles` is in preview, and its maintainers want to know where
this session was rough. Create `oracles-feedback.md` at the root of the
repository when the session starts, and do not commit it.
Append a short entry whenever a skill or doc was unclear, wrong, or
contradicted another; whenever you had to guess; whenever a command,
install, or config step failed or needed a workaround; and whenever
something took much longer than it should have. Each entry gives the time,
what you were doing, what happened, the skill file and section, and what
would have made it smooth. Keep entries short, and keep working: the log
is for later, not a reason to stop.

## 1. Open

Before your first message, read the block that finishing the setup adds to
`AGENTS.md`: it is in [`oracles-setup` step 4](../oracles-setup/SKILL.md),
under "Write the AGENTS.md block". It governs you from the start of this
session, though nobody has added it to the repository yet: who owns the
laws and who owns the code, which skill to read before each kind of oracle
work, and the lint rule. Until the setup is finished, the lint rule means
the repository's own lint: the oracles lint plugin comes with the setup,
and its absence is not a problem to report.

Your first message starts with two or three sentences on what this session
will do, before any question. Write them for this repository, in plain words,
in your own sentences: name what the library does, which of its behaviors
you will try, how you will try them (calling the real code with chosen
inputs), and that you will then write an oracle with them for the rules you
agree on. Mention nothing about this skill or its steps.

Then go straight on to look around. If their first message named a part of
the code, say that you will start there, and go on. They can name a part at
any time, and you start there.

## 2. Look around

If the developer named a part of the code, look closely there. Otherwise,
look around the repository, and make it quick. Read the public API and its
docs (the README, the API docs, the JSDoc), the existing tests, and the git
history of fixes. The files that fixes change most often tell you more than
a search for "fix":
`git log -i --grep fix --name-only --format= | sort | uniq -c | sort -rn | head`.
It is a starting point: skip build and config files, and read the commits
that changed the public API.

Look for behavior that is easy to break, and whose right answer is simpler
to state than the code that produces it. Rank the candidates by how much a
bug there would hurt the people who use the code. Good signs:

- the most important API: the call most users make first, and most often
- code the README's examples and getting-started section show
- behavior users see directly, and depend on
- a promise stated strongly (a guarantee in the docs, an invariant in a
  comment), above all in code that has not changed in years: nobody has
  checked it since it was written
- a rare edge case that would bring a user's system down when it hits
- code that git history shows was fixed more than once: people keep
  reporting bugs there, so the tests are not capturing the whole picture
- a round trip (parse and serialize, encode and decode, copy and compare)
- a cache, a queue, or other state that changes over a sequence of calls
- an ordering, timing, or normalization rule

Avoid an internal helper whose only law would restate its code. Avoid
behavior that nothing documents, unless the developer wants to decide it.

Quick probes to choose the spots are fine. Show a result only later, with
the probe that proves it.

Present two or three spots, a short paragraph each: what the code seems to
promise, where that is stated, why a bug there would matter, and why it
would make a good oracle. Recommend one, and stop for their choice. If they
already asked you to choose ("surprise me"), say in a line which spot you
picked and why, and go on to probe it.

## 3. Probe

Read the spot's docs, code, tests, and fix history. Then ask yourself: what
do I not know about this code that I need to know to build its oracle? How
does the state change with each call? Where are the boundaries? What holds
whatever happens? Show the developer those questions in the chat, a short
list, before you probe: it shows them how an oracle gets built. Write each
question about their code ("If the second try fails too, does it wait
longer than after the first?"), not as a category ("timing", "lifecycle"). Then build a
probe for each one, and answer each question with what its probe showed.

**A probe** is a small script that calls the real public API with chosen
inputs and prints what happens. Import the code the way the repository's own
tests do, and run the probe with `node` from a scratch directory against
the unchanged code. If the import or Node gets in the way, open
[Problems you may hit](references/problems.md). Keep each probe and its
output.

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
the API docs, the JSDoc, the tests' names and bodies, the changelog, commit messages that state an intent, source
comments, and any standard that the docs name. Quote it, with the file and
line. The authority is what makes a finding credible, and it becomes the
documentation in the oracle file. When nothing decides a behavior, it is a
design question, not a bug.

The developer's answer to a design question is an authority too. Once they
decide it, it becomes a potential law, and the oracle can find where the
code breaks it, just as with a law from the docs. In a repository with few
docs, this is the usual way to a bug: ask the question, and let the oracle
check the answer. The oracle file records the decision with the
developer's name, their GitHub login, and the date, so that their team knows
whom to ask.
Find the login with `gh api user --jq .login`. If that fails, ask for it
with the first finding or design question you bring them, not with the
question of where to look.

**Present each finding** in this shape, a light touch, with each finding
called a possible bug or a question, never a certainty:

1. A title that names the behavior: "Retry delay: the second wait is
   shorter than the first".
2. The smallest case, expected against observed, as a short snippet the
   developer can run.
3. **Why I think it's wrong:** the authority, quoted, with its file and line.
4. **Why it matters:** who would hit it, and what would happen to them.
5. **Why the tests miss it:** what the existing tests check instead.
6. **How often:** how many of the probe's inputs failed, out of how many.

Put the findings in order of their potential impact on users, the worst
first. The first time you show a small finding, say in a line why it is
there: an oracle captures the code's design and then enforces all of it,
trying every input it can generate, so it turns up small bugs as well as
serious ones. Expect a mix.

Leave out a bug so trivial that no real user would ever hit it. Keep a note
of it: the oracle will catch it too, and you fix it with the others when it
comes time to fix, and list it in the wrap-up.

Give each finding its kind:

| Kind              | What it means                                                           |
| ----------------- | ----------------------------------------------------------------------- |
| Possible bug      | The code breaks a promise that a document or a test states.             |
| Inconsistency     | Two sources disagree: say which ones, and what each says.               |
| Untested behavior | A probe shows behavior that no existing test checks.                    |
| Design question   | Nothing decides the behavior: give two readings and what each predicts. |

For example:

> **Retry delay: the second wait is shorter than the first.**
>
> ```ts
> await retry(failTwice, { retries: 3, delay: 100 }) // waits 100 ms, then 50 ms; expected 100, then 200
> ```
>
> **Why I think it's wrong:** the README says the delay "doubles after each
> failed try" (`README.md:42`). **Why it matters:** a service that is already
> overloaded gets its retries faster, not slower. **Why the tests miss it:**
> they check only the first delay. **How often:** 412 of the 2,000 schedules
> I tried.

For a possible bug, ask: "Is this a bug, or is it intended?"

**Oracle first.** When a probe finds a bug, do not fix production yet, even
when the fix is obvious. The bug goes into the oracle: a law that it breaks,
and a history that reaches it. The fix comes after the oracle fails on it
(step 5). That way the oracle, not the probe, proves the fix, and holds it
for every later change.

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
- The contract, as a few lines of public calls and their results. Always
  include it: it is the quickest way for the developer to see what you mean.

  ```ts
  slugify('Hello, World!') // → 'hello-world': lowercase words joined by '-'
  slugify(slugify(title)) // → slugify(title)
  ```

- Each potential law, as one "For every …" sentence, with its authority
  quoted, and what the probes showed about it. Nothing else from your
  worksheet: no backing word (`stated`, `observed`, `open`), no rival, no
  witness.
- The laws people forget, or one line on why each does not apply:
  - **No throw on valid input.** When the contract says a call returns a
    value, it promises not to throw for valid input.
  - **The laws of the kind of function.** An equality check is reflexive and
    symmetric. A parser and a serializer round-trip. A setter is idempotent
    when set to the same value.
- The open design questions, each with its two readings, and what the probe
  showed. Say that these can wait: the oracle's results will help decide
  them. List them apart from the potential laws, and do not number them as
  laws. Until the developer decides one, the oracle file states it as a
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
- Authority: <document and section, or a decision: who (name and GitHub login), when, and the rule>
- Backing: stated | observed | open
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
- **Backing:** `stated` if an authority states it, `observed` if production
  does it but nothing states it, `open` if it is a question. A `stated` law
  is what you ask the developer to approve. It becomes adopted only when they
  do, and only adopted laws become expected results. An `observed` or `open`
  law goes to the developer as a question.
- **Production output is evidence, never authority.** A rule that you write
  only because production does it is model hacking. Mark that rule
  `observed`, and ask the developer. An analogy to another documented rule is not
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

**Always build the strongest oracle the laws need.** Its model predicts every
observation that the approved laws make a claim about. How the oracle is
built is your decision, not the developer's: never offer them a weaker
design, such as checks without a model, a partial model, or fewer
observations, as a choice. If a law truly cannot be modeled yet, say which
part, and state it as a limit.

The law must say more than the code does. If a model of it would only repeat
the implementation, look for the public promise that the code serves.

**A more complex design needs sign-off.** Before you propose, read the
trigger list in `oracles-design` step 1. When a trigger for the
[design grammar](../../docs/instruments/design-grammar.md) card fires (for
example, more than five laws, or a
law with no new case that it predicts), work through the card. Then show
the developer the design it produced, in a few plain lines: what the model
keeps, how the laws share it, and any choice between two designs, with your
recommendation. Leave out the card's own terms (preservation relation,
primitives, ablation). Ask them to approve it with the laws.

Then ask the developer to approve the potential laws that the authority
decides. When the developer approves a potential law, it becomes an adopted
law, and the oracle file records their decision. If they do not maintain the
repository, its maintainers confirm the laws when they review the pull
request. Potential laws have no default: with no developer present, propose
them and stop.

## 5. Build and run

1. **Install what is missing**, and nothing more: `fast-check@^4` and
   `vitest@^4.1` when `package.json` does not list them. Use the
   repository's own package manager. If the repository's own Vitest config
   would not pick up the oracle file, add a minimal config for it (or add
   its glob to the existing `include`). Add no scripts, lint, or other
   config yet. The `oracles-setup` skill's install and "where oracle files
   go" sections have the details: take only what these packages and the
   config need. If the repository uses another test runner or an older
   Vitest, or an install fails, open
   [Problems you may hit](references/problems.md).

2. **Write the oracle file.** Follow `oracles-design` from its first step:
   the law block's prose, then the model, the histories, the driver, and the
   check. As you build, tell the developer briefly what each part is for: the
   model computes the expected answer the simple way, the histories are the
   generated inputs and sequences, the driver calls their real code, and the
   check compares the two at each step.
3. **Run it on the unchanged code.** A failure under an adopted law is a
   possible bug. Present it like a probe finding, with the oracle's smallest
   failing case as the snippet.
4. **Fix each bug the developer confirms, right away, oracle first.** The
   oracle already fails on it. Make the smallest production fix, rerun the
   oracle until it passes, and show both runs: the failure before, the pass
   after. Follow the defect path in `oracles-design` step 7. Most developers
   want the fix at once; with the oracle failing first, the fix is proved.
5. **As the developer settles questions, change the law** and rewrite the law
   block's prose in the same step. Before you show results, check that the
   prose still says what the code does.

**When the oracle passes, close gaps at once, without stopping.** Say in a
line that the oracle passed and what held, then run the gap check, and
explain what it does the first time you mention it. Take the command and
its flags from `oracles-setup` step 7, with `--out` in a temporary directory
outside the repository. Do not run it while the oracle fails: it cannot
judge a failing run.

For each gap, oracle first: ask why the oracle missed it. Usually the
histories never reach the case, or the check does not look at that result.
Widen the histories or the check, under the laws already approved, and run
the oracle again on the unchanged code:

- If the oracle now fails, it found a bug. Present it, and fix it as above
  once the developer confirms it.
- If closing the gap needs a rule that no approved law states, that is a
  design question. Bring it to the developer.
- If the oracle passes and the gap is closed, go on to the next one.

Group the gaps by function, and tell the developer what you are doing as
you go. Keep going until a bug or a design question turns up. When the
gaps under the approved laws are closed and nothing has turned up, say so,
pick the next spot from your look-around, and keep going.

## 6. Present

When the oracle has found bugs, or brought up design questions that the
developer has settled, stop and present. Present the same way whenever the
developer wants to stop:

- what it found, first: each bug, with what it was, its fix, and the oracle
  run before and after
- the trivial bugs you left out of the findings and fixed along the way, in
  one line each
- what you built
- an offer to walk through how it works: how the reference model was built,
  how the histories are generated, and how the driver calls their code.
  Developers often want this, and it is the best part to teach.
- an invitation to ask questions
- the path to the feedback log, and a request to send it to Kyle Mathews
  (GitHub KyleAMathews) when they are done

When they take the walk-through, follow one bug the oracle found through
the file: the history that produced it, what the driver did and saw, what
the model expected, and how the check reported the difference and shrank it.
Show a few lines of the file at each part, not a description of it.

When the developer wants to keep the work (commit it, or open a pull
request), say what finishing the repository's setup adds: a lint preset
that keeps oracle files honest, a block in `AGENTS.md` (or `CLAUDE.md`) so
every agent follows the same rules, and the gap check over all the owned
code. Then load `oracles-setup`, and do it. Do not call this "production"
or "shipping": it is setting up their repository for oracles.
