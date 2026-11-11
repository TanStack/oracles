/**
 * # Declared reach: the laws that hold across lints and receiving paths
 *
 * Laws, each an oracle property over the shared grammar (see
 * part-reach-oracle-support.js for the grammar, the model, the drivers, and their
 * authority):
 *
 * - Receiving paths: a single-file Linter call agrees with the model on the
 *   full grammar (fixed seeds, 4 runs each).
 * - Fixed inputs: the reviewer's repros go through every receiving path with
 *   the full feature set, and carry no expected answers of their own: the model
 *   supplies them.
 * - Registration order: permuting a program's registrations does not change
 *   the reports, up to the subject names (`undeclared` names the first unreached
 *   test in source order, so it moves with the order). The reordered lint
 *   agrees with the model, and it names the same subjects as the original.
 * - Rerun equality: linting the same program twice in one process gives the
 *   same reports. The model is checked by the other properties, so this law
 *   compares the two runs with each other.
 * - Companion edits: a companion edited between two lints of one oracle file
 *   gives the reports of a fresh process. The rule caches a binding's reach in
 *   the module that declares it, so the second lint must recompute it. Each
 *   generated history is linted once before the edit; a history with a
 *   dependency is edited and linted again, and the second lint must agree with
 *   the model of the edited program. A history without a dependency is only
 *   checked unedited.
 * - Dependency chain: a fixed chain, in which an oracle imports a companion
 *   that imports the check; editing the check's companion between two lints
 *   must change the reports of the next lint.
 *
 * Authority: see PART_REACH_AUTHORITY in part-reach-oracle-support.js; the edit laws
 * also rest on the rule's reach cache, which is stated in the no-unit-test
 * rule's header (maintainer decision 2026-11-02).
 *
 * Limits: the edits rewrite one companion in place, with a later mtime, so
 * the rule's cache sees a change. A history with no dependency is edited in no
 * law. The fixed inputs and the chain are enumerated, not generated.
 */
import fc from 'fast-check'
import { differs, oracleProperty, pass } from '@tanstack/oracles'
import {
  ALL,
  BASE,
  BASE_RUNS,
  FIXED_SEED,
  REPORTS_LAW,
  STATE_NAMES,
  buildProgram,
  chain,
  checkPaths,
  declarationsAndProperties,
  defaultRegistrar,
  defaultThroughStar,
  dependencyOfReached,
  drivers,
  editDirectory,
  exportCycle,
  familyOptions,
  forms,
  helpers,
  javascriptCompanion,
  lintDriver,
  lintInstance,
  lintWithEslint,
  lintWithLinter,
  machineryHelpers,
  mutualRecursion,
  namedCycle,
  nextSeq,
  predictReports,
  programSkeleton,
  reportCalibrations,
  rewriteCompanion,
  statesOf,
  toggleDeclaration,
  trailingArguments,
  usePartReachPaths,
  wrappedBody,
  writeProgram,
} from './part-reach-oracle-support.js'

usePartReachPaths()

const observed = (observations, name) =>
  observations.find((observation) => observation.checkpoint === name)?.value

// -- Receiving paths ----------------------------------------------------------

oracleProperty({
  ...familyOptions({
    id: `lint.part-reach.receiving-linter`,
    statement: `A single-file Linter call agrees with the model on the full grammar.`,
    features: ALL,
    gated: [],
    runs: 4,
    fixedSeeds: [FIXED_SEED, FIXED_SEED + 1],
  }),
  check: checkPaths,
  driver: (plan, observe) => observe(`linter`, lintWithLinter(plan)),
  timeout: 900_000,
})

// -- Fixed inputs: enumerated, through every receiving path --------------------

const fixedInputs = [
  [`export-star and named re-export cycles`, exportCycle],
  [`named re-export cycle only`, namedCycle],
  [`mutual recursion, in both orders`, mutualRecursion],
  [
    `mutual recursion, reversed`,
    {
      ...mutualRecursion,
      oracle: {
        ...mutualRecursion.oracle,
        tests: [...mutualRecursion.oracle.tests].reverse(),
      },
    },
  ],
  [`each registration form`, forms],
  [`broken companion, string-keyed type model, registration helper`, helpers],
  [`a caller-passed body before a trailing argument`, trailingArguments],
  [`a caller-passed body inside the helper's wrapper`, wrappedBody],
  [`helpers in oracle- machinery modules`, machineryHelpers],
  [`a registrar through a default import`, defaultRegistrar],
  [`let, for...of, and namespace drivers`, drivers],
  [`a spread declaration and generated properties`, declarationsAndProperties],
  [`a check imported from a JavaScript companion`, javascriptCompanion],
  [`a default import through a star export`, defaultThroughStar],
]
const fixedNames = new Map(
  fixedInputs.map(([name, skeleton]) => [skeleton, name]),
)

