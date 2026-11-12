import { describe, it } from 'vitest'
import { RuleTester } from 'eslint'
import tsParser from '@typescript-eslint/parser'
import noDisabled from '../src/rules/no-disabled.js'
import noUnitTest from '../src/rules/no-unit-test.js'

// The rules recognize the framework by its package specifier, `@tanstack/oracles`,
// and by a relative module with the framework's file name, which a project
// keeps as a shim. A project's variables and replay modules are settings, so
// these cases use the package's defaults unless a case names settings.

RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester({
  languageOptions: { parser: tsParser, sourceType: `module` },
})

const packageHeader = `import { oracleProperty } from '@tanstack/oracles'
function checkHistory(history) { return history }
`

ruleTester.run(`oracle/no-unit-test`, noUnitTest, {
  valid: [
    {
      code: `${packageHeader}oracleProperty({ id: 'p', check: checkHistory })`,
      filename: `/repo/tests/checks-oracle.test.ts`,
    },
  ],
  invalid: [
    {
      code: `${packageHeader}oracleProperty({ id: 'p' })`,
      filename: `/repo/tests/checks-oracle.test.ts`,
      errors: [{ messageId: `incompleteProperty` }],
    },
  ],
})

const noDisabledTester = new RuleTester({
  languageOptions: { parser: tsParser, sourceType: `module` },
})

noDisabledTester.run(`oracle/no-disabled`, noDisabled, {
  valid: [
    {
      code: `import { oracleReplayRequested } from '@tanstack/oracles'\nit.skipIf(oracleReplayRequested())('checks the history', () => check())`,
      filename: `/repo/tests/checks-oracle.test.ts`,
    },
    // The framework's shared variables are read by the framework's helpers, so
    // the default prefix's seed is no private replay variable.
    {
      code: `const seed = process.env.ORACLE_SEED`,
      filename: `/repo/tests/checks-oracle.test.ts`,
    },
  ],
  invalid: [
    // The default prefix's runs variable is a private replay variable.
    {
      code: `const runs = process.env.ORACLE_RUNS`,
      filename: `/repo/tests/checks-oracle.test.ts`,
      errors: [
        {
          messageId: `replayVariable`,
          data: {
            name: `ORACLE_RUNS`,
            seed: `ORACLE_SEED`,
            path: `ORACLE_PATH`,
            property: `ORACLE_PROPERTY`,
            unit: `ORACLE_UNIT`,
            runsMultiplier: `ORACLE_RUNS_MULTIPLIER`,
          },
        },
      ],
    },
    // A replay-selection module is the one exemption, and it is named by path,
    // not by file name: this module is not one.
    {
      code: `const runs = process.env.ORACLE_RUNS`,
      filename: `/repo/src/oracle-config.ts`,
      errors: [{ messageId: `replayVariable` }],
    },
  ],
})

// A project's settings name its variable prefix and its replay modules.
const projectSettings = {
  oracles: {
    envPrefix: `TANSTACK_DB_ORACLE`,
    implementationModules: [`packages/app/tests/oracle-config.ts`],
    replayWitnessModules: [],
  },
}
const projectTester = new RuleTester({
  languageOptions: { parser: tsParser, sourceType: `module` },
  settings: projectSettings,
})

projectTester.run(`oracle/no-disabled with a project's settings`, noDisabled, {
  valid: [
    {
      code: `const seed = process.env.TANSTACK_DB_ORACLE_SEED`,
      filename: `/repo/tests/checks-oracle.test.ts`,
    },
    // The unit a path replay runs is a shared replay variable.
    {
      code: `const unit = process.env.TANSTACK_DB_ORACLE_UNIT`,
      filename: `/repo/tests/checks-oracle.test.ts`,
    },
    // The configured replay module, named by its path, may read a private
    // replay variable.
    {
      code: `const runs = process.env.TANSTACK_DB_ORACLE_RUNS`,
      filename: `/repo/packages/app/tests/oracle-config.ts`,
    },
  ],
  invalid: [
    {
      code: `const runs = process.env.TANSTACK_DB_ORACLE_RUNS`,
      filename: `/repo/tests/checks-oracle.test.ts`,
      errors: [{ messageId: `replayVariable` }],
    },
    // The default prefix is not the project's, so its variables are private.
    {
      code: `const runs = process.env.ORACLE_RUNS`,
      filename: `/repo/tests/checks-oracle.test.ts`,
      errors: [{ messageId: `replayVariable` }],
    },
    // A unit under another prefix selects a replay the shared variables do
    // not see.
    {
      code: `const unit = process.env.ORACLE_UNIT`,
      filename: `/repo/tests/checks-oracle.test.ts`,
      errors: [{ messageId: `replayVariable` }],
    },
    {
      code: `const { UTILS_ORACLE_UNIT } = process.env`,
      filename: `/repo/tests/checks-oracle.test.ts`,
      errors: [{ messageId: `replayVariable` }],
    },
  ],
})
