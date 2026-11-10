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
  `configureOracles`.
- `packages/eslint-plugin-oracles` (`@tanstack/eslint-plugin-oracles`): the
  `oracle/*` lint rules. The rules recognize the framework by its package
  specifier and by a relative module with its file name. A project names its
  variable prefix and its replay-selection modules in `settings.oracles`.

## The `oracle/oracle-property-only` rule

In an oracle file, a generated-history campaign must run through
`oracleProperty`, whose constructed histories make each declared state's reach
required. The rule reports:

- a raw campaign: `fc.assert` or `fc.check` on a fast-check binding, from
  `fast-check` or `@fast-check/vitest`, and a `.prop` registration of a test
  root;
- an import of `createOracleReach` or `runOracleCampaign`, from any module.

A framework implementation module is exempt.

A file that still migrates can be listed in `settings.oracles.legacyCampaigns`:

```js
settings: {
  oracles: {
    legacyCampaigns: [
      { file: 'packages/x/tests/some-oracle.test.ts', reason: 'why it still runs raw campaigns' },
    ],
  },
}
```

An entry exempts its file's raw campaigns and legacy imports only with a
non-empty `reason`. The rule also reports an entry that has no reason, and an
entry whose file has no legacy use left (a stale entry). An entry for a deleted
or renamed file is not reported, because no lint run sees that file. An entry
the rule cannot judge is a configuration error: a malformed entry, or one that
names a file outside the oracle-file glob or a framework implementation module.
The rule throws when it reads the settings, so the run stops with that message.

The rule sees one file at a time, so it cannot tell a new entry from an old
one: a project that wants the baseline to shrink enforces that in its own diff
check.
