# @tanstack/eslint-plugin-oracles

Lint rules for oracle files written with `@tanstack/oracles`. They report the
shortcuts that make an oracle pass without enforcing its law, wherever a
syntactic check can see them. They need no type information, so an agent's
post-edit hook can run them on one file quickly.

Install it at the same pkg.pr.new commit as `@tanstack/oracles`. The
`oracles-setup` skill in that package configures it.

## Configs

| Config                | Files                                                                     | Rules                                                                                                       |
| --------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `configs.recommended` | Files whose names contain `oracle` (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`) | `no-disabled`, `no-oracle-disable`, `no-unit-test`, `oracle-property-only`, `pure-model`, `replayable-seed` |
| `configs.production`  | `src/**` and `packages/*/src/**`                                          | `probe-form`                                                                                                |

The `recommended` config also sets `linterOptions.noInlineConfig` for oracle
files, so a directive comment cannot switch a rule off there. Fix a report;
do not disable the rule.

The `production` config covers `src/**` and `packages/*/src/**`. For source
elsewhere, add `oracle/probe-form` with your own glob.

## Rules

| Rule                          | Reports                                                                                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `oracle/no-disabled`          | An oracle test that stops running: `.only`, a skipped body, a switch-off condition, or one run with no fixed history.                                                   |
| `oracle/no-unit-test`         | A test in an oracle file that reaches no declared check or model: an ordinary unit test.                                                                                |
| `oracle/no-oracle-disable`    | A directive comment that would silence an oracle rule. Oracle rules cannot be disabled inline.                                                                          |
| `oracle/oracle-property-only` | A raw campaign (`fc.assert`, `fc.check`, or a `.prop` registration) or a legacy campaign API in an oracle file. Only `oracleProperty` declares a generated-history law. |
| `oracle/pure-model`           | A model, check, or reach classifier that reads a clock, ambient randomness, or a timer.                                                                                 |
| `oracle/probe-form`           | A state probe in production code that is not in the one form the production build strips.                                                                               |
| `oracle/replayable-seed`      | A property seed that the shared replay variables cannot select.                                                                                                         |

The decided bans on snapshot matchers (B1), `fc.pre` (B3), production imports
in a model (B4), and identical comparison operands (B7) are not rules yet.
Reviews check them until they ship.

`settings.oracles.legacyCampaigns` is removed. A configuration that still
sets it exempts nothing.
