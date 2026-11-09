/**
 * # The gap report's probe-only code follows the lint rule's probe form
 *
 * Law: a statement is a state probe, and the gap report leaves its mutants
 * out as probe-only code, exactly when the lint rule `oracle/probe-form`
 * accepts it; the guard's declaration, when it is the decided one, is
 * probe-only code too. Both follow one definition (the rule's header in
 * packages/eslint-plugin-oracles/src/rules/probe-form.js):
 *
 *   const probing = typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production'
 *   probing && globalThis.__oracleProbe?.('package#name', condition)
 *
 * with `probing` bound to that `const` in the probe's nearest function (its
 * top, a block of it, or a switch case), parentheses anywhere in the
 * initializer, the receiver `globalThis` or one `as` cast of it, an optional
 * call of two arguments, a name of the form `package#name`, and a condition
 * with no assignment, update, `new`, `delete`, `await`, `yield`, function or
 * class expression, or arrow with a block body.
 *
 * Authority: the maintainer's decisions on the probe form (2026-11-05, and
 * the function-local guard of 2026-11-08), and the round-2 review of PR #2,
 * which asked that the CLI and the rule follow one definition (R2b-5,
 * R2b-7).
 *
 * The grammar, model, and renderer are the lint rule's oracle's
 * (packages/eslint-plugin-oracles/tests/probe-form-grammar.js): each site is
 * a legal probe or one near-miss, on its own line of one function, below the
 * function's guard or with none. The driver instruments the program with the
 * CLI's own `instrument` (schemata.mjs) and records, for each line, which of
 * its mutants are probe-only. The comparison: on a legal site's line and on
 * the guard's line, every mutant is probe-only; on any other site's line,
 * none is. A line with no mutation site says nothing.
 *
 * Limits: the rule's own observations (its reports) are its oracle's; this
 * oracle judges only the CLI. Probe helpers and probe-only blocks are the
 * static oracle's.
 */
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { declareOracle } from '../src/oracle-declaration.ts'
import { oracleProperty, pass, violation } from '../src/oracle-property.ts'
import {
  MODEL,
  censusProgram,
  isLegal,
  programArbitrary,
  renderProgram,
  siteLine,
} from '../../eslint-plugin-oracles/tests/probe-form-grammar.js'
import { instrument } from './schemata.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ts = createRequire(join(here, `../package.json`))(`typescript`)
// The guard's line in the rendered function.
const GUARD_LINE = 2

// ## Model
//
// For each line, whether its mutants are probe-only: a legal site's and the
// guard's are, every other site's are not.
function model(program) {
  const lines = new Map(
    program.sites.map((site, index) => [
      siteLine(index),
      isLegal(site, program),
    ]),
  )
  if (program.header === `guard`) lines.set(GUARD_LINE, true)
  return { lines }
}

// ## Production driver
//
// The CLI's instrumenter on the rendered program, as for any source file.
function driver(program, observe) {
  const { mutants } = instrument(
    ts,
    `probe-form.ts`,
    renderProgram(program),
    `src/probe-form.ts`,
  )
  const lines = {}
  for (const m of mutants) (lines[m.line] ??= []).push(m.probeGuard === true)
  observe(`instrumented`, lines)
  for (const [index, site] of program.sites.entries())
    if (lines[siteLine(index)])
      observe(
        `reach`,
        `${isLegal(site, program) ? `legal` : `near-miss`} ${site.kind}`,
      )
}

// ## Comparison
function check(program, observations, expected) {
  const lines = observations.find((o) => o.checkpoint === `instrumented`)?.value
  if (!lines)
    return violation(`instrumented`, `nothing was instrumented`, `probe form`)
  for (const [line, legal] of expected.lines) {
    const marks = lines[line]
    if (!marks) continue
    if (marks.some((probe) => probe !== legal)) {
      const kind =
        line === GUARD_LINE
          ? `the guard`
          : program.sites[line - siteLine(0)].kind
      return violation(
        `instrumented`,
        `line ${line} (${kind}): ${marks.filter(Boolean).length} of ${marks.length} mutants are probe code, owed ${legal ? `all` : `none`}`,
        `probe form`,
      )
    }
  }
  return pass
}

declareOracle({ check: [check], model: [model], grammar: [programArbitrary] })

// A calibration marks a near-miss's mutant as probe code.
const calibrations = [
  {
    name: `a near-miss is marked as probe code`,
    law: `probe form`,
    corrupt: (trace, program) => {
      const index = trace.findIndex((o) => o.checkpoint === `instrumented`)
      const at = program.sites.findIndex(
        (site, i) => !isLegal(site, program) && trace[index].value[siteLine(i)],
      )
      if (index < 0 || at < 0) return undefined
      const value = structuredClone(trace[index].value)
      value[siteLine(at)][0] = true
      return trace.map((o, i) => (i === index ? { ...o, value } : o))
    },
  },
]

// Every kind that leaves a mutation site, legal and as a near-miss. A
// constructed history replaces a generated program's sites with six kinds
// at a time, each drawn with the generated first site's pools.
const KINDS = Object.keys(MODEL)
const chunks = []
for (let i = 0; i < KINDS.length; i += 6) chunks.push(KINDS.slice(i, i + 6))
const census = censusProgram()
const sitesOf = (program) =>
  new Set(
    program.sites
      .map((site, index) => [site, index])
      .filter(([, index]) => {
        const { mutants } = instrument(
          ts,
          `probe-form.ts`,
          renderProgram(program),
          `src/probe-form.ts`,
        )
        return mutants.some((m) => m.line === siteLine(index))
      })
      .map(
        ([site]) =>
          `${isLegal(site, program) ? `legal` : `near-miss`} ${site.kind}`,
      ),
  )
const states = [
  ...sitesOf(census),
  ...sitesOf({ ...census, header: `none` }),
].filter((state, i, all) => all.indexOf(state) === i)

oracleProperty({
  id: `oracle-gaps.report-probe-form`,
  law: {
    statement: `The gap report leaves out as probe-only code exactly the probe statements, and the guard declaration, that the lint rule's probe form accepts.`,
    authority: `The maintainer's probe-form decisions (2026-11-05; the function-local guard, 2026-11-08) and the round-2 review of PR #2 (R2b-5, R2b-7: one definition for the CLI and the rule).`,
    limits: `The rule's reports are judged by its own oracle; probe helpers and probe-only blocks by the static oracle. Lines without a mutation site say nothing.`,
    owner: `packages/oracles/oracle-gaps`,
  },
  histories: {
    arbitrary: programArbitrary,
    states,
    runs: 40,
    fixedSeeds: [20261108],
    constructed: [`guard`, `none`]
      .flatMap((header) =>
        chunks.map((kinds, i) => ({
          name: `kinds ${i + 1} under ${header === `guard` ? `the guard` : `no guard`}`,
          enters: [
            ...sitesOf({
              header,
              guardQuote: `'`,
              sites: kinds.map((kind) => ({ ...census.sites[0], kind })),
            }),
          ].filter((s) => states.includes(s)),
          build: (generated) => ({
            ...generated,
            header,
            sites: kinds.map((kind) => ({ ...generated.sites[0], kind })),
          }),
        })),
      )
      .filter((construction) => construction.enters.length > 0),
  },
  model,
  driver,
  check,
  calibrations,
  timeout: 120_000,
})
