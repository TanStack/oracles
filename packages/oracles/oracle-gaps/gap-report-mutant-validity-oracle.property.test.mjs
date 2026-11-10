/**
 * # The gap report never generates a mutant that no input can distinguish
 *
 * Law 1: every mutant that the CLI's instrumenter emits differs from the
 * original function on some input. Law 2: every site that the instrumenter
 * skips as undetectable equals the original function on every input. An
 * undetectable mutant is an invalid mutant. A report that counts one either
 * calls a non-gap a gap, or gives an agent a gap that no test can close.
 *
 * Authority: the frozen design v20's maintainer decision of 2026-11-10,
 * "anything an oracle can't possibly detect is an invalid mutant" (freeze.md,
 * "Undetectable mutants are invalid"), and its decision 5, that a reported
 * equivalent is a framework bug and not an answer.
 *
 * Domain. Each program is one function `f(a, b, c)` run on every input in
 * {0,1,2}^3. Every ordering of three integers, ties included, is in that
 * domain, so an input cannot be missing that separates two orderings. Two
 * functions are equal when they return `Object.is`-equal values on all 27
 * inputs.
 *
 * Grammar. A program's body is one of: a comparison returned as a value; a
 * ternary; a guard, `if (C) return T; return F;` or the same with an `else`;
 * or a clamp, a ternary whose false branch is another ternary. A comparison
 * is of two operands, each a variable or the literal 1, in either written
 * order (`a > b` and `b < a` are both generated). A ternary's or guard's
 * branches are either the two compared operands, in either order, or the
 * third variable with one of them. The third variable stands in for a
 * literal branch: on this domain, a literal such as `2` in `if (a > 1)
 * return 2; return a` makes the `if-false` mutant equal the original on all
 * 27 inputs, although the integers distinguish it (a = 3). Equal branches
 * are not generated; they are a different family of undetectable mutants,
 * outside this grammar (see the limits).
 *
 * Model. The model interprets the grammar on each input. A mutant is a
 * change to the program: a comparison's operator swapped to its boundary
 * partner (`>` with `>=`, `<` with `<=`), or an `if`'s condition forced to
 * true or to false. A site is distinguishable when some input gives the
 * changed program a different value from the original. The model reads the
 * grammar's own rendered text and its sites, never the instrumenter's text,
 * and it evaluates programs directly, so it does not share the emitter's
 * rules.
 *
 * Production path. The CLI's `instrument` (schemata.mjs) instruments the
 * rendered text. The driver runs the instrumented function with no mutant
 * active, which must equal the original, and then with each emitted mutant
 * active, recording whether its outputs differ from the original's.
 *
 * Observations. `instrumented` reports the clean run's result and each
 * emitted mutant's operator, position, and whether it is distinguishable.
 * `reach` reports the structural state of the program.
 *
 * Comparison, for each site the model names. An emitted site must be
 * distinguishable in the model and in its run (law 1). A site that is not
 * emitted is skipped, and must equal the original on every input (law 2).
 * Each emitted mutant must be a site of the grammar.
 *
 * Limits. Integer inputs only: the law says nothing about signed zero (`0`
 * and `-0` differ under `Object.is`), NaN, or operands of mixed types (`'1'`
 * and `1` compare with coercion). A skipped `>`/`>=` or `<`/`<=` swap is
 * sound only for numbers, so a skipped swap can distinguish mixed-type or
 * signed-zero inputs, which this domain cannot reach. That is a maintainer
 * decision, not a passing check. Outside the grammar, and open: branches
 * that agree (`if (a > b) return a; return a`), arithmetic with a literal
 * zero (`a + 0`), the logical and nullish operators (`a ?? a`), and `!`
 * (see the report). Property reads, calls, and getters are not generated. A
 * skipped swap is judged by the model's evaluation, not by any run of the
 * emitter. The switch below restates the operator contract in
 * schemata.mjs for the operators the grammar uses. Programs are sampled from
 * the enumerated grammar, and each structural state is constructed.
 */
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { declareOracle } from '../src/oracle-declaration.ts'
import { oracleProperty, pass, violation } from '../src/oracle-property.ts'
import { instrument } from './schemata.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ts = createRequire(join(here, `../package.json`))(`typescript`)

const LAW_1 = `every emitted mutant differs from the original on some input`
const LAW_2 = `every skipped site equals the original on every input`
const LAW_REFINE = `the mutant run agrees with the model`
const LAW_KNOWN = `every emitted mutant is a site of the grammar`
const LAW_INERT = `instrumentation with no mutant active is inert`

// ## Grammar
//
// A program is `function f(a, b, c)`. Its operands are variables or the
// literal 1; a comparison's operands are a pair of them, and each op is
// generated in both written orders.

