# @tanstack/oracles

Oracle testing for TypeScript on Vitest and fast-check:

1. State a law.
2. Generate the histories where the law matters.
3. Check production against an independent model.

The gap check then lists the owned production behavior that no law judges.

Not on npm yet. Install a commit from pkg.pr.new (see [Try it](#try-it)).

## Try it

Paste this prompt into your coding agent at the root of the repository you
want to test. Any agent that can run shell commands works.

```text
Show me what oracle testing with @tanstack/oracles can find in this repository.

1. Find the current commit of TanStack/oracles. Run
   `git ls-remote https://github.com/TanStack/oracles refs/heads/main`, and use
   the first 7 characters of the hash as <sha>.
2. Install https://pkg.pr.new/TanStack/oracles/@tanstack/oracles@<sha> as a dev
   dependency, with this repository's package manager.
3. Read node_modules/@tanstack/oracles/skills/oracles-start/SKILL.md in full,
   and follow it. Use <sha> wherever a skill asks for the commit to pin.
```

What happens next:

1. The agent says what the session will do, and asks whether you have a
   part of the code in mind.
2. It looks around, and suggests two or three places where an oracle would
   help. You pick one.
3. It tries that code with probes: small scripts that call your real API.
   Each finding comes with a snippet you can rerun, and the doc or test that
   the behavior seems to break: possible bugs, places where the docs and the
   code disagree, behavior no test checks, and design questions nobody has
   decided.
4. It proposes a potential oracle for that behavior, with its potential laws.
   You approve the laws. This is the step that needs you: you decide what the
   code promises.
5. It writes the oracle file and runs it on your unchanged code, telling you
   what each part does as it goes, until the oracle has found a bug and you
   have settled some design questions.
6. It shows you what it built, offers to walk you through how it works, and
   explains how to take the oracle to production.

Until you choose to ship it, the agent changes nothing in your repository
except the minimal installs and the oracle file.

The package needs Node 20 or later. The setup skill installs Vitest and
fast-check if the repository does not have them.

## What ships in this package

| Path                              | What it is                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| `skills/oracles-start/`           | A first session: a look around, probes, a potential oracle, and the oracle built and run.          |
| `skills/oracles-setup/`           | Taking an oracle to production: setup, the gap check, upgrades, making the skills findable.        |
| `skills/oracles-design/`          | How to design, write, or change an oracle: from approved laws to model, histories, and gaps.       |
| `skills/oracles-evaluate-review/` | How to act on a review: a lossless ledger, RED on unchanged production, and closing the bug class. |
| `skills/oracles-review/`          | How to review oracle work.                                                                         |
| `docs/intro.md`                   | What an oracle is, for when someone asks.                                                          |
| `docs/oracle-checklist.md`        | The complete requirements, by ID (ORC-001 to ORC-016).                                             |
| `docs/guide.md`                   | Techniques for each design and review step.                                                        |
| `docs/model-styles.md`            | One small example of each model style.                                                             |
| `docs/glossary.md`                | The oracle terms.                                                                                  |
| `docs/instruments/`               | Short reasoning cards that the skills route to.                                                    |
| `oracle-gaps/`                    | The gap check (`oracle-gaps` binary).                                                              |

## An oracle

One `oracleProperty` call holds the oracle's parts.

```ts
import fc from 'fast-check'
import { differs, oracleProperty, pass } from '@tanstack/oracles'
import { clamp } from '../src/clamp'

type History = { n: number; max: number }

// The type is number, so the domain includes -0.
const histories = fc.record({
  n: fc.oneof(fc.integer({ min: -100, max: 100 }), fc.constant(-0)),
  max: fc.integer({ min: 0, max: 50 }),
})

oracleProperty({
  id: 'clamp-bound',
  owns: ['src/clamp.ts'],
  law: {
    statement:
      'clamp(n, max) returns max when n is above max, and n otherwise.',
    authority: 'README, "clamp"',
    limits:
      'Integers in [-100, 100] and -0 for n, and [0, 50] for max. No NaN or infinities.',
  },
  histories: {
    arbitrary: histories,
    runs: 100,
    fixedSeeds: [1],
    states: ['above max', 'at max', 'negative zero at max'],
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
      {
        // -0 is not above 0, so the result is n (-0), not max (0).
        name: '-0 at max 0',
        enters: ['negative zero at max'],
        build: () => ({ n: -0, max: 0 }),
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
    Object.is(plan.n, -0) && plan.max === 0
      ? 'negative zero at max'
      : plan.n > plan.max
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
