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
          `packages/oracles/src/oracle-campaign.ts`,
          `packages/oracles/src/oracle-config.ts`,
          `packages/oracles/src/oracle-property.ts`,
        ],
        replayWitnessModules: [`packages/oracles/src/oracle-replay-witness.ts`],
        // Files that still run raw campaigns or import the legacy reach API.
        // Each entry is a decision the maintainer has not yet made: the
        // migration is disproportionately large (see the pull request), and
        // the entry shrinks as each file moves to oracleProperty.
        legacyCampaigns: [
          {
            file: `packages/oracles/tests/declared-reach-oracle.property.test.ts`,
            reason: `Self-test of the legacy createOracleReach and runOracleCampaign; deleted with them when the API is removed, which waits on part-reach.`,
          },
          {
            file: `packages/oracles/tests/oracle-campaign.test.ts`,
            reason: `Self-test of the legacy runOracleCampaign; deleted with it when the API is removed, which waits on part-reach.`,
          },
          {
            file: `packages/oracles/tests/oracle-reach.test.ts`,
            reason: `Self-test of the legacy createOracleReach; deleted with it when the API is removed, which waits on part-reach.`,
          },
        ],
      },
    },
  },
  oraclePlugin.configs.recommended,
  { ...oraclePlugin.configs.production, ignores: oracleMachinery },
]
