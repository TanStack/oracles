# Oracle guide: techniques

These techniques support `oracles-design` and `oracles-review`. They add no
requirements; the [checklist](oracle-checklist.md) holds them all, and this
guide cites it by ID. Terms follow the [glossary](glossary.md).

## The model

### Make the model easy to distrust

Prefer a pure function or a small state transition. Keep production queues,
caches, classifiers, and helpers out of the expected result (ORC-002). A
reader should be able to challenge the model without learning the
implementation first.

Name a partial model honestly: if it predicts values but not callback counts,
say so in `limits` (ORC-001).

Keep the model's records separate from production's records. If production
mutates a shared object, the expected answer can change with it, and both sides
agree for the wrong reason. Copy the fields the model needs.

Independent code also needs independent reasoning. A model that calls
production's comparator cannot see a comparator defect. Reuse ordinary test
mechanics freely, but name any semantic helper that both sides trust. A small
model is easier to inspect. It is not correct because it is small.

### Decompose the model by law

A model can become as hard to trust as production. Do not keep adding state
until it is a second implementation.

When the contract has independent laws, treat the oracle as a small graph:

- A node owns one rule and the least state needed to predict it.
- An edge records a real dependency between two rules.
- The driver can feed the same action to several nodes.
- The check composes their observations at the checkpoint.

A failure then names the law that diverged, and a reviewer can inspect each
rule alone. Plain functions and Maps are usually enough.

Do not split state that a legal next action can observe only as a whole. If two
states look equal to the proposed nodes, try one legal next action. If it can
produce different promised results, add the missing edge, or keep that state in
one model. Decomposition does not mean one model per assertion. Group facts
that form one state machine, and keep independent policies separate.

### Choose the judgment that fits

A full reference works when the answer is cheap to compute independently.
Other promises need other judgments:

| Method                  | Useful judgment                                                    | Limit                                                            |
| ----------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Simple model            | Recompute the allowed result, or step a small abstract state.      | The model can omit a distinction or encode the wrong rule.       |
| Differential comparison | Run the same work through another implementation or formulation.   | Both paths can share a bug. Their semantics must actually agree. |
| Metamorphic relation    | Transform a history, and check a relation between the two results. | The transformation's premises must hold.                         |
| Partial invariant       | Check one promise, such as "no request completes twice".           | A pass says nothing about other properties.                      |

Choose the smallest judgment that answers the question. Combining
complementary checks can help. Making every oracle compute every observation
usually does not.

### Keep only state that can matter

Removing fields until a model looks simple is not a design method. Test each
merge of states instead (ORC-008).

Example: a handle supports a row. Replacing handle `a` with `b` moves that
support. Releasing a retired handle does nothing.

| History                                       | Supported rows | Live support count |
| --------------------------------------------- | -------------- | ------------------ |
| Acquire `a` for `x`                           | `{x}`          | 1                  |
| Acquire `a`, then replace it with `b` for `x` | `{x}`          | 1                  |

The two states look equal. Now release `a`. The first history loses support
for `x`. The second keeps it through `b`. A model with only rows and a count
cannot answer both.

So: find two states that the model treats as equal, and try a legal next
action. If their promised observations differ, or an action is legal in only
one, the model erased something that matters. The witness justifies this one
distinction. It does not prove the model handles every race.

### Know where the expected answer comes from

Two questions sit behind "the model says so". Who established the behavior?
Which state determines the observation?

- A finite model can lose permitted values. For example, a model that holds
  scores only up to three makes `score > 3` an empty predicate. Fix the model,
  not production.
- A model can read the wrong state. For example, it can use locally edited
  values where the contract uses source values.

Before you change production to satisfy a red oracle, check the contract, the
model's representation, and the comparison. An unresolved product choice goes
to the user as an `open` law. Judge a reviewer's accusation and their proposed
fix separately: a correct concern does not make its repair correct.

Projection needs the same care. Dropping internal metadata from a comparison
can be valid. Dropping a field the contract promises is not, whatever it is
called. Write down one difference the comparison may ignore and one it must
keep.

## Histories

### Describe the input domain as a grammar

Before choosing arbitraries, describe the language of legal histories. Separate
three kinds of fact:

