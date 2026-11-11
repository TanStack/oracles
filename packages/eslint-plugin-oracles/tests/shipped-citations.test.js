/**
 * The plugin's published files cite only what they ship. An agent that reads
 * a rule's source, as installed in a consumer's node_modules, follows each
 * path the source names; a path into this repository's other packages or
 * scripts names a file that the consumer does not have, and an agent read
 * one such path as an instruction to look for it (maintainer finding F16,
 * 2026-11-10). So every path that a shipped file names, in a comment or in a
 * message, resolves inside the package: from the citing file's directory or
 * from the package's root.
 *
 * A path here is a run of directory segments and a file name with an
 * extension (`dir/file.js`, `../file.js`), so a bare file name (an example
 * such as `oracle-config.ts`) and a placeholder such as `<package>/x.ts` are
 * not paths. The shipped files are those the manifest's `files` names.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

const root = fileURLToPath(new URL(`..`, import.meta.url))
const manifest = JSON.parse(readFileSync(join(root, `package.json`), `utf8`))

const filesUnder = (path) =>
  statSync(path).isDirectory()
    ? readdirSync(path).flatMap((name) => filesUnder(join(path, name)))
    : [path]

const PATH =
  /(?<![\w$}{<>./-])((?:\.\.?\/)?(?:[\w@.-]+\/)+[\w@*.-]+\.(?:m?[jt]sx?|c[jt]s|md|json))/g

test(`every path a shipped file cites resolves inside the package`, () => {
  const shipped = manifest.files
    .map((entry) => join(root, entry))
    .filter((path) => existsSync(path))
    .flatMap(filesUnder)
  expect(shipped.length).toBeGreaterThan(0)
  const unresolved = shipped.flatMap((file) =>
    [...readFileSync(file, `utf8`).matchAll(PATH)]
      .map((match) => match[1])
      .filter(
        (cited) =>
          ![dirname(file), root].some((base) => {
            const target = join(base, cited)
            return (
              !relative(root, target).startsWith(`..`) && existsSync(target)
            )
          }),
      )
      .map((cited) => `${relative(root, file)}: ${cited}`),
  )
  expect(unresolved).toEqual([])
})
