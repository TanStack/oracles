// The unit check of the path sets. scripts/classify-changes.sh maps the files a
// change touches to the sets that gate the heavy jobs of .github/workflows/pr.yml.
// Each row below is a sample change and the sets it must turn on; a job whose
// set is off is skipped. The table covers each arm of the classifier, the
// fail-safe rule (an unknown path, an empty change list, or an unknown base
// runs every set), and the framework and gap sets that they share.
//
//   node scripts/classify-changes-check.mjs
//
// It runs in the Test job, so a change to the classifier, or to the files a
// row names, fails there rather than in a probe run.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const classifier = fileURLToPath(
  new URL(`./classify-changes.sh`, import.meta.url),
)
const sets = [`framework`, `gaps`, `eslint`, `all`]
const ZERO_SHA = `0`.repeat(40)
const MISSING_SHA = `f`.repeat(40)

// `on` lists the sets that must be true. A row whose rule turns every set on
// lists all four, so the table states the fail-safe outcome in full.
const EVERY = sets

const paths = [
  {
    name: `an eslint plugin source file`,
    paths: [`packages/eslint-plugin-oracles/src/rules/no-unit-test.js`],
    on: [`eslint`],
  },
  {
    name: `the probe-form grammar, which the gap report imports`,
    paths: [
      `packages/eslint-plugin-oracles/tests/probe-form-oracle-grammar.js`,
    ],
    on: [`eslint`, `gaps`],
  },
  {
    name: `an oracle-gaps file`,
    paths: [`packages/oracles/oracle-gaps/check.mjs`],
    on: [`gaps`],
  },
  {
    name: `the gap report's config`,
    paths: [`packages/oracles/oracle-gaps/vitest.config.mjs`],
    on: [`gaps`],
  },
  {
    name: `oracle-property.ts, which the gap report's CLI and tests import`,
    paths: [`packages/oracles/src/oracle-property.ts`],
    on: [`framework`, `gaps`],
  },
  {
    name: `a framework source file the gap report does not import`,
    paths: [`packages/oracles/src/index.ts`],
    on: [`framework`],
  },
  {
    name: `a framework test`,
    paths: [`packages/oracles/tests/config.test.ts`],
    on: [`framework`],
  },
  {
    name: `the framework's Vitest config`,
    paths: [`packages/oracles/vitest.oracle-framework.config.mjs`],
    on: [`framework`],
  },
  {
    name: `the framework's build config`,
    paths: [`packages/oracles/vite.config.ts`],
    on: [`framework`],
  },
  {
    name: `the Windows witness, which the Windows CLI job runs`,
    paths: [`packages/oracles/scripts/windows-witness.mjs`],
    on: [`framework`],
  },
  {
    name: `the framework and gap shard partition`,
    paths: [`packages/oracles/scripts/pr-shards.mjs`],
    on: EVERY,
  },
  {
    name: `the end-to-end shard partition`,
    paths: [`packages/oracles/scripts/e2e-shards.mjs`],
    on: EVERY,
  },
  {
    name: `the framework's package.json`,
    paths: [`packages/oracles/package.json`],
    on: EVERY,
  },
  {
    name: `the root package.json`,
    paths: [`package.json`],
    on: EVERY,
  },
  {
    name: `the lockfile`,
    paths: [`pnpm-lock.yaml`],
    on: EVERY,
  },
  {
    name: `the workspace file`,
    paths: [`pnpm-workspace.yaml`],
    on: EVERY,
  },
  {
    name: `a TypeScript config`,
    paths: [`packages/oracles/tsconfig.json`],
    on: EVERY,
  },
  {
    name: `the workflow itself`,
    paths: [`.github/workflows/pr.yml`],
    on: EVERY,
  },
  {
    name: `a root file the classifier does not know`,
    paths: [`LICENSE`],
    on: EVERY,
  },
  {
    name: `a known change mixed with an unknown file`,
    paths: [`packages/oracles/src/index.ts`, `LICENSE`],
    on: EVERY,
  },
  {
    name: `the framework's README`,
    paths: [`packages/oracles/README.md`],
    on: [],
  },
  {
    name: `framework documentation`,
    paths: [
      `packages/oracles/docs/guide.md`,
      `packages/oracles/skills/oracles-review/SKILL.md`,
    ],
    on: [],
  },
  {
    name: `a root markdown file`,
    paths: [`README.md`],
    on: [],
  },
  {
    name: `a framework file mixed with documentation`,
    paths: [`packages/oracles/docs/guide.md`, `packages/oracles/src/index.ts`],
    on: [`framework`],
  },
  {
    name: `no changed files`,
    paths: [],
    on: EVERY,
  },
]

// A base that is not a commit in this clone is unknown, so every set runs.
const bases = [
  {
    name: `an all-zero base (a new branch)`,
    args: [ZERO_SHA, `HEAD`],
    on: EVERY,
  },
  {
    name: `a base commit this clone lacks`,
    args: [MISSING_SHA, `HEAD`],
    on: EVERY,
  },
]

const failures = []

// Parses the `name=true|false` lines and returns the sets that are true.
function parse(output, name) {
  const lines = output.trim().split(`\n`)
  const trueSets = []
  const keys = lines.map((line) => line.split(`=`)[0])
  for (const line of lines) {
    const [key, value] = line.split(`=`)
    if (value !== `true` && value !== `false`) {
      failures.push(`${name}: bad line ${JSON.stringify(line)}`)
    }
    if (value === `true`) trueSets.push(key)
  }
  const expectedKeys = [`framework`, `gaps`, `eslint`, `all`]
  if (keys.join(` `) !== expectedKeys.join(` `)) {
    failures.push(
      `${name}: keys ${keys.join(` `)}, want ${expectedKeys.join(` `)}`,
    )
  }
  return trueSets
}

function check(name, output, on) {
  const got = parse(output, name)
  const want = [...on].sort()
  const have = [...got].sort()
  if (JSON.stringify(have) !== JSON.stringify(want)) {
    failures.push(
      `${name}: on ${have.join(`, `) || `(none)`}, want ${want.join(`, `) || `(none)`}`,
    )
  }
}

for (const row of paths) {
  const input = row.paths.map((path) => `${path}\n`).join(``)
  const run = spawnSync(`bash`, [classifier, `--paths`], {
    input,
    encoding: `utf8`,
  })
  if (run.status !== 0) {
    failures.push(`${row.name}: classifier exited ${run.status}: ${run.stderr}`)
    continue
  }
  check(row.name, run.stdout, row.on)
}

for (const row of bases) {
  const run = spawnSync(`bash`, [classifier, ...row.args], { encoding: `utf8` })
  if (run.status !== 0) {
    failures.push(`${row.name}: classifier exited ${run.status}: ${run.stderr}`)
    continue
  }
  check(row.name, run.stdout, row.on)
}

if (failures.length > 0) {
  console.error(`The path sets disagree with the table:`)
  for (const failure of failures) console.error(`  ${failure}`)
  process.exit(1)
}
console.log(
  `The path sets match ${paths.length + bases.length} sample changes (${sets.join(`, `)}).`,
)
