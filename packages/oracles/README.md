# @tanstack/oracles

Oracle testing for TypeScript on Vitest and fast-check:

1. State a law.
2. Generate the histories where the law matters.
3. Check production against an independent model.

The gap check then lists the owned production behavior that no law judges.

Not on npm yet. Install a commit from pkg.pr.new (see [Start](#start)).

## Start

Give your coding agent this prompt in the repository:

> Install `https://pkg.pr.new/TanStack/oracles/@tanstack/oracles@<sha>` as a
> dev dependency, then read
> `node_modules/@tanstack/oracles/skills/oracles-setup/SKILL.md` in full and
> follow it.

The setup skill installs this package and `@tanstack/eslint-plugin-oracles`
at the same commit, adds the lint preset, and writes a block in `AGENTS.md`.
It offers to make the skills findable, in the repository or globally for your
coding agents, and walks through a first oracle and gap check.

## What ships in this package

| Path                       | What it is                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| `skills/oracles-setup/`    | Setup, upgrade, and making the skills findable.                                                 |
| `skills/oracles-design/`   | How to design, write, or change an oracle: law sheet first, model, histories, RED, GREEN, gaps. |
| `skills/oracles-review/`   | How to review oracle work.                                                                      |
| `docs/oracle-checklist.md` | The complete requirements, by ID (ORC-001 to ORC-016).                                          |
| `docs/guide.md`            | Techniques for each design and review step.                                                     |
| `docs/glossary.md`         | The oracle terms.                                                                               |
| `docs/instruments/`        | Short reasoning cards that the skills route to.                                                 |
| `oracle-gaps/`             | The gap check (`oracle-gaps` binary).                                                           |

## An oracle

One `oracleProperty` call holds the oracle's parts.

```ts
import fc from 'fast-check'
import { differs, oracleProperty, pass } from '@tanstack/oracles'
import { clamp } from '../src/clamp'

type History = { n: number; max: number }

const histories = fc.record({
  n: fc.integer({ min: -100, max: 100 }),
  max: fc.integer({ min: 0, max: 50 }),
})

oracleProperty({
  id: 'clamp-bound',
  owns: ['src/clamp.ts'],
  law: {
    statement:
      'clamp(n, max) returns max when n is above max, and n otherwise.',
    authority: 'README, "clamp"',
    limits: 'Integers in [-100, 100] for n and [0, 50] for max.',
  },
  histories: {
    arbitrary: histories,
    runs: 100,
    fixedSeeds: [1],
    states: ['above max', 'at max'],
    measured: ['below max'],
    constructed: [
      {
        name: 'n above max',
        enters: ['above max'],
        build: ({ max }) => ({ n: max + 1, max }),
      },
      {
        name: 'n at max',
        enters: ['at max'],
        build: ({ max }) => ({ n: max, max }),
      },
    ],
  },
  // The law restated without production.
  model: (plan: History) => ({ result: Math.min(plan.n, plan.max) }),
  // The real entry point; the driver records and decides nothing.
  driver: (plan, observe) => observe('result', clamp(plan.n, plan.max)),
  check: (_plan, observations, expected) =>
    differs(
      'result',
      'clamp bound',
      observations.find((o) => o.checkpoint === 'result')?.value,
      expected.result,
    ) ?? pass,
  reached: (plan) => [
    plan.n > plan.max
      ? 'above max'
      : plan.n === plan.max
        ? 'at max'
        : 'below max',
  ],
  calibrations: [
    {
      name: 'returns n unclamped',
      law: 'clamp bound',
      corrupt: (trace, plan) =>
        plan.n > plan.max
          ? trace.map((o) =>
              o.checkpoint === 'result' ? { ...o, value: plan.n } : o,
            )
          : undefined,
    },
  ],
})
```

A generated property runs one test per fixed seed and one random test. It
also runs every constructed history, a determinism test, and each
calibration. Each run reports how many histories entered each state.

## API

| Export                                                                 | Purpose                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `oracleProperty(options)`                                              | Registers an oracle. Options: `id`, `owns`, `law` (`statement`, `authority`, `limits`), `histories` (an enumerated list, or `{ arbitrary, runs, fixedSeeds, states, measured, constructed, fixed }`), `resolve`, `model`, `driver`, `check`, `reached`, `predict`, `calibrations`, `label`, `timeout`. |
| `pass`, `violation(...)`, `differs(checkpoint, law, actual, expected)` | The check's verdicts. `differs` returns a violation with a diff, or `undefined`, so comparisons chain with `??`.                                                                                                                                                                                       |
| `forwardCut(...)`                                                      | Checks an observation against an ordered list of allowed states that may be skipped but never revisited.                                                                                                                                                                                               |
| `useOracleClock(...)`                                                  | Runs the rest of a driver on virtual timers and `Date`, with a bound on fired timers (law `bounded clock`).                                                                                                                                                                                            |
| `scheduleFrom(...)`, `withinTurns(...)`                                | Controlled scheduling helpers for drivers.                                                                                                                                                                                                                                                             |
| `configureOracles({ envPrefix, registry, retiredVariables })`          | Optional. Changes the environment-variable prefix or limits the property ids. Call it before any oracle module is imported.                                                                                                                                                                            |
| `OracleViolation`, `OracleModelError`, `OracleDataError`               | The framework's failure types.                                                                                                                                                                                                                                                                         |

Observations and enumerated histories must be data: primitives, plain
arrays and objects, Maps, Sets, and Errors. A driver converts anything else
before it records it.

`@tanstack/oracles/declaration` is an entry point for browser or native
modules. It loads none of the main entry's Node built-ins.

## The gap check

```sh
pnpm exec oracle-gaps --package <package dir> --source <src/file.ts>
```

The gap check mutates the owned source and runs the oracles against each
mutant. Its report lists every gap with one
instruction. The other options and the report format are still changing.
The skills describe how to work with the report.

A gap closes only when a law rejects the mutant or the code is removed. There
are no equivalent mutants.
