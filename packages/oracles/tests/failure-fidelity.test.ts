import { describe, expect, it } from 'vitest'
import { OracleFailureReport, createOracleFailureFidelity } from '../src/index'

// The trace a failure report prints for a history, by default: the text an
// `oracleProperty` failure prints on its History line. JSON data prints as
// its JSON text; what JSON loses or refuses prints as the data encoding
// spells it.
async function traceOf(history: unknown): Promise<string> {
  const fidelity = createOracleFailureFidelity()
  const broken = new Error(`law broken`)
  const report = await fidelity
    .run(history, () => {
      throw broken
    })
    .then(
      () => undefined,
      (error: unknown) => error,
    )
  expect(report).toBeInstanceOf(OracleFailureReport)
  const { original, reduced } = report as OracleFailureReport
  expect(original.error).toBe(broken)
  expect(reduced.trace).toBe(original.trace)
  return original.trace
}

describe(`createOracleFailureFidelity`, () => {
  it.each([
    [
      `JSON data, as its JSON text`,
      { a: [1, `x`], b: null },
      `{"a":[1,"x"],"b":null}`,
    ],
    [`-0`, { n: -0, list: [1, -0] }, `{"n":-0,"list":[1,-0]}`],
    [
      `NaN and the infinities`,
      [Number.NaN, Infinity, -Infinity],
      `[NaN,Infinity,-Infinity]`,
    ],
    [
      `undefined`,
      { u: undefined, list: [undefined] },
      `{"u":undefined,"list":[undefined]}`,
    ],
    [`a bigint`, { big: 1n }, `{"big":1n}`],
    [
      `a Map and a Set`,
      [new Map([[`k`, 1]]), new Set([2])],
      `[Map{"k"=>1},Set{2}]`,
    ],
  ])(
    `describes a history holding %s as its History line does`,
    async (_, history, trace) => {
      expect(await traceOf(history)).toBe(trace)
    },
  )

  it(`describes a long history in full`, async () => {
    const history = Array.from({ length: 1000 }, (_, index) => index)
    expect(await traceOf(history)).toBe(JSON.stringify(history))
  })

  it(`describes a history that is not data by Node's inspection`, async () => {
    class Step {
      at = 3
    }
    expect(await traceOf({ step: new Step() })).toBe(`{ step: Step { at: 3 } }`)
  })
})
