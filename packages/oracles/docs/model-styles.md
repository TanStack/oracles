# Model styles, by example

`oracles-design` step 3 lists six model styles in order. Use the first style
that can state the law. This page gives one small example of each. The
examples use made-up domains. Copy the shape, not the domain.

Two rules hold for every style:

- **Each model rule is one sentence of the law.** A reviewer can point from a
  sentence of `law.statement` to the rule that enforces it, and back.
- **Legality is not the model.** If the grammar or `resolve` needs state to
  pick legal actions (counts, phases, open handles), compute it in a separate
  pure `legal(prefix, action)` guard. Keep the model a pure function from the
  plan to the expected result.

## 1. A pure function of the inputs or the whole history

Use this by default. The expected observation is a formula over the plan.

Law: "A page holds the rows that match the filter, sorted by `id`, from
`offset`, at most `limit` rows."

```ts
type Row = { id: number; tag: string }
type PagePlan = { rows: Array<Row>; tag: string; offset: number; limit: number }

function expectedPage(plan: PagePlan): Array<number> {
  return plan.rows
    .filter((row) => row.tag === plan.tag)
    .map((row) => row.id)
    .sort((a, b) => a - b)
    .slice(plan.offset, plan.offset + plan.limit)
}
```

The model ignores how production finds the rows (an index, a cursor, a cache).
A formula like this also forces you to state edge cases: an `offset` past the
end gives an empty page, and a `limit` of 0 gives an empty page.

## 2. A naive reference structure and an abstraction

Use this for a data structure with a simple abstract view. Keep a plain copy
of that view, and compare it with what production shows at each checkpoint.

Law: "A cache of capacity `n` keeps the `n` most recently used keys. `get`
returns the stored value of a kept key, and `undefined` otherwise."

```ts
type CacheAction =
  { kind: 'set'; key: string; value: number } | { kind: 'get'; key: string }

function expectedReads(
  capacity: number,
  actions: Array<CacheAction>,
): Array<number | undefined> {
  // The reference: keys from least to most recently used.
  const order: Array<string> = []
  const values = new Map<string, number>()
  const reads: Array<number | undefined> = []
  const touch = (key: string) => {
    order.splice(order.indexOf(key), 1)
    order.push(key)
  }
  for (const action of actions) {
    if (action.kind === 'set') {
      if (!values.has(action.key)) order.push(action.key)
      values.set(action.key, action.value)
      touch(action.key)
      if (order.length > capacity) values.delete(order.shift()!)
    } else {
      const value = values.get(action.key)
      if (value !== undefined) touch(action.key)
      reads.push(value)
    }
  }
  return reads
}
```

