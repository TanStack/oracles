/**
 * # Declared reach through companion modules in oracle files
 *
 * Law: a registration in an oracle file reaches a declared part through the
 * companion modules that its functions import, and the rule reports it when it
 * does not (see part-reach-oracle-support.js for the reach relation and its
 * authority). This file owns the module shapes: export-star and named
 * re-export cycles, string-keyed and type-model declarations, an unparseable
 * companion, and a test that imports its check from a JavaScript companion.
 *
 * Each feature family is one oracle property. Cycles are rare in random
 * programs, so their budgets are larger (400 runs), as in the original file.
 * Each property gates the states its features enter, each with a constructed
 * history (a builder that splices the parts entering the state into the generated skeleton).
 *
 * Authority: see PART_REACH_AUTHORITY in part-reach-oracle-support.js.
 *
 * Limits: the grammar's limits are stated in part-reach-oracle-support.js.
 */
import { oracleProperty } from '@tanstack/oracles'
import {
  BASE,
  checkPaths,
  familyOptions,
  usePartReachPaths,
} from './part-reach-oracle-support.js'

usePartReachPaths()

oracleProperty({
  ...familyOptions({
    id: `lint.part-reach.export-star-cycles`,
    statement: `A test that reaches a check through companion modules that star-export each other reaches it exactly when the model says, and the cycle of export stars does not stop the reach.`,
    features: { ...BASE, stars: true },
    gated: [`export-star-cycle`],
    runs: 400,
  }),
  check: checkPaths,
})
oracleProperty({
  ...familyOptions({
    id: `lint.part-reach.named-reexport-cycles`,
    statement: `A test that reaches a check through companion modules that re-export each other's names reaches it exactly when the model says, and the cycle of named re-exports does not stop the reach.`,
    features: BASE,
    gated: [`named-reexport-cycle`],
    runs: 400,
  }),
  check: checkPaths,
})
oracleProperty({
  ...familyOptions({
    id: `lint.part-reach.string-keyed-declarations`,
    statement: `A declaration with string keys, and a type model in a companion, are reported exactly when the model says: a type model without an alias is reported, and a string-keyed declaration reaches the parts it declares.`,
    features: { ...BASE, stringKeys: true, typeModels: true },
    gated: [`string-keyed-declaration`, `type-model-declaration`],
  }),
  check: checkPaths,
})
oracleProperty({
  ...familyOptions({
    id: `lint.part-reach.type-models`,
    statement: `A type model in a companion is reported exactly when it has no alias in its file, and a registration reaches it only through a declared alias, as the model predicts.`,
    features: { ...BASE, typeModels: true },
    gated: [],
  }),
  check: checkPaths,
})
oracleProperty({
  ...familyOptions({
    id: `lint.part-reach.unparseable-companion`,
    statement: `A companion that does not parse reaches nothing, so a test that imports from it is unit-test shaped and the rule reports it as the model predicts.`,
    features: { ...BASE, broken: true },
    gated: [`unparseable-companion`],
  }),
  check: checkPaths,
})
oracleProperty({
  ...familyOptions({
    id: `lint.part-reach.javascript-companions`,
    statement: `A test that imports its check from a JavaScript companion reaches the part there, as the model predicts, and a JavaScript companion holds no type syntax.`,
    features: { ...BASE, jsCompanions: true },
    gated: [`javascript-companion-import-reaches-part`],
    runs: 300,
  }),
  check: checkPaths,
})
