/**
 * # Declared reach of registration forms in oracle files
 *
 * Law: every test registration in an oracle file reaches a declared part, or
 * the rule reports it. A declared part is a check, a model, a grammar, or a
 * type model. A registration reaches a part when its body uses one, directly
 * or through a binding that reaches one, through local functions, imports,
 * re-exports, and companion modules. A registration whose `.each` or `.for`
 * table has a function that reaches a part reaches it too. A registration that
 * reaches none is reported as a unit test (`oracle/no-unit-test`).
 *
 * This file owns the registration forms: the plain and identifier forms of
 * the base grammar, call and member bodies, `.for` tables, options before or
 * after a body, `let` and `for...of` drivers, declaration spreads, and
 * generated properties. Each feature family is one oracle property with its
 * own features, budget, and fixed and random campaigns. Each property gates
 * the states its features enter, and each gated state has a constructed
 * history: rejection sampling from the grammar, seeded from the generated
 * history (`constructedFor` in part-reach-fixtures.js).
 *
 * Authority: see PART_REACH_AUTHORITY in part-reach-fixtures.js.
 *
 * Limits: the grammar's limits are stated in part-reach-fixtures.js. A state
 * that a family's features cannot enter fails its construction loudly, so no
 * state is claimed by a family that does not reach it.
 *
 * Structure, following ORC-003: the grammar and model live in
 * part-reach-fixtures.js; each property below supplies only its features,
 * budget, and gated states.
 */
import { afterAll, beforeAll } from 'vitest'
import { oracleProperty } from '@tanstack/oracles'
import {
  BASE,
  familyOptions,
  setupReceivingPaths,
  teardownReceivingPaths,
} from './part-reach-fixtures.js'

beforeAll(setupReceivingPaths)
afterAll(teardownReceivingPaths)

const withForms = (forms) => ({ ...BASE, forms: [...BASE.forms, ...forms] })

oracleProperty(
  familyOptions({
    id: `lint.part-reach.base`,
    statement: `The base grammar's registrations (plain, identifier, and .each forms) reach a declared part exactly when the model says, and the mutual recursion among the oracle's functions reaches a part or not as the model predicts.`,
    features: BASE,
    gated: [
      `form-each`,
      `mutual-recursion-reaches-part`,
      `mutual-recursion-reaches-no-part`,
    ],
  }),
)
oracleProperty(
  familyOptions({
    id: `lint.part-reach.call-bodies`,
    statement: `A registration whose body is a call reaches a part exactly when the call's callee reaches one, as the model predicts.`,
    features: withForms([`call`]),
    gated: [`form-call-body`],
  }),
)
oracleProperty(
  familyOptions({
    id: `lint.part-reach.member-bodies`,
    statement: `A registration whose body is a member expression reaches a part exactly when the member reaches one, as the model predicts.`,
    features: withForms([`member`]),
    gated: [`form-member-body`],
  }),
)
oracleProperty(
  familyOptions({
    id: `lint.part-reach.for-tables`,
    statement: `A registration in a .for table reaches a part exactly when its table's functions do, as the model predicts.`,
    features: withForms([`for`]),
    gated: [`form-for`],
  }),
)
oracleProperty(
  familyOptions({
    id: `lint.part-reach.options`,
    statement: `Options placed before or after a registration's body do not change whether the body reaches a part, as the model predicts.`,
    features: withForms([`options-first`, `options-last`]),
    gated: [`form-options`],
  }),
)
oracleProperty(
  familyOptions({
    id: `lint.part-reach.let-and-for-of-drivers`,
    statement: `A let driver reaches a part when the value assigned to it does; a for...of loop registers one test per element, so every element must reach a part.`,
    features: withForms([`let-driver`, `for-of`]),
    gated: [`let-assigned-driver`, `for-of-driver`, `for-of-mixed-elements`],
    runs: 300,
  }),
)
oracleProperty(
  familyOptions({
    id: `lint.part-reach.declaration-spreads`,
    statement: `A declaration that spreads its first part list reaches the parts it spreads, as the model predicts.`,
    features: { ...BASE, spreads: true },
    gated: [`declaration-spread`],
  }),
)
oracleProperty(
  familyOptions({
    id: `lint.part-reach.generated-properties`,
    statement: `A generated property counts as its own check when one of its arbitraries generates values and its predicate reads its input, whether the arbitrary is named or the predicate imported, as the model predicts.`,
    features: withForms([`property`, `prop-named`, `helper-prop`]),
    gated: [
      `imported-predicate`,
      `named-constant-arbitrary`,
      `predicate-ignores-input`,
    ],
  }),
)
