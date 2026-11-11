# TanStack Oracles

Oracle-based testing for TypeScript: state a law, generate the histories where
it matters, and check production against an independent model.

This package is under construction while it is extracted from TanStack DB's
oracle suite. It is not published to npm yet; previews are published from
every commit with [pkg.pr.new](https://pkg.pr.new).

## Packages

- `packages/oracles` (`@tanstack/oracles`): the oracle framework, and the
  `oracle-gaps` CLI. The CLI lists the production behaviour that a
  project's owning oracles leave unexercised or unjudged. A project runs it as
  `oracle-gaps --package <dir> --source <src/x.ts,...>`, with
  `--env-prefix` set to the prefix that the project passes to
  `configureOracles`. `--config <file>`, relative to `--package`, selects the
  Vitest config; without it, the run loads the config that Vitest discovers,
  and the baseline output names the config it loaded. Each run writes its report to
  `<dir>/.oracle-gaps/out/<run>/` (or to `--out`), and keeps its state in
  `<dir>/.oracle-gaps/`, and keeps the last five run directories there. Add
  `.oracle-gaps/` and `.oracle-gaps-*` to the project's `.gitignore`. The
  `.oracle-gaps-*` files are the runner's copies of the test files and its
  Vitest configs. They sit beside the package's config, because Vitest resolves
  each copy's imports from the directory the copy is in; a run that is killed
  before it cleans up leaves them there.
- `packages/eslint-plugin-oracles` (`@tanstack/eslint-plugin-oracles`): the
  `oracle/*` lint rules. The rules recognize the framework by its package
  specifier and by a relative module with its file name. A project names its
  variable prefix and its replay-selection modules in `settings.oracles`.

The `recommended` and `production` configs leave out tool config files: the
configs of ESLint, Vite, and Vitest (`vite.config.ts`, `vitest.unit.config.mjs`)
and any config named for oracles (`*.oracle.config.*`, such as
`eslint.oracle.config.mjs`). A config file is never an oracle file or
production source. A companion oracle module, such as `foo-oracle.ts`, keeps
the oracle rules, and so does a source module named `src/foo.config.ts`.

A config that spreads a preset and sets its own `ignores` replaces the
preset's, so merge them:

```js
{
  ...oracles.configs.production,
  ignores: [...oracles.configs.production.ignores, 'packages/x/src/machinery/**'],
}
```

## Bind calibrations to histories

A calibration's `history` selects an existing input directly:

```ts
calibrations: [
  {
    name: 'drops the committed row',
    law: 'durable publication',
    history: { constructed: 'a committed write' },
    corrupt: dropCommittedRow,
  },
]
```

Generated sources accept `{ constructed: name }` and `{ fixed: name }`.
Enumerated sources accept `{ enumerated: index }` (zero-based) or
`{ enumerated: name }`, using `label` or the framework's default data label.
Unknown or duplicate names, invalid indices, and incompatible source kinds fail
registration before a driver runs.

The selected clean run must pass and actually enter every state the history
declares. The mutation must apply, and the check must reject it under exactly
the named law. A failed clean run, missing reach, inapplicable corruption,
passing mutant, wrong-law rejection, or driver setup error fails the calibration
directly. It never searches another history.

A selected construction uses one deterministic seed derived from the property
id and calibration name. Inserting or reordering other calibrations leaves this
seed unchanged. Each driver execution builds from that seed afresh and resolves
its plan once. This preserves builder-created metadata, including WeakMap
associations, and avoids reusing consumed plans. Fixed and enumerated selectors
preserve the existing history's identity and semantics. Use `resolve` to create a
fresh mutable execution plan from those histories for each driver run. Each
calibration remains on the `calibration` route, so a failed self-check is a framework error in the gap report. Fresh-seed
calibrations will follow the planned `UNIT` replay support; this API adds no new
replay variable.

For automatic forced-probe controls, opt a state into direct selection:

```ts
probeHistories: {
  'committed write': {
    notEntered: { fixed: 'no writes' },
    // Optional: entered: { constructed: 'a committed write' }
  },
}
```

The clean-entered history detects the probe forced not entered. If `entered`
is omitted, exactly one construction must declare the state in `enters`.
The clean-not-entered history detects the probe forced entered and always needs
an explicit selection. Neither control may silently disappear.

During consumer migration, an unbound authored calibration or entirely unbound
probe state retains candidate search and prints a registration-time warning
naming each affected calibration. Bind both probe controls together with
`probeHistories`. Search will be removed after consumers migrate, before the
first npm release.

## The `oracle/no-unit-test` rule

Each test in an oracle file must reach a part that the file declares: its
check, model, or grammar. A test that reaches none compares production with a
hand-written value, so the rule reports it as a unit test that belongs in an
ordinary test file.

A test whose body is empty, such as `it('x', () => {})`, `test('x', async
() => {})`, or a skipped placeholder `it.skip('x', () => {})`, checks
nothing. The rule reports it whatever the file declares: remove it, or use
`it.todo`.

## The `oracle/no-oracle-disable` rule

An ESLint directive that would silence an `oracle/*` rule is reported: a
directive whose rule list names an oracle rule, a directive with no rule list
(it silences every rule), and an inline config comment that names an oracle
rule. Rule names may be quoted. The forms are the line, next-line, and block
forms, with or without a `-- description`. Oracle rules cannot be disabled
inline, so the directive is the report.

A report sits on the directive's own line. A directive that names this rule or
has no rule list can hide its own report, and so can a directive under an
earlier block directive. Those reports sit at line 1, column 0 instead.

Residuals the rule cannot close:

- A directive on line 1 that names this rule or has no rule list covers the
  file's start, so no report can sit there.
- In production source, a config comment that turns this rule off
  (`eslint oracle/no-oracle-disable: "off"`) switches the rule off for the file.
  ESLint then runs no rule, and none reports it.
- `noInlineConfig` in the `recommended` config makes ESLint ignore every
  directive of every rule in an oracle file, not only the oracle rules. A
  directive for another rule in an oracle file has no effect.

## The `oracle/oracle-property-only` rule

In an oracle file, a generated-history campaign must run through
`oracleProperty`, whose constructed histories make each declared state's reach
required. The rule reports:

- a raw campaign: `fc.assert` or `fc.check` on a fast-check binding, from
  `fast-check` or `@fast-check/vitest`, and a `.prop` registration of a test
  root;
- an import of `createOracleReach` or `runOracleCampaign`, from any module.

A framework implementation module is exempt.

No other configuration exempts a file. `settings.oracles.legacyCampaigns`, the
old list of files that kept their raw campaigns while they migrated, is removed.
A configuration that still sets it, to any value, exempts nothing. The rule
reports it as `removedSetting` at line 1 of each oracle file that the
configuration reaches, since ESLint runs a rule once per file. Convert the
listed files to `oracleProperty`, then delete the setting.

A non-array `settings.oracles.implementationModules` or `replayWitnessModules` is
reported at line 1 as `malformedSetting`, and it is read as an empty list.