- **Dynamics:** the actions that move the system.
- **Constraints:** invariants, interfaces, and forbidden combinations.
- **Boundary conditions:** the starting state, scale, provider behavior, and
  value domains where the rules apply.

Mark which rules come from the contract and which you inferred. Map
containment, overlap, and dependency. Do not force overlapping concerns into a
tree to make the generator neat.

ORC-004's four controls apply to any claim of generated coverage:

1. **Reconstruction:** can the grammar rebuild every known valid witness?
2. **Ablation:** does removing each axis, rule, or overlap lose a promised case
   or admit a forbidden one?
3. **Range:** does an independent marginal case need only new values, or does
   it expose a missing rule?
4. **Exclusion:** does the grammar reject a nearby invalid history?

Do not take a flat Cartesian product of unrelated axes because the tool makes
it easy. Two false greens are common. A grammar that cannot rebuild a known bug
omits a path. A grammar that generates valid and invalid histories without
telling them apart hides policy in filters.

### Build legal histories

Generate only actions that are legal in the current state. Choose the action
kind first, then a key that it applies to. Put legality in the grammar or in
`resolve`, so every shrunk history stays legal; `fc.pre` is banned (B3).

Design action dependencies so that smaller histories stay meaningful under
shrinking.

The structural cases that matter become constructed histories, for example:

- no rows
- a width of zero
- a tie at a boundary
- repeated changes to one key

Each constructed history names the declared state it enters (ORC-015). Then
let random generation vary the values and lengths around them. A larger run
count is not a substitute for a constructed history.

### Generate histories that reach the problem

Once the model can tell the relevant states apart, the histories must put
production into them. Random values alone do not create reuse, failed
startup, or work after recovery.

Look for relationships and transitions:

- the same key versus a fresh key
- one owner versus a surviving sibling
- rejection before versus after acquisition
- release before versus after completion
- recovery followed by another operation

Keep healthy peers alive where isolation is part of the promise. A history
that ends at "recovery succeeded" may never show broken state on the next use.

Fresh disjoint keys can simplify a driver but exclude the reused-key
interaction that the law needs. Repeated `true` reports do not cover
`true → false → true` while earlier work is pending. These are different
histories, not different random values.

Widening a generator can lose reach in two ways:

- A rewrite can make a previously possible history impossible, even while it
  adds a dimension.
- A larger domain can make a useful history rarer at the same run budget.

Check possibility with a constructed history, and frequency with the reach
counts.

### Control the event, not its returned Promise

An async operation can have several boundaries:

```text
request invoked → response delivered → writes applied → result visible
                                      ↘ returned Promise settles
```

The contract says which boundaries come before which. The driver must control
and observe the boundaries that the law depends on.

If an operation applies its work eagerly, delaying its returned Promise does
not delay that work. An unconditional `await` can let a queued microtask
repair a mismatch before the check sees it. A driver that reads only settled
state cannot expose an earlier wrong observation.

Put an explicit hold and release at the event you need. For a law about
visibility before application:

1. Production requests data.
2. The driver receives the response, and holds delivery of its writes.
3. The driver records what is visible while delivery is held.
4. The driver releases delivery, and production applies the writes.
5. The driver records what is visible at the promised checkpoint.

The hold must be real. A driver that delivers the writes and only delays
returning from its handler controls a different event. A scheduler helps only
within the boundaries it controls. A seed cannot schedule external I/O that the
driver does not intercept.

### Check that timing helpers establish their premises

A driver often needs helpers such as "wait until the request is blocked" or
"let the message reach the worker". Each helper establishes a premise. If it
does less than its name says, the oracle can pass without ever reaching the
history.

Example: a helper released a lock in the same turn that it sent a close
message. The message was still crossing a task boundary, so the earlier
request finished first. Close never ran during the wait, and the mutants it
targeted passed.

For each timing helper, do one of these:

- Assert the premise at its checkpoint, for example from a lock inventory or a
  delivery counter.
- Add a calibration that only a history meeting the premise can reject
  (ORC-006).

A helper that waits a fixed time proves no delivery. It still needs one of
these checks.