const VARIABLES = [`a`, `b`, `c`]
const DOMAIN = [0, 1, 2].flatMap((a) =>
  [0, 1, 2].flatMap((b) => [0, 1, 2].map((c) => [a, b, c])),
)
const environment = ([a, b, c]) => ({ a, b, c })
const OPS = [`>`, `>=`, `<`, `<=`]
// `x op y` is the same test as `y reverse(op) x`.
const REVERSE = { '>': `<`, '>=': `<=`, '<': `>`, '<=': `>=` }
const ref = (name) => ({ kind: `ref`, name })
const ternary = (test, then, otherwise) => ({
  kind: `cond`,
  test,
  then,
  else: otherwise,
})

// The eight comparisons of two operands: four ops in two written orders.
function comparisonsOf(left, right) {
  return OPS.flatMap((op) => [
    { kind: `cmp`, left: ref(left), op, right: ref(right) },
    { kind: `cmp`, left: ref(right), op: REVERSE[op], right: ref(left) },
  ])
}

// The branches of a ternary or guard: the two operands in either order, or
// the variable that is not an operand with one of the operands, in either
// position. Each pair is unequal as written.
function branchesOf(test) {
  const [l, r] = [test.left, test.right]
  const others = VARIABLES.filter((v) => v !== l.name && v !== r.name).map(ref)
  return [
    [l, r],
    [r, l],
    ...others.flatMap((x) => [
      [x, l],
      [x, r],
      [l, x],
      [r, x],
    ]),
  ]
}

// Each program, once. A pair of operands is generated once, in both orders
// through `comparisonsOf`.
const programs = []
for (const [i, left] of VARIABLES.entries())
  for (const right of [...VARIABLES.slice(i + 1), `1`])
    for (const test of comparisonsOf(left, right)) {
      programs.push({ kind: `return`, expr: test })
      for (const [then, otherwise] of branchesOf(test)) {
        programs.push({
          kind: `return`,
          expr: ternary(test, then, otherwise),
        })
        programs.push({
          kind: `guard`,
          form: `return`,
          test,
          then,
          rest: otherwise,
        })
        programs.push({
          kind: `guard`,
          form: `else`,
          test,
          then,
          rest: otherwise,
        })
      }
    }
// A clamp: `a > c ? c : a < b ? b : a`, with each test in either order.
for (const outer of comparisonsOf(`a`, `c`))
  for (const inner of comparisonsOf(`a`, `b`))
    programs.push({
      kind: `return`,
      expr: ternary(outer, ref(`c`), ternary(inner, ref(`b`), ref(`a`))),
    })

// The structural states a program can enter. Each one has a constructed
// history below, so every campaign reaches it.
const STATES = [
  `a comparison used as a value`,
  `a clamp`,
  `a ternary whose branches are its operands`,
  `a ternary whose branches include a non-operand`,
  `a guard whose branches are its operands`,
  `a guard whose branches include a non-operand`,
  `a guard with else whose branches are its operands`,
  `a guard with else whose branches include a non-operand`,
]

function stateOf(program) {
  if (program.kind === `return` && program.expr.kind === `cmp`) return STATES[0]
  if (
    program.kind === `return` &&
    program.expr.kind === `cond` &&
    program.expr.else.kind === `cond`
  )
    return STATES[1]
  const test = program.kind === `guard` ? program.test : program.expr.test
  const [then, otherwise] =
    program.kind === `guard`
      ? [program.then, program.rest]
      : [program.expr.then, program.expr.else]
  const operands = new Set([test.left.name, test.right.name])
  const onOperands =
    operands.size === 2 &&
    operands.has(then.name) &&
    operands.has(otherwise.name)
  const shape =
    program.kind === `guard`
      ? program.form === `else`
        ? `a guard with else`
        : `a guard`
      : `a ternary`
  return `${shape} whose branches ${onOperands ? `are its operands` : `include a non-operand`}`
}

// The source of a program, and its mutation sites. A comparison's site is its
// operator token. An `if`'s sites are its condition's first character, as the
// instrumenter reports them. A change says what the mutant does.
function render(program) {
  let text = `function f(a, b, c) {\n  `
  const sites = []
  const put = (piece) => {
    text += piece
  }
  const expression = (expr) => {
    if (expr.kind === `ref`) return put(expr.name)
    if (expr.kind === `cond`) {
      expression(expr.test)
      put(` ? `)
      expression(expr.then)
      put(` : `)
      return expression(expr.else)
    }
    if (expr.kind === `cmp`) {
      expression(expr.left)
      put(` `)
      sites.push({
        operator: `binary-swap`,
        position: text.length,
        change: { kind: `flip`, node: expr },
      })
      put(`${expr.op} `)
      return expression(expr.right)
    }
    throw new Error(`unknown expression ${expr.kind}`)
  }
  if (program.kind === `return`) {
    put(`return `)
    expression(program.expr)
    put(`;\n}`)
  } else {
    put(`if (`)
    const at = text.length
    sites.push(
      {
        operator: `if-true`,
        position: at,
        change: { kind: `force`, node: program, taken: true },
      },
      {
        operator: `if-false`,
        position: at,
        change: { kind: `force`, node: program, taken: false },
      },
    )
    expression(program.test)
    put(`) return `)
    expression(program.then)
    put(program.form === `else` ? `;\n  else return ` : `;\n  return `)
    expression(program.rest)
    put(`;\n}`)
  }
  return { text, sites }
}

