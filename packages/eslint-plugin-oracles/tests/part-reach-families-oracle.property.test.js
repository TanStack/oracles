/**
 * # Declared reach across every feature family at once
 *
 * Law: the same as every part-reach oracle file (see part-reach-oracle-support.js):
 * a registration reaches a declared part, or the rule reports it. This file
 * runs the full grammar, with every feature family on, so that the combination
 * of families is exercised, not only each one alone. It gates no state of its
 * own: every state is gated by the family that enters it, and this property
 * measures the rest across the combined grammar.
 *
 * Authority: see PART_REACH_AUTHORITY in part-reach-oracle-support.js.
 *
 * Limits: the grammar's limits are stated in part-reach-oracle-support.js.
 */
import { oracleProperty } from '@tanstack/oracles'
import {
  ALL,
  checkPaths,
  familyOptions,
  usePartReachPaths,
} from './part-reach-oracle-support.js'

usePartReachPaths()

oracleProperty({
  ...familyOptions({
    id: `lint.part-reach.all-families`,
    statement: `With every feature family on, a registration reaches a declared part exactly when the model says, on every receiving path.`,
    features: ALL,
    gated: [],
  }),
  check: checkPaths,
})
