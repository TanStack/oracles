/**
 * # A constructed history keeps its generated input and changes only its gate
 *
 * Law: each part-reach construction builds its state's history from the
 * generated skeleton by writing only the fields that gate its state. Every
 * other field, including the registrations, modules, and companions that the
 * generated input holds, is the input's own. So the part that enters the state
 * varies with the input, and a failing history shrinks through the generated
 * skeleton, not through a fixed fixture.
 *
 * Authority: the maintainer's direction that reach keeps randomness (round-2
 * review, Q-2, 2026-11-08), and the framework rule that a constructed history
 * is built from a generated history (packages/oracles/src/oracle-property.ts,
 * "Constructed history").
 *
 * Grammar: the generated skeletons of `programSkeleton`, drawn with a fixed
 * seed and a run budget, so every family's skeletons are covered.
 *
 * Model: for each construction, the skeleton with its gated paths removed,
 * padded the way the construction pads an element it creates. The model reads
 * only the input and the list of gated paths; it does not run a builder.
 *
 * Driver: applies each construction to the skeleton and removes the same gated
 * paths from the result. The driver records one observation per state.
 *
 * Check: each observation equals the model's expectation for that state.
 *
 * Limits: this law checks the non-gated parts, not that each construction
 * enters its state; that is the families' constructed histories, which the
 * framework checks at run time. A construction that gates a field its state
 * does not need passes here; reviewers check the write lists.
 */
import { differs, oracleProperty, pass } from '@tanstack/oracles'
import {
  ALL,
  CONSTRUCTIONS,
  FIXED_SEED,
  STATE_NAMES,
  gatesOf,
  programSkeleton,
  ungated,
} from './part-reach-oracle-support.js'

const LAW = `constructed history keeps its generated input outside its gated fields`

// A registration that replaces the generated one: the mutant's wrong answer.
const constantRegistration = { formIndex: 0 }

/**
 * The gated paths of a state that name a whole element (a registration, a
 * module, or a companion) instead of a field inside it. Such a gate replaces
 * the element, which the law must not allow.
 */
const wholeElementGates = (state) =>
  gatesOf(state).filter((path) => /^\d+$/.test(path.split(`.`).at(-1)))

/** The constructed history of every state, with its gated fields removed. */
const constructedFor = (skeleton, state) =>
  ungated(state, CONSTRUCTIONS[state](ALL)(skeleton))

/** The check: each state's observation equals the input's expectation. */
function check(_plan, observations, expected) {
  return (
    observations
      .map((observation) =>
        differs(
          observation.checkpoint,
          LAW,
          observation.value,
          expected[observation.checkpoint],
        ),
      )
      .find((verdict) => verdict !== undefined) ?? pass
  )
}

oracleProperty({
  id: `lint.part-reach.constructions`,
  law: {
    statement: `Each part-reach construction changes only the fields that gate its state: outside those paths, its constructed history equals the generated skeleton, padded as the construction pads it.`,
    authority: `Round-2 review, Q-2 (maintainer direction: reach keeps randomness); packages/oracles/src/oracle-property.ts "Constructed history".`,
    limits: `Checks the non-gated parts of each construction; whether each construction enters its state is checked by the families' constructed histories at run time.`,
    owner: `eslint-plugin-oracles lint rules`,
  },
  histories: {
    arbitrary: programSkeleton,
    runs: 60,
    fixedSeeds: [FIXED_SEED],
  },
  model: (skeleton) =>
    Object.fromEntries(
      STATE_NAMES.flatMap((state) => [
        [state, ungated(state, skeleton)],
        [`gates ${state}`, []],
      ]),
    ),
  driver: (skeleton, observe) => {
    for (const state of STATE_NAMES) {
      observe(state, constructedFor(skeleton, state))
      observe(`gates ${state}`, wholeElementGates(state))
    }
  },
  check,
  calibrations: [
    {
      // A builder that replaces the generated registration with a constant
      // fails the check: its non-gated fields differ from the input's.
      name: `a builder that replaces the generated registration with a constant`,
      law: LAW,
      driver: (skeleton, observe) => {
        for (const state of STATE_NAMES) {
          const built = constructedFor(skeleton, state)
          observe(state, {
            ...built,
            oracle: { ...built.oracle, tests: [constantRegistration] },
          })
        }
      },
    },
  ],
})
