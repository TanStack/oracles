/**
 * # A data schedule releases tasks as its choices say
 *
 * `scheduleFrom(choices)` is the framework's schedule as plain data. Its
 * promise, from the header of `oracle-property.ts`: a task belongs to a queue;
 * each queue releases its tasks in the order they were scheduled; at each
 * step the schedule releases the oldest task of the queue that
 * `choices[step] % queues` names, counting the queues that have a pending task
 * in the order they first did, and the oldest task overall once the choices
 * run out. A released task's promise settles like the promise it wraps, and
 * the same choices give the same release order every time.
 *
 * A choice names a queue only when it is a nonnegative integer. A negative or
 * fractional choice, or one that is not finite, names no queue, so the rule
 * above cannot apply to it: it is a caller's breach, and `scheduleFrom`
 * throws when it is called, before it releases anything (fail fast, the
 * TanStack DB agent guide's "Separate valid edge cases from contract
 * contradictions"). The contract does not promise to normalize such a choice.
 *
 * History: two to five tasks, each in one of three queues, each resolving or
 * rejecting, and up to six choices, mostly natural numbers and sometimes a
 * negative, fractional, or non-finite number. The model replays the rule
 * above on the task list, or owes the rejection. The driver schedules every
 * task through `scheduleFrom`, waits until idle, and records the release
 * order and each task's outcome, or that `scheduleFrom` threw. The check
 * compares them. The declared state `a choice that names no queue` is entered
 * by a constructed history that puts one first, so half of each campaign
 * reaches it; the generated choices are mostly valid, so the release order is
 * checked in most of the rest.
 *
 * Limits: tasks are scheduled up front; tasks scheduled by released tasks'
 * continuations are not generated.
 */
import fc from 'fast-check'
import {
  oracleProperty,
  pass,
  scheduleFrom,
  violation,
} from '../src/oracle-property'
import type { Observation } from '../src/oracle-property'

type Task = { queue: `storage` | `provider` | `timer`; rejects: boolean }
// A choice list may hold what an untyped caller passes: `undefined`, or a
// hole in a sparse array.
type History = { tasks: Array<Task>; choices: Array<number | undefined> }

const listOf = (choice: fc.Arbitrary<number | undefined>) =>
  fc.oneof(
    { arbitrary: fc.array(choice, { maxLength: 6 }), weight: 9 },
    { arbitrary: fc.sparseArray(choice, { maxLength: 6 }), weight: 1 },
  )
const history: fc.Arbitrary<History> = fc.record({
  tasks: fc.array(
    fc.record({
      queue: fc.constantFrom(
        `storage` as const,
        `provider` as const,
        `timer` as const,
      ),
      rejects: fc.boolean(),
    }),
    { minLength: 2, maxLength: 5 },
  ),
  choices: listOf(
    fc.oneof(
      { arbitrary: fc.nat(5), weight: 24 },
      { arbitrary: fc.integer({ min: -5, max: -1 }), weight: 1 },
      {
        arbitrary: fc
          .double({ min: -5, max: 5, noNaN: true })
          .filter((choice) => !Number.isInteger(choice)),
        weight: 1,
      },
      {
        arbitrary: fc.constantFrom(Number.NaN, Infinity, -Infinity, undefined),
        weight: 1,
      },
    ),
  ),
})

const namesAQueue = (choice: number | undefined) =>
  Number.isInteger(choice) && choice! >= 0
const rejectedChoice = `a choice that names no queue`
const releasedInOrder = `a schedule that releases every task`

// The rule, stated over task indexes; `rejected` when a choice names no queue.
function releaseOrder({ tasks, choices }: History): Array<number> | `rejected` {
  // Array.from reads a hole as undefined, which names no queue.
  if (!Array.from(choices).every(namesAQueue)) return `rejected`
  const pending = tasks.map((_, index) => index)
  const order: Array<number> = []
  for (let step = 0; pending.length > 0; step++) {
    const queues = [...new Set(pending.map((index) => tasks[index]!.queue))]
    const choice = choices[step]
    const at =
      choice === undefined
        ? 0
        : pending.findIndex(
            (index) => tasks[index]!.queue === queues[choice % queues.length],
          )
    order.push(...pending.splice(at, 1))
  }
  return order
}

