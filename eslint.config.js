import { tanstackConfig } from '@tanstack/eslint-config'
import oraclePlugin from '@tanstack/eslint-plugin-oracles'

// The framework's oracle modules and this plugin are oracle machinery. The
// framework installs the receiver of the state probes, and the plugin's rule
// names the probe, so neither is production source for the probe-form rule.
const oracleMachinery = [
  `packages/oracles/src/oracle-*.ts`,
  `packages/eslint-plugin-oracles/src/**`,
]

export default [
  ...tanstackConfig,
  {
    ignores: [
      `**/dist/**`,
      `**/.self-oracle-*/**`,
      `**/oracle-gaps*/.scratch-*/**`,
    ],
  },
  {
    // The framework's own replay-selection modules, which read the replay
    // variables and may select a replay from configuration. The variables use
    // the default prefix, ORACLE.
    settings: {
      oracles: {
        implementationModules: [
          `packages/oracles/src/oracle-config.ts`,
          `packages/oracles/src/oracle-property.ts`,
        ],
        replayWitnessModules: [`packages/oracles/src/oracle-replay-witness.ts`],
      },
    },
  },
  oraclePlugin.configs.recommended,
  // The preset's own ignores (tool config files) are kept.
  {
    ...oraclePlugin.configs.production,
    ignores: [...oraclePlugin.configs.production.ignores, ...oracleMachinery],
  },
]
