/**
 * # Declared reach through registration helpers in oracle files
 *
 * Law: a registration that a helper makes reaches a declared part exactly when
 * the registered body does, however the helper is imported and named, and the
 * rule reports a call to a helper that registers tests of its own unless the
 * helper's module is linted on its own (see part-reach-oracle-support.js for the
 * reach relation and its authority). This file owns the helper shapes:
 * imported registrars, caller-passed body helpers and their layouts, helpers
 * selected by module name and import form, namespace and default imports, and
 * oracle properties from the framework module and its lookalikes.
 *
 * Each feature family is one oracle property with its own features and budget
 * (200 runs for layouts, namespace imports, and oracle properties, as in the
 * original file). Each
 * property gates the states its features enter, each with a constructed history
 * (a builder that splices the parts entering the state into the generated skeleton).
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
  withForms,
} from './part-reach-oracle-support.js'

usePartReachPaths()

oracleProperty({
  ...familyOptions({
    id: `lint.part-reach.imported-registrar`,
    statement: `A registration helper imported from an ordinary module reaches a part exactly when the body it registers does, and a helper in an oracle-prefixed module is judged there.`,
    features: { ...BASE, registrar: true },
    gated: [`imported-registration`, `prefixed-oracle-registrar`],
  }),
  check: checkPaths,
})
oracleProperty({
  ...familyOptions({
    id: `lint.part-reach.caller-passed-bodies`,
    statement: `A helper that registers its caller's body reaches a part exactly when the argument at the body's position does; a trailing argument says nothing about the body.`,
    features: withForms([`helper-plain`, `helper-prop`]),
    gated: [`caller-passed-body-helper`],
  }),
  check: checkPaths,
})
oracleProperty({
  ...familyOptions({
    id: `lint.part-reach.caller-passed-body-layouts`,
    statement: `A caller-passed body with a trailing argument, or inside the helper's own wrapper, reaches a part as the model predicts: a wrapper that uses a part reaches, and a trailing name does not change the body.`,
    features: withForms([`helper-plain`, `helper-prop`], {
      helperLayouts: true,
    }),
    gated: [
      `caller-body-trailing-name`,
      `caller-body-wrapper`,
      `caller-body-wrapper-reaches-part`,
    ],
    runs: 200,
  }),
  check: checkPaths,
})
oracleProperty({
  ...familyOptions({
    id: `lint.part-reach.registration-helpers-by-name-and-import`,
    statement: `Registration helpers are judged by their module name and import form: a namespace member call, a default import, and an oracle-named helper each register as the model predicts.`,
    features: withForms([`call`, `helper-plain`, `helper-prop`], {
      registrar: true,
      helperNames: true,
      importForms: true,
    }),
    gated: [
      `default-import`,
      `default-import-registration`,
      `member-callee-registration`,
      `namespace-import`,
      `oracle-named-helper`,
      `prefixed-oracle-helper`,
    ],
  }),
  check: checkPaths,
})
oracleProperty({
  ...familyOptions({
    id: `lint.part-reach.namespace-and-default-imports`,
    statement: `A default import reaches only the target's own default export: export-star does not carry a default, so a default import through a star reaches nothing unless the star target's default is a part.`,
    features: { ...BASE, importForms: true, stars: true },
    gated: [
      `default-import-star-target-has-part`,
      `default-import-through-star`,
    ],
    runs: 200,
  }),
  check: checkPaths,
})
oracleProperty({
  ...familyOptions({
    id: `lint.part-reach.oracle-properties`,
    statement: `An oracleProperty call from the framework module, with an object-literal options argument that has a check, reaches a part by construction; the framework module's lookalikes in other modules are judged as ordinary helpers.`,
    features: withForms([`framework-property`], {
      frameworkNames: true,
      importForms: true,
    }),
    gated: [
      `oracle-property-complete`,
      `oracle-property-without-check`,
      `oracle-property-named-options`,
      `oracle-property-namespace-import`,
      `oracle-property-machinery-lookalike`,
      `oracle-property-ordinary-lookalike`,
      `oracle-property-oracle-named-lookalike`,
    ],
    runs: 200,
  }),
  check: checkPaths,
})