async function driveSchedule(
  { tasks, choices }: History,
  observe: (checkpoint: string, value: unknown) => void,
) {
  let schedule: ReturnType<typeof scheduleFrom>
  try {
    // As an untyped caller passes them.
    schedule = scheduleFrom(choices as Array<number>)
  } catch {
    observe(`schedule`, `rejected`)
    return
  }
  const outcomes: Array<string> = tasks.map(() => `pending`)
  const settled = tasks.map((task, index) =>
    schedule
      .schedule(
        task.rejects
          ? Promise.reject(new Error(`task ${index}`))
          : Promise.resolve(index),
        `${task.queue} ${index}`,
      )
      .then(
        (value) => (outcomes[index] = `resolved ${String(value)}`),
        (error: Error) => (outcomes[index] = `rejected ${error.message}`),
      ),
  )
  await schedule.waitIdle()
  await Promise.all(settled)
  observe(`schedule`, {
    released: schedule.released().map((label) => Number(label.split(` `)[1])),
    outcomes,
  })
}

function checkSchedule(
  { tasks }: History,
  trace: ReadonlyArray<Observation>,
  owed: ReturnType<typeof releaseOrder>,
) {
  const recorded = trace[0]?.value as
    | { released: Array<number>; outcomes: Array<string> }
    | `rejected`
    | undefined
  if (!recorded) return violation(`schedule`, `nothing recorded`, `trace`)
  if (recorded === `rejected` || owed === `rejected`)
    return recorded === owed
      ? pass
      : violation(
          `schedule`,
          owed === `rejected`
            ? `a choice names no queue, but the schedule accepted it`
            : `the schedule rejected choices that all name a queue`,
          `invalid choice`,
          { actual: recorded, expected: owed },
        )
  const seen = recorded
  if (JSON.stringify(seen.released) !== JSON.stringify(owed))
    return violation(
      `schedule`,
      `released ${seen.released}, owed ${owed}`,
      `release-order`,
      {
        actual: seen.released,
        expected: owed,
      },
    )
  const outcomes = tasks.map((task, index) =>
    task.rejects ? `rejected task ${index}` : `resolved ${index}`,
  )
  if (JSON.stringify(seen.outcomes) !== JSON.stringify(outcomes))
    return violation(`schedule`, `outcomes ${seen.outcomes}`, `settlement`, {
      actual: seen.outcomes,
      expected: outcomes,
    })
  return pass
}

oracleProperty({
  id: `self-oracle.scheduler`,
  law: {
    statement: `A data schedule releases the oldest task of the queue its next choice names, the oldest task overall once the choices run out, and settles each task like the promise it wraps; a choice that is not a nonnegative integer names no queue, and scheduleFrom throws when called with one.`,
    authority: `the scheduleFrom contract in the header of packages/oracles/src/oracle-property.ts; fail fast on a contract breach (TanStack DB AGENTS.md, "Separate valid edge cases from contract contradictions")`,
    limits: `Tasks scheduled up front, in up to three queues; no tasks scheduled by continuations. A rejected schedule is observed only as a throw, not by its message.`,
  },
  histories: {
    arbitrary: history,
    runs: 200,
    fixedSeeds: [20261103],
    states: [rejectedChoice],
    measured: [releasedInOrder],
    constructed: [
      {
        name: rejectedChoice,
        enters: [rejectedChoice],
        build: (generated) => ({
          ...generated,
          choices: [-1, ...generated.choices.slice(0, 5)],
        }),
      },
    ],
    fixed: [
      {
        name: `a queue keeps its order while another advances`,
        history: {
          tasks: [
            { queue: `storage`, rejects: false },
            { queue: `storage`, rejects: false },
            { queue: `provider`, rejects: true },
          ],
          choices: [1, 0, 0],
        },
      },
      // A negative choice once released the newest pending task, `storage 2`
      // before `storage 0`, out of its queue's order; a fractional one did
      // the same.
      {
        name: `a negative choice names no queue`,
        history: {
          tasks: [
            { queue: `storage`, rejects: false },
            { queue: `provider`, rejects: false },
            { queue: `storage`, rejects: false },
          ],
          choices: [-1],
        },
        enters: [rejectedChoice],
      },
      {
        name: `a hole names no queue`,
        history: {
          tasks: [
            { queue: `storage`, rejects: false },
            { queue: `provider`, rejects: false },
          ],
          // A hole at index 0, written without an array literal hole.
          choices: Object.assign(new Array<number>(2), { 1: 0 }),
        },
        enters: [rejectedChoice],
      },
      {
        name: `a fractional choice names no queue`,
        history: {
          tasks: [
            { queue: `storage`, rejects: false },
            { queue: `storage`, rejects: false },
            { queue: `provider`, rejects: false },
          ],
          choices: [1.5],
        },
        enters: [rejectedChoice],
      },
    ],
  },
  model: releaseOrder,
  reached: (_history, _trace, owed) => [
    owed === `rejected` ? rejectedChoice : releasedInOrder,
  ],
  driver: driveSchedule,
  check: checkSchedule,
})
