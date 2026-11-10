/**
 * # `withinTurns` answers whether a promise settled before its deadline
 *
 * `withinTurns(promise, turns)` is the logical-time wait that drivers use
 * instead of a timeout. Its promise, from the header of `oracle-property.ts`:
 * it resolves `true` as soon as the promise settles, or `false` after `turns`
 * event-loop turns. So a promise that settled before the call, or that
 * settles in an earlier turn than the deadline, owes `true` in the turn it
 * settles; a promise that settles after the deadline, or never, owes `false`
 * in the deadline's turn. Zero turns is a deadline too: a promise that had
 * already settled when `withinTurns` was called still settled before it.
 * A rejection counts as settling. A number of turns is a nonnegative
 * integer; any other number counts no turns, so `withinTurns` throws when it
 * is called with one (fail fast on a caller's breach).
 *
 * History: when the promise settles (already, in turn 1 to 3, or never),
 * whether it resolves or rejects, and the number of turns (0 to 3, and
 * sometimes a negative, fractional, or non-finite number). The
 * driver counts turns with a ticker of its own that it starts before the
 * call, settles the promise in the ticker's callback for its turn, and
 * records the answer and the ticker's turn when the answer arrived. The
 * model states the rule above. The check compares both.
 *
 * Limits: a settlement in the deadline's own turn is a tie that the contract
 * leaves open, so the check accepts either answer there, in that turn. A
 * promise that settles in a later microtask of the turn in which
 * `withinTurns` is called is not generated.
 */
import fc from 'fast-check'
import { differs, oracleProperty, pass, withinTurns } from '../src/index.js'
import type { Observation } from '../src/index.js'

type History = {
  settles: `already` | `never` | 1 | 2 | 3
  rejects: boolean
  turns: number
}
type Answer = { within: boolean; turn: number } | `rejected`

const history: fc.Arbitrary<History> = fc.record({
  settles: fc.constantFrom<History[`settles`]>(`already`, `never`, 1, 2, 3),
  rejects: fc.boolean(),
  turns: fc.oneof(
    { arbitrary: fc.integer({ min: 0, max: 3 }), weight: 12 },
    {
      arbitrary: fc.constantFrom(-1, 0.5, 1.5, Number.NaN, Infinity),
      weight: 1,
    },
  ),
})

const countsTurns = (turns: number) => Number.isInteger(turns) && turns >= 0

// The rule. `either` marks the tie the contract leaves open.
function owedAnswer({ settles, turns }: History):
  | {
      within: boolean | `either`
      turn: number
    }
  | `rejected` {
  if (!countsTurns(turns)) return `rejected`
  if (settles === `already`) return { within: true, turn: 0 }
  if (settles === `never` || settles > turns)
    return { within: false, turn: turns }
  return { within: settles < turns ? true : `either`, turn: settles }
}

async function driveWithinTurns(
  { settles, rejects, turns }: History,
  observe: (checkpoint: string, value: unknown) => void,
) {
  const failure = new Error(`settled by rejection`)
  let settle = () => {}
  const promise =
    settles === `already`
      ? rejects
        ? Promise.reject(failure)
        : Promise.resolve()
      : new Promise<void>((resolve, reject) => {
          settle = rejects ? () => reject(failure) : resolve
        })
  promise.catch(() => {})
  // The ticker's k-th callback is turn k. It is queued before withinTurns
  // queues its own turns, so it runs first in each turn.
  let turn = 0
  const tick = () => {
    turn += 1
    if (turn === settles) settle()
    if (turn < 4) setImmediate(tick)
  }
  setImmediate(tick)
  let answer: Answer
  try {
    answer = { within: await withinTurns(promise, turns), turn }
  } catch {
    answer = `rejected`
  }
  observe(`answer`, answer)
  // Let the ticker finish, so no turn of this history runs in the next one.
  await new Promise<void>((resolve) => {
    const wait = () => (turn >= 4 ? resolve() : setImmediate(wait))
    wait()
  })
}

function checkWithinTurns(
  _history: History,
  trace: ReadonlyArray<Observation>,
  owed: ReturnType<typeof owedAnswer>,
) {
  const seen = trace.find(({ checkpoint }) => checkpoint === `answer`)
    ?.value as Answer | undefined
  if (seen === `rejected` || owed === `rejected` || seen === undefined)
    return differs(`answer`, `turns`, seen, owed) ?? pass
  return (
    differs(`answer`, `turn`, seen.turn, owed.turn) ??
    (owed.within === `either`
      ? undefined
      : differs(`answer`, `deadline`, seen.within, owed.within)) ??
    pass
  )
}

const alreadyNoTurns = `an already settled promise with no turns`
const noTurnCount = `a number of turns that counts none`

oracleProperty({
  id: `self-oracle.within-turns`,
  law: {
    statement: `withinTurns resolves true in the turn its promise settles when that is before its deadline, including a promise already settled when it is called, and false in the deadline's turn otherwise; it throws for a number of turns that is not a nonnegative integer.`,
    authority: `the withinTurns contract in the header of packages/oracles/src/oracle-property.ts`,
    limits: `Settlement in the deadline's own turn may answer either way; settlement in a later microtask of the calling turn is not generated; up to three turns.`,
  },
  histories: {
    arbitrary: history,
    runs: 100,
    fixedSeeds: [20261108],
    states: [alreadyNoTurns, noTurnCount],
    measured: [`settled before the deadline`, `deadline first`, `a tie`],
    constructed: [
      {
        name: alreadyNoTurns,
        enters: [alreadyNoTurns],
        build: (generated): History => ({
          ...generated,
          settles: `already`,
          turns: 0,
        }),
      },
      {
        name: noTurnCount,
        enters: [noTurnCount],
        build: (generated): History => ({ ...generated, turns: 1.5 }),
      },
    ],
    // A fractional count once waited two turns, and a negative one none.
    fixed: [
      {
        name: `a negative number of turns`,
        history: { settles: `never`, rejects: false, turns: -1 },
        enters: [noTurnCount],
      },
    ],
  },
  // A count of Infinity would wait for ever on a promise that never settles.
  timeout: 10_000,
  model: owedAnswer,
  reached: ({ settles, turns }, _trace, owed) => [
    ...(settles === `already` && turns === 0 ? [alreadyNoTurns] : []),
    owed === `rejected`
      ? noTurnCount
      : owed.within === true
        ? `settled before the deadline`
        : owed.within === false
          ? `deadline first`
          : `a tie`,
  ],
  driver: driveWithinTurns,
  check: checkWithinTurns,
})
