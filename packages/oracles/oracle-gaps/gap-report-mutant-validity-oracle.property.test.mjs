/**
 * # The gap report's mutants are judged over the framework's data domain
 *
 * Law 1: every emitted mutant that is not marked dead code differs from the
 * original function on some input. Law 2: every site that the instrumenter
 * skips equals the original on every input. Dead code: a site is marked dead
 * code exactly when no input distinguishes it, and no site is skipped as
 * undetectable: an undetectable site is dead code, not a skip. Boundary: a
 * site marked `boundary: -0` is distinguished by a history of 0 and -0 alone,
 * so the hint's claim holds. A distinguishable site need not carry the hint.
 * Refinement: every emitted mutant's run, dead-marked or not, agrees with the
 * model.
 *
 * Authority: the frozen design v20's decision of 2026-11-10, "anything an
 * oracle can't possibly detect is an invalid mutant" (freeze.md, "Undetectable
 * mutants are invalid"), and its decision 5, that a reported equivalent is a
 * framework bug and not an answer. The domain is the framework's data domain
 * (maintainer, 2026-11-10, relayed by the coordinator): signed zero counts
 * apart from zero, NaN is a value, and a string compares with coercion beside
 * a number of the same digits. A skip that the integers alone would justify is
 * unsound on that domain, so no site is skipped. The dead-code and boundary
 * evidence follow the coordinator's revision and the review of PR #8.
 *
 * Domain. Each program is one function `f(a: T, b: T, c: T)`, where T is one
 * of three declared types: `number`, `bigint`, or `string | number`. The
 * admitted domain of a type is the values it admits, in every combination of
 * three parameters: number admits -1, 0, -0, 1, 2, and NaN; bigint admits -1n,
 * 0n, 1n, and 2n (no signed zero); `string | number` admits those numbers and
 * the strings '1' and '2'. A program may also read the free name `g`, a global
 * whose getter counts its reads. Two functions are equal when they return
 * `Object.is`-equal values on every admitted input and make the same reads. A
 * site is distinguishable when some admitted input separates the mutant from
 * the original. The grammar is enumerated at every type: each shape is one
 * history per type.
 *
 * Grammar. A program is one of: a comparison (of two operands, a variable or
 * the literal 0 or 1, in either written order, with each of `>`, `>=`, `<`,
 * `<=`, `===`, `!==`) returned as a value; a comparison of one variable with
 * itself; a logical operator (`&&`, `||`, `??`) on two variables, on one
 * variable twice, or on the global `g` twice; a clamp, a ternary whose false
 * branch is another ternary; or a ternary or a guard (`if (C) return T; return
 * F;`, or the same with an `else`). A test is a comparison, a negated
 * comparison, or a logical operator with a comparison and a variable. A
 * ternary's or guard's branches are the two compared operands in either order,
 * the variable that is not an operand with one of them, the same variable
 * twice, or an empty return. The grammar is enumerated: every program is one
 * history of the oracle.
 *
 * Model. The model interprets the grammar on each input, with JavaScript's
 * short-circuit order and reads of `g`. A mutant is a change to the program: a
 * comparison's operator swapped to its partner (`>` with `>=`, `<` with `<=`,
 * `===` with `!==`), a logical operator swapped to its partner (`&&` with `||`,
 * `??` with `&&`), a negation dropped, or an `if`'s condition forced to true or
 * to false. The model reads the grammar's own rendered text and its sites,
 * never the instrumenter's text.
 *
 * Production path. The CLI's `instrument` (schemata.mjs) instruments the
 * rendered text. The driver runs the instrumented function with no mutant
 * active, which must equal the original, and then with each emitted mutant
 * active, recording whether its outputs and reads differ from the original's,
 * and the evidence the instrumenter tags on it.
 *
 * Observations. `instrumented` reports the clean run's result and, for each
 * emitted mutant, its operator, position, whether its run differs, and its
 * evidence.
 *
 * Comparison, for each site the model names. An emitted site that is not dead
 * code must be distinguishable in the model (law 1). A site marked dead code
 * must be indistinguishable in the model (dead-code law). A site that is not
 * emitted must equal the original on every input (law 2), and an
 * indistinguishable one must be marked dead code, not skipped. Every emitted
 * mutant's run must agree with the model (refinement). A boundary hint must sit
 * on a site that a history of 0 and -0 distinguishes (boundary law). Each
 * emitted mutant must be a site of the grammar.
 *
 * Limits. The domain is finite: the admitted values of each type, three
 * parameters, and one free name. A clamp at type bigint is left out: its outer swap is undetectable over bigint, because at a tie the inner ternary returns the same value (witness: `function f(a: bigint, b: bigint, c: bigint) { return a > c ? c : a === b ? b : a; }`, the swap at offset 57). No syntactic rule decides that, so it is an open family for the maintainer. The grammar has no property reads, calls,
 * getters beyond `g`, or equal branches with a non-operand expression (`a +
 * 0`). Dead code is judged for grammar programs only, and the production rule
 * requires a pure condition (local names, literals, comparisons, logical
 * operators, `!`), so a site whose condition calls a function is left untagged.
 * Logical operators on literals (`1 && 1`) are not tagged. The boundary hint
 * is one-directional: it claims that a signed zero distinguishes the mutant. It
 * is given only to a number-typed ordering swap at a top-level test whose tie
 * can be zero (both operands variables, or the literal 0). A string-admitting or
 * untyped operand gets no hint: the mutant is valid, and strings distinguish it.
 * An ordering swap with a nonzero literal tie over `number` operands, or over
 * `bigint` operands, is skipped: no admitted input distinguishes it. The
 * parameter type is read from its annotation in schemata.mjs, because
 * `instrument` takes the text alone; the checker's program belongs to the
 * caller. A skipped site is judged by the model, not by a run of the emitter.
 * The switch below restates the operator contract in schemata.mjs. No shared
 * helper exists for it: gap-report-static-oracle.property.test.mjs keeps its
 * own copy for derived classes, so this copy stays here, and both restate the
 * same contract.
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
const LAW_BOUNDARY = `a boundary hint sits only on a site that a 0 and -0 history distinguishes`
const LAW_REFINE = `the mutant run agrees with the model`
const LAW_KNOWN = `every emitted mutant is a site of the grammar`
const LAW_INERT = `instrumentation with no mutant active is inert`

// ## Grammar
//
// A program is `function f(a, b, c)`. Its operands are variables, the literals
// 0 and 1, and the free global `g`.

const VARIABLES = [`a`, `b`, `c`]
const FREE = `g`
// The three types a parameter can declare, and the values each admits. A
// bigint has no signed zero and no NaN; a `string | number` admits strings.
const TYPES = [`number`, `bigint`, `mixed`]
const ANNOTATION = {
  number: `number`,
  bigint: `bigint`,
  mixed: `string | number`,
}
const VALUES = {
  number: [-1, 0, -0, 1, 2, NaN],
  bigint: [-1n, 0n, 1n, 2n],
  mixed: [-1, 0, -0, 1, 2, NaN, `1`, `2`],
}
const cube = (values) =>
  values.flatMap((a) => values.flatMap((b) => values.map((c) => [a, b, c])))
const DOMAIN = Object.fromEntries(TYPES.map((t) => [t, cube(VALUES[t])]))
// The inputs that hold only zeros, with their signs; a bigint has none.
const ZERO_DOMAIN = Object.fromEntries(
  TYPES.map((t) => [t, t === `bigint` ? [] : cube([0, -0])]),
)
// A literal operand in a program of a type: `1` is `1n` for a bigint.
const literal = (name, type) =>
  type === `bigint` && /^[01]$/.test(name) ? `${name}n` : name
const ORDERING = [`>`, `>=`, `<`, `<=`]
const OPS = [...ORDERING, `===`, `!==`]
const LOGICAL = [`&&`, `||`, `??`]
// `x op y` is the same test as `y reverse(op) x`.
const REVERSE = {
  '>': `<`,
  '>=': `<=`,
  '<': `>`,
  '<=': `>=`,
  '===': `===`,
  '!==': `!==`,
}
// The partner a mutation swaps in: the boundary of an ordering test, or the
// other equality, and the other logical operator.
const BOUNDARY = {
  '>': `>=`,
  '>=': `>`,
  '<': `<=`,
  '<=': `<`,
  '===': `!==`,
  '!==': `===`,
}
const LOGIC_PARTNER = { '&&': `||`, '||': `&&`, '??': `&&` }
const ref = (name) => ({ kind: `ref`, name })
const ternary = (test, then, otherwise) => ({
  kind: `cond`,
  test,
  then,
  else: otherwise,
})
const VOID = { kind: `void` }
const negation = (operand) => ({ kind: `not`, operand })
const logic = (op, left, right) => ({ kind: `logic`, op, left, right })

// The twelve comparisons of two operands, each op in both written orders.
function comparisonsOf(left, right) {
  return OPS.flatMap((op) => [
    { kind: `cmp`, left: ref(left), op, right: ref(right) },
    { kind: `cmp`, left: ref(right), op: REVERSE[op], right: ref(left) },
  ])
}

// Every pair of variables, and each variable with the literals 0 and 1. A pair
// is generated once, in both orders through `comparisonsOf`.
const pairs = []
for (const [i, left] of VARIABLES.entries())
  for (const right of [...VARIABLES.slice(i + 1), `1`, `0`])
    pairs.push([left, right])
const tests = pairs.flatMap(([left, right]) => comparisonsOf(left, right))

// The comparison a test is built on.
const comparisonOf = (test) =>
  test.kind === `cmp`
    ? test
    : test.kind === `not`
      ? test.operand
      : test.left.kind === `cmp`
        ? test.left
        : test.right

// A test built on a comparison: its negation, and the comparison with a
// variable that is not one of its operands, in either order.
const compoundsOf = (cmp) => {
  const other = VARIABLES.find(
    (v) => v !== cmp.left.name && v !== cmp.right.name,
  )
  return [
    negation(cmp),
    logic(`&&`, cmp, ref(other)),
    logic(`||`, ref(other), cmp),
  ]
}
const compounds = tests.flatMap(compoundsOf)

// The branches of a ternary or guard on a comparison: the two operands in
// either order, the variable that is not an operand with one of them in either
// position, and the same variable twice.
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
// The branches of a guard that returns nothing on one side or both.
const EMPTY_BRANCHES = [
  ...VARIABLES.flatMap((v) => [
    [VOID, ref(v)],
    [ref(v), VOID],
  ]),
  [VOID, VOID],
]
// The branches of a compound test: its comparison's operands in either order,
// and one variable twice.
const compoundBranches = (test) => {
  const cmp = comparisonOf(test)
  return [
    [cmp.left, cmp.right],
    [cmp.right, cmp.left],
    ...VARIABLES.map((v) => [ref(v), ref(v)]),
  ]
}

const shapes = []
// A ternary, a guard, and a guard with `else` for each branch pair. A ternary
// cannot return nothing, so only guards take an empty branch.
const branched = (test, branches) => {
  for (const [then, otherwise] of branches) {
    if (then.kind !== `void` && otherwise.kind !== `void`)
      shapes.push({ kind: `return`, expr: ternary(test, then, otherwise) })
    shapes.push({
      kind: `guard`,
      form: `return`,
      test,
      then,
      rest: otherwise,
    })
    shapes.push({ kind: `guard`, form: `else`, test, then, rest: otherwise })
  }
}
for (const test of tests) {
  shapes.push({ kind: `return`, expr: test })
  branched(test, [...branchesOf(test), ...EMPTY_BRANCHES])
}
for (const test of compounds) branched(test, compoundBranches(test))
// Same-variable comparisons, returned as values.
for (const v of VARIABLES)
  for (const op of OPS)
    shapes.push({
      kind: `return`,
      expr: { kind: `cmp`, left: ref(v), op, right: ref(v) },
    })
// Logical operators: two variables, one variable twice, and the free global.
for (const left of VARIABLES)
  for (const right of VARIABLES)
    for (const op of LOGICAL)
      shapes.push({ kind: `return`, expr: logic(op, ref(left), ref(right)) })
for (const op of LOGICAL)
  shapes.push({ kind: `return`, expr: logic(op, ref(FREE), ref(FREE)) })
// A clamp: `a > c ? c : a < b ? b : a`, with each test in either order.
for (const outer of comparisonsOf(`a`, `c`))
  for (const inner of comparisonsOf(`a`, `b`))
    shapes.push({
      kind: `return`,
      expr: ternary(outer, ref(`c`), ternary(inner, ref(`b`), ref(`a`))),
    })

// Every shape at each parameter type: the history of the oracle.
// A clamp at type bigint is left out, and is an open family (see the limits):
// at a tie of the outer test, the inner ternary's value is the same as the
// operand's, so the outer swap is undetectable over bigint without a semantic
// argument that no syntactic rule here makes.
const isClamp = (shape) =>
  shape.kind === `return` &&
  shape.expr.kind === `cond` &&
  shape.expr.else.kind === `cond`
const programs = shapes.flatMap((shape) =>
  TYPES.filter((type) => !(type === `bigint` && isClamp(shape))).map(
    (type) => ({
      ...shape,
      type,
    }),
  ),
)

// The structural state a program enters, derived from the grammar.
function stateOf(program) {
  if (program.kind === `return`) {
    const expr = program.expr
    if (expr.kind === `cmp`)
      return expr.left.name === expr.right.name
        ? `a comparison of a variable with itself`
        : `a comparison used as a value`
    if (expr.kind === `logic`) {
      if (expr.left.name === FREE) return `a logical operator on the global`
      return expr.left.name === expr.right.name
        ? `a logical operator on one variable twice`
        : `a logical operator on two variables`
    }
    if (expr.else.kind === `cond`) return `a clamp`
  }
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
  const testClass =
    test.kind === `cmp`
      ? `a comparison`
      : test.kind === `not`
        ? `a negated comparison`
        : `a compound comparison`
  let branchClass
  if (then.kind === `void` || otherwise.kind === `void`)
    branchClass = `includes an empty return`
  else if (then.name === otherwise.name) branchClass = `has identical branches`
  else if (
    test.kind === `cmp` &&
    [then.name, otherwise.name].sort().join() ===
      [test.left.name, test.right.name].sort().join()
  )
    branchClass = `has its operands as branches`
  else branchClass = `has a non-operand branch`
  return `${shape} on ${testClass} that ${branchClass}`
}
// The source of a program, and its mutation sites. An operator's site is its
// token. An `if`'s sites are its condition's first character, as the
// instrumenter reports them. A change says what the mutant does.
function render(program) {
  const annotation = ANNOTATION[program.type]
  let text = `function f(a: ${annotation}, b: ${annotation}, c: ${annotation}) {\n  `
  const sites = []
  const put = (piece) => {
    text += piece
  }
  const expression = (expr) => {
    if (expr.kind === `ref`) return put(literal(expr.name, program.type))
    if (expr.kind === `void`) return undefined
    if (expr.kind === `cond`) {
      expression(expr.test)
      put(` ? `)
      expression(expr.then)
      put(` : `)
      return expression(expr.else)
    }
    if (expr.kind === `not`) {
      sites.push({
        operator: `drop-not`,
        position: text.length,
        change: { kind: `drop`, node: expr },
      })
      put(`!`)
      return operand(expr.operand)
    }
    if (expr.kind === `cmp` || expr.kind === `logic`) {
      operand(expr.left)
      put(` `)
      sites.push({
        operator: `binary-swap`,
        position: text.length,
        change: { kind: `flip`, node: expr },
      })
      put(`${expr.op} `)
      return operand(expr.right)
    }
    throw new Error(`unknown expression ${expr.kind}`)
  }
  // An operand of a negation or a binary: parenthesised unless it is a name.
  const operand = (expr) => {
    if (expr.kind === `ref`) return put(literal(expr.name, program.type))
    put(`(`)
    expression(expr)
    put(`)`)
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
// The grammar's own semantics on one input, with JavaScript's short-circuit
// order and the reads of `g`. A change flips one comparison's or logical
// operator to its partner, drops one negation, or forces one guard's condition.
const COMPARE = {
  '>': (x, y) => x > y,
  '>=': (x, y) => x >= y,
  '<': (x, y) => x < y,
  '<=': (x, y) => x <= y,
  '===': (x, y) => x === y,
  '!==': (x, y) => x !== y,
}

function evaluate(program, input, change) {
  const env = { a: input[0], b: input[1], c: input[2] }
  let reads = 0
  const flipped = (node) => change?.kind === `flip` && change.node === node
  const value = (expr) => {
    if (expr.kind === `ref`) {
      if (expr.name === FREE) return ++reads
      if (/^[01]$/.test(expr.name))
        return program.type === `bigint` ? BigInt(expr.name) : Number(expr.name)
      return env[expr.name]
    }
    if (expr.kind === `void`) return undefined
    if (expr.kind === `cond`)
      return value(expr.test) ? value(expr.then) : value(expr.else)
    if (expr.kind === `not`) {
      const dropped = change?.kind === `drop` && change.node === expr
      return dropped ? value(expr.operand) : !value(expr.operand)
    }
    if (expr.kind === `logic`) {
      const op = flipped(expr) ? LOGIC_PARTNER[expr.op] : expr.op
      const left = value(expr.left)
      if (op === `&&`) return left ? value(expr.right) : left
      if (op === `||`) return left ? left : value(expr.right)
      return left === undefined || left === null ? value(expr.right) : left
    }
    const op = flipped(expr) ? BOUNDARY[expr.op] : expr.op
    return COMPARE[op](value(expr.left), value(expr.right))
  }
  if (program.kind === `return`) return value(program.expr)
  // The condition is evaluated even when a change forces the branch.
  const truth = Boolean(value(program.test))
  const forced = change?.kind === `force` && change.node === program
  return value((forced ? change.taken : truth) ? program.then : program.rest)
}

// The model's expectation for a program: its source, and for each site whether
// some admitted input of its own type distinguishes its mutant from the original
// (`distinct`), whether no admitted input of any declared type does (`dead`:
// the program is redundant, whatever its parameters' types), and whether a
// history of 0 and -0 alone does (for an ordering comparison at its own type).
function model(program) {
  const { text, sites } = render(program)
  const distinctAt = (type, index) => {
    const copy = { ...program, type }
    const change = render(copy).sites[index].change
    return DOMAIN[type].some(
      (input) =>
        !Object.is(evaluate(copy, input, change), evaluate(copy, input, null)),
    )
  }
  return {
    source: text,
    sites: sites.map((site, index) => {
      const distinct = distinctAt(program.type, index)
      const differs = (domain, change) =>
        domain.some(
          (input) =>
            !Object.is(
              evaluate(program, input, change),
              evaluate(program, input, null),
            ),
        )
      return {
        operator: site.operator,
        position: site.position,
        distinct,
        dead: TYPES.every((type) => !distinctAt(type, index)),
        zeroDistinct:
          site.change.kind === `flip` &&
          site.change.node.kind === `cmp` &&
          ORDERING.includes(site.change.node.op) &&
          differs(ZERO_DOMAIN[program.type], site.change),
      }
    }),
  }
}

// ## Production driver
//
// The CLI's instrumenter on the rendered source. The switch restates the
// contract of schemata.mjs for the operators in the grammar: `m` marks a site,
// `cmp` forces a comparison's operator, `not` drops a negation, and `cond`
// forces an `if`.
const load = (code) => {
  const js = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
  }).outputText
  return new Function(`${js}\nreturn f`)()
}
function switchFor(active) {
  return {
    m: (id) => id === active,
    v: (value) => value,
    cmp: (id, a, b, op) => COMPARE[id === active ? BOUNDARY[op] : op](a, b),
    not: (id, value) => (id === active ? value : !value),
    b: (id, value) => (id === active ? !value : value),
    cond: (ifTrue, ifFalse, value) =>
      active === ifTrue ? true : active === ifFalse ? false : value,
  }
}

// The free global `g`, whose getter counts the reads of one call.
let globalReads = 0
// Each input's result and the reads it made, with `g` installed as a counter.
function runAll(f, domain) {
  Object.defineProperty(globalThis, FREE, {
    configurable: true,
    get: () => ++globalReads,
  })
  try {
    return domain.map((input) => {
      globalReads = 0
      const result = f(...input)
      return { result, reads: globalReads }
    })
  } finally {
    delete globalThis[FREE]
  }
}
const sameRuns = (xs, ys) =>
  xs.every(
    (x, i) => Object.is(x.result, ys[i].result) && x.reads === ys[i].reads,
  )
function runsUnder(code, active, domain) {
  const previous = globalThis.__oracleGaps
  globalThis.__oracleGaps = switchFor(active)
  try {
    return runAll(load(code), domain)
  } finally {
    globalThis.__oracleGaps = previous
  }
}

function driver(program, observe) {
  const { text } = render(program)
  const domain = DOMAIN[program.type]
  const original = runAll(load(text), domain)
  const { code, mutants } = instrument(
    ts,
    `mutant-validity.ts`,
    text,
    `src/mutant-validity.ts`,
  )
  const clean = sameRuns(runsUnder(code, null, domain), original)
  const emitted = mutants.map((mutant) => ({
    operator: mutant.operator,
    position: mutant.position,
    differs: !sameRuns(runsUnder(code, mutant.number, domain), original),
    evidence: mutant.evidence,
  }))
  observe(`instrumented`, { clean, emitted })
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
      if (site.distinct)
        return violation(
          `instrumented`,
          `skipped ${where}, but the model finds an input that distinguishes it`,
          LAW_2,
        )
      if (site.dead)
        return violation(
          `instrumented`,
          `skipped ${where}, which no declared type can distinguish: it is dead code, not a skip`,
          LAW_DEAD,
        )
      continue
    }
    const marked = mutant.evidence === DEAD
    if (!marked && !site.distinct)
      return violation(
        `instrumented`,
        `emitted ${where}, which equals the original on every input of its type, and is not marked dead code`,
        LAW_1,
      )
    if (marked !== site.dead)
      return violation(
        `instrumented`,
        `${marked ? `marked dead code` : `left unmarked`} ${where}, but ${site.dead ? `no declared type can distinguish it` : `some declared type can distinguish it`}`,
        LAW_DEAD,
      )
    if (mutant.differs !== site.distinct)
      return violation(
        `instrumented`,
        `${marked ? `marked dead code` : `emitted`} ${where}: its run ${mutant.differs ? `differs` : `matches`} the original, but the model says ${site.distinct ? `it is distinguishable` : `it is not`}`,
        LAW_REFINE,
      )
    if (mutant.evidence === BOUNDARY_EVIDENCE && !site.zeroDistinct)
      return violation(
        `instrumented`,
        `tags ${where} as boundary evidence, but no history of 0 and -0 distinguishes it`,
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

// Five calibrations, each a wrong answer the check must reject.
const observed = (trace) => {
  const index = trace.findIndex((o) => o.checkpoint === `instrumented`)
  return index < 0 ? undefined : { index, value: trace[index].value }
}
const withEmitted = (trace, index, value, emitted) =>
  trace.map((o, i) =>
    i === index ? { ...o, value: { ...value, emitted } } : o,
  )
// The first emitted entry whose model site satisfies `pick`.
const firstEmitted = (value, sites, pick) => {
  for (const [at, entry] of value.emitted.entries()) {
    const site = sites.find((s) => keyOf(s) === keyOf(entry))
    if (site && pick(site, entry)) return { at, entry }
  }
  return undefined
}
// A calibration: find the first emitted entry the wrong answer changes, and
// rewrite the trace there.
const corruptEntry = (pick, rewrite) => (trace, program) => {
  const seen = observed(trace)
  if (!seen) return undefined
  const found = firstEmitted(seen.value, model(program).sites, pick)
  if (!found) return undefined
  const emitted = seen.value.emitted.map((e, i) =>
    i === found.at ? rewrite(e) : e,
  )
  return withEmitted(trace, seen.index, seen.value, emitted)
}
const calibrations = [
  {
    name: `a distinguishable swap is left out of the emitted mutants`,
    law: LAW_2,
    corrupt: (trace, program) => {
      const seen = observed(trace)
      if (!seen) return undefined
      const found = firstEmitted(
        seen.value,
        model(program).sites,
        (s) => s.distinct,
      )
      if (!found) return undefined
      return withEmitted(
        trace,
        seen.index,
        seen.value,
        seen.value.emitted.filter((_, i) => i !== found.at),
      )
    },
  },
  {
    name: `an undistinguishable mutant is emitted without the dead-code mark`,
    law: LAW_1,
    corrupt: corruptEntry(
      (s) => s.dead,
      (e) => ({ ...e, evidence: undefined }),
    ),
  },
  {
    name: `a distinguishable mutant is marked dead code`,
    law: LAW_DEAD,
    corrupt: corruptEntry(
      (s, e) => s.distinct && !e.evidence,
      (e) => ({ ...e, evidence: DEAD }),
    ),
  },
  {
    name: `a boundary hint sits on a site no 0 and -0 history distinguishes`,
    law: LAW_BOUNDARY,
    corrupt: corruptEntry(
      (s, e) => !s.zeroDistinct && !e.evidence,
      (e) => ({ ...e, evidence: BOUNDARY_EVIDENCE }),
    ),
  },
  {
    name: `a dead-marked mutant runs differently from the model`,
    law: LAW_REFINE,
    corrupt: corruptEntry(
      (s, e) => e.evidence === DEAD && !e.differs,
      (e) => ({ ...e, differs: true }),
    ),
  },
]

oracleProperty({
  id: `oracle-gaps.report-mutant-validity`,
  law: {
    statement: `Over the admitted domain of each declared parameter type (number: -1, 0, -0, 1, 2, NaN; bigint: -1n, 0n, 1n, 2n; string | number: the numbers and the strings '1' and '2'; in three parameters, with the free global g counting its reads), every emitted mutant of a grammar program that is not marked dead code differs from the program on some input (law 1). Every site the instrumenter skips equals the program on every input (law 2). A site is marked dead code exactly when no input distinguishes it, and no site is skipped as undetectable. Every emitted mutant's run agrees with the model. A boundary hint sits only on a site that a history of 0 and -0 distinguishes.`,
    authority: `The frozen design v20's maintainer decision of 2026-11-10 that anything an oracle can't possibly detect is an invalid mutant (freeze.md, "Undetectable mutants are invalid"), and its decision 5, that an equivalent is a framework bug and not an answer. The domain is the framework's data domain, which counts -0 apart from 0 and compares strings with coercion (maintainer, 2026-11-10, relayed by the coordinator). The dead-code and boundary evidence follow the coordinator's revision and the review of PR #8.`,
    limits: `A finite domain of eight values per variable and one free name. A small grammar, without property reads, calls, getters beyond g, or equal branches with a non-operand expression (\`a + 0\`). Dead code is judged on grammar programs, and tagged only under a pure condition. Logical operators on literals are not tagged. The boundary hint is one-directional, and is given only where both operands are variables or the literal 0; a nonzero tie, such as \`n > 10 ? 10 : n\`, carries none, because within numbers that mutant is undetectable and only a coerced string detects it. Whether the domain should come from the TypeScript types is a design question, not settled here. A skipped site is judged by the model, not by a run of the emitter.`,
    owner: `packages/oracles/oracle-gaps`,
  },
  // Enumerated: every program of the grammar is one history, in order.
  histories: programs,
  label: (program) => `${stateOf(program)}: ${render(program).text}`,
  model,
  driver,
  check,
  calibrations,
  timeout: 120_000,
})
