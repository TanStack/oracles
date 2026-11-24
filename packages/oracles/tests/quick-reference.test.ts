import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// docs/quick-reference.md shows the files of examples/quick-reference, which
// CI compiles, runs, and gap-checks. Each code block that follows an
// `<!-- example: <path> -->` marker must be that file, so the page cannot
// drift from the code that is checked. Prettier fences a block that holds
// three backticks with four, so a fence is three backticks or more.
const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), `utf8`).replace(
    /\r\n/g,
    `\n`,
  )

const page = read(`docs/quick-reference.md`)
const blocks = [
  ...page.matchAll(/<!-- example: (\S+) -->\n\n(`{3,})ts\n([\s\S]*?)\n\2\n/g),
].map(([, path, , code]) => ({ path: path!, code: `${code!}\n` }))

describe(`docs/quick-reference.md`, () => {
  it(`shows both files of the example`, () => {
    expect(blocks.map(({ path }) => path)).toEqual([
      `examples/quick-reference/src/insert-sorted.ts`,
      `examples/quick-reference/tests/insert-sorted.oracle.property.test.ts`,
    ])
  })

  it.each(blocks)(`shows $path as it is`, ({ path, code }) => {
    expect(code).toBe(read(path))
  })
})
