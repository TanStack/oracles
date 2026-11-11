import noDisabled from './rules/no-disabled.js'
import noOracleDisable from './rules/no-oracle-disable.js'
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
 * can run them on one file in well under a second.
 *
 * P8 of the frozen design grammar: lint rules cannot be disabled inline. The
 * `recommended` config sets `linterOptions.noInlineConfig`, so in an oracle file
 * a disable directive has no effect (ESLint reports that it was ignored); the
 * directive cannot silence `oracle/*` rules there. The setting applies to every
 * rule in the file, not only the oracle rules, because ESLint has no per-rule
 * switch.
 */

// The same names that the run-budget check (check-oracle-run-counts) accepts.
const oracleFiles = [
  `**/*oracle*.ts`,
  `**/*oracle*.tsx`,
  `**/*oracle*.js`,
  `**/*oracle*.mjs`,
  `**/*oracle*.jsx`,
]

// A tool's config file (`eslint.oracle.config.mjs`, `vite.config.ts`) is
// never an oracle file or production source, so both configs leave it out.
// A companion oracle module (`foo-oracle.ts`) stays in scope.
const configFiles = [`**/*.config.{js,mjs,cjs,ts,mts,cts}`]

const plugin = {
  meta: { name: `eslint-plugin-oracle` },
  rules: {
    'no-disabled': noDisabled,
    'no-oracle-disable': noOracleDisable,
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
    ignores: configFiles,
    plugins: { oracle: plugin },
    linterOptions: { noInlineConfig: true },
    rules: {
      'oracle/no-disabled': `error`,
      'oracle/no-oracle-disable': `error`,
      'oracle/no-unit-test': `error`,
      'oracle/oracle-property-only': `error`,
      'oracle/pure-model': `error`,
      'oracle/replayable-seed': `error`,
    },
  },
  // Production source, not oracle files: a state probe is the only development
  // code that the production build must not carry (the probe form). A monorepo
  // package keeps its source under packages/*/src; a single-package repository
  // keeps it under src at the root.
  production: {
    name: `oracle/production`,
    files: [`packages/*/src`, `src`].flatMap((dir) =>
      [`ts`, `tsx`, `js`, `jsx`, `mjs`].map((ext) => `${dir}/**/*.${ext}`),
    ),
    ignores: configFiles,
    plugins: { oracle: plugin },
    rules: {
      'oracle/no-oracle-disable': `error`,
      'oracle/probe-form': `error`,
    },
  },
}

export default plugin