### One law can need two schedules

Enumerating more positions is not always enough. Example: a request settles
after four completion obligations, `r0` to `r3`. Success must wait for every
obligation, and a rejection must not wait for unrelated later work. For a
selected obligation `r1`, two schedules ask different questions:

| Question                                 | Schedule                                        | Observation                                                        |
| ---------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| Can settlement ignore `r1`?              | Hold `r1`; complete `r0`, `r2`, and `r3`.       | The request is still pending.                                      |
| Does a rejection of `r1` wait for peers? | Complete `r0`; hold `r2` and `r3`; reject `r1`. | The request rejects at once, with the partial result of `r0` only. |

Completing every peer first isolates the first question but removes the
pending sibling that the second question needs. At the last obligation there is
no later peer, so that case cannot distinguish the delay.

### Keep the driver on its side of the boundary

A test provider can fix the consumer by accident. Example: a paging provider
removed already-delivered rows before it applied the requested limit. That
supplied progress the consumer never requested, and hid a repeated-page bug.

State what the request asks, what the provider promises, and which progress
production must arrange. The same applies to reentry. If a callback triggers a
second operation only under a condition, assert that the callback and the
trigger happened. "If reached, check it" is not evidence that reentry was
tested.

When one law must hold in two environments, give each environment its own
driver, and share the law, model, histories, and check (ORC-014).

## The driver and the check

### Observe what the contract promises

Choose observations from the promise. Membership, values, order,
multiplicity, callback boundaries, error identity, settlement timing, durable
storage, and resource ownership are different facts. Record the ones the law
needs, not all of them.

- If an unprojected sort field changes, compare the new order, not only whether
  the result changed.
- If a callback count matters, check the count before looping over the
  callbacks. A loop over no callbacks checks nothing.
- If a failed write must not reach storage later, read the stored data after a
  later successful operation.

Each comparison should separate the specific wrong behavior from the allowed
one.

### Let observations represent violations

Make generated inputs legal. Do not make recorded outputs unable to be
illegal.

Suppose production completes one request twice. A map keyed by request that
keeps the last completion hides the violation. Record both events, then compare
the promised count. Do not fold the raw list back into a map before the check
sees it.

Likewise:

- Do not reset a change tracker before checking the parts that must stay
  unchanged.
- Do not discard values that "should" never appear.
- Do not normalize away an order that the contract promises.

Normalize only what the comparison permits.

### Check incremental results and publication separately

An incremental system emits changes, while a model often computes a whole
result. Compare compatible objects: accumulate the changes, then compare that
state with a full recomputation at the promised checkpoint. Check individual
batches too when the contract makes their boundaries visible.

A correct final result cannot show that every earlier publication was
coherent. Choose checkpoints that can expose the promised failure, such as a
torn publication of old and new halves. Do not add delays until the result is
stable.

When scheduling allows several results, check for **one allowed explanation of
the whole observed history**. Do not approve each field against a different
allowed execution: pieces that are each allowed may never occur together. A
bounded oracle checks sampled histories. It is not a proof of every behavior.

### Make the comparison prove its usefulness

Suppose an update check asserts only that the result changed. An empty result
passes it. Compare against the exact expected value instead.

Then calibrate the check against known wrong answers (ORC-006):

```ts
// The allowed answer passes; a wrong order and an arbitrary change fail.
check(plan, [{ checkpoint: 'ids', value: [1, 2] }], { ids: [1, 2] }) // pass
check(plan, [{ checkpoint: 'ids', value: [2, 1] }], { ids: [1, 2] }) // violation
check(plan, [{ checkpoint: 'ids', value: [] }], { ids: [1, 2] }) // violation
```

In an `oracleProperty`, write these as `calibrations`, so the framework runs
them. Calibration proves the check is sensitive. Reach proves the path ran.
These are different claims: a perfect comparison on a path that never runs
protects nothing.

### Compare formulations when a model might share the bug

A plain model can copy a wrong semantic assumption. A second formulation gives
another way to disagree. This applies when a plausible shared fault and a
meaningfully different formulation have been named (ORC-011).

- First state how the two formulations match on empty inputs, duplicates,
  order, and projection. A transformation that changes the answer cannot
  show that the two formulations agree.
