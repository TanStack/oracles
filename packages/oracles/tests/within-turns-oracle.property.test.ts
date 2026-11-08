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
 * A rejection counts as settling.
 *
 * History: when the promise settles (already, in turn 1 to 3, or never),
 * whether it resolves or rejects, and the number of turns (0 to 3). The
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
type Answer = { within: boolean; turn: number }

const history: fc.Arbitrary<History> = fc.record({
  settles: fc.constantFrom<History[`settles`]>(`already`, `never`, 1, 2, 3),
  rejects: fc.boolean(),
  turns: fc.integer({ min: 0, max: 3 }),
})

// The rule. `either` marks the tie the contract leaves open.
function owedAnswer({ settles, turns }: History): {
  within: boolean | `either`
  turn: number
} {
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
  const within = await withinTurns(promise, turns)
  observe(`answer`, { within, turn } satisfies Answer)
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
  return (
    differs(`answer`, `turn`, seen?.turn, owed.turn) ??
    (owed.within === `either`
      ? undefined
      : differs(`answer`, `deadline`, seen?.within, owed.within)) ??
    pass
  )
}

const alreadyNoTurns = `an already settled promise with no turns`

oracleProperty({
  id: `self-oracle.within-turns`,
  law: {
    statement: `withinTurns resolves true in the turn its promise settles when that is before its deadline, including a promise already settled when it is called, and false in the deadline's turn otherwise.`,
    authority: `the withinTurns contract in the header of packages/oracles/src/oracle-property.ts`,
    limits: `Settlement in the deadline's own turn may answer either way; settlement in a later microtask of the calling turn is not generated; up to three turns.`,
    owner: `oracleProperty framework`,
  },
  histories: {
    arbitrary: history,
    runs: 100,
    fixedSeeds: [20261108],
    states: [alreadyNoTurns],
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
    ],
  },
  model: owedAnswer,
  reached: ({ settles, turns }, _trace, owed) => [
    ...(settles === `already` && turns === 0 ? [alreadyNoTurns] : []),
    owed.within === true
      ? `settled before the deadline`
      : owed.within === false
        ? `deadline first`
        : `a tie`,
  ],
  driver: driveWithinTurns,
  check: checkWithinTurns,
})
