import noDisabled from './rules/no-disabled.js'
import noUnitTest from './rules/no-unit-test.js'
import oraclePropertyOnly from './rules/oracle-property-only.js'
import probeForm from './rules/probe-form.js'
import pureModel from './rules/pure-model.js'
import replayableSeed from './rules/replayable-seed.js'

/**
 * Lint rules for oracle files.
 *
 * The project's oracle guide lists the shortcuts that make an oracle pass without enforcing
 * its law ("How oracle work is scored"). These rules report the ones that a
 * syntactic check can see, in TypeScript and JavaScript files whose names
 * contain `oracle`. They need no type information, so an agent's post-edit hook
 * can run them on one file in well under a second. A directive can silence them in the root config, so
 * scripts/agent-lint-feedback.mjs enforces them in a pass that ignores inline
 * directives.
 */

// The same names that the run-budget check (check-oracle-run-counts) accepts.
const oracleFiles = [
  `**/*oracle*.ts`,
  `**/*oracle*.tsx`,
  `**/*oracle*.js`,
  `**/*oracle*.mjs`,
  `**/*oracle*.jsx`,
]

const plugin = {
  meta: { name: `eslint-plugin-oracle` },
  rules: {
    'no-disabled': noDisabled,
    'no-unit-test': noUnitTest,
    'oracle-property-only': oraclePropertyOnly,
    'pure-model': pureModel,
    'probe-form': probeForm,
    'replayable-seed': replayableSeed,
  },
}

plugin.configs = {
  recommended: {
    name: `oracle/recommended`,
    files: oracleFiles,
    plugins: { oracle: plugin },
    rules: {
      'oracle/no-disabled': `error`,
      'oracle/no-unit-test': `error`,
      'oracle/oracle-property-only': `error`,
      'oracle/pure-model': `error`,
      'oracle/replayable-seed': `error`,
    },
  },
  // Production source, not oracle files: a state probe is the only development
  // code that the production build must not carry (the probe form).
  production: {
    name: `oracle/production`,
    files: [
      `packages/*/src/**/*.ts`,
      `packages/*/src/**/*.tsx`,
      `packages/*/src/**/*.js`,
      `packages/*/src/**/*.jsx`,
      `packages/*/src/**/*.mjs`,
    ],
    plugins: { oracle: plugin },
    rules: {
      'oracle/probe-form': `error`,
    },
  },
}

export default plugin
