import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// docs/by-example.md walks through examples/quick-reference, which CI
// compiles, runs, and gap-checks. Each TypeScript block on the page is cut
// from one of the example's two files: its lines must be consecutive lines
// of that file, each with the same leading indentation removed, so the page
// cannot drift from the code that is checked.
const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), `utf8`).replace(
    /\r\n/g,
    `\n`,
  )

const files = [
  `examples/quick-reference/src/insert-sorted.ts`,
  `examples/quick-reference/tests/insert-sorted.oracle.property.test.ts`,
]
const page = read(`docs/by-example.md`)
const blocks = [...page.matchAll(/^(`{3,})ts\n([\s\S]*?)\n\1$/gm)].map(
  ([, , code]) => code!,
)

/** The example file whose consecutive lines, under one indentation, are the block. */
function sourceOf(code: string) {
  const lines = code.split(`\n`)
  const indent = Math.min(
    ...lines
      .filter((line) => line !== ``)
      .map((line) => /^ */.exec(line)![0].length),
  )
  const cut = lines.map((line) => line.slice(indent))
  return files.find((path) => {
    const have = read(path).split(`\n`)
    return have.some((first, start) => {
      const pad = first.slice(0, first.length - cut[0]!.length)
      return (
        first.endsWith(cut[0]!) &&
        /^ *$/.test(pad) &&
        cut.every(
          (line, i) => have[start + i] === (line === `` ? `` : pad + line),
        )
      )
    })
  })
}

describe(`docs/by-example.md`, () => {
  it(`shows code from the example`, () => {
    expect(blocks.length).toBeGreaterThan(5)
  })

  it.each(blocks.map((code) => ({ code, head: code.split(`\n`)[0]!.trim() })))(
    `shows $head as the example has it`,
    ({ code }) => {
      expect(sourceOf(code)).toBeDefined()
    },
  )
})