// ## Model
//
// The grammar's own semantics: a comparison's test, a ternary's branch, and a
// guard's branch, evaluated on one input. A change flips one comparison's op
// to its boundary partner, or forces one guard's condition.
const BOUNDARY = { '>': `>=`, '>=': `>`, '<': `<=`, '<=': `<` }
const compare = (x, op, y) =>
  op === `>` ? x > y : op === `>=` ? x >= y : op === `<` ? x < y : x <= y

function evaluate(program, env, change) {
  const value = (expr) => {
    if (expr.kind === `ref`)
      return /^[0-9]$/.test(expr.name) ? Number(expr.name) : env[expr.name]
    if (expr.kind === `cond`)
      return outcome(expr.test) ? value(expr.then) : value(expr.else)
    return outcome(expr)
  }
  const outcome = (cmp) => {
    const flipped = change?.kind === `flip` && change.node === cmp
    return compare(
      value(cmp.left),
      flipped ? BOUNDARY[cmp.op] : cmp.op,
      value(cmp.right),
    )
  }
  if (program.kind === `return`) return value(program.expr)
  const forced = change?.kind === `force` && change.node === program
  const taken = forced ? change.taken : outcome(program.test)
  return value(taken ? program.then : program.rest)
}

// The model's expectation for a program: its source, and for each site
// whether some input distinguishes its mutant from the original.
function model(program) {
  const { text, sites } = render(program)
  return {
    source: text,
    sites: sites.map((site) => ({
      operator: site.operator,
      position: site.position,
      distinct: DOMAIN.some((input) => {
        const env = environment(input)
        return !Object.is(
          evaluate(program, env, site.change),
          evaluate(program, env, null),
        )
      }),
    })),
  }
}

// ## Production driver
//
// The CLI's instrumenter on the rendered source. The switch restates the
// contract of schemata.mjs for the operators in the grammar: `m` marks a
// site, `cmp` forces a comparison's operator, and `cond` forces an `if`.
const load = (code) => new Function(`${code}\nreturn f`)()
const sameOutputs = (xs, ys) => xs.every((x, i) => Object.is(x, ys[i]))
function switchFor(active) {
  return {
    m: (id) => id === active,
    v: (value) => value,
    cmp: (id, a, b, op) => compare(a, id === active ? BOUNDARY[op] : op, b),
    not: (id, value) => (id === active ? value : !value),
    b: (id, value) => (id === active ? !value : value),
    cond: (ifTrue, ifFalse, value) =>
      active === ifTrue ? true : active === ifFalse ? false : value,
  }
}
function outputsUnder(code, active) {
  const previous = globalThis.__oracleGaps
  globalThis.__oracleGaps = switchFor(active)
  try {
    const f = load(code)
    return DOMAIN.map((input) => f(...input))
  } finally {
    globalThis.__oracleGaps = previous
  }
}

function driver(program, observe) {
  const { text } = render(program)
  const original = DOMAIN.map((input) => load(text)(...input))
  const { code, mutants } = instrument(
    ts,
    `mutant-validity.js`,
    text,
    `src/mutant-validity.js`,
  )
  const clean = sameOutputs(outputsUnder(code, null), original)
  const emitted = mutants.map((mutant) => ({
    operator: mutant.operator,
    position: mutant.position,
    differs: !sameOutputs(outputsUnder(code, mutant.number), original),
  }))
  observe(`instrumented`, { clean, emitted })
  observe(`reach`, stateOf(program))
}

// ## Comparison
const keyOf = (site) => `${site.operator}@${site.position}`