oracleProperty({
  id: `lint.part-reach.fixed-inputs`,
  law: {
    statement: `The reviewer's fixed inputs, built with every feature family on, agree with the model on every receiving path.`,
    authority: `See PART_REACH_AUTHORITY in part-reach-oracle-support.js.`,
    limits: `The inputs are enumerated, so the grammar is not sampled here; they carry no expected answers of their own.`,
  },
  histories: fixedInputs.map(([, skeleton]) => skeleton),
  label: (skeleton) => fixedNames.get(skeleton) ?? `fixed input`,
  resolve: (skeleton) => buildProgram(skeleton, ALL),
  model: (program) => predictReports(program),
  driver: lintDriver,
  check: checkPaths,
  calibrations: reportCalibrations,
  timeout: 300_000,
})

// -- Registration order --------------------------------------------------------

const ORDER = { ...BASE, companions: false, forms: [`identifier`] }
const ORDER_LAW = `part-reach subjects under reordering`

/** A permutation of 0..count-1, ordered by the drawn keys (ties by index). */
function permutationOf(count, keys) {
  return Array.from({ length: count }, (_, index) => index).sort(
    (a, b) => keys[a % keys.length] - keys[b % keys.length] || a - b,
  )
}

const orderArbitrary = fc.record({
  skeleton: programSkeleton,
  keys: fc.array(fc.nat({ max: 999 }), { minLength: 6, maxLength: 6 }),
})

// The subjects a reordering may move: `undeclared` names the first unreached
// test in source order, so it stands for every such name.
const bySubject = (keys) =>
  keys.map((key) => (key.startsWith(`undeclared`) ? `undeclared` : key)).sort()

oracleProperty({
  id: `lint.part-reach.registration-order`,
  law: {
    statement: `Permuting an oracle's registrations does not change its reports, up to the subject names: the reordered lint agrees with the model, and it names the same subjects as the original.`,
    authority: `See PART_REACH_AUTHORITY in part-reach-oracle-support.js; the reports are a pure function of the source files (law L1 of rules/no-unit-test.js).`,
    limits: `Identifier registrations in one file, the shape whose evaluation order the reach rule must not depend on. Companions are not generated here.`,
  },
  histories: {
    arbitrary: orderArbitrary,
    runs: 3000,
    fixedSeeds: [FIXED_SEED],
    states: [],
    measured: STATE_NAMES,
    constructed: [],
  },
  resolve: ({ skeleton, keys }) => {
    const program = buildProgram(skeleton, ORDER)
    const order = permutationOf(program.tests.length, keys)
    return {
      program,
      permuted: {
        ...program,
        tests: order.map((index) => program.tests[index]),
      },
    }
  },
  reached: ({ program }) => [...statesOf(program)],
  model: ({ permuted }) => predictReports(permuted),
  driver: async ({ program, permuted }, observe) => {
    observe(`original`, await lintWithEslint(program))
    observe(`reordered`, await lintWithEslint(permuted))
  },
  check: (_plan, observations, expected) =>
    differs(
      `reordered`,
      REPORTS_LAW,
      observed(observations, `reordered`),
      expected,
    ) ??
    differs(
      `subjects`,
      ORDER_LAW,
      bySubject(observed(observations, `reordered`)),
      bySubject(observed(observations, `original`)),
    ) ??
    pass,
  calibrations: [
    {
      name: `a report dropped from the reordered lint`,
      law: REPORTS_LAW,
      corrupt: (trace) => {
        if (observed(trace, `reordered`).length === 0) return undefined
        return trace.map((o) =>
          o.checkpoint === `reordered` ? { ...o, value: o.value.slice(1) } : o,
        )
      },
    },
  ],
  timeout: 900_000,
})

// -- Rerun equality ------------------------------------------------------------

oracleProperty({
  id: `lint.part-reach.rerun`,
  law: {
    statement: `Linting the same program twice in one process gives the same reports.`,
    authority: `See PART_REACH_AUTHORITY in part-reach-oracle-support.js.`,
    limits: `Rerun equality only: the model is checked by the other properties, so this law has no expectation of its own.`,
  },
  histories: {
    arbitrary: programSkeleton,
    runs: BASE_RUNS,
    fixedSeeds: [FIXED_SEED],
    states: [],
    measured: STATE_NAMES,
    constructed: [],
  },
  resolve: (skeleton) => buildProgram(skeleton, ALL),
  reached: (program) => [...statesOf(program)],
  model: () => null,
  driver: async (program, observe) => {
    observe(`first`, await lintWithEslint(program))
    observe(`second`, await lintWithEslint(program))
  },
  check: (_plan, observations) =>
    differs(
      `second`,
      `part-reach rerun equality`,
      observed(observations, `second`),
      observed(observations, `first`),
    ) ?? pass,
  calibrations: [
    {
      name: `a report added on the second lint`,
      law: `part-reach rerun equality`,
      corrupt: (trace) =>
        trace.map((o) =>
          o.checkpoint === `second`
            ? { ...o, value: [...o.value, `other:spurious@0:wrong`] }
            : o,
        ),
    },
  ],
  timeout: 900_000,
})

