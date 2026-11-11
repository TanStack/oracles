/**
 * The plugin's published files cite only what they ship. An agent that reads
 * a rule's source, as installed in a consumer's node_modules, follows each
 * file the source names; a file of this repository that the package does not
 * ship is one the consumer does not have, and an agent read one such
 * citation as an instruction to look for it (maintainer finding F16,
 * 2026-11-10).
 *
 * What the check covers, in every shipped file (the files `npm pack` lists,
 * so the manifest's `files` decides them):
 *
 * - A path: directory segments and a file name with an extension
 *   (`dir/file.js`, `../file.js`). It must name a shipped file, from the
 *   citing file's directory or the package's root. A path that names no file
 *   of the repository and does not start with one of its top-level
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
const own = fileURLToPath(new URL(`..`, import.meta.url))
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
    { cwd: dir, encoding: `utf8` },
  )
  return JSON.parse(packed.stdout)[0].files.map((file) => file.path)
}
const stemOf = (name) => name.replace(/(\.property)?(\.test)?\.[\w]+$/, ``)
const namesOf = (path) => [basename(path), stemOf(basename(path))]

const shipped = shippedFiles(own)
const shippedNames = new Set(
  packages.flatMap((dir) => shippedFiles(dir).flatMap(namesOf)),
)
const tracked = spawnSync(`git`, [`ls-files`], { cwd: repo, encoding: `utf8` })
  .stdout.split(`\n`)
  .filter(Boolean)
// The names of the repository's files that no package ships.
const repoOnlyNames = new Set(
  tracked.flatMap(namesOf).filter((name) => !shippedNames.has(name)),
)

/** The citations of `text`, in the shipped file `file`, that it does not ship. */
function strays(file, text) {
  const paths = [...text.matchAll(PATH)]
    .map((match) => match[1])
    .filter((cited) => {
      const ships = [dirname(file), `.`].some((base) =>
        shipped.includes(join(base, cited)),
      )
      const names =
        topLevel.test(cited) ||
        [dirname(join(own, file)), own, repo].some((base) =>
          existsSync(join(base, cited)),
        )
      return names && !ships
    })
  const names = [...text.matchAll(NAME)]
    .map((match) => match[1])
    .filter((name) => repoOnlyNames.has(name))
  return [...paths, ...names].map((cited) => `${file}: ${cited}`)
}

test(`every file a shipped file cites is a shipped file`, () => {
  const sources = shipped.filter((file) => /\.(m?[jt]s|c[jt]s)$/.test(file))
  expect(sources.length).toBeGreaterThan(0)
  expect(
    sources.flatMap((file) =>
      strays(file, readFileSync(join(own, file), `utf8`)),
    ),
  ).toEqual([])
})

test(`the check rejects a citation of a test file, a repository script, and a bare oracle name`, () => {
  expect(
    strays(
      `src/rules/probe-form.js`,
      [
        `// See tests/no-unit-test.test.js for the cases.`,
        `// The law is in scripts/eslint-plugin-oracle/probe-form-oracle.property.test.js.`,
        `// Its oracle (gap-report-probe-form-oracle) checks the CLI.`,
        `// The production config in src/index.js, and src/x.ts as an example.`,
      ].join(`\n`),
    ),
  ).toEqual([
    `src/rules/probe-form.js: tests/no-unit-test.test.js`,
    `src/rules/probe-form.js: scripts/eslint-plugin-oracle/probe-form-oracle.property.test.js`,
    `src/rules/probe-form.js: gap-report-probe-form-oracle`,
  ])
})