function check(program, observations, expected) {
  const found = observations.find((o) => o.checkpoint === `instrumented`)?.value
  if (!found)
    return violation(`instrumented`, `nothing was instrumented`, LAW_INERT)
  if (!found.clean)
    return violation(
      `instrumented`,
      `with no mutant active, the instrumented function differs from its source ${JSON.stringify(expected.source)}`,
      LAW_INERT,
    )
  const emitted = new Map(found.emitted.map((e) => [keyOf(e), e]))
  for (const site of expected.sites) {
    const where = `${site.operator} at offset ${site.position} of ${JSON.stringify(expected.source)}`
    const mutant = emitted.get(keyOf(site))
    if (mutant) {
      if (!site.distinct)
        return violation(
          `instrumented`,
          `emitted ${where} equals the original on every input`,
          LAW_1,
        )
      if (!mutant.differs)
        return violation(
          `instrumented`,
          `emitted ${where}: its run matches the original on every input, but the model finds an input that distinguishes it`,
          LAW_REFINE,
        )
    } else if (site.distinct) {
      return violation(
        `instrumented`,
        `skipped ${where}, but the model finds an input that distinguishes it`,
        LAW_2,
      )
    }
  }
  const known = new Set(expected.sites.map(keyOf))
  const stray = found.emitted.find((e) => !known.has(keyOf(e)))
  if (stray)
    return violation(
      `instrumented`,
      `emitted ${stray.operator} at offset ${stray.position}, which is no site of ${JSON.stringify(expected.source)}`,
      LAW_KNOWN,
    )
  return pass
}

declareOracle({
  check: [check],
  model: [model],
  grammar: [fc.constantFrom(...programs)],
})

// Two calibrations, each a wrong answer the check must reject. One hides a
// distinguishable swap; the other keeps an undistinguishable one.
const calibrations = [
  {
    name: `a distinguishable swap is left out of the emitted mutants`,
    law: LAW_2,
    corrupt: (trace, program) => {
      const index = trace.findIndex((o) => o.checkpoint === `instrumented`)
      if (index < 0) return undefined
      const { value } = trace[index]
      const { sites } = model(program)
      const at = value.emitted.findIndex((e) =>
        sites.some((s) => s.distinct && keyOf(s) === keyOf(e)),
      )
      if (at < 0) return undefined
      const emitted = value.emitted.filter((_, i) => i !== at)
      return trace.map((o, i) =>
        i === index ? { ...o, value: { ...value, emitted } } : o,
      )
    },
  },
  {
    name: `an undistinguishable swap is kept as an emitted mutant`,
    law: LAW_1,
    corrupt: (trace, program) => {
      const index = trace.findIndex((o) => o.checkpoint === `instrumented`)
      if (index < 0) return undefined
      const { value } = trace[index]
      const { sites } = model(program)
      const site = sites.find(
        (s) =>
          !s.distinct &&
          s.operator === `binary-swap` &&
          !value.emitted.some((e) => keyOf(e) === keyOf(s)),
      )
      if (!site) return undefined
      const emitted = [
        ...value.emitted,
        { operator: site.operator, position: site.position, differs: true },
      ]
      return trace.map((o, i) =>
        i === index ? { ...o, value: { ...value, emitted } } : o,
      )
    },
  },
]

// One constructed history per structural state: the first program of the
// grammar that enters it.
const constructed = STATES.map((state) => {
  const program = programs.find((p) => stateOf(p) === state)
  if (!program) throw new Error(`no program enters "${state}"`)
  return { name: state, enters: [state], build: () => program }
})

oracleProperty({
  id: `oracle-gaps.report-mutant-validity`,
  law: {
    statement: `The gap report never emits a mutant that no input distinguishes from its original, and skips no comparison swap that some input distinguishes. Over the domain {0,1,2}^3, every emitted mutant of a grammar program differs from the program on some input (law 1), and every site the instrumenter skips equals the program on every input (law 2).`,
    authority: `The frozen design v20's maintainer decision of 2026-11-10 that anything an oracle can't possibly detect is an invalid mutant (freeze.md, "Undetectable mutants are invalid"), and its decision 5, that an equivalent is a framework bug and not an answer. The boundary-swap skip rule is the first instance the design names: a swap whose two branches yield the two compared operands.`,
    limits: `Integer inputs in {0,1,2}^3 only; signed zero, NaN, and mixed-type operands are outside the domain, where the skip is not sound (see the file's header). The grammar covers comparisons of variables and the literal 1 in ternaries, guards, guards with else, comparisons as values, and clamps, with branches that are the operands or the third variable. A literal branch other than the operand 1 is not generated: on {0,1,2}^3 it can make an if-false mutant equal the original on every input although the integers distinguish it (\`if (a > 1) return 2; return a\`, at a = 3), so a wider domain is a maintainer decision. Branches that agree, arithmetic with a zero operand, logical and nullish operators, and \`!\` are not generated, and are open families. Skipped swaps are judged by the model, not by a run of the emitter. Programs are sampled from the enumerated grammar.`,
    owner: `packages/oracles/oracle-gaps`,
  },
  histories: {
    arbitrary: fc.constantFrom(...programs),
    states: STATES,
    runs: 400,
    fixedSeeds: [20261110],
    constructed,
  },
  model,
  driver,
  check,
  calibrations,
  timeout: 120_000,
})