// -- Companion edits between lints ---------------------------------------------

const COMPANION = { ...BASE, stars: true, acyclic: true }
const EDIT_STATE = `companion-edited-between-lints`

/** The file that a history edits, or undefined when it has no dependency. */
const editedFile = (plan) => dependencyOfReached(plan)?.file

/** Lints, edits the file (when there is one), and lints again on the same instance. */
async function editAndRelint(plan, observe, fileOf) {
  const seq = nextSeq()
  const before = writeProgram(editDirectory(seq), plan)
  observe(`before`, await lintInstance(before.oracle, before.subjects))
  const file = fileOf(plan)
  if (file === undefined) return
  rewriteCompanion(editDirectory(seq), toggleDeclaration(plan, file), file)
  observe(`after`, await lintInstance(before.oracle, before.subjects))
}

/** The model: the edited program's reports, after the same edit. */
function editModel(plan, fileOf) {
  const file = fileOf(plan)
  return {
    before: predictReports(plan),
    after:
      file === undefined
        ? undefined
        : predictReports(toggleDeclaration(plan, file)),
  }
}

// The second lint is owed whenever the plan has a dependency to edit. A missing
// observation then differs from the owed reports, and fails the check.
function editCheck(_plan, observations, expected) {
  return (
    differs(
      `before`,
      REPORTS_LAW,
      observed(observations, `before`),
      expected.before,
    ) ??
    (expected.after === undefined
      ? pass
      : differs(
          `after`,
          REPORTS_LAW,
          observed(observations, `after`),
          expected.after,
        )) ??
    pass
  )
}

// Wrong answers the edit check must reject (ORC-006): a second lint that never
// ran, and reports that the second lint dropped.
const dropSecondLint = {
  name: `the second lint is not recorded`,
  law: REPORTS_LAW,
  corrupt: (trace) =>
    trace.some((o) => o.checkpoint === `after`)
      ? trace.filter((o) => o.checkpoint !== `after`)
      : undefined,
}

oracleProperty({
  ...familyOptions({
    id: `lint.part-reach.companion-edits`,
    statement: `A companion edited between two lints of one oracle file gives the reports of a fresh process: the second lint agrees with the model of the edited program.`,
    features: COMPANION,
    gated: [EDIT_STATE],
    runs: 40,
    // Only programs with a dependency are drawn, so every run edits a file.
    arbitrary: programSkeleton.filter(
      (skeleton) =>
        dependencyOfReached(buildProgram(skeleton, COMPANION)) !== undefined,
    ),
    // The edit state is entered only when a second lint was recorded, that is,
    // when the driver really edited a companion between the two lints.
    reached: (plan, trace) => [
      ...statesOf(plan),
      ...(trace.some((o) => o.checkpoint === `after`) ? [EDIT_STATE] : []),
    ],
    calibrations: [...reportCalibrations, dropSecondLint],
  }),
  driver: (plan, observe) => editAndRelint(plan, observe, editedFile),
  model: (plan) => editModel(plan, editedFile),
  check: editCheck,
  timeout: 900_000,
})

// The pinned dependency chain: a fixed history of the same edit, on c0.
const chainFile = () => `c0.ts`
oracleProperty({
  id: `lint.part-reach.dependency-chain`,
  law: {
    statement: `An oracle that imports a companion which imports the check: editing the check's companion between two lints changes the next lint's reports, although the middle companion is unchanged.`,
    authority: `See PART_REACH_AUTHORITY in part-reach-oracle-support.js, and the rule's reach cache (maintainer decision 2026-11-02).`,
    limits: `One fixed chain, enumerated; the generated companion edits are the companion-edits property.`,
  },
  histories: [chain],
  label: () => `a dependency chain`,
  resolve: (skeleton) => buildProgram(skeleton, ALL),
  model: (plan) => editModel(plan, chainFile),
  driver: (plan, observe) => editAndRelint(plan, observe, chainFile),
  check: editCheck,
  calibrations: reportCalibrations,
  timeout: 300_000,
})
