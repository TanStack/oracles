/**
 * Each published package (the plugin and `@tanstack/oracles`) cites only
 * what it ships. An agent that reads a package's source, as installed in a
 * consumer's node_modules, follows each file the source names; a file of this repository that the package does not
 * ship is one the consumer does not have, and an agent read one such
 * citation as an instruction to look for it (maintainer finding F16,
 * 2026-11-10).
 *
 * What the check covers, in every shipped file (the files `npm pack` lists,
 * so the manifest's `files` decides them):
 *
 * - A path: directory segments and a file name with an extension
 *   (`dir/file.js`, `../file.js`). It must name a file its package ships,
 *   from the citing file's directory or the package's root (a `.js` import
 *   names its `.ts` source). A path that names no file of the repository
 *   (from the citing file, the package, the repository's root, or another
 *   package or its `src`) and does not start with one of its top-level
 *   directories (an example of a consumer's path, such as `src/x.ts`) is
 *   not a citation.
 * - A bare name, with or without its extension, such as
 *   `gap-report-probe-form-oracle`: a name with a hyphen that is the file
 *   name or the stem (the name without `.property`, `.test`, and its
 *   extension) of a tracked file of the repository that no package ships.
 *   A name that a shipped file also has (a rule's name, a framework module's
 *   name) is not a citation.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

const repo = fileURLToPath(new URL(`../../../`, import.meta.url))
const own = join(repo, `packages`, `eslint-plugin-oracles`)
const packages = readdirSync(join(repo, `packages`)).map((name) =>
  join(repo, `packages`, name),
)
const topLevel = /^(packages|scripts|docs|\.agents|\.github)\//

const PATH =
  /(?<![\w$}{<>./-])((?:\.\.?\/)?(?:[\w@.-]+\/)+[\w@*.-]+\.(?:m?[jt]sx?|c[jt]s|md|json))(?![\w-])/g
const NAME =
  /(?<![\w./-])([\w@]+(?:[.-][\w@]+)*-[\w@]+(?:[.-][\w@]+)*)(?![\w/-])/g

/** The files `npm pack` would publish from a package, relative to it. */
function shippedFiles(dir) {
  const packed = spawnSync(
    `npm`,
    [`pack`, `--dry-run`, `--json`, `--ignore-scripts`],
    // On Windows npm is an npm.cmd shim, which only a shell runs.
    { cwd: dir, encoding: `utf8`, shell: process.platform === `win32` },
  )
  return JSON.parse(packed.stdout)[0].files.map((file) => file.path)
}
const stemOf = (name) => name.replace(/(\.property)?(\.test)?\.[\w]+$/, ``)
const namesOf = (path) => [basename(path), stemOf(basename(path))]

const shippedOf = new Map(packages.map((dir) => [dir, shippedFiles(dir)]))
const shippedNames = new Set([...shippedOf.values()].flat().flatMap(namesOf))
const tracked = spawnSync(`git`, [`ls-files`], { cwd: repo, encoding: `utf8` })
  .stdout.split(`\n`)
  .filter(Boolean)
// The names of the repository's files that no package ships, except the
// conventional names that a consumer's package has too (a lockfile the CLI
// reads, a manifest).
const conventional = new Set([
  `pnpm-lock.yaml`,
  `package-lock.json`,
  `yarn.lock`,
  `package.json`,
  `tsconfig.json`,
])
const repoOnlyNames = new Set(
  tracked
    .flatMap(namesOf)
    .filter((name) => !shippedNames.has(name) && !conventional.has(name)),
)

/**
 * The citations of `text`, in the file `file` that package `dir` ships, of
 * files the package does not ship. A `.js` path names its `.ts` source too.
 */
function strays(dir, file, text) {
  const shipped = shippedOf.get(dir)
  const paths = [...text.matchAll(PATH)]
    .map((match) => match[1])
    .filter((cited) => {
      const ships = [dirname(file), `.`].some((base) =>
        [cited, cited.replace(/\.js$/, `.ts`)].some((name) =>
          // npm names a shipped file with forward slashes, on every platform.
          shipped.includes(join(base, name).replaceAll(`\\`, `/`)),
        ),
      )
      const names =
        topLevel.test(cited) ||
        [dirname(join(dir, file)), dir, repo, ...packages].some((base) =>
          existsSync(join(base, cited)),
        ) ||
        packages.some((other) => existsSync(join(other, `src`, cited)))
      return names && !ships
    })
  const names = [...text.matchAll(NAME)]
    .map((match) => match[1])
    .filter((name) => repoOnlyNames.has(name))
  return [...paths, ...names].map(
    (cited) => `${relative(repo, join(dir, file))}: ${cited}`,
  )
}

test(`every file a shipped file cites is a file its package ships`, () => {
  const found = packages.flatMap((dir) => {
    const sources = shippedOf
      .get(dir)
      .filter((file) => /\.(m?[jt]s|c[jt]s)$/.test(file))
    expect(sources.length).toBeGreaterThan(0)
    return sources.flatMap((file) =>
      strays(dir, file, readFileSync(join(dir, file), `utf8`)),
    )
  })
  expect(found).toEqual([])
})

test(`the check rejects a citation of a test file, a repository script, another package's file, and a bare oracle name`, () => {
  expect(
    strays(
      own,
      `src/rules/probe-form.js`,
      [
        `// See tests/no-unit-test.test.js for the cases.`,
        `// The law is in scripts/eslint-plugin-oracle/probe-form-oracle.property.test.js.`,
        `// Its oracle (gap-report-probe-form-oracle) checks the CLI.`,
        `// The production config in src/index.js, and src/x.ts as an example.`,
      ].join(`\n`),
    ),
  ).toEqual([
    `packages/eslint-plugin-oracles/src/rules/probe-form.js: tests/no-unit-test.test.js`,
    `packages/eslint-plugin-oracles/src/rules/probe-form.js: scripts/eslint-plugin-oracle/probe-form-oracle.property.test.js`,
    `packages/eslint-plugin-oracles/src/rules/probe-form.js: gap-report-probe-form-oracle`,
  ])
  expect(
    strays(
      join(repo, `packages`, `oracles`),
      `oracle-gaps/schemata.mjs`,
      `// The probe form is the lint rule's (rules/probe-form.js), read by ./analysis.mjs.`,
    ),
  ).toEqual([`packages/oracles/oracle-gaps/schemata.mjs: rules/probe-form.js`])
})