- A metamorphic relation transforms a history and checks a known relation
  between the results. Examples: incremental equals recompute, partitions that
  recombine to the whole, a round trip.
- Agreement between two paths does not prove that they are independent. Paths
  that share an operator or a copied code path share its faults. A matching
  count can hide wrong rows. Use each formulation for the faults it can
  separate.

## Evidence

### Test the test

"The oracle passed" combines several claims:

1. Was the property selected?
2. Did it run?
3. Did it reach the intended path?
4. Did its comparison execute?
5. Would that comparison reject the fault under discussion?

Treat them as separate evidence. Reach counts, calibrations, and the gap
check answer them for an `oracleProperty`.

For a mutant, record what happened, not only "killed":

- A comparison rejected the intended wrong answer.
- A timeout exposed a missing progress obligation.
- Setup failed before the comparison.
- Execution failed outside the comparison after setup, such as a crash.
- The changed code never ran.
- The mutant survived. This is a gap (see the
  [mutant gap hunt](instruments/mutant-gap-hunt.md), step 3).

These outcomes call for different conclusions. If deleting one clause leaves
the same obligation enforced elsewhere, survival does not show that the
obligation is unnecessary. If an oracle kills a compound change, it may not
distinguish each part.

### Preserve the violation, not merely a red exit

Shrinking keeps the first failure kind (ORC-010). Keep the violated law, the
checkpoint, and the original history beside the reduced one. A replay that
ran but did not reproduce the mismatch is not a reproduction.

Capture evidence before cleanup can change it. Copy what the law needs before
a rollback runs. A serializer can lose object identity or reorder arrays. Keep
the original form when normalization would erase the disputed distinction.

A challenge that shaped the design is a regression case afterwards, not a
held-out test of that design.

### Vary machinery and premises separately

When comparing implementation candidates, hold the law, the legal histories,
and the checkpoints fixed. If removing an index or cache changes no public
result, it is dead code, unless a law states the work it saves, such as a
count of reads. State that law and measure it, or remove the code.

If a premise changes instead, derive which guarantees still follow. Examples:
delivery may duplicate, ordering may tie, or the client may see only part of
the source. A failure under a changed premise may call for more provider data
or a law decision, not another algorithm.

### Simplify machinery without changing the question

Before removing or combining oracles, name what will remain: the valid
history, the expected outcome, the production path, the observation, and the
oracle that receives them. "Retry the parent" turning into "delete the parent"
changes the behavior, even when the replacement is shorter and green.

Other reductions are legitimate. An expectation can contradict the contract.
Two branches can enforce the same law. Removing a redundant branch need not
remove its law.

Share stable mechanics, such as cleanup, where they are truly interchangeable.
Keep domain truth small and reviewable. Several independent models should not
grow into one miniature implementation to reduce duplication.

### Reusable boundary laws

Consider these laws when the contract has the matching boundary. They are
prompts, not requirements. If one does not apply, say why in `limits`; do not
add an empty case.

- **Real-provider conformance:** freeze representative values from each
  supported provider version. Show that the driver's stand-in accepts them
  before it stands in for that provider (ORC-014).
- **Minimal ambiguity:** include the smallest valid input for every branch of a
  classifier. Rich values that carry several redundant signals do not cover a
  one-field collision.
- **Name invariance:** renaming a user-controlled name must not change a result
  unless the contract gives the name meaning.
- **Representation symmetry:** two forms of one input that the contract treats
  as the same must give the same
  public result or the same documented error.
- **Await-boundary transitions:** hold each relevant `await`. Change ownership,
  leadership, generation, abort, cleanup, or restart state, then release it.
  Compare the result with the contract for that transition.
- **Local and remote agreement:** data sent across a transport must mean the
  same on both sides. Live local references stay local.
- **Partial-construction cleanup:** fail each construction step after it
  acquires a resource. Keep the primary error, and show that every acquired
  resource is released exactly once.
- **Value and work:** when bounded work is promised, check the exact result and
  a deterministic work count. A correct result alone does not establish the
  work law.

An unchecked prompt is not evidence that the law it names holds.
