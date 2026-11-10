/**
 * # The gap report's mutants are judged over the framework's data domain
 *
 * Law 1: every emitted mutant that is not marked dead code differs from the
 * original function on some input. Law 2: every site that the instrumenter
 * skips equals the original on every input. Dead code: a site is marked dead
 * code exactly when no input distinguishes it, and no site is skipped as
 * undetectable: an undetectable site is dead code, not a skip. Boundary: the
 * boundary evidence appears exactly on an ordering swap whose two branches
 * yield its two compared operands; it is a hint for the report, and the
 * mutant stays.
 *
 * Authority: the frozen design v20's decision of 2026-11-10, "anything an
 * oracle can't possibly detect is an invalid mutant" (freeze.md, "Undetectable
 * mutants are invalid"), and its decision 5, that a reported equivalent is a
 * framework bug and not an answer. The domain is the framework's data domain
 * (maintainer, 2026-11-10, relayed by the coordinator): signed zero counts
 * apart from zero, NaN is a value, and a string compares with coercion beside
 * the number of its digits. A skip that the integers alone would justify is
 * unsound on that domain, so no skip is made.
 *
 * Domain. Each program is one function `f(a, b, c)` run on every input in
 * VALUES^3, where VALUES is 0, -0, 1, 2, NaN, '1', '2'. Two functions are equal
 * when they return `Object.is`-equal values on all 343 inputs. A site is
 * distinguishable when some input separates the mutant from the original.
 *
 * Grammar. A program's body is one of: a comparison returned as a value; a
 * ternary; a guard, `if (C) return T; return F;` or the same with an `else`;
 * a clamp, a ternary whose false branch is another ternary; or a logical
 * operator, `return X op Y` with `op` one of `&&`, `||`, `??`. A comparison is
 * of two operands, each a variable or the literal 1, in either written order
 * (`a > b` and `b < a` are both generated). A ternary's or guard's branches
 * are the two compared operands in either order, the variable that is not an
 * operand with one of them, or the same variable twice. A literal branch other
 * than the operand 1 is not generated: on the small integers alone it can make
 * an if-false mutant equal the original, although a larger value distinguishes
 * it (`if (a > 1) return 2; return a`, at a = 3). The domain above has 3 and
 * the strings, but a larger literal is still left out.
 *
 * Model. The model interprets the grammar on each input. A mutant is a change
 * to the program: a comparison's operator swapped to its boundary partner
 * (`>` with `>=`, `<` with `<=`), a logical operator swapped to its partner
 * (`&&` with `||`, `??` with `&&`), or an `if`'s condition forced to true or
 * to false. The model reads the grammar's own rendered text and its sites,
 * never the instrumenter's text, and it evaluates programs directly.
 *
 * Production path. The CLI's `instrument` (schemata.mjs) instruments the
 * rendered text. The driver runs the instrumented function with no mutant
 * active, which must equal the original, and then with each emitted mutant
 * active, recording whether its outputs differ from the original's and the
 * evidence the instrumenter tags on it.
 *
 * Observations. `instrumented` reports the clean run's result and, for each
 * emitted mutant, its operator, position, whether it differs, and its evidence.
 * `reach` reports the structural state of the program.
 *
 * Comparison, for each site the model names. An emitted site that is not dead
 * code must be distinguishable in the model and in its run (law 1). A site
 * marked dead code must be indistinguishable in the model (dead-code law). A
 * site that is not emitted must equal the original on every input (law 2), and
 * an indistinguishable one must be marked dead code, not skipped. The boundary
 * evidence must appear exactly where the model says (boundary law). Each
 * emitted mutant must be a site of the grammar.
 *
 * Limits. The domain is finite and the grammar is small: a property read, a
 * call, a getter, equal branches with a non-operand expression (`a + 0`), and
 * the equality operators are not generated. Dead code is judged for the grammar
 * programs only. A skipped site is judged by the model, not by any run of the
 * emitter. The switch below restates the operator contract in schemata.mjs for
 * the operators the grammar uses. Programs are sampled from the enumerated
 * grammar, and each structural state is constructed.
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

const LAW_1 = `every emitted mutant that is not dead code differs from the original on some input`
const LAW_2 = `every skipped site equals the original on every input`
const LAW_DEAD = `a site is marked dead code exactly when no input distinguishes it`
const LAW_BOUNDARY = `the boundary evidence appears exactly on an ordering swap whose branches yield its operands`
const LAW_REFINE = `the mutant run agrees with the model`
const LAW_KNOWN = `every emitted mutant is a site of the grammar`
const LAW_INERT = `instrumentation with no mutant active is inert`

// ## Grammar
//
// A program is `function f(a, b, c)`. Its operands are variables or the
// literal 1; a comparison's operands are a pair of them, and each op is
// generated in both written orders.

const VARIABLES = [`a`, `b`, `c`]
const VALUES = [0, -0, 1, 2, NaN, `1`, `2`]
const DOMAIN = VALUES.flatMap((a) =>
  VALUES.flatMap((b) => VALUES.map((c) => [a, b, c])),
)
const environment = ([a, b, c]) => ({ a, b, c })
const OPS = [`>`, `>=`, `<`, `<=`]
const ORDERING = new Set(OPS)
const LOGICAL = [`&&`, `||`, `??`]
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

// The branches of a ternary or guard: the two operands in either order, the
// variable that is not an operand with one of the operands in either position,
// and the same variable twice (dead code, judged by the model).
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
    ...VARIABLES.map((v) => [ref(v), ref(v)]),
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
// A logical operator on two variables, the same variable twice included.
for (const left of VARIABLES)
  for (const right of VARIABLES)
    for (const op of LOGICAL)
      programs.push({
        kind: `return`,
        expr: { kind: `logic`, left: ref(left), op, right: ref(right) },
      })

// The structural states a program can enter. Each one has a constructed
// history below, so every campaign reaches it.
const STATES = [
  `a comparison used as a value`,
  `a clamp`,
  `a ternary whose branches are its operands`,
  `a ternary whose branches include a non-operand`,
  `a ternary whose branches are identical`,
  `a guard whose branches are its operands`,
  `a guard whose branches include a non-operand`,
  `a guard whose branches are identical`,
  `a guard with else whose branches are its operands`,
  `a guard with else whose branches include a non-operand`,
  `a guard with else whose branches are identical`,
  `a logical operator on one variable twice`,
  `a logical operator on two variables`,
]

function stateOf(program) {
  if (program.kind === `return` && program.expr.kind === `cmp`) return STATES[0]
  if (program.kind === `return` && program.expr.kind === `logic`)
    return program.expr.left.name === program.expr.right.name
      ? STATES[11]
      : STATES[12]
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
  const shape =
    program.kind === `guard`
      ? program.form === `else`
        ? `a guard with else`
        : `a guard`
      : `a ternary`
  if (then.name === otherwise.name)
    return `${shape} whose branches are identical`
  const operands = new Set([test.left.name, test.right.name])
  const onOperands =
    operands.size === 2 &&
    operands.has(then.name) &&
    operands.has(otherwise.name)
  return `${shape} whose branches ${onOperands ? `are its operands` : `include a non-operand`}`
}

// The source of a program, and its mutation sites. A comparison's or logical
// operator's site is its operator token. An `if`'s sites are its condition's
// first character, as the instrumenter reports them. A change says what the
// mutant does.
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
    if (expr.kind === `cmp` || expr.kind === `logic`) {
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
// The grammar's own semantics: a comparison's test, a ternary's branch, a
// guard's branch, and a logical operator, evaluated on one input. A change
// flips one comparison's or logical operator to its boundary partner, or forces
// one guard's condition.
const BOUNDARY = { '>': `>=`, '>=': `>`, '<': `<=`, '<=': `<` }
const LOGIC_PARTNER = { '&&': `||`, '||': `&&`, '??': `&&` }
const compare = (x, op, y) =>
  op === `>` ? x > y : op === `>=` ? x >= y : op === `<` ? x < y : x <= y

function evaluate(program, env, change) {
  const value = (expr) => {
    if (expr.kind === `ref`)
      return /^[0-9]$/.test(expr.name) ? Number(expr.name) : env[expr.name]
    if (expr.kind === `cond`)
      return outcome(expr.test) ? value(expr.then) : value(expr.else)
    if (expr.kind === `logic`) {
      const flipped = change?.kind === `flip` && change.node === expr
      const op = flipped ? LOGIC_PARTNER[expr.op] : expr.op
      const [x, y] = [value(expr.left), value(expr.right)]
      return op === `&&` ? x && y : op === `||` ? x || y : (x ?? y)
    }
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

// The tests that decide a branch, with their two values, in the program.
function decisionsOf(program) {
  const found = []
  const visit = (expr) => {
    if (expr.kind !== `cond`) return
    found.push({ test: expr.test, branches: [expr.then, expr.else] })
    visit(expr.then)
    visit(expr.else)
  }
  if (program.kind === `guard`)
    found.push({ test: program.test, branches: [program.then, program.rest] })
  else visit(program.expr)
  return found
}

// Whether a site's ordering swap has branches that are the two compared
// operands, one each: the boundary evidence's shape.
function boundaryOf(program, node) {
  if (node.kind !== `cmp` || !ORDERING.has(node.op)) return false
  return decisionsOf(program).some(({ test, branches }) => {
    if (test !== node || branches.some((b) => b.kind !== `ref`)) return false
    const yielded = branches
      .map((b) => b.name)
      .sort()
      .join()
    return yielded === [test.left.name, test.right.name].sort().join()
  })
}

// The model's expectation for a program: its source, and for each site
// whether some input distinguishes its mutant from the original, and whether
// the boundary evidence is owed.
function model(program) {
  const { text, sites } = render(program)
  return {
    source: text,
    sites: sites.map((site) => {
      const distinct = DOMAIN.some((input) => {
        const env = environment(input)
        return !Object.is(
          evaluate(program, env, site.change),
          evaluate(program, env, null),
        )
      })
      return {
        operator: site.operator,
        position: site.position,
        distinct,
        dead: !distinct,
        boundary:
          site.change.kind === `flip` && boundaryOf(program, site.change.node),
      }
    }),
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
    evidence: mutant.evidence,
  }))
  observe(`instrumented`, { clean, emitted })
  observe(`reach`, stateOf(program))
}

// ## Comparison
const keyOf = (site) => `${site.operator}@${site.position}`
const DEAD = `dead code`
const BOUNDARY_EVIDENCE = `boundary: -0`

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
    if (!mutant) {
      if (!site.distinct)
        return violation(
          `instrumented`,
          `skipped ${where}, which no input distinguishes: it is dead code, not a skip`,
          LAW_DEAD,
        )
      return violation(
        `instrumented`,
        `skipped ${where}, but the model finds an input that distinguishes it`,
        LAW_2,
      )
    }
    const marked = mutant.evidence === DEAD
    if (!marked && !site.distinct)
      return violation(
        `instrumented`,
        `emitted ${where}, which equals the original on every input, and is not marked dead code`,
        LAW_1,
      )
    if (marked && site.distinct)
      return violation(
        `instrumented`,
        `marked dead code ${where}, but the model finds an input that distinguishes it`,
        LAW_DEAD,
      )
    if (!marked && !mutant.differs)
      return violation(
        `instrumented`,
        `emitted ${where}: its run matches the original on every input, but the model finds an input that distinguishes it`,
        LAW_REFINE,
      )
    const tagged = mutant.evidence === BOUNDARY_EVIDENCE
    if (tagged !== site.boundary)
      return violation(
        `instrumented`,
        `${tagged ? `tags` : `does not tag`} ${where} as boundary evidence, owed ${site.boundary ? `yes` : `no`}`,
        LAW_BOUNDARY,
      )
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

// Four calibrations, each a wrong answer the check must reject: a
// distinguishable swap hidden; an undistinguishable mutant not marked dead;
// a distinguishable mutant marked dead; boundary evidence missing.
const withEmitted = (trace, index, value, emitted) =>
  trace.map((o, i) =>
    i === index ? { ...o, value: { ...value, emitted } } : o,
  )
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
      return withEmitted(
        trace,
        index,
        value,
        value.emitted.filter((_, i) => i !== at),
      )
    },
  },
  {
    name: `an undistinguishable mutant is emitted without the dead-code mark`,
    law: LAW_1,
    corrupt: (trace, program) => {
      const index = trace.findIndex((o) => o.checkpoint === `instrumented`)
      if (index < 0) return undefined
      const { value } = trace[index]
      const { sites } = model(program)
      const at = value.emitted.findIndex((e) =>
        sites.some((s) => s.dead && keyOf(s) === keyOf(e)),
      )
      if (at < 0) return undefined
      const emitted = value.emitted.map((e, i) =>
        i === at ? { ...e, evidence: undefined } : e,
      )
      return withEmitted(trace, index, value, emitted)
    },
  },
  {
    name: `a distinguishable mutant is marked dead code`,
    law: LAW_DEAD,
    corrupt: (trace, program) => {
      const index = trace.findIndex((o) => o.checkpoint === `instrumented`)
      if (index < 0) return undefined
      const { value } = trace[index]
      const { sites } = model(program)
      const at = value.emitted.findIndex((e) =>
        sites.some((s) => s.distinct && !s.boundary && keyOf(s) === keyOf(e)),
      )
      if (at < 0) return undefined
      const emitted = value.emitted.map((e, i) =>
        i === at ? { ...e, evidence: DEAD } : e,
      )
      return withEmitted(trace, index, value, emitted)
    },
  },
  {
    name: `the boundary evidence is missing from an operand swap`,
    law: LAW_BOUNDARY,
    corrupt: (trace, program) => {
      const index = trace.findIndex((o) => o.checkpoint === `instrumented`)
      if (index < 0) return undefined
      const { value } = trace[index]
      const { sites } = model(program)
      const at = value.emitted.findIndex((e) =>
        sites.some((s) => s.boundary && keyOf(s) === keyOf(e)),
      )
      if (at < 0) return undefined
      const emitted = value.emitted.map((e, i) =>
        i === at ? { ...e, evidence: undefined } : e,
      )
      return withEmitted(trace, index, value, emitted)
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
    statement: `Over the framework's data domain (0, -0, 1, 2, NaN, and the strings '1' and '2' in three variables), every emitted mutant of a grammar program that is not marked dead code differs from the program on some input (law 1). Every site the instrumenter skips equals the program on every input (law 2). A site is marked dead code exactly when no input distinguishes it, and no site is skipped as undetectable (dead-code law). The boundary evidence appears exactly on an ordering swap whose two branches yield its two compared operands.`,
    authority: `The frozen design v20's maintainer decision of 2026-11-10 that anything an oracle can't possibly detect is an invalid mutant (freeze.md, "Undetectable mutants are invalid"), and its decision 5, that an equivalent is a framework bug and not an answer. The domain is the framework's data domain, which counts -0 apart from 0 and compares strings with coercion (maintainer, 2026-11-10, relayed by the coordinator). The dead-code and boundary evidence are the coordinator's revision of that decision.`,
    limits: `A finite domain of seven values per variable, and a small grammar: no property reads, calls, getters, equality operators, or equal branches with a non-operand expression (for example \`a + 0\`). Literal branches other than the operand 1 are not generated. Dead code is judged for grammar programs only. A skipped site is judged by the model, not by a run of the emitter. Programs are sampled from the enumerated grammar.`,
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