The driver records only what the contract exposes: each `get` result. If the
contract also promises iteration order, the driver records the key order
(the abstraction of production's state) at the same checkpoint.

## 3. A transition table for a lifecycle

Use this when the law names phases. Each row is one rule, with an id and its
authority. Reach is the set of rows that fired, so transition coverage is
measured, not guessed.

Law: "A connection opens only from `idle`. A failure while connecting returns
it to `idle`. Closing is final."

```ts
type Phase = 'idle' | 'connecting' | 'open' | 'closed'
type ConnEvent = 'connect' | 'connected' | 'fail' | 'close'
type TableRow = {
  id: string
  from: ReadonlyArray<Phase>
  event: ConnEvent
  to: Phase
  authority: string
}

const rows: ReadonlyArray<TableRow> = [
  {
    id: 'connect',
    from: ['idle'],
    event: 'connect',
    to: 'connecting',
    authority: 'README, Lifecycle',
  },
  {
    id: 'connected',
    from: ['connecting'],
    event: 'connected',
    to: 'open',
    authority: 'README, Lifecycle',
  },
  {
    id: 'fail',
    from: ['connecting'],
    event: 'fail',
    to: 'idle',
    authority: 'README, Lifecycle',
  },
  {
    id: 'close',
    from: ['idle', 'connecting', 'open'],
    event: 'close',
    to: 'closed',
    authority: 'README, Lifecycle',
  },
]

function expectedPhases(events: Array<ConnEvent>): {
  phases: Array<Phase>
  fired: Array<string>
} {
  let phase: Phase = 'idle'
  const phases: Array<Phase> = []
  const fired: Array<string> = []
  for (const event of events) {
    const row = rows.find((r) => r.event === event && r.from.includes(phase))
    // No row means the event has no effect in this phase.
    if (row) {
      phase = row.to
      fired.push(row.id)
    }
    phases.push(phase)
  }
  return { phases, fired }
}
```

Return `fired` from `reached`, so each row id is a reach state. A row that
never fires shows a missing history, or a rule that the law does not need.

A table costs more lines than a formula. Use it when the phases are part of
the contract, or when you need to show which transitions the histories cover.
A table may also call a formula for one rule, such as a timeout guard.

## 4. A pure step function

Use this for a stateful API whose answers depend on what came before, without
named phases. The step function handles every legal action.

Law: "A withdrawal succeeds only when it does not exceed the balance. A
deposit always succeeds. Each call returns the new balance, or `rejected`."

```ts
type Account = { balance: number }
type AccountAction =
  { kind: 'deposit'; amount: number } | { kind: 'withdraw'; amount: number }
type AccountResult = number | 'rejected'

function step(
  state: Account,
  action: AccountAction,
): { state: Account; expected: AccountResult } {
  switch (action.kind) {
    case 'deposit':
      return {
        state: { balance: state.balance + action.amount },
        expected: state.balance + action.amount,
      }
    case 'withdraw':
      return action.amount <= state.balance
        ? {
            state: { balance: state.balance - action.amount },
            expected: state.balance - action.amount,
          }
        : { state, expected: 'rejected' }
  }
}

function expectedResults(actions: Array<AccountAction>): Array<AccountResult> {
  let state: Account = { balance: 0 }
  return actions.map((action) => {
    const next = step(state, action)
    state = next.state
    return next.expected
  })
}
```

There is one `switch` on the action kind. A rejected withdrawal is an
expected result, not an illegal history, so the grammar generates it.

## 5. Relations between runs

Use this when the exact output is hard to compute. State a relation that must
hold between two runs, or between a run and its inverse.

Law: "`parse(serialize(value))` equals `value` for every value in the domain."

```ts
type Value = { name: string; tags: Array<string> }

function roundTripHolds(
  serialize: (value: Value) => string,
  parse: (text: string) => Value,
  value: Value,
): boolean {
  const back = parse(serialize(value))
  // Compare element by element. Joining the tags would accept [''] -> [] and
  // ['a\u0000b'] -> ['a', 'b'], which lose information.
  return (
    back.name === value.name &&
    back.tags.length === value.tags.length &&
    back.tags.every((tag, i) => tag === value.tags[i])
  )
}
```

In an oracle, the driver records `value` and `parse(serialize(value))`, and the
check compares them. A relation can hold for a useless implementation: a
`serialize` that returns `""` and a `parse` that returns a fixed value
satisfy many symmetries. So each relation needs a calibration that shows it
fails. Good calibrations here are traces whose parsed tags lose an empty
string (`['']` becomes `[]`) or split one tag in two (`['a\u0000b']` becomes
`['a', 'b']`).

Other useful relations: an incremental result equals a recompute from scratch,
and the order of independent updates does not change the final state.

### A reference that must be awaited

The model is synchronous: `model(plan, trace)` returns the expected value,
never a promise. The framework calls it after the driver has finished, on the
trace the driver recorded, and again on the traces that calibrations corrupt,
so nothing awaits it. A promise returned from a model reaches the check as the
expected value. TypeScript rejects a check that reads a field of it, but a
JavaScript oracle file gets no such error, and a check that rejects only the
values it recognizes then passes every history.

Some relations need a reference that only awaited work can compute: the same
code run without instrumentation, a cold start beside a warm one, or a second
entry point. Run the reference in the driver, record it under a checkpoint of
its own before the run it judges, and let the check compare the two
checkpoints, as in the round trip above. The reference is something production
showed, so it belongs to the check, not to the model: the model still predicts
only what it can from the plan.

Law: "For every program, the instrumented copy returns what the program
returns when it runs as written (README, Instrumentation)."

```ts
type Plan = { source: string; input: number }

// The driver awaits both runs. The reference comes first, under its own
// checkpoint, so a trace cut short after it still holds it.
async function driver(
  plan: Plan,
  observe: (checkpoint: string, value: unknown) => void,
) {
  observe('reference', await runAsWritten(plan.source, plan.input))
  observe('result', await runInstrumented(plan.source, plan.input))
}

// The check compares the two runs. A trace without both fails.
function check(_plan: Plan, trace: ReadonlyArray<Observation>): Verdict {
  const at = (checkpoint: string) =>
    trace.find((o) => o.checkpoint === checkpoint)
  const reference = at('reference')
  const result = at('result')
  if (reference === undefined || result === undefined)
    return violation('result', 'the trace lacks a run', LAW)
  return differs('result', LAW, result.value, reference.value) ?? pass
}
```

This costs the oracle its independent model: the owed value is now something
production computed, so a defect that both runs share agrees with itself, and
the law says nothing about what the reference returns. Keep it honest:

- **Keep the owned code off the reference's path.** The reference must not run
  through the code that the law judges. A mutant of shared code changes both
  runs alike, so no history can see it, and the gap check reports it. Name in
  `owns` only the code that differs between the two runs.
- **Pin the reference with a law of its own.** Predict at least part of the
  reference from the plan, such as its type, a value the plan fixes, or a
  relation between two references, so that a reference that returns nothing
  useful fails.
- **Calibrate both sides.** One calibration corrupts the `result` checkpoint,
  and another corrupts `reference`. Each must be rejected, which shows that the
  check reads both.
- **Say so in `limits`.** Name the reference and what the law does not
  establish about it.

## 6. An allowed set of outcomes

Use this when the contract leaves a choice open. Predict every allowed
outcome, cite the clause for each, and accept any member.

Law: "After `save`, the store notifies `written` and `indexed`, in either
order (README, Events: the two listeners are independent)."

```ts
type Notice = 'written' | 'indexed'

function allowedNotices(): Array<Array<Notice>> {
  return [
    ['written', 'indexed'],
    ['indexed', 'written'],
  ]
}

function noticesAllowed(observed: Array<Notice>): boolean {
  return allowedNotices().some(
    (allowed) =>
      allowed.length === observed.length &&
      allowed.every((notice, i) => notice === observed[i]),
  )
}
```

Never pick the order that production happens to use: that would reject a
valid implementation. A mutant that only switches production to the other
allowed order survives a sound oracle. The law already answers the question,
so report it as an allowed alternative: its key, the clause, and the history.
Do not strengthen the law to kill it. Until the gap check recognizes allowed
sets, it stays open in the report (see the
[mutant gap search](instruments/mutant-gap-search.md) card).

## Mixing styles

Mix styles when one law has parts of different shapes. For example, a
lifecycle table can call a formula for its timeout rule:

```ts
// A row's guard that is a formula, not more table rows.
const retiresNow = (
  unheldSince: number,
  now: number,
  gcTime: number,
): boolean => now > unheldSince + gcTime
```

The formula states the timing rule in one line. The table keeps the phases
and makes each transition a row.
