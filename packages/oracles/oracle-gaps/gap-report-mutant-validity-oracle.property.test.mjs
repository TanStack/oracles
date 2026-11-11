/**
 * # Types never hide a mutant
 *
 * The law (maintainer decision, 2026-11-11): the gap CLI never skips a
 * mutant, and never marks it dead code, on the basis of types. A mutant that
 * no input of its declared types distinguishes, and that an input JavaScript
 * allows does, is emitted with the `outside` label, which names that input's
 * class, and its survivor is reported as `outside-annotation`. An argument
 * typed `any` is an input the types allow, so the label claims no more than
 * that the annotations exclude the input. An unsound type analysis now only
 * mislabels a survivor; it never hides one.
 *
 * Law 1: every emitted mutant that is not marked dead code differs from the
 * original function on some input that JavaScript allows. Law 2: no site of
 * the operator contract is skipped (the contract's own syntactic exclusions,
 * such as `return undefined`, are no sites). Dead code: a site is marked dead
 * code exactly when no input distinguishes it, by its syntax alone. The label
 * law: a mutant carries the label exactly when an annotation excludes every
 * input that distinguishes it (in the first family and the coerced
 * programs); everywhere else it carries none. Boundary: a
 * site marked `boundary: -0` is distinguished by a history of 0 and -0 alone.
 * Refinement: every emitted mutant's run agrees with the model. Types change
 * nothing (the hostile programs): erasing a program's types changes none of
 * its sites and no dead-code mark, and every dead-code mark there holds.
 *
 * Authority: the maintainer's decision of 2026-11-11 above, relayed by the
 * coordinator after the fifth soundness review, and the frozen design v20's
 * decision of 2026-11-10, "anything an oracle can't possibly detect is an
 * invalid mutant" (freeze.md, "Undetectable mutants are invalid"). The
 * domain counts -0 apart from 0, NaN as a value, a string beside a number of
 * the same digits, `null` beside a zero, a number beside a bigint, and an
 * object whose `valueOf` has an effect. The dead-code and boundary evidence
 * follow the coordinator's revision and the review of PR #8.
 *
 * Domain. Each program is one function `f(a: T, b: T, c: T)`, where T is one
 * of three declared types: `number`, `bigint`, or `string | number`. Its
 * declared inputs are the values T admits, in every combination of three
 * parameters: number admits -1, 0, -0, 1, 2, and NaN; bigint admits -1n, 0n,
 * 1n, and 2n; `string | number` admits those numbers and the strings '1' and
 * '2'. What JavaScript allows adds foreign inputs (`FOREIGN`): two values
 * that tie at different identities in two of the parameters, the third 0 or
 * 1. A program may read the free name `g`, a global whose getter counts its
 * reads, and the coerced object counts its `valueOf` calls. Two functions
 * are equal when they return `Object.is`-equal values on every input and
 * make the same reads.
 *
 * Grammar. A program is one of: a comparison (of two operands, a variable or
 * the literal 0 or 1, in either written order, with each of `>`, `>=`, `<`,
 * `<=`, `===`, `!==`) returned as a value; a comparison of one variable with
 * itself; a logical operator (`&&`, `||`, `??`) on two variables, on one
 * variable twice, or on the global `g` twice; a clamp, a ternary whose false
 * branch is another ternary; or a ternary or a guard (`if (C) return T; return
 * F;`, or the same with an `else`). A test is a comparison, a negated
 * comparison, a logical operator with a comparison and a variable, or an
 * ordering comparison beside the impure `g > c`. A ternary's or guard's
 * branches are the two compared operands in either order, the variable that
 * is not an operand with one of them, the same variable twice, or an empty
 * return. Every program is one history of the oracle.
 *
 * Model. The model interprets the grammar on each input, with JavaScript's
 * short-circuit order, coercions, and reads of `g`. A mutant is a change to
 * the program: a comparison's operator swapped to its partner (`>` with
 * `>=`, `<` with `<=`, `===` with `!==`), a logical operator swapped to its
 * partner (`&&` with `||`, `??` with `&&`), a negation dropped, an `if`'s
 * condition forced to true or to false, or a returned value made
 * `undefined` after it is evaluated. The model reads the grammar's own
 * rendered text and its sites, never the instrumenter's text.
 *
 * Production path. The CLI's `instrument` (schemata.mjs) instruments the
 * rendered text. The driver runs the instrumented function with no mutant
 * active, which must equal the original, and then with each emitted mutant
 * active, recording whether its outputs and reads differ from the original's,
 * and the evidence and label the instrumenter tags on it.
 *
 * Observations. `instrumented` reports the clean run's result and, for each
 * emitted mutant, its operator, position, whether its run differs, its
 * evidence, and its label. A hostile program reports its mutants, and those
 * of its text with the types erased.
 *
 * Comparison, for each site the model names: it is emitted (law 2); if it is
 * not dead code it is distinguishable (law 1); a dead-code mark sits exactly
 * on the undistinguishable sites; a label sits on every site the label law
 * names; its run agrees with the model; a boundary hint sits on a site that
 * a history of 0 and -0 distinguishes; and each emitted mutant is a site of
 * the grammar.
 *
 * Every returned expression is a `return-undefined` site (F17), returned
 * calls and `import()` included, except `return undefined` where nothing
 * binds the name and the file has no direct `eval` and no `with`, and
 * `return void x`. Its mutant evaluates the returned expression and returns `undefined`
 * in its place, so the two left out are exact equivalents, and the returned
 * values family judges them. The optional chains family judges
 * `optional-chain`.
 *
 * Limits. The domain is finite: each type's values, a fixed set of foreign
 * ties, and one free name. A clamp at type bigint is left out. The grammar
 * has no property reads, calls, getters beyond `g`, or equal branches with
 * a non-operand expression (`a + 0`). Dead code is tagged only under a pure
 * condition (local names, literals, comparisons, logical operators, `!`)
 * where no ordering comparison runs or not because of the site. Logical
 * operators on literals (`1 && 1`) are not tagged. The boundary hint is
 * one-directional. The label law covers the first family and an annotated
 * optional-chain receiver only: the narrowed family's narrowings are not
 * labelled, and their survivors take their other classes. The type analysis
 * reads annotations by syntax and makes no claim beyond the label; its known
 * mislabels (overload merging, module augmentation, a project's other
 * tsconfig options) only name a survivor's class. The switch below restates
 * the operator contract in schemata.mjs; the static oracle keeps its own
 * copy for derived classes.
 */
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { oracleProperty, pass, violation } from '../src/oracle-property.ts'
import { instrument } from './schemata.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ts = createRequire(join(here, `../package.json`))(
  `typescript-for-tanstack-oracles`,
)

const LAW_1 = `every emitted mutant that is not dead code differs from the original on some input`
const LAW_2 = `no site is skipped on the basis of types, and a skipped site equals the original on every input`
const LAW_DEAD = `a site is marked dead code exactly when no input distinguishes it`
const LAW_LABEL = `a mutant carries the outside-annotation label exactly when an annotation excludes every input that distinguishes it`
const LAW_TYPELESS = `erasing the types changes no emitted site and no dead-code mark`
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
// What JavaScript allows (maintainer decision, 2026-11-11: types never skip
// a mutant or mark it dead). Beside each type's own inputs, a fixed set of
// foreign inputs puts two values that tie at different identities in two
// parameters: a string beside the number of its digits, `null` beside a
// zero, a number beside a bigint, -0 beside 0, and an object whose `valueOf`
// has an effect beside the number it yields. The third parameter is 0 or 1.
// An object's `valueOf` counts in `effects`, which a run reads as it reads
// `g`, so a mutant that changes how often an operand is coerced shows.
const effects = { count: 0 }
const VALUED = {
  valueOf() {
    effects.count += 1
    return 1
  },
}
const TIES = [
  [`1`, 1],
  [null, 0],
  [null, 0n],
  [1n, 1],
  [0, -0],
  [VALUED, 1],
  [VALUED, VALUED],
  [undefined, 0],
].flatMap(([x, y]) => [
  [x, y],
  [y, x],
])
const FOREIGN = [
  [0, 1],
  [0, 2],
  [1, 2],
].flatMap(([i, j]) =>
  TIES.flatMap(([x, y]) =>
    [0, 1].map((third) => {
      const input = [third, third, third]
      input[i] = x
      input[j] = y
      return input
    }),
  ),
)
const JS_DOMAIN = Object.fromEntries(
  TYPES.map((t) => [t, [...DOMAIN[t], ...FOREIGN]]),
)
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
// A comparison beside an impure operand, `g > c`, which reads the global
// `g` (its value is the read count, 1 here). Under `&&` and `||` the
// comparison decides whether `g` is read. At a tie an ordering swap changes
// that read, which the reads show, so a skip there is unsound (the third
// review, 2026-11-11). The comparison orders its operands, as the swap's
// skip needs, and does not read `c`, so `g > c` can take either value. Its
// branches are its operands.
const READ = { kind: `cmp`, left: ref(FREE), op: `>`, right: ref(`c`) }
const impure = tests
  .filter(
    (cmp) =>
      ORDERING.includes(cmp.op) &&
      cmp.left.name !== `c` &&
      cmp.right.name !== `c`,
  )
  .flatMap((cmp) => [logic(`&&`, cmp, READ), logic(`||`, cmp, READ)])
for (const test of impure)
  branched(test, [
    [test.left.left, test.left.right],
    [test.left.right, test.left.left],
  ])
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
const typedPrograms = shapes.flatMap((shape) =>
  TYPES.filter((type) => !(type === `bigint` && isClamp(shape))).map(
    (type) => ({
      ...shape,
      type,
    }),
  ),
)

const programs = typedPrograms

// ## Narrowed unions
//
// A second family, for the types TypeScript narrows. Its programs are
// `function f(t: T, a: number)`, where the subject `t` is a union of two
// members, `'x' | 'y'` (plain, read as `t`) or `{ type: 'x' } | { type: 'y' }`
// (tagged, read as `t.type`), or its wide counterpart, `string` or
// `{ type: string }`. The typed inputs of a union are its two members; of a
// wide type, those and a third, `'z'`; `a` takes the number values. Each
// program tests the subject against `'x'` and then `'y'`. At a union the
// second test meets the last member: the subject is narrowed to `'y'` there,
// the test is constant, and the code after both members is narrowed to
// `never`. The same text at the wide type narrows nothing. No narrowing is
// trusted, so the model judges every program over the cast domain.
//
// Each program is checked under strict null checks and, as a package with
// them off is, without them (loose). Without them a declared type admits
// `undefined` too: a plain subject may be `undefined`, and a tagged one's
// `type` may be, so narrowing proves nothing and no site is skipped.
//
// A program's form says how it tests and what follows:
//
// - `chain`, `reversed`, `negated`: `if (D === 'x') return a > 0;`, then the
//   second test (`D === 'y'`, `'y' === D`, or `!(D !== 'y')`) returning
//   `a > 1`, then `return a > 2;`;
// - `guard`: the second test as `D !== 'y'` (constant false) returning
//   `a > 1`, then `return a > 2;`;
// - `else`: the second test with `else return a > 2;`;
// - `loop`: in `for (const u of [t])`, `if (U === 'x') continue;`, then
//   `if (U === 'y') return a > 1;` and `return a > 0;`, and `return a > 2;`
//   after the loop, which the first member reaches;
// - `loopWork`: the same loop, whose first branch does work before it
//   continues (`{ a = a + 1; continue; }`), as path-to-regexp's token loop
//   does, and `return a < 2;` after the loop: on the path to the second test
//   only conditions run, so its narrowing holds;
// - `switch`: `switch (D)` with the cases `'x'` and `'y'` and a `default`
//   returning `a > 2`;
// - `satisfies`: the same switch with no `default`, then `t satisfies never;`
//   and `return a > 2;`;
// - `labelled`: a plain `'x' | number` subject (wide: `string | number`, with
//   the numbers 0 and 1 its members too), switched on `case 'x'` and on
//   `case other`, a `let other = 0`, with a `default`: a label with no single
//   value, and a member with none, leave the switch open;
// - `hoisted`: the second test returns `check(a)`, a function declared after
//   it, which the call reaches though it follows the narrowed test;
// - `assigned`: a flag that a callback sets: the checker narrows `done` to
//   `false` at its test, though the callback has set it when the subject is
//   `'y'`;
// - `retag`: after the first test, a callback that, when `a > 1`, changes the
//   subject (a destructuring `[t] = ['x']`, or the tagged object's `type`),
//   then the second test returning `a > 1` and `return a < 2;`: a narrowing
//   that a call, or an assignment the checker does not follow, has undone;
// - `retagLoop`: the same with a plain subject assigned by `for (t of …)`.
//
// The sites are the if-operators, the comparison swaps, the dropped
// negation, a boolean literal's flip, a skipped call statement, the `+`'s
// swap, and a call's value; a switch, a case label, a loop over an array,
// and `satisfies` have none.
const NARROWED_TYPE = {
  plain: { union: `'x' | 'y'`, wide: `string` },
  tagged: { union: `{ type: 'x' } | { type: 'y' }`, wide: `{ type: string }` },
}
const WIDTHS = [`union`, `wide`]
const MEMBERS = { union: [`x`, `y`], wide: [`x`, `y`, `z`] }
const STRICTNESS = [`strict`, `loose`]
// The `labelled` form's own subject types and members.
const LABELLED = {
  type: { union: `'x' | number`, wide: `string | number` },
  members: { union: [`x`, 0, 1], wide: [`x`, `z`, 0, 1] },
}
// A narrowed program is judged over the cast domain, which JavaScript
// allows (maintainer decision, 2026-11-11: types never skip a mutant or mark
// it dead): the members, the wide type's third string, which a cast passes,
// and without strict null checks `undefined`. No narrowing is trusted, so
// the code a narrowing excludes stays emitted. The switch forms below each
// reach the default, or the code after the switch, in their own way.
function narrowedDomain(program) {
  const flow =
    program.form === `labelled`
      ? LABELLED.members[program.width]
      : MEMBERS[program.width]
  const members = flow.includes(`z`) ? flow : [...flow, `z`]
  const loose = program.strictness === `loose` ? [undefined] : []
  return [...members, ...loose].flatMap((name) =>
    VALUES.number.map((a) => [
      program.subject === `tagged` ? { type: name } : name,
      a,
    ]),
  )
}
const subjectRef = (name) => ({ kind: `subject`, name })
const member = (value) => ({ kind: `member`, value })
const number = (value) => ({ kind: `number`, value })
const compared = (op, k) => ({
  kind: `return`,
  expr: { kind: `cmp`, left: ref(`a`), op, right: number(k) },
})
const above = (k) => compared(`>`, k)
const when = (test, then, otherwise) => ({
  kind: `if`,
  test,
  then,
  else: otherwise,
})
const is = (left, op, right) => ({ kind: `cmp`, left, op, right })
const bool = (value) => ({ kind: `bool`, value })
const SUBJECT = subjectRef(`t`)
const firstMember = () => when(is(SUBJECT, `===`, member(`x`)), above(0))
const secondMember = (then) => when(is(SUBJECT, `===`, member(`y`)), then)
const twoCases = (fallback) => ({
  kind: `switch`,
  cases: [
    [member(`x`), above(0)],
    [member(`y`), above(1)],
  ],
  fallback,
})
const loopOf = (first, after) => [
  {
    kind: `loop`,
    body: [
      when(is(subjectRef(`u`), `===`, member(`x`)), first),
      when(is(subjectRef(`u`), `===`, member(`y`)), above(1)),
      above(0),
    ],
  },
  after,
]
// A callback that changes the subject when `a > 1`, then the second test.
const retagged = (change) => [
  firstMember(),
  {
    kind: `each`,
    body: when(is(ref(`a`), `>`, number(1)), change),
  },
  secondMember(above(1)),
  compared(`<`, 2),
]
// Each form's statements, and the subjects it takes.
const NARROWED_FORMS = {
  chain: () => [firstMember(), secondMember(above(1)), above(2)],
  reversed: () => [
    firstMember(),
    when(is(member(`y`), `===`, SUBJECT), above(1)),
    above(2),
  ],
  negated: () => [
    firstMember(),
    when(negation(is(SUBJECT, `!==`, member(`y`))), above(1)),
    above(2),
  ],
  guard: () => [
    firstMember(),
    when(is(SUBJECT, `!==`, member(`y`)), above(1)),
    above(2),
  ],
  else: () => [
    firstMember(),
    when(is(SUBJECT, `===`, member(`y`)), above(1), above(2)),
  ],
  loop: () => loopOf({ kind: `continue` }, above(2)),
  // After the loop, `a < 2`, so that the `+ 1` and the work's skip both show.
  loopWork: () =>
    loopOf(
      { kind: `block`, body: [{ kind: `bump` }, { kind: `continue` }] },
      compared(`<`, 2),
    ),
  switch: () => [twoCases(above(2))],
  satisfies: () => [twoCases(undefined), { kind: `satisfies` }, above(2)],
  // Switch forms that reach the default, or the code after the switch, with
  // a member: each broke one condition of an earlier exhaustive-switch skip.
  // `fallthrough`: the case `'y'` has no statement and falls into the
  // default.
  fallthrough: () => [
    {
      kind: `switch`,
      cases: [
        [member(`x`), above(0)],
        [member(`y`), undefined],
      ],
      fallback: above(2),
    },
  ],
  // `broken`: the case `'x'` breaks, so the code after the switch runs.
  broken: () => [
    {
      kind: `switch`,
      cases: [
        [member(`x`), { kind: `break` }],
        [member(`y`), above(1)],
      ],
    },
    above(2),
  ],
  // `recast`: when `a > 1` the program assigns the subject a value that a
  // cast passes, so the default runs.
  recast: () => [
    when(is(ref(`a`), `>`, number(1)), { kind: `recast` }),
    twoCases(above(2)),
  ],
  // `hoistedSwitch`: the case `'x'` calls a function declared after the
  // switch, which is hoisted: its body runs, and the return after the
  // switch does not.
  hoistedSwitch: () => [
    {
      kind: `switch`,
      cases: [
        [
          member(`x`),
          {
            kind: `return`,
            expr: { kind: `call`, name: `check`, argument: ref(`a`) },
          },
        ],
        [member(`y`), above(1)],
      ],
    },
    { kind: `satisfies` },
    above(2),
    { kind: `function`, name: `check`, body: compared(`>`, 1) },
  ],
  labelled: () => [
    { kind: `let`, name: `other`, init: number(0) },
    {
      kind: `switch`,
      cases: [
        [member(`x`), above(0)],
        [{ kind: `name`, name: `other` }, above(1)],
      ],
      fallback: above(2),
    },
  ],
  hoisted: () => [
    firstMember(),
    secondMember({
      kind: `return`,
      expr: { kind: `call`, name: `check`, argument: ref(`a`) },
    }),
    { kind: `function`, name: `check`, body: compared(`>`, 1) },
  ],
  assigned: () => [
    { kind: `let`, name: `done`, init: bool(false) },
    {
      kind: `each`,
      body: when(is(subjectRef(`u`), `===`, member(`y`)), {
        kind: `set`,
        name: `done`,
        value: bool(true),
      }),
    },
    when({ kind: `name`, name: `done` }, above(1)),
    above(2),
  ],
  // A returned `void a`, whose value is `undefined` whatever `a` is.
  voided: () => [
    firstMember(),
    { kind: `return`, expr: { kind: `voidOf`, name: `a` } },
  ],
  retag: () => retagged({ kind: `retag` }),
  retagLoop: () => retagged({ kind: `retagLoop` }),
}
const PLAIN_ONLY = new Set([`labelled`, `retagLoop`])
const narrowedPrograms = Object.keys(NARROWED_FORMS).flatMap((form) =>
  [`plain`, `tagged`]
    .filter((subject) => subject === `plain` || !PLAIN_ONLY.has(form))
    .flatMap((subject) =>
      WIDTHS.flatMap((width) =>
        STRICTNESS.map((strictness) => ({
          kind: `narrowed`,
          form,
          subject,
          width,
          strictness,
          body: NARROWED_FORMS[form](),
        })),
      ),
    ),
)

// The source of a narrowed program and its sites, as `render` gives them for
// the first family.
function renderNarrowed(program) {
  const type =
    program.form === `labelled`
      ? LABELLED.type[program.width]
      : NARROWED_TYPE[program.subject][program.width]
  let text = `function f(t: ${type}, a: number) {\n`
  const sites = []
  const put = (piece) => {
    text += piece
  }
  const site = (operator, change) =>
    sites.push({ operator, position: text.length, change })
  const read = (name) => (program.subject === `tagged` ? `${name}.type` : name)
  const expression = (expr) => {
    if (expr.kind === `subject`) return put(read(expr.name))
    if (expr.kind === `voidOf`) return put(`void ${expr.name}`)
    if (expr.kind === `member`)
      return put(
        typeof expr.value === `string` ? `'${expr.value}'` : `${expr.value}`,
      )
    if (expr.kind === `number`) return put(String(expr.value))
    if (expr.kind === `ref` || expr.kind === `name`) return put(expr.name)
    if (expr.kind === `call`) {
      site(`value-undefined`, { kind: `undefine`, node: expr })
      put(`${expr.name}(`)
      expression(expr.argument)
      return put(`)`)
    }
    if (expr.kind === `bool`) {
      site(`bool-flip`, { kind: `flip`, node: expr })
      return put(String(expr.value))
    }
    if (expr.kind === `not`) {
      site(`drop-not`, { kind: `drop`, node: expr })
      put(`!(`)
      expression(expr.operand)
      return put(`)`)
    }
    expression(expr.left)
    put(` `)
    site(`binary-swap`, { kind: `flip`, node: expr })
    put(`${expr.op} `)
    return expression(expr.right)
  }
  const statement = (s, indent) => {
    if (s.kind === `return`) {
      put(`${indent}return `)
      // `void a` is `undefined` already, so it is no site. A returned call
      // is a site (the sixth review: a test that checks only the call's
      // effect kills `value-undefined`, never this).
      if (s.expr.kind !== `voidOf`)
        sites.push({
          operator: `return-undefined`,
          position: text.length,
          change: { kind: `undefine`, node: s },
        })
      expression(s.expr)
      return put(`;\n`)
    }
    if (s.kind === `continue`) return put(`continue;`)
    if (s.kind === `bump`) {
      put(`a = a `)
      site(`arithmetic-swap`, { kind: `swap`, node: s })
      return put(`+ 1;`)
    }
    if (s.kind === `block`) {
      put(`{ `)
      for (const [i, inner] of s.body.entries()) {
        if (i > 0) put(` `)
        statement(inner, ``)
      }
      return put(` }\n`)
    }
    if (s.kind === `retag`)
      return put(
        program.subject === `tagged`
          ? `(u as { type: string }).type = 'x';`
          : `[t] = ['x'];`,
      )
    if (s.kind === `retagLoop`) return put(`for (t of ['x' as const]);`)
    if (s.kind === `recast`)
      return put(
        program.subject === `tagged`
          ? `(t as { type: string }).type = 'z';`
          : `t = 'z' as 'x';`,
      )
    if (s.kind === `break`) return put(`break;\n`)
    if (s.kind === `set`) {
      put(`${s.name} = `)
      expression(s.value)
      return put(`;`)
    }
    if (s.kind === `let`) {
      put(`${indent}let ${s.name} = `)
      expression(s.init)
      return put(`;\n`)
    }
    if (s.kind === `each`) {
      put(indent)
      site(`delete-call`, { kind: `delete`, node: s })
      put(`[t].forEach((u) => { `)
      statement(s.body, ``)
      return put(` });\n`)
    }
    if (s.kind === `function`) {
      put(`${indent}function ${s.name}(a: number) {\n`)
      statement(s.body, `${indent}  `)
      return put(`${indent}}\n`)
    }
    if (s.kind === `satisfies`) return put(`${indent}t satisfies never;\n`)
    if (s.kind === `if`) {
      put(`${indent}if (`)
      for (const taken of [true, false])
        site(taken ? `if-true` : `if-false`, { kind: `force`, node: s, taken })
      expression(s.test)
      put(`) `)
      statement(s.then, ``)
      if (s.then.kind !== `return` && s.then.kind !== `block`) put(`\n`)
      if (s.else) {
        put(`${indent}else `)
        statement(s.else, ``)
      }
      return undefined
    }
    if (s.kind === `loop`) {
      put(`${indent}for (const u of [t]) {\n`)
      for (const inner of s.body) statement(inner, `${indent}  `)
      return put(`${indent}}\n`)
    }
    put(`${indent}switch (${read(`t`)}) {\n`)
    for (const [label, body] of s.cases) {
      put(`${indent}  case `)
      expression(label)
      put(`: `)
      // A case with no statement falls through into the next.
      if (body) statement(body, ``)
      else put(`\n`)
    }
    if (s.fallback) {
      put(`${indent}  default: `)
      statement(s.fallback, ``)
    }
    return put(`${indent}}\n`)
  }
  for (const s of program.body) statement(s, `  `)
  put(`}`)
  return { text, sites }
}

// A narrowed program on one input, under at most one change. A statement ends
// the function with its value, or continues the loop. The subject is copied,
// so a run that changes it leaves the input as it was.
function evaluateNarrowed(program, input, change) {
  const [t, a] = input
  const env = { t: typeof t === `object` ? { ...t } : t, a }
  const functions = new Map(
    program.body.filter((s) => s.kind === `function`).map((s) => [s.name, s]),
  )
  const subject = (name) =>
    program.subject === `tagged` ? env[name].type : env[name]
  const value = (expr) => {
    if (expr.kind === `subject`) return subject(expr.name)
    if (expr.kind === `voidOf`) return undefined
    if (expr.kind === `member` || expr.kind === `number`) return expr.value
    if (expr.kind === `ref` || expr.kind === `name`) return env[expr.name]
    if (expr.kind === `call`) {
      if (change?.kind === `undefine` && change.node === expr) return undefined
      // A function's parameter shadows `a` while it runs.
      const outer = env.a
      env.a = value(expr.argument)
      const result = execute(functions.get(expr.name).body)?.value
      env.a = outer
      return result
    }
    if (expr.kind === `bool`)
      return change?.kind === `flip` && change.node === expr
        ? !expr.value
        : expr.value
    if (expr.kind === `not`)
      return change?.kind === `drop` && change.node === expr
        ? value(expr.operand)
        : !value(expr.operand)
    const op =
      change?.kind === `flip` && change.node === expr
        ? BOUNDARY[expr.op]
        : expr.op
    return COMPARE[op](value(expr.left), value(expr.right))
  }
  const run = (statements) => {
    for (const s of statements) {
      const ended = execute(s)
      if (ended) return ended
    }
    return undefined
  }
  const execute = (s) => {
    if (s === undefined || s.kind === `satisfies` || s.kind === `function`)
      return undefined
    if (s.kind === `return`) {
      // The returned expression runs even when its value is dropped.
      const result = value(s.expr)
      return {
        value:
          change?.kind === `undefine` && change.node === s ? undefined : result,
      }
    }
    if (s.kind === `continue`) return { next: true }
    if (s.kind === `block`) return run(s.body)
    if (s.kind === `bump`) {
      env.a =
        change?.kind === `swap` && change.node === s ? env.a - 1 : env.a + 1
      return undefined
    }
    if (s.kind === `break`) return { broke: true }
    if (s.kind === `recast`) {
      if (program.subject === `tagged`) env.t.type = `z`
      else env.t = `z`
      return undefined
    }
    if (s.kind === `retag` || s.kind === `retagLoop`) {
      if (program.subject === `tagged`) env.t.type = `x`
      else env.t = `x`
      return undefined
    }
    if (s.kind === `let` || s.kind === `set`) {
      env[s.name] = value(s.kind === `let` ? s.init : s.value)
      return undefined
    }
    if (s.kind === `each`) {
      if (change?.kind !== `delete` || change.node !== s)
        for (const u of [env.t]) {
          env.u = u
          execute(s.body)
        }
      return undefined
    }
    if (s.kind === `if`) {
      // The condition is evaluated even when a change forces the branch.
      const truth = Boolean(value(s.test))
      const forced = change?.kind === `force` && change.node === s
      return execute((forced ? change.taken : truth) ? s.then : s.else)
    }
    if (s.kind === `loop`) {
      for (const u of [env.t]) {
        env.u = u
        const ended = run(s.body)
        if (ended && !ended.next) return ended
      }
      return undefined
    }
    // A switch runs from the matching case, or else from the default, through
    // the clauses after it until one ends the function or breaks.
    const bodies = [...s.cases.map(([, body]) => body), s.fallback]
    const found = s.cases.findIndex(([label]) => value(label) === subject(`t`))
    for (const body of bodies.slice(found < 0 ? s.cases.length : found)) {
      const ended = execute(body)
      if (ended?.broke) return undefined
      if (ended) return ended
    }
    return undefined
  }
  return run(program.body)?.value
}

// ## Optional chains
//
// A fourth family: `function f(o: T, a: number) { return R === a; }`, where
// R reads `v` of a receiver through an optional chain, as `?.v` (property)
// or `?.['v']` (element), and T is `{ v: number } | undefined` (nullable)
// or `{ v: number }` (present). The `optional-chain` mutant reads through a
// plain access, which throws on a nullish receiver.
//
// Every receiver is judged over the inputs JavaScript allows: the typed
// objects, `undefined`, and `null`. Where the receiver is the parameter its
// own annotation declares (`param`), no declared input makes the present
// type's receiver nullish under strict null checks, but without them the
// annotation admits `null`. The CLI does not read the package's strictness,
// so the plain read carries no label (the sixth review: a label only where
// an annotation excludes the input), and its survivor's directive already
// names `undefined`. The other receivers: a local that holds the parameter
// (`local`, `const p = o`), a property of a wrapper (`property`, `w.o`), the
// same text in JavaScript with a JSDoc type, and a literal constant
// (`constant`, `const K = 'v'`, read as `K?.length`), which is never
// nullish, so its plain read is dead code: emitted, and marked.
const CHAIN_TYPE = {
  nullable: `{ v: number } | undefined`,
  present: `{ v: number }`,
}
const CHAIN_WIDTHS = [`nullable`, `present`]
const CHAIN_OBJECTS = {
  nullable: [{ v: 1 }, undefined],
  present: [{ v: 1 }, { v: 2 }],
}
const RECEIVERS = [`param`, `local`, `property`, `constant`]
const LANGS = [`ts`, `js`]
// A run that throws, in the model and the driver alike.
const THREW = `threw TypeError`
const chainPrograms = [`property`, `element`].flatMap((access) =>
  RECEIVERS.flatMap((receiver) =>
    LANGS.flatMap((lang) =>
      CHAIN_WIDTHS.flatMap((width) =>
        STRICTNESS.map((strictness) => ({
          kind: `optional`,
          access,
          receiver,
          lang,
          width,
          strictness,
        })),
      ),
    ),
  ),
)
// Whether the receiver is the parameter whose own annotation declares it, in
// TypeScript under strict null checks: then its declared types are the
// typed objects, and the label law applies.
const annotatedChain = (program) =>
  program.receiver === `param` &&
  program.lang === `ts` &&
  program.strictness === `strict`
function renderChain(program) {
  const type =
    program.receiver === `property`
      ? `{ o: ${CHAIN_TYPE[program.width]} }`
      : CHAIN_TYPE[program.width]
  const name = program.receiver === `property` ? `w` : `o`
  const declared =
    program.lang === `ts`
      ? `function f(${name}: ${type}, a: number) {\n`
      : `/** @param {${type}} ${name} @param {number} a */\nfunction f(${name}, a) {\n`
  const constant = program.receiver === `constant` ? `const K = 'v';\n` : ``
  const local = program.receiver === `local` ? `  const p = o;\n` : ``
  const head = `${constant}${declared}${local}  return `
  const at = head.length
  const object = { param: `o`, local: `p`, property: `w.o`, constant: `K` }[
    program.receiver
  ]
  const key = program.receiver === `constant` ? `length` : `v`
  const read =
    program.access === `property`
      ? `${object}?.${key}`
      : `${object}?.['${key}']`
  return {
    text: `${head}${read} === a;\n}`,
    sites: [
      {
        operator: `return-undefined`,
        position: at,
        change: { kind: `undefine` },
      },
      { operator: `optional-chain`, position: at, change: { kind: `chain` } },
      {
        operator: `binary-swap`,
        position: at + read.length + 1,
        change: { kind: `flip`, node: { kind: `cmp`, op: `===` } },
      },
    ],
  }
}
function evaluateChain(program, [o, a], change) {
  const object =
    program.receiver === `constant`
      ? `v`
      : program.receiver === `property`
        ? o.o
        : o
  if (change?.kind === `chain` && (object === undefined || object === null))
    return THREW
  const read = program.receiver === `constant` ? object.length : object?.v
  const value = COMPARE[change?.kind === `flip` ? `!==` : `===`](read, a)
  return change?.kind === `undefine` ? undefined : value
}
// What JavaScript allows: the typed objects, `undefined`, and `null`. The
// declared types' inputs are the typed objects alone.
function chainDomain(program, typed = false) {
  const objects = [
    ...new Set([
      ...CHAIN_OBJECTS[program.width],
      ...(typed ? [] : [undefined, null]),
    ]),
  ]
  return objects
    .map((o) => (program.receiver === `property` ? { o } : o))
    .flatMap((o) => VALUES.number.map((a) => [o, a]))
}

// ## Returned values
//
// A fifth family: `function f(a: number) { R }`, where R returns `a`
// (`plain`), `void a` (`voided`), `void g` (`voidRead`, which reads the
// global), or `undefined` (`undefinedName`), and the same `return undefined`
// where a parameter named `undefined` shadows the global (`shadowed`), or a
// `var` in a nested block does (`varShadowed`, function-scoped). The
// `return-undefined` mutant evaluates the returned expression and returns
// `undefined` in its place, so its effects stay (the reads of `g`). Its
// contract leaves out a returned call, which `value-undefined` covers, and a
// returned `undefined` or `void x`, which already return `undefined` after
// the same effects: those are no site. A shadowed `undefined` is a name
// like any other, and its return is a site. Each is judged in TypeScript and
// in JavaScript, under strict null checks and without them, over the number
// values of `a`, `undefined`, and `null`.
const RETURN_FORMS = [
  `plain`,
  `voided`,
  `voidRead`,
  `undefinedName`,
  `shadowed`,
  `varShadowed`,
]
const returnPrograms = RETURN_FORMS.flatMap((form) =>
  LANGS.flatMap((lang) =>
    STRICTNESS.map((strictness) => ({
      kind: `returned`,
      form,
      lang,
      strictness,
    })),
  ),
)
function renderReturned(program) {
  const name = program.form === `shadowed` ? `undefined` : `a`
  const block =
    program.form === `varShadowed` ? `  { var undefined = a; }\n` : ``
  const head =
    program.lang === `ts`
      ? `function f(${name}: number) {\n${block}  return `
      : `function f(${name}) {\n${block}  return `
  const value = {
    plain: `a`,
    voided: `void a`,
    voidRead: `void g`,
    undefinedName: `undefined`,
    shadowed: `undefined`,
    varShadowed: `undefined`,
  }[program.form]
  const site = [`plain`, `shadowed`, `varShadowed`].includes(program.form)
  return {
    text: `${head}${value};\n}`,
    sites: site
      ? [
          {
            operator: `return-undefined`,
            position: head.length,
            change: { kind: `undefine` },
          },
        ]
      : [],
  }
}
// The program on one input, with the reads of `g` it made.
function evaluateReturned(program, [a], change, counter = { reads: 0 }) {
  if (program.form === `voidRead`) counter.reads += 1
  const value = [`plain`, `shadowed`, `varShadowed`].includes(program.form)
    ? a
    : undefined
  return change?.kind === `undefine` ? undefined : value
}
const returnDomain = () => [...VALUES.number, undefined, null].map((a) => [a])

// ## Scopes, bindings, and coercions (the sixth review)
//
// A sixth family, of short programs that the model judges by running their
// text (round 6 of the soundness review, 2026-11-11: fixed programs missed
// whole classes twice, so each cause is a generated dimension here). Each
// program's sites are named with the text that applies each one's mutant,
// and the model runs the program and each mutant on every input, counting
// the coerced object's `valueOf` calls and a getter's reads as effects.
// Results compare by kind and value, so a fresh function or object returned
// by two runs is the same result.
//
// - `tdz`: a logical operator's operand that may be in its temporal dead
//   zone. The condition sits in a parameter's default (`b = (c && a ? 1 :
//   1)`), a `for (let …)` head, or a `for (const … of …)` head, and its
//   operand names a binding declared later (still uninitialized there) or
//   one declared earlier; a condition in the body is the control. Under
//   identical branches the swap changes only whether the operand is read,
//   and a read in the dead zone throws.
// - `binds`: each form that can bind the name `undefined` (a nested `var`,
//   a block `let`, a parameter, a destructured parameter, a caught error, a
//   function or class declaration, a function or class expression's own
//   name), and forms that name it without binding it (a method name, a
//   label, an object key) or not at all. A returned bound `undefined` is a
//   site; a returned global one is not.
// - `scope`: a sloppy script with a direct `eval`, with a `with`, or with
//   neither, around a returned `undefined`, an optional read of a constant,
//   and `a && a`. `eval` can declare a `var` that shadows a name, and `with`
//   reads names through an object, whose getter runs.
// - `called`: a returned call, which is a site like any returned value.
// - `coerced`: `if (c || p < q) return 1; return 1;` with `p` and `q`
//   annotated `number`, `string | number`, `object`, or `unknown`, and in
//   JavaScript. Only the comparison's coercion of an object distinguishes
//   the `||` swap; the label belongs only where the annotation excludes the
//   object (`number` and `string | number`).
const TEXT_LOGICAL = [`&&`, `||`, `??`]
const TEXT_PARTNER = { '&&': `||`, '||': `&&`, '??': `&&`, '<': `<=` }
const TDZ_CONTEXTS = [`body`, `default`, `forLet`, `forOf`]
const textPrograms = []
// A site at the first occurrence of `marker` (after `from`), whose mutant
// replaces `length` characters there with `replacement`, or wraps a
// returned expression in `void (…)`, which evaluates it and returns
// `undefined`.
function textSite(text, operator, marker, from = 0) {
  const position = text.indexOf(marker, from)
  if (position < 0) throw new Error(`no ${marker} in ${text}`)
  return { operator, position, marker }
}
function mutateSite(text, site) {
  const { operator, position, marker } = site
  const at = (replacement, length = marker.length) =>
    `${text.slice(0, position)}${replacement}${text.slice(position + length)}`
  if (operator === `binary-swap`) return at(TEXT_PARTNER[marker] ?? marker)
  if (operator === `return-undefined`) return at(`void (${marker})`)
  if (operator === `optional-chain`) return at(marker.replace(`?.`, `.`))
  if (operator === `delete-call`) return at(`;`)
  if (operator === `value-undefined`) return at(`void 0`)
  if (operator === `field-drop`) return at(``)
  if (operator === `if-true`) return at(`(${marker}) || true`)
  if (operator === `if-false`) return at(`(${marker}) && false`)
  throw new Error(`no text mutant for ${operator}`)
}
for (const context of TDZ_CONTEXTS)
  for (const op of TEXT_LOGICAL)
    for (const binding of context === `body`
      ? [`earlier`]
      : [`later`, `earlier`]) {
      const condition = (operand) => `c ${op} ${operand} ? `
      let text
      let returned
      if (context === `body`) {
        returned = `c ${op} a ? 1 : 1`
        text = `function f(c, a) {\n  return ${returned};\n}`
      } else if (context === `default`) {
        returned = `b`
        text =
          binding === `later`
            ? `function f(c, b = (${condition(`a`)}1 : 1), a) {\n  return b;\n}`
            : `function f(c, a, b = (${condition(`a`)}1 : 1)) {\n  return b;\n}`
      } else if (context === `forLet`) {
        returned = `i`
        text = `function f(c, a) {\n  for (let i = (${condition(binding === `later` ? `i` : `a`)}1 : 1); ; ) return i;\n}`
      } else {
        returned = `x`
        text = `function f(c, a, xs = [1]) {\n  for (const x of (${condition(binding === `later` ? `x` : `a`)}xs : xs)) return x;\n}`
      }
      const sites = [
        textSite(text, `binary-swap`, op, text.indexOf(`c ${op}`)),
        textSite(
          text,
          `return-undefined`,
          returned,
          text.lastIndexOf(`return `),
        ),
      ]
      textPrograms.push({
        kind: `text`,
        lang: `js`,
        family: `tdz`,
        name: `${context} ${op} ${binding}`,
        text,
        sites,
        inputs: context === `default` ? `defaultArgs` : `pairs`,
      })
    }
const BINDS = {
  none: [`function f(x) {\n  return undefined;\n}`, false],
  varNested: [
    `function f(x) {\n  { var undefined = x; }\n  return undefined;\n}`,
    true,
  ],
  letBlock: [
    `function f(x) {\n  {\n    let undefined = x;\n    return undefined;\n  }\n}`,
    true,
  ],
  param: [`function f(undefined) {\n  return undefined;\n}`, true],
  destructured: [`function f({ undefined }) {\n  return undefined;\n}`, true],
  caught: [
    `function f(x) {\n  try { throw x; } catch (undefined) {\n    return undefined;\n  }\n}`,
    true,
  ],
  functionDeclaration: [
    `function f(x) {\n  function undefined() {}\n  return undefined;\n}`,
    true,
  ],
  classDeclaration: [
    `function f(x) {\n  class undefined {}\n  return undefined;\n}`,
    true,
  ],
  functionExpression: [
    `const f = function undefined(x) {\n  return undefined;\n};`,
    true,
  ],
  classExpression: [
    `const C = class undefined {\n  static m(x) {\n    return undefined;\n  }\n};\nconst f = C.m;`,
    true,
  ],
  methodName: [
    `function f(x) {\n  const o = { undefined() {} };\n  return undefined;\n}`,
    false,
  ],
  label: [
    `function f(x) {\n  undefined: for (;;) break undefined;\n  return undefined;\n}`,
    false,
  ],
}
for (const [form, [text, bound]] of Object.entries(BINDS)) {
  const at = text.lastIndexOf(`return undefined`) + `return `.length
  textPrograms.push({
    kind: `text`,
    lang: `js`,
    family: `binds`,
    name: form,
    text,
    sites: bound
      ? [{ operator: `return-undefined`, position: at, marker: `undefined` }]
      : [],
    inputs: form === `destructured` ? `objects` : `single`,
  })
}
const SCOPE_PREFIX = {
  none: ``,
  eval: `  eval(code);\n`,
}
const SCOPE_TARGETS = {
  undefined: `undefined`,
  constant: `s?.length`,
  local: `a && a`,
}
for (const scope of [`none`, `eval`, `with`])
  for (const [target, expression] of Object.entries(SCOPE_TARGETS)) {
    const head = target === `constant` ? `const s = 'x';\n` : ``
    const body =
      scope === `with`
        ? `  with /* scope */ (o) {\n    return ${expression};\n  }\n`
        : `${SCOPE_PREFIX[scope]}  return ${expression};\n`
    const text = `${head}function f(a, code, o) {\n${body}}`
    const sites = []
    if (scope === `eval`)
      sites.push(textSite(text, `delete-call`, `eval(code);`))
    const returned = text.indexOf(`return `) + `return `.length
    const bindsBreak = scope !== `none`
    if (target !== `undefined` || bindsBreak)
      sites.push({
        operator: `return-undefined`,
        position: returned,
        marker: expression,
      })
    if (target === `constant`)
      sites.push({
        operator: `optional-chain`,
        position: returned,
        marker: `s?.length`,
      })
    if (target === `local`)
      sites.push(textSite(text, `binary-swap`, `&&`, returned))
    textPrograms.push({
      kind: `text`,
      lang: `js`,
      family: `scope`,
      name: `${scope} ${target}`,
      text,
      sites,
      inputs: `scoped`,
    })
  }
{
  const text = `function f(a) {\n  return h(a);\n}\nfunction h(x) {\n  return x;\n}`
  textPrograms.push({
    kind: `text`,
    lang: `js`,
    family: `called`,
    name: `a returned call`,
    text,
    sites: [
      {
        operator: `return-undefined`,
        position: text.indexOf(`h(a)`),
        marker: `h(a)`,
      },
      {
        operator: `value-undefined`,
        position: text.indexOf(`h(a)`),
        marker: `h(a)`,
      },
      {
        operator: `return-undefined`,
        position: text.indexOf(`x;`),
        marker: `x`,
      },
    ],
    inputs: `single`,
  })
}
const COERCED_TYPES = [
  `number`,
  `string | number`,
  `object`,
  `unknown`,
  undefined,
]
for (const type of COERCED_TYPES) {
  const annotation = (t) => (type === undefined ? `` : `: ${t}`)
  const text = `function f(c${annotation(`boolean`)}, p${annotation(type)}, q${annotation(type)}) {\n  if (c || p < q) return 1;\n  return 1;\n}`
  const condition = text.indexOf(`c || p < q`)
  textPrograms.push({
    kind: `text`,
    family: `coerced`,
    name: type ?? `JavaScript`,
    lang: type === undefined ? `js` : `ts`,
    annotation: type,
    text,
    sites: [
      { operator: `if-true`, position: condition, marker: `c || p < q` },
      { operator: `if-false`, position: condition, marker: `c || p < q` },
      textSite(text, `binary-swap`, `||`),
      textSite(text, `binary-swap`, `<`),
      textSite(text, `return-undefined`, `1`, text.indexOf(`return 1`)),
      textSite(text, `return-undefined`, `1`, text.lastIndexOf(`return 1`)),
    ],
    inputs: `coerced`,
  })
}
// The seventh review's dimensions (2026-11-11): every binding form crossed
// with every position of a read, so that a dead zone, a scope boundary, or
// a spelling of `eval` is generated, not found one construct at a time.
//
// - `zone`: a read of `x` in `c OP x ? 1 : 1`, under identical branches,
//   where `x` is bound by a parameter, a destructured parameter, a `let`, a
//   `const`, a class, a caught error's pattern, a `for…of` or `for…in`
//   declaration's pattern, a nested pattern, or a `var` (in a nested block,
//   or in a class's static block, which keeps it from the function). The
//   read sits before the binding's declaration ends, inside its own
//   initializer or pattern, after it, or in a hoisted function that runs
//   before it. A read in the dead zone throws, so the swap shows there.
// - `scope` gains `(eval)(code)`, `(eval as any)(code)` (both direct), and
//   `(0, eval)(code)` (indirect, which declares nothing in the function).
// - `chain`: an ordering swap beside a second comparison in the same `&&`
//   chain (`a < 5 && p < q ? a : 5`, and the bigint form), with `p` and `q`
//   annotated with a primitive or with `object`. An admitted object's
//   `valueOf` distinguishes the swap, so the label belongs only where every
//   comparison in the chain compares primitives.
const ZONE = [
  [
    `param before`,
    `function f(c, b = (c OP x ? 1 : 1), x) {\n  return b;\n}`,
    `zoneDefault`,
  ],
  [
    `param inside`,
    `function f(c, x = (c OP x ? 1 : 1)) {\n  return x;\n}`,
    `zone`,
  ],
  [
    `param after`,
    `function f(c, x, b = (c OP x ? 1 : 1)) {\n  return b;\n}`,
    `zonePairs`,
  ],
  [
    `destructured before`,
    `function f(c, { p = (c OP x ? 1 : 1), x } = o) {\n  return p;\n}`,
    `zone`,
  ],
  [
    `destructured after`,
    `function f(c, { x, p = (c OP x ? 1 : 1) } = o) {\n  return p;\n}`,
    `zone`,
  ],
  [
    `let before`,
    `function f(c) {\n  const r = (c OP x ? 1 : 1);\n  let x = 1;\n  return r;\n}`,
    `zone`,
  ],
  [
    `let inside`,
    `function f(c) {\n  let x = (c OP x ? 1 : 1);\n  return x;\n}`,
    `zone`,
  ],
  [
    `let after`,
    `function f(c) {\n  let x = 1;\n  return (c OP x ? 1 : 1);\n}`,
    `zone`,
  ],
  [
    `const hoisted`,
    `function f(c) {\n  const r = g();\n  const x = 1;\n  return r;\n  function g() {\n    return (c OP x ? 1 : 1);\n  }\n}`,
    `zone`,
  ],
  [
    `class before`,
    `function f(c) {\n  const r = (c OP x ? 1 : 1);\n  class x {}\n  return r;\n}`,
    `zone`,
  ],
  [
    `caught before`,
    `function f(c) {\n  try {\n    throw o;\n  } catch ({ p = (c OP x ? 1 : 1), x }) {\n    return p;\n  }\n}`,
    `zone`,
  ],
  [
    `caught after`,
    `function f(c) {\n  try {\n    throw o;\n  } catch ({ x, p = (c OP x ? 1 : 1) }) {\n    return p;\n  }\n}`,
    `zone`,
  ],
  [
    `for-of pattern`,
    `function f(c) {\n  for (const [p = (c OP x ? 1 : 1), x] of rows) return p;\n}`,
    `zone`,
  ],
  [
    `for-in pattern`,
    `function f(c) {\n  for (const [p = (c OP x ? 1 : 1), x] in o) return p;\n}`,
    `zone`,
  ],
  [
    `for-of body`,
    `function f(c) {\n  for (const x of rows) return (c OP x ? 1 : 1);\n}`,
    `zone`,
  ],
  [
    `nested pattern`,
    `function f(c) {\n  for (const [[p = (c OP x ? 1 : 1)], x] of nested) return p;\n}`,
    `zone`,
  ],
  [
    `var nested`,
    `function f(c) {\n  {\n    var x = 1;\n  }\n  return (c OP x ? 1 : 1);\n}`,
    `zone`,
  ],
  [
    `var before`,
    `function f(c) {\n  const r = (c OP x ? 1 : 1);\n  var x = 1;\n  return r;\n}`,
    `zone`,
  ],
  [
    `static block`,
    `function f(c) {\n  class K {\n    static {\n      var x = 1;\n    }\n  }\n  return (c OP x ? 1 : 1);\n}`,
    `zone`,
  ],
]
for (const [name, template, inputs] of ZONE)
  for (const op of [`&&`, `||`, `??`]) {
    const text = template.replace(`OP`, op)
    const sites = [textSite(text, `binary-swap`, op, text.indexOf(`c ${op}`))]
    for (
      let at = text.indexOf(`return `);
      at >= 0;
      at = text.indexOf(`return `, at + 1)
    ) {
      const start = at + `return `.length
      sites.push({
        operator: `return-undefined`,
        position: start,
        marker: text.slice(start, text.indexOf(`;`, start)),
      })
    }
    if (text.includes(`g()`))
      sites.push(textSite(text, `value-undefined`, `g()`))
    textPrograms.push({
      kind: `text`,
      lang: `js`,
      family: `zone`,
      name: `${name} ${op}`,
      text,
      sites,
      inputs,
    })
  }
for (const [spelling, lang] of [
  [`(eval)(code)`, `js`],
  [`(eval as any)(code)`, `ts`],
  [`(0, eval)(code)`, `js`],
])
  for (const [target, expression] of Object.entries(SCOPE_TARGETS)) {
    const head = target === `constant` ? `const s = 'x';\n` : ``
    const text = `${head}function f(a${lang === `ts` ? `: any` : ``}, code${lang === `ts` ? `: any` : ``}, o${lang === `ts` ? `: any` : ``}) {\n  ${spelling};\n  return ${expression};\n}`
    const direct = !spelling.startsWith(`(0,`)
    const returned = text.indexOf(`return `) + `return `.length
    const sites = [
      {
        operator: `delete-call`,
        position: text.indexOf(spelling),
        marker: `${spelling};`,
      },
    ]
    if (target !== `undefined` || direct)
      sites.push({
        operator: `return-undefined`,
        position: returned,
        marker: expression,
      })
    if (target === `constant`)
      sites.push({
        operator: `optional-chain`,
        position: returned,
        marker: `s?.length`,
      })
    if (target === `local`)
      sites.push(textSite(text, `binary-swap`, `&&`, returned))
    textPrograms.push({
      kind: `text`,
      lang,
      family: `scope`,
      name: `${spelling} ${target}`,
      text,
      sites,
      inputs: `scoped`,
    })
  }
// A direct eval through a local binding named `eval` (the eighth review): a
// sloppy call of the identifier `eval` holding the real `eval` is direct,
// whatever binding holds it.
const EVAL_BINDINGS = {
  parameter: [
    `function f(a, code, o, eval = globalThis.eval) {\n`,
    `  eval(code);\n  return T;\n}`,
  ],
  destructured: [
    `function f(a, code, o) {\n  var { eval } = globalThis;\n`,
    `  eval(code);\n  return T;\n}`,
  ],
  caught: [
    `function f(a, code, o) {\n  try {\n    throw globalThis.eval;\n  } catch (eval) {\n`,
    `  eval(code);\n  return T;\n  }\n}`,
  ],
}
for (const [binding, [open, close]] of Object.entries(EVAL_BINDINGS))
  for (const [target, expression] of Object.entries(SCOPE_TARGETS)) {
    const head = target === `constant` ? `const s = 'x';\n` : ``
    const text = `${head}${open}${close.replace(`T`, expression)}`
    const returned = text.indexOf(`return `) + `return `.length
    const sites = [
      {
        operator: `delete-call`,
        position: text.indexOf(`eval(code);`),
        marker: `eval(code);`,
      },
      { operator: `return-undefined`, position: returned, marker: expression },
    ]
    if (target === `constant`)
      sites.push({
        operator: `optional-chain`,
        position: returned,
        marker: `s?.length`,
      })
    if (target === `local`)
      sites.push(textSite(text, `binary-swap`, `&&`, returned))
    textPrograms.push({
      kind: `text`,
      lang: `js`,
      family: `scope`,
      name: `eval as a ${binding} ${target}`,
      text,
      sites,
      inputs: `scoped`,
    })
  }
// The generator witness of the eighth review: a yield that reads a `let`
// before its declaration.
for (const op of [`&&`, `||`, `??`]) {
  const text = `function f(c) {\n  yield (c ${op} x ? 1 : 1);\n  let x = 1;\n}`
  textPrograms.push({
    kind: `text`,
    lang: `js`,
    family: `zone`,
    name: `let before a yield ${op}`,
    text,
    sites: [textSite(text, `binary-swap`, op)],
    inputs: `zone`,
    generatorOnly: true,
  })
}
// Each program of the dead-zone, scope, binding, and returned-call
// dimensions again as an async function, a generator, and an async
// generator (the eighth review: a rejected promise or a throwing iterator
// is a result too). The first `function` keyword is the one rewritten, and
// every site after it moves by what the rewrite inserts.
const KINDS = {
  async: [`async `, 0],
  generator: [`*`, 8],
  asyncGenerator: [`async *`, 0],
}
for (const program of textPrograms.splice(0)) {
  const at = program.text.indexOf(`function `)
  const kinds = [
    `sync`,
    ...(at < 0 || ![`zone`, `scope`, `binds`, `called`].includes(program.family)
      ? []
      : Object.keys(KINDS)),
  ]
  for (const kind of kinds) {
    if (program.generatorOnly && !kind.toLowerCase().includes(`generator`))
      continue
    if (kind === `sync`) {
      if (!program.generatorOnly) textPrograms.push(program)
      continue
    }
    const [insert, offset] = KINDS[kind]
    const pieces =
      insert === `async *`
        ? [
            [`async `, 0],
            [`*`, 8],
          ]
        : [[insert, offset]]
    let text = program.text
    let sites = program.sites
    let shift = 0
    for (const [piece, after] of pieces) {
      const where = at + after + shift
      text = `${text.slice(0, where)}${piece}${text.slice(where)}`
      sites = sites.map((site) =>
        site.position >= where
          ? { ...site, position: site.position + piece.length }
          : site,
      )
      shift += piece.length
    }
    textPrograms.push({
      ...program,
      name: `${program.name}, ${kind}`,
      text,
      sites,
      generatorOnly: undefined,
    })
  }
}
const CHAIN_FORMS = {
  number: [`number`, `a < 5 && p < q ? a : 5`],
  bigint: [`bigint`, `a < b && p < q ? a : b`],
}
for (const [form, [type, expression]] of Object.entries(CHAIN_FORMS))
  for (const other of [`number`, `object`]) {
    const params = form === `number` ? `a: number` : `a: bigint, b: bigint`
    const text = `function f(${params}, p: ${other}, q: ${other}) {\n  return ${expression};\n}`
    const returned = text.indexOf(`return `) + `return `.length
    textPrograms.push({
      kind: `text`,
      family: `chain`,
      name: `${form} beside ${other}`,
      lang: `ts`,
      annotation: other,
      operandType: type,
      text,
      sites: [
        {
          operator: `return-undefined`,
          position: returned,
          marker: expression,
        },
        textSite(text, `binary-swap`, `<`, returned),
        textSite(text, `binary-swap`, `&&`, returned),
        textSite(text, `binary-swap`, `<`, text.indexOf(`p <`)),
      ],
      inputs: form === `number` ? `chainNumber` : `chainBigint`,
    })
  }
// A getter read through `with`, counted as an effect.
const READ_ONCE = () => ({
  get a() {
    effects.count += 1
    return 1
  },
  get undefined() {
    effects.count += 1
    return 5
  },
})
// The names the zone programs read from outside: a thrown object, whose
// one key is empty (so a `for…in` pattern destructures `''`), rows to
// iterate, and a global `x` whose getter counts its reads (a static block's
// `var` is not the function's, so its `x` is this global).
function installZone() {
  globalThis.o = { '': 1 }
  globalThis.rows = [[]]
  globalThis.nested = [[[]]]
  Object.defineProperty(globalThis, `x`, {
    configurable: true,
    get() {
      effects.count += 1
      return 1
    },
  })
}
const ZONE_C = [true, false, 0, 1, null, undefined]
const TEXT_INPUTS = {
  zone: () => {
    installZone()
    return ZONE_C.map((c) => [c])
  },
  zoneDefault: () => {
    installZone()
    return ZONE_C.map((c) => [c, undefined, 1])
  },
  zonePairs: () => {
    installZone()
    return ZONE_C.map((c) => [c, 1])
  },
  chainNumber: () =>
    [4, 5, 6, `5`].flatMap((a) =>
      [1, 2, VALUED, {}].flatMap((p) =>
        [1, 2, VALUED, {}].map((q) => [a, p, q]),
      ),
    ),
  chainBigint: () =>
    [4n, 5n, 5, null].flatMap((a) =>
      [5n, 5, 0n].flatMap((b) =>
        [1, 2, VALUED, {}].flatMap((p) =>
          [1, 2, VALUED, {}].map((q) => [a, b, p, q]),
        ),
      ),
    ),
  pairs: () =>
    [true, false, 0, 1, null, undefined].flatMap((c) =>
      [0, 1, null].map((a) => [c, a]),
    ),
  defaultArgs: () =>
    [true, false, 0, 1, null, undefined].flatMap((c) =>
      [0, 1, null].map((a) => [c, undefined, a]),
    ),
  single: () => [[5], [0], [null], [undefined]],
  objects: () => [[{ undefined: 5 }], [{}]],
  scoped: () => [
    [1, ``, {}],
    [1, `var undefined = 5`, {}],
    [1, `var s = null`, {}],
    [1, `a = 2`, {}],
    [1, `throw 1`, {}],
    [1, ``, READ_ONCE()],
    [0, ``, { s: null }],
  ],
  coerced: () =>
    [true, false].flatMap((c) =>
      [1, 2, `1`, VALUED, {}].flatMap((p) =>
        [1, 2, VALUED, {}].map((q) => [c, p, q]),
      ),
    ),
}
// The inputs of the declared types, where an annotation declares them.
const COERCED_TYPED = {
  number: (p) => typeof p === `number`,
  'string | number': (p) => typeof p === `number` || typeof p === `string`,
  object: (p) => typeof p === `object` && p !== null,
  unknown: () => true,
}
// A result by kind and value: a function or an object is its kind alone,
// since each run makes a fresh one.
const encoded = (value) =>
  typeof value === `function`
    ? `function`
    : typeof value === `object` && value !== null
      ? value === VALUED
        ? `the coerced object`
        : `object`
      : shown(value)
const loadText = (text) => {
  const js = ts.transpileModule(text, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
  }).outputText
  return new Function(`${js}\nreturn f`)()
}
// A result as it settles (the eighth review: a promise, or an iterator, is
// a result only once it settles). A promise is awaited: fulfilled with an
// encoded value, or rejected with an error's name. An iterator is driven,
// eight steps at most: each yield, the return, or a throw.
const ITERATION_BOUND = 8
async function settled(value) {
  if (typeof value?.then === `function`) {
    try {
      return `fulfilled ${encoded(await value)}`
    } catch (error) {
      return `rejected ${error?.name}`
    }
  }
  if (
    typeof value?.next === `function` &&
    (Symbol.iterator in value || Symbol.asyncIterator in value)
  ) {
    const steps = []
    try {
      for (let i = 0; i < ITERATION_BOUND; i += 1) {
        const step = await value.next()
        steps.push(`${step.done ? `return` : `yield`} ${encoded(step.value)}`)
        if (step.done) break
      }
    } catch (error) {
      steps.push(`threw ${error?.name}`)
    }
    return `iterated ${steps.join(`, `)}`
  }
  return encoded(value)
}
// Each run of a function over a domain, settled, with its effects.
async function settledRuns(f, domain) {
  const runs = []
  for (const input of domain) {
    const before = effects.count
    let result
    try {
      result = await settled(f(...input))
    } catch (error) {
      result = `threw ${error.name}`
    }
    runs.push({ result, reads: effects.count - before })
  }
  return runs
}
// The model of a text program: the runs of its text and of each site's
// mutant text, settled. They are computed when this file loads, since a
// settled run is asynchronous and the model is not.
const textRuns = new Map()
const textKey = (program, text) =>
  `${program.family}\u0000${program.name}\u0000${text}`
for (const program of textPrograms)
  for (const text of [
    program.text,
    ...program.sites.map((site) => mutateSite(program.text, site)),
  ])
    textRuns.set(
      textKey(program, text),
      await settledRuns(loadText(text), TEXT_INPUTS[program.inputs]()),
    )
const sameRun = (x, y) => x.result === y.result && x.reads === y.reads
// The model's expectation for a text program, from its settled runs: a
// site is distinct where some input's run differs, and labelled where no
// input of the declared types does.
function textModel(program) {
  const original = textRuns.get(textKey(program, program.text))
  const typed = textTypedMask(program)
  return {
    source: program.text,
    sites: program.sites.map((site) => {
      const runs = textRuns.get(
        textKey(program, mutateSite(program.text, site)),
      )
      const distinct = runs.some((run, i) => !sameRun(run, original[i]))
      return {
        operator: site.operator,
        position: site.position,
        distinct,
        label:
          typed !== undefined &&
          distinct &&
          runs.every((run, i) => !typed[i] || sameRun(run, original[i])),
        dead: !distinct,
        zeroDistinct: false,
        ...(site.operator === `return-undefined` ? { runs: digest(runs) } : {}),
      }
    }),
  }
}
function renderText(program) {
  return {
    text: program.text,
    sites: program.sites.map((site) => ({
      operator: site.operator,
      position: site.position,
      change: { kind: `text`, text: mutateSite(program.text, site) },
    })),
  }
}
const textDomain = (program) => TEXT_INPUTS[program.inputs]()
// Which inputs of a text program's domain its declared types admit, where
// an annotation declares them.
const textTypedMask = (program) => {
  const typed = textTypedDomain(program)
  if (typed === undefined) return undefined
  const domain = TEXT_INPUTS[program.inputs]()
  const admitted = new Set(typed.map((input) => input.map(encoded).join()))
  return domain.map((input) => admitted.has(input.map(encoded).join()))
}
const textTypedDomain = (program) => {
  if (program.family === `coerced` && program.annotation !== undefined)
    return textDomain(program).filter(
      ([, p, q]) =>
        COERCED_TYPED[program.annotation](p) &&
        COERCED_TYPED[program.annotation](q),
    )
  if (program.family === `chain`) {
    // Without strict null checks an annotated operand admits `null`, and the
    // CLI does not know the package's strictness (the eighth review).
    const operand = (v) => typeof v === program.operandType || v === null
    const other = COERCED_TYPED[program.annotation]
    return textDomain(program).filter((input) => {
      const [p, q] = input.slice(-2)
      return input.slice(0, -2).every(operand) && other(p) && other(q)
    })
  }
  return undefined
}

// ## Hostile programs
//
// A family of fixed programs from five reviews (2026-11-10 to 2026-11-11).
// Each held a static judgment that some input defeats: a narrowing, a type,
// a literal, a binding, or a coercion. The shapes: (a) a `case` that falls
// through into `default`; (b) a numeric enum, where a number is admitted,
// and a string enum; (c) a property read with effects between its guard and
// its read, through a getter, a generator, a `toString`, a Proxy's `has`
// trap, `Symbol.hasInstance`, a nested or an optional read, and
// path-to-regexp's last union member; (d) a default parameter that runs
// before the body; (e) a `never` default fed by an `as` cast, and ms's
// `satisfies never` fed by a regex through `as`; (f) an extra label that a
// template computes; (g) operand types from `bigint | null` and `bigint`
// without strict null checks, a local fed by `any`, a cast, or
// `JSON.parse`, JavaScript with or without JSDoc, and generics instantiated
// with `any`; the conditions of an exhaustive-switch skip, each broken
// once; a comparison beside a call; overloads; ambient constants; and the
// fifth review's nested `var`s, imports, zero literals, changed constants,
// coercions, and type-only merges; and a closure that reads a `let` before
// its assignment. Each program's inputs include one that
// distinguishes a mutant there, which its reach state records.
//
// Laws (see `checkEscape`): erasing the types changes no emitted site and no
// dead-code mark; each dead-code mark holds on the inputs; and a returned
// `undefined` that a declaration binds is a site. A mutant is applied as
// text (its operator's `original` replaced at its position by its
// `replacement`), and the program and the mutant run on each input, by
// their results and their `log()` calls.
const ESCAPE_PROGRAMS = [
  {
    name: `a case that falls through into default`,
    text: `export function f(x: 'a' | 'b') {\n  switch (x) {\n    case 'a':\n    case 'b':\n    default:\n      log()\n      return 1\n  }\n}`,
    inputs: () => [[`a`], [`b`]],
  },
  {
    name: `a numeric enum switched`,
    text: `export enum E { A, B }\nexport function f(e: E) {\n  switch (e) {\n    case 0: return 'a'\n    case 1: return 'b'\n    default: log(); return 'z'\n  }\n}`,
    inputs: () => [[0], [1], [2]],
  },
  {
    name: `a numeric enum tested`,
    text: `export enum E { A, B }\nexport function f(e: E) {\n  if (e === 0) return 'a'\n  if (e === 1) return 'b'\n  log()\n  return 'z'\n}`,
    inputs: () => [[0], [1], [2]],
  },
  {
    name: `a class getter`,
    text: `export class C { n = 0; get k(): 'a' | 'b' { return this.n++ % 2 ? 'b' : 'a' } }\nexport function f(c: C) {\n  if (c.k !== 'a') return 0\n  if (c.k === 'a') return 1\n  log()\n  return 2\n}`,
    inputs: (m) => [[new m.C()]],
  },
  {
    name: `a generator iterated between the guard and the read`,
    text: `export function f(o: { k: 'a' | 'b' }, it: Iterable<number>) {\n  if (o.k !== 'a') return 0\n  for (const _ of it) {}\n  if (o.k === 'a') return 1\n  log()\n  return 2\n}`,
    inputs: () => [[{ k: `a` }, []], [{ k: `b` }, []], changing(`k`, `b`)],
  },
  {
    name: `a generator spread between the guard and the read`,
    text: `export function f(o: { k: 'a' | 'b' }, it: Iterable<number>) {\n  if (o.k !== 'a') return 0\n  const xs = [...it]\n  if (o.k === 'a') return xs.length\n  log()\n  return 2\n}`,
    inputs: () => [[{ k: `a` }, []], changing(`k`, `b`)],
  },
  {
    name: `a template that calls toString`,
    text: "export function f(o: { k: 'a' | 'b' }, t: { toString(): string }) {\n  if (o.k !== 'a') return 0\n  const s = `${t}`\n  if (o.k === 'a') return s\n  log()\n  return 2\n}",
    inputs: () => {
      const o = { k: `a` }
      return [
        [{ k: `a` }, `t`],
        [
          o,
          {
            toString() {
              o.k = `b`
              return `u`
            },
          },
        ],
      ]
    },
  },
  {
    name: `an in test through a Proxy`,
    text: `export function f(o: { k: 'a' | 'b' }, p: object) {\n  if (o.k !== 'a') return 0\n  const has = 'x' in p\n  if (o.k === 'a') return has\n  log()\n  return 2\n}`,
    inputs: () => {
      const o = { k: `a` }
      const trap = new Proxy(
        {},
        {
          has() {
            o.k = `b`
            return true
          },
        },
      )
      return [
        [{ k: `a` }, {}],
        [o, trap],
      ]
    },
  },
  {
    name: `an instanceof through Symbol.hasInstance`,
    text: `export function f(o: { k: 'a' | 'b' }, v: unknown, K: { [Symbol.hasInstance](v: unknown): boolean }) {\n  if (o.k !== 'a') return 0\n  const is = v instanceof K\n  if (o.k === 'a') return is\n  log()\n  return 2\n}`,
    inputs: () => {
      const o = { k: `a` }
      const K = {
        [Symbol.hasInstance]() {
          o.k = `b`
          return false
        },
      }
      return [
        [{ k: `a` }, 1, { [Symbol.hasInstance]: () => true }],
        [o, 1, K],
      ]
    },
  },
  {
    name: `a getter read into a const`,
    text: `export function f(o: { k: 'a' | 'b'; readonly j: number }) {\n  if (o.k !== 'a') return 0\n  const j = o.j\n  if (o.k === 'a') return j\n  log()\n  return 2\n}`,
    inputs: () => {
      const o = {
        k: `a`,
        get j() {
          o.k = `b`
          return 1
        },
      }
      return [[{ k: `a`, j: 1 }], [o]]
    },
  },
  {
    name: `a nested discriminant`,
    text: `export function f(o: { v: { t: 'a' } | { t: 'b' } }, it: Iterable<number>) {\n  if (o.v.t !== 'a') return 0\n  for (const _ of it) {}\n  if (o.v.t === 'a') return 1\n  log(); return 2\n}`,
    inputs: () => {
      const o = { v: { t: `a` } }
      function* change() {
        o.v = { t: `b` }
        yield 1
      }
      return [
        [{ v: { t: `a` } }, []],
        [o, change()],
      ]
    },
  },
  {
    name: `an optional read through a getter`,
    text: `export function f(o: { k: 'a' | 'b' } | undefined) {\n  if (o?.k !== 'a') return 0\n  if (o?.k === 'a') return 1\n  log()\n  return 2\n}`,
    inputs: () => {
      let reads = 0
      return [
        [{ k: `a` }],
        [undefined],
        [
          {
            get k() {
              reads += 1
              return reads > 1 ? `b` : `a`
            },
          },
        ],
      ]
    },
  },
  {
    name: `a default parameter that runs first`,
    text: `export function f(o: { k: 'a' }, m: () => void, _u: void = m()) {\n  if (o.k === 'a') return 1\n  log(); return 2\n}`,
    inputs: () => {
      const o = { k: `a` }
      return [
        [{ k: `a` }, () => {}],
        [
          o,
          () => {
            o.k = `b`
          },
        ],
      ]
    },
  },
  {
    name: `a never default fed by a cast`,
    text: `type K = 'a' | 'b'\nexport function f(raw: string) {\n  const k = raw as K\n  switch (k) {\n    case 'a': return 1\n    case 'b': return 2\n    default: { const n: never = k; log(); return n }\n  }\n}`,
    inputs: () => [[`a`], [`b`], [`z`]],
  },
  {
    name: `an extra label that a template computes`,
    text: "export function f(x: 'a', o: { k: 'a' | 'b' }, t: { toString(): string }) {\n  if (o.k !== 'a') return 0\n  switch (x) {\n    case `${t}`: return 1\n    case o.k: return 2\n    default: log(); return 3\n  }\n}",
    inputs: () => {
      const o = { k: `a` }
      return [
        [`a`, { k: `a` }, `a`],
        [
          `a`,
          o,
          {
            toString() {
              o.k = `b`
              return `z`
            },
          },
        ],
      ]
    },
  },
  // The switch rule's own conditions, each broken once with a typed input
  // that reaches the default.
  {
    name: `a string enum switched`,
    text: `export enum E { A = 'a', B = 'b' }\nexport function f(e: E) {\n  switch (e) {\n    case E.A: return 1\n    case E.B: return 2\n    default: log(); return 3\n  }\n}`,
    inputs: () => [[`a`], [`b`], [`z`]],
  },
  {
    name: `a subject with a default value`,
    text: `export function f(t: 'a' | 'b' = 'z' as 'a') {\n  switch (t) {\n    case 'a': return 1\n    case 'b': return 2\n    default: log(); return 3\n  }\n}`,
    inputs: () => [[`a`], [`b`], []],
  },
  {
    name: `an optional subject`,
    text: `export function f(t?: 'a' | 'b') {\n  switch (t) {\n    case 'a': return 1\n    case 'b': return 2\n    default: log(); return 3\n  }\n}`,
    inputs: () => [[`a`], [`b`], []],
  },
  {
    name: `a subject assigned from a cast`,
    text: `export function f(t: 'a' | 'b', m: boolean) {\n  if (m) t = 'z' as 'a'\n  switch (t) {\n    case 'a': return 1\n    case 'b': return 2\n    default: log(); return 3\n  }\n}`,
    inputs: () => [
      [`a`, false],
      [`a`, true],
    ],
  },
  {
    name: `a subject that a callback assigns`,
    text: `export function f(t: 'a' | 'b', run: (set: () => void) => void) {\n  run(() => { t = 'z' as 'a' })\n  switch (t) {\n    case 'a': return 1\n    case 'b': return 2\n    default: log(); return 3\n  }\n}`,
    inputs: () => [
      [`a`, () => {}],
      [`a`, (set) => set()],
    ],
  },
  {
    name: `a subject that eval assigns`,
    text: `export function f(t: 'a' | 'b', code: string) {\n  eval(code)\n  switch (t) {\n    case 'a': return 1\n    case 'b': return 2\n    default: log(); return 3\n  }\n}`,
    inputs: () => [
      [`a`, ``],
      [`a`, `t = 'z'`],
    ],
  },
  {
    name: `a switch that misses a member`,
    text: `export function f(t: 'a' | 'b') {\n  switch (t) {\n    case 'a': return 1\n    default: log(); return 3\n  }\n}`,
    inputs: () => [[`a`], [`b`]],
  },
  {
    name: `a function the default declares`,
    text: `export function f(t: 'a' | 'b') {\n  switch (t) {\n    case 'a': return g()\n    case 'b': return 2\n    default:\n      function g() { log(); return 1 }\n  }\n}`,
    inputs: () => [[`a`], [`b`]],
  },
  {
    name: `a property's last member, as path-to-regexp tests it`,
    text: `type Token = { type: 'text'; value: string } | { type: 'param'; name: string } | { type: 'wildcard'; name: string }\nexport function f(tokens: Token[]) {\n  let out = ''\n  for (const token of tokens) {\n    if (token.type === 'text') { out += token.value; continue }\n    if (token.type === 'param') { out += ':' + token.name; continue }\n    if (token.type === 'wildcard') { out += '*' + token.name; continue }\n    log()\n  }\n  return out\n}`,
    inputs: () => [
      [[{ type: `text`, value: `a` }]],
      [[{ type: `wildcard`, name: `w` }]],
      [[{ type: `other`, name: `o` }]],
    ],
  },
  {
    name: `a satisfies never whose subject a regex feeds through as, as in ms`,
    text: `type Unit = 'ms' | 's'\nexport function f(str: string) {\n  const match = /^(\\d+)(ms|s|h)?$/.exec(str)\n  if (!match) return NaN\n  const type = (match[2] || 'ms').toLowerCase() as Unit\n  const n = Number(match[1])\n  switch (type) {\n    case 'ms': return n\n    case 's': return n * 1000\n    default:\n      type satisfies never\n      log()\n      return NaN\n  }\n}`,
    inputs: () => [[`1ms`], [`1s`], [`1h`]],
  },
  // The ordering swap's operand types: each from a source the rule does not
  // trust, with an input that ties its operands at different values.
  {
    name: `a bigint | null parameter without strict null checks`,
    strict: false,
    text: `export function f(a: bigint | null, b: bigint) { return a < b ? a : b }`,
    inputs: () => [
      [1n, 0n],
      [null, 0n],
    ],
  },
  {
    name: `bigint parameters without strict null checks`,
    strict: false,
    text: `export function f(a: bigint, b: bigint) { return a < b ? a : b }`,
    inputs: () => [
      [1n, 0n],
      [null, 0n],
    ],
  },
  {
    name: `a bigint parameter and a zero without strict null checks`,
    strict: false,
    text: `export function f(a: bigint) { return a < 0n ? a : 0n }`,
    inputs: () => [[1n], [null]],
  },
  {
    name: `a local number fed by any`,
    text: `export function f(o: any) { const x: number = o; return x < 5 ? x : 5 }`,
    inputs: () => [[1], [`5`]],
  },
  {
    name: `a local number fed by a cast`,
    text: `export function f(s: string) { const x = s as unknown as number; return x < 5 ? x : 5 }`,
    inputs: () => [[`1`], [`5`]],
  },
  {
    name: `a local number fed by JSON.parse`,
    text: `export function f(s: string) { const x: number = JSON.parse(s); return x < 5 ? x : 5 }`,
    inputs: () => [[`1`], [`"5"`]],
  },
  {
    name: `a number parameter assigned from a cast`,
    text: `export function f(a: number, s: string) { a = s as unknown as number; return a < 5 ? a : 5 }`,
    inputs: () => [[0, `5`]],
  },
  {
    name: `a number parameter assigned by destructuring`,
    text: `export function f(a: number, o: any) { [a] = o; return a < 5 ? a : 5 }`,
    inputs: () => [[0, [`5`]]],
  },
  {
    name: `a number parameter that eval assigns`,
    text: `export function f(a: number, code: string) { eval(code); return a < 5 ? a : 5 }`,
    inputs: () => [[0, `a = '5'`]],
  },
  {
    name: `a number parameter that a var redeclares`,
    text: `export function f(a: number, s: any) { { var a: number = s } return a < 5 ? a : 5 }`,
    inputs: () => [[0, `5`]],
  },
  {
    name: `JavaScript with a JSDoc number`,
    ext: `js`,
    text: `/** @param {number} x */\nexport function f(x) { return x < 5 ? x : 5 }`,
    inputs: () => [[1], [`5`]],
  },
  {
    name: `JavaScript with JSDoc bigints`,
    ext: `js`,
    text: `/** @param {bigint} a @param {bigint} b */\nexport function f(a, b) { return a < b ? a : b }`,
    inputs: () => [
      [1n, 0n],
      [0n, 0],
    ],
  },
  {
    name: `JavaScript with a JSDoc cast`,
    ext: `js`,
    text: `export function f(s) { const x = /** @type {number} */ (s); return x < 5 ? x : 5 }`,
    inputs: () => [[1], [`5`]],
  },
  {
    name: `untyped JavaScript that reassigns a number`,
    ext: `js`,
    text: `export function f(s) { let x = 0; x = s; return x < 5 ? x : 5 }`,
    inputs: () => [[1], [`5`]],
  },
  {
    name: `a generic instantiated with any`,
    text: `export function f<T extends bigint>(a: T, b: T) { return a < b ? a : b }`,
    inputs: () => [
      [1n, 0n],
      [0n, 0],
    ],
  },
  {
    name: `a generic call fed by any`,
    text: `function g<T>(v: T): T { return v }\nexport function f(a: bigint, s: any) { const b = g<bigint>(s); return a < b ? a : b }`,
    inputs: () => [
      [1n, 0n],
      [0n, 0],
    ],
  },
  // The third review (2026-11-11): a comparison beside a call, whose
  // evaluation an ordering swap changes at a tie, and overloads, whose
  // callers see only the overload signatures. TypeScript erases an
  // overload's type parameters when it checks the implementation, so a
  // caller can pass what the implementation's annotation excludes. And an
  // ambient constant, whose value the environment gives.
  {
    name: `a comparison beside a call under &&`,
    text: `export function f(a: number, check: () => boolean): number {\n  return a < 1 && check() ? a : 1\n}`,
    inputs: () => [
      [0, () => true],
      [
        1,
        () => {
          throw new Error(`called`)
        },
      ],
    ],
  },
  {
    name: `a bigint comparison beside a call under ||`,
    text: `export function f(a: bigint, b: bigint, check: () => boolean): bigint {\n  if (a < b || check()) return a\n  return b\n}`,
    inputs: () => [
      [0n, 1n, () => true],
      [
        1n,
        1n,
        () => {
          throw new Error(`called`)
        },
      ],
    ],
  },
  {
    name: `a switch under a generic overload`,
    text: `export function f<T extends string>(x: T): number\nexport function f(x: 'a' | 'b'): number {\n  switch (x) {\n    case 'a': return 1\n    case 'b': return 2\n    default: log(); return 3\n  }\n}`,
    inputs: () => [[`a`], [`zzz`]],
  },
  {
    name: `a bigint swap under a generic overload`,
    text: `export function f<T>(a: T, b: T): T\nexport function f(a: bigint, b: bigint): bigint {\n  return a < b ? a : b\n}`,
    inputs: () => [
      [1n, 0n],
      [0, -0],
    ],
  },
  {
    name: `a switch in an overloaded method`,
    text: `export class C {\n  m<T extends string>(x: T): number\n  m(x: 'a' | 'b'): number {\n    switch (x) {\n      case 'a': return 1\n      case 'b': return 2\n      default: log(); return 3\n    }\n  }\n}\nexport const f = (x: string) => new C().m(x)`,
    inputs: () => [[`a`], [`zzz`]],
  },
  {
    name: `a switch on an ambient constant`,
    text: `declare const K = 'a'\nexport function f(): number {\n  switch (K) {\n    case 'a': return 1\n    default: log(); return 3\n  }\n}`,
    inputs: () => {
      globalThis.K = `z`
      return [[]]
    },
  },
  {
    name: `a swap with an ambient constant`,
    text: `declare const K = 5\nexport function f(x: number): number { return x < K ? x : K }`,
    inputs: () => {
      globalThis.K = `5`
      return [[1], [5]]
    },
  },
  {
    name: `an equality tie of locals fed by any`,
    text: `export function f(s: any, t: any) {\n  const a: bigint = s\n  const c: bigint = t\n  if (a !== c) return a\n  return c\n}`,
    inputs: () => [
      [1n, 0n],
      [0, -0],
    ],
  },
  // F17's operators: an optional read whose receiver's type the rule does
  // not trust, and a returned value typed `undefined` or `void`, each with
  // an input that JavaScript allows.
  {
    name: `an optional read of a local fed by any`,
    text: `export function f(s: any) { const p: { v: number } = s; return p?.v }`,
    inputs: () => [[{ v: 1 }], [undefined]],
  },
  {
    name: `an optional read of a local fed by a cast`,
    text: `export function f(s: unknown) { const p = s as { v: number }; return p?.v }`,
    inputs: () => [[{ v: 1 }], [undefined]],
  },
  {
    name: `an optional read of a property`,
    text: `export function f(w: { o: { v: number } }) { return w.o?.v }`,
    inputs: () => [[{ o: { v: 1 } }], [{ o: undefined }]],
  },
  {
    name: `an optional read of a generic parameter`,
    text: `export function f<T extends { v: number }>(o: T) { return o?.v }`,
    inputs: () => [[{ v: 1 }], [undefined]],
  },
  {
    name: `an optional read of an optional parameter`,
    text: `export function f(o?: { v: number }) { return o?.v }`,
    inputs: () => [[{ v: 1 }], []],
  },
  {
    name: `an optional read of a defaulted parameter`,
    text: `export function f(o: { v: number } = undefined as any) { return o?.v }`,
    inputs: () => [[{ v: 1 }], []],
  },
  {
    name: `an optional read of an assigned parameter`,
    text: `export function f(o: { v: number }, s: any) { o = s; return o?.v }`,
    inputs: () => [
      [{ v: 1 }, { v: 2 }],
      [{ v: 1 }, undefined],
    ],
  },
  {
    name: `an optional read of a parameter that eval assigns`,
    text: `export function f(o: { v: number }, code: string) { eval(code); return o?.v }`,
    inputs: () => [
      [{ v: 1 }, ``],
      [{ v: 1 }, `o = undefined`],
    ],
  },
  {
    name: `an optional read in JavaScript with a JSDoc type`,
    ext: `js`,
    text: `/** @param {{ v: number }} o */\nexport function f(o) { return o?.v }`,
    inputs: () => [[{ v: 1 }], [undefined]],
  },
  {
    name: `an optional read of a parameter without strict null checks`,
    strict: false,
    text: `export function f(o: { v: number }) { return o?.v }`,
    inputs: () => [[{ v: 1 }], [undefined]],
  },
  {
    name: `an optional read under a generic overload`,
    text: `export function f<T>(x: T): number | undefined\nexport function f(x: { n: number }): number | undefined {\n  return x?.n\n}`,
    inputs: () => [[{ n: 1 }], [null]],
  },
  {
    name: `a returned parameter typed undefined`,
    text: `export function f(x: undefined) { return x }`,
    inputs: () => [[undefined], [5]],
  },
  {
    name: `a returned parameter typed void`,
    text: `export function f(x: void) { return x }`,
    inputs: () => [[undefined], [5]],
  },
  // The fifth review (2026-11-11): each program defeats a static judgment
  // that the CLI made without types or with them. A `var` in a nested block
  // is the function's, and an import binds a name. `0x0`, `0.0`, `0b0`,
  // and `0x0n` are zeros. A namespace's or a CommonJS module's exported
  // `const` is a property that code can change. An object's `valueOf` runs
  // when a comparison coerces it. The rest change nothing but types: an
  // overload named by a default export or a quoted method, an interface
  // merged with a class, and a function type without strict function types.
  {
    name: `a nested var that shadows a constant beside a swap`,
    text: `const k = 5\nexport function f(a: number): number {\n  { var k = 0 }\n  return a < k ? a : k\n}`,
    inputs: () => [[-0], [1]],
  },
  {
    name: `a nested var that shadows a constant beside a guard`,
    text: `const k = 5\nexport function f(a: number): number {\n  { var k = 0 }\n  if (a !== k) return a\n  return k\n}`,
    inputs: () => [[-0], [1]],
  },
  {
    name: `a nested var that shadows a constant receiver`,
    text: `const s = 'x'\nexport function f(): number | undefined {\n  { var s: string | undefined = undefined }\n  return s?.length\n}`,
    inputs: () => [[]],
  },
  {
    name: `a nested var named undefined`,
    text: `export function f(): number | undefined {\n  { var undefined = 5 }\n  return undefined\n}`,
    inputs: () => [[]],
  },
  {
    name: `an import named undefined`,
    text: `import { five as undefined } from './five'\nexport function f(): number { return undefined }`,
    inputs: () => [[]],
  },
  {
    name: `a destructured parameter named undefined`,
    text: `export function f({ undefined }: { undefined: number }): number { return undefined }`,
    inputs: () => [[{ undefined: 5 }]],
  },
  {
    name: `a hexadecimal zero beside a guard`,
    text: `export function f(a: number): number {\n  if (a !== 0x0) return a\n  return 0x0\n}`,
    inputs: () => [[-0], [1]],
  },
  {
    name: `a decimal zero with a fraction beside a guard`,
    text: `export function f(a: number): number {\n  if (a !== 0.0) return a\n  return 0.0\n}`,
    inputs: () => [[-0], [1]],
  },
  {
    name: `a binary zero beside a guard in JavaScript`,
    ext: `js`,
    text: `export function f(a) {\n  if (a !== 0b0) return a\n  return 0b0\n}`,
    inputs: () => [[-0], [1]],
  },
  {
    name: `a hexadecimal bigint zero beside a swap`,
    text: `export function f(a: bigint): bigint {\n  return a < 0x0n ? a : 0x0n\n}`,
    inputs: () => [[1n], [null], [0]],
  },
  {
    name: `a namespace constant that code changes`,
    text: `export namespace N {\n  export const s: string | undefined = 'x'\n  export function f(): number | undefined { return s?.length }\n}\nexport const f = N.f`,
    inputs: (m) => {
      m.N.s = undefined
      return [[]]
    },
  },
  {
    name: `an exported constant that a CommonJS caller changes`,
    text: `export const s: string | undefined = 'x'\nexport function f(): number | undefined { return s?.length }`,
    inputs: (m) => {
      m.s = undefined
      return [[]]
    },
  },
  {
    name: `a comparison that coerces an object beside identical branches`,
    text: `export function f(c: boolean, p: object, q: object): number {\n  if (c || p < q) return 1\n  return 1\n}`,
    inputs: () => {
      const loud = {
        valueOf() {
          throw new Error(`coerced`)
        },
      }
      return [
        [true, loud, loud],
        [false, {}, {}],
      ]
    },
  },
  {
    name: `a comparison that coerces an object under && beside identical branches`,
    text: `export function f(c: boolean, p: object, q: object): number {\n  return c && p < q ? 1 : 1\n}`,
    inputs: () => {
      const loud = {
        valueOf() {
          throw new Error(`coerced`)
        },
      }
      return [
        [false, loud, loud],
        [true, {}, {}],
      ]
    },
  },
  {
    name: `a swap beside a comparison of objects`,
    text: `export function f(a: number, p: object, q: object): number {\n  return a < 1 && p < q ? a : 1\n}`,
    inputs: () => {
      const loud = {
        valueOf() {
          throw new Error(`coerced`)
        },
      }
      return [
        [1, loud, loud],
        [0, 1, 2],
      ]
    },
  },
  {
    name: `a closure that reads a let before its assignment`,
    text: `export function f(c: boolean): number {\n  const read = () => (c && x ? 1 : 1)\n  const r = read()\n  let x = 1\n  return r + x\n}`,
    inputs: () => [[false], [true]],
  },
  {
    name: `a returned dynamic import`,
    text: `export function f() {\n  return import('./five')\n}`,
    inputs: () => [[]],
  },
  {
    name: `an overloaded default export`,
    text: `export default function g<T extends string>(x: T): number\nexport default function g(x: 'a' | 'b'): number {\n  switch (x) {\n    case 'a': return 1\n    case 'b': return 2\n    default: log(); return 3\n  }\n}\nexport const f = g`,
    inputs: () => [[`a`], [`zzz`]],
  },
  {
    name: `an overload named by a quoted method`,
    text: `export class K {\n  'm'<T extends string>(x: T): number\n  m(x: 'a' | 'b'): number {\n    switch (x) {\n      case 'a': return 1\n      case 'b': return 2\n      default: log(); return 3\n    }\n  }\n}\nexport const f = (x: string) => new K().m(x)`,
    inputs: () => [[`a`], [`zzz`]],
  },
  {
    name: `an interface merged with a class`,
    text: `export interface K { m(x: string): number }\nexport class K {\n  m(x: 'a' | 'b'): number {\n    switch (x) {\n      case 'a': return 1\n      case 'b': return 2\n      default: log(); return 3\n    }\n  }\n}\nexport const f = (x: string) => new K().m(x)`,
    inputs: () => [[`a`], [`zzz`]],
  },
  {
    name: `an optional read under a wider function type`,
    text: `type H = (x: { n: number } | undefined) => number | undefined\nexport const f: H = (x: { n: number }): number | undefined => x?.n`,
    inputs: () => [[{ n: 1 }], [undefined]],
  },
]
// A history is data, so each program's inputs are found by its name.
const ESCAPE_INPUTS = new Map(
  ESCAPE_PROGRAMS.map(({ name, inputs }) => [name, inputs]),
)
const ESCAPES = ESCAPE_PROGRAMS.map(({ name, text, strict, ext }) => ({
  kind: `escape`,
  name,
  strict: strict ?? true,
  ext: ext ?? `ts`,
  // JavaScript has no `declare`: there `log` is a free name.
  text: ext === `js` ? text : `${text}\ndeclare function log(): void\n`,
}))
// An object whose `key` a generator changes to `value` when iterated.
function changing(key, value) {
  const o = { [key]: `a` }
  function* change() {
    o[key] = value
    yield 1
  }
  return [o, change()]
}

// A program's runs on its inputs: each result, or the error it threw, and
// its `log()` calls. Each run builds its inputs afresh, so state that one run
// changes does not reach the next.
function runEscape(program, text) {
  const js = ts.transpileModule(text, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText
  const load = () => {
    const exported = {}
    let calls = 0
    // An import reads `./five`, a module whose `five` is 5.
    const required = (name) =>
      name === `./five` ? { five: 5 } : { __proto__: null }
    new Function(`exports`, `log`, `require`, js)(
      exported,
      () => {
        calls += 1
      },
      required,
    )
    return { exported, calls: () => calls }
  }
  const inputs = ESCAPE_INPUTS.get(program.name)
  return inputs(load().exported).map((_, index) => {
    const { exported, calls } = load()
    const input = inputs(exported)[index]
    let result
    try {
      result = shown(exported.f(...input))
    } catch (error) {
      result = `threw ${error.name}`
    }
    return `${result}:${calls()}`
  })
}
// A result as text that tells apart what `Object.is` does: a bigint from a
// number, -0 from 0, NaN, `null`, and `undefined`.
function shown(value) {
  if (typeof value === `bigint`) return `${value}n`
  if (typeof value === `number`)
    return Object.is(value, -0) ? `-0` : String(value)
  if (value === undefined) return `undefined`
  return JSON.stringify(value, (_, inner) =>
    typeof inner === `bigint` ? `${inner}n` : inner,
  )
}
// A mutant applied as text: its original at its position, replaced. An
// optional chain's `?.` is the first after the access's start.
function mutateText(text, mutant) {
  const at =
    mutant.operator === `optional-chain`
      ? text.indexOf(`?.`, mutant.position)
      : mutant.position
  // A returned value made undefined reads the global's own value, which a
  // name that shadows `undefined` would not.
  const replacement =
    mutant.operator === `return-undefined` ? `void 0` : mutant.replacement
  return `${text.slice(0, at)}${replacement}${text.slice(at + mutant.original.length)}`
}

// The families, each program one history.
const histories = [
  ...programs,
  ...narrowedPrograms,
  ...chainPrograms,
  ...returnPrograms,
  ...textPrograms,
  ...ESCAPES,
]

// ## Reach
//
// The states where the laws matter, each derived from the grammar and the
// model: a mutant that only an input outside its annotation distinguishes,
// which must carry the label; an ordering swap beside an impure operand; an
// optional read of an annotated parameter, and of a literal constant; the
// returns that are no site, and a shadowed `undefined`; and each hostile
// program whose inputs distinguish a mutant that the CLI emits.
const REACH = {
  label: `a mutant that only an input outside its annotation distinguishes`,
  impure: `an ordering swap beside an impure operand that its reads distinguish`,
  hostile: (name) => `a hostile shape stays emitted: ${name}`,
  chainAnnotated: `an optional read of an annotated parameter that only null reaches, unlabelled`,
  chainDead: (lang) => `an optional read of a literal constant in ${lang}`,
  returnExcluded: (form) => `a returned ${form} that is no site`,
  text: (program) =>
    `a ${program.family} program the law decides: ${program.name}`,
  shadowed: (form) => `a returned undefined that a ${form} shadows`,
}
const REQUIRED_STATES = [
  REACH.label,
  REACH.impure,
  ...ESCAPE_PROGRAMS.map(({ name }) => REACH.hostile(name)),
  REACH.chainAnnotated,
  ...LANGS.map(REACH.chainDead),
  ...[`voided`, `voidRead`, `undefinedName`].map(REACH.returnExcluded),
  ...[`shadowed`, `varShadowed`].map(REACH.shadowed),
  ...textPrograms.map(REACH.text),
]
// The ordering swaps of a first-family program, each with the model's site.
const orderingSites = (program, expected) =>
  sourceOf(program)
    .sites.map((site, index) => [site, expected.sites[index], index])
    .filter(
      ([site]) =>
        site.change.kind === `flip` &&
        site.change.node.kind === `cmp` &&
        ORDERING.includes(site.change.node.op),
    )
function reached(program, trace, expected) {
  // A text program decides a law when a site there is distinguished, or
  // when it has no site at all (a control).
  if (program.kind === `text`)
    return expected.sites.length === 0 ||
      expected.sites.some((site) => site.distinct)
      ? [REACH.text(program)]
      : []
  if (program.kind === `optional`) {
    const chain = expected.sites.find((s) => s.operator === `optional-chain`)
    if (program.receiver === `constant`)
      return chain.dead ? [REACH.chainDead(program.lang)] : []
    return annotatedChain(program) &&
      program.width === `present` &&
      chain.distinct
      ? [REACH.chainAnnotated]
      : []
  }
  if (program.kind === `returned`) {
    if ([`shadowed`, `varShadowed`].includes(program.form))
      return [REACH.shadowed(program.form)]
    return program.form === `plain` ? [] : [REACH.returnExcluded(program.form)]
  }
  if (program.kind === `escape`) {
    const found = trace.find((o) => o.checkpoint === `instrumented`)?.value
    const runs = runEscape(program, program.text)
    const detected = (found?.mutants ?? []).some(
      (mutant) =>
        runEscape(program, mutateText(program.text, mutant)).join() !==
        runs.join(),
    )
    return detected ? [REACH.hostile(program.name)] : []
  }
  if (program.kind === `narrowed`) return []
  const states = expected.sites.some((site) => site.label) ? [REACH.label] : []
  const test = program.kind === `guard` ? program.test : program.expr.test
  if (
    test?.kind === `logic` &&
    test.right.left?.name === FREE &&
    orderingSites(program, expected).some(([, site]) => site.distinct)
  )
    states.push(REACH.impure)
  return states
}

// The structural state a program enters, derived from the grammar.
function stateOf(program) {
  if (program.kind === `optional`)
    return `an optional ${program.access} read of a ${program.width} ${program.receiver} receiver in ${program.lang}, ${program.strictness}`
  if (program.kind === `returned`)
    return `a ${program.form} return in ${program.lang}, ${program.strictness}`
  if (program.kind === `escape`) return `a hostile program: ${program.name}`
  if (program.kind === `text`)
    return `a ${program.family} program: ${program.name}`
  if (program.kind === `narrowed`)
    return `a narrowed ${program.subject} subject's ${program.form} at its ${program.width} type, ${program.strictness}`
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
  const operandText = (name) => literal(name, program.type)
  const sites = []
  const put = (piece) => {
    text += piece
  }
  const expression = (expr) => {
    if (expr.kind === `ref`) return put(operandText(expr.name))
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
    if (expr.kind === `ref`) return put(operandText(expr.name))
    put(`(`)
    expression(expr)
    put(`)`)
  }
  // A returned expression's site: replaced with `undefined`, unevaluated.
  // An empty return has none.
  const returned = (expr, branch) => {
    if (expr.kind !== `void`)
      sites.push({
        operator: `return-undefined`,
        position: text.length,
        change: { kind: `undefine`, branch },
      })
    expression(expr)
  }
  if (program.kind === `return`) {
    put(`return `)
    returned(program.expr, `expr`)
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
    returned(program.then, `then`)
    put(program.form === `else` ? `;\n  else return ` : `;\n  return `)
    returned(program.rest, `rest`)
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

function evaluate(program, input, change, counter = { reads: 0 }) {
  const env = { a: input[0], b: input[1], c: input[2] }
  let reads = 0
  const flipped = (node) => change?.kind === `flip` && change.node === node
  const value = (expr) => {
    if (expr.kind === `ref`) {
      if (expr.name === FREE) {
        counter.reads += 1
        return ++reads
      }
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
  // A returned expression replaced with `undefined` is still evaluated.
  const returned = (expr, branch) => {
    const result = value(expr)
    return change?.kind === `undefine` && change.branch === branch
      ? undefined
      : result
  }
  if (program.kind === `return`) return returned(program.expr, `expr`)
  // The condition is evaluated even when a change forces the branch.
  const truth = Boolean(value(program.test))
  const forced = change?.kind === `force` && change.node === program
  return (forced ? change.taken : truth)
    ? returned(program.then, `then`)
    : returned(program.rest, `rest`)
}

// The model's expectation for a program: its source, and for each site whether
// some admitted input of its own type distinguishes its mutant from the original
// (`distinct`), whether no admitted input of any declared type does (`dead`:
// the program is redundant, whatever its parameters' types), and whether a
// history of 0 and -0 alone does (for an ordering comparison at its own type).
// A program's source and sites, its run on one input, its typed inputs, and
// the declared types its text may take, for either family.
const families = {
  // An escape program is judged by its runs as text (`checkEscape`), and has
  // no sites of its own.
  escape: {
    render: (program) => ({ text: program.text, sites: [] }),
    domain: () => [],
  },
  narrowed: {
    render: renderNarrowed,
    evaluate: evaluateNarrowed,
    domain: (program) => narrowedDomain(program),
  },
  optional: {
    render: renderChain,
    evaluate: evaluateChain,
    domain: chainDomain,
  },
  returned: {
    render: renderReturned,
    evaluate: evaluateReturned,
    domain: returnDomain,
  },
  // A text program's model is its settled runs (`textModel`).
  text: {
    render: renderText,
    domain: textDomain,
    typedDomain: textTypedDomain,
  },
}
const familyOf = (program) => families[program.kind]
const sourceOf = (program) => (familyOf(program)?.render ?? render)(program)
const run = (program, input, change, counter) =>
  (familyOf(program)?.evaluate ?? evaluate)(program, input, change, counter)
// Whether a change shows on one input: in the value, or in the reads of `g`
// and the coercions of an object (two functions are equal only when they
// make the same reads).
const shows = (program, input, change) => {
  const [mutant, original] = [change, null].map((c) => {
    const counter = { reads: 0 }
    const before = effects.count
    const result = run(program, input, c, counter)
    return [result, counter.reads + effects.count - before]
  })
  return !Object.is(mutant[0], original[0]) || mutant[1] !== original[1]
}
// What JavaScript allows, and what the declared types allow where the label
// law applies (the first family's annotations, and an annotated receiver).
const domainOf = (program) =>
  familyOf(program)?.domain(program) ?? JS_DOMAIN[program.type]
// The first family's declared inputs admit `null` and `undefined` too: the
// CLI does not know whether the package has strict null checks, so a label
// holds only where it holds without them (the eighth review).
const LOOSE_DOMAIN = Object.fromEntries(
  TYPES.map((t) => [t, cube([...VALUES[t], null, undefined])]),
)
const typedDomainOf = (program) =>
  familyOf(program)
    ? familyOf(program).typedDomain?.(program)
    : LOOSE_DOMAIN[program.type]
const zeroDomainOf = (program) =>
  familyOf(program)
    ? domainOf(program).filter(([, a]) => a === 0)
    : ZERO_DOMAIN[program.type]

// A digest of a mutant's runs over the domain, each its result and its reads
// of `g`, for the refinement of a `return-undefined` site: its mutant must
// keep the returned expression's effects, as the model's does.
function digest(runs) {
  let hash = 2166136261
  for (const char of runs.map((r) => `${shown(r.result)}:${r.reads}`).join(` `))
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0
  return hash.toString(16)
}
function modelRuns(program, change) {
  return digest(
    domainOf(program).map((input) => {
      const counter = { reads: 0 }
      const before = effects.count
      const result = (familyOf(program)?.evaluate ?? evaluate)(
        program,
        input,
        change,
        counter,
      )
      return { result, reads: counter.reads + effects.count - before }
    }),
  )
}

function model(program) {
  if (program.kind === `escape`) return { source: program.text, sites: [] }
  if (program.kind === `text`) return textModel(program)
  const { text, sites } = sourceOf(program)
  const distinctIn = (copy, index) => {
    const change = sourceOf(copy).sites[index].change
    return domainOf(copy).some((input) => shows(copy, input, change))
  }
  return {
    source: text,
    sites: sites.map((site, index) => {
      const distinct = distinctIn(program, index)
      const differs = (domain, change) =>
        domain.some((input) => shows(program, input, change))
      // The label law: no input of the declared types distinguishes the
      // mutant, and an input that JavaScript allows does.
      const typed = typedDomainOf(program)
      return {
        operator: site.operator,
        position: site.position,
        distinct,
        label: typed !== undefined && distinct && !differs(typed, site.change),
        // Dead code: no input that JavaScript allows distinguishes it, in
        // this program's own text.
        dead: !distinct,
        zeroDistinct:
          site.change.kind === `flip` &&
          site.change.node.kind === `cmp` &&
          ORDERING.includes(site.change.node.op) &&
          differs(zeroDomainOf(program), site.change),
        ...(site.operator === `return-undefined`
          ? { runs: modelRuns(program, site.change) }
          : {}),
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
    // A plain access in place of `?.`: it throws on a nullish object.
    chain: (id, value) => {
      if (id === active && (value === undefined || value === null))
        throw new TypeError(`Cannot read properties of ${value}`)
      return value
    },
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
      const before = effects.count
      // A run may change an object it is given, so each gets a copy (but
      // the coerced object, which no run changes, and whose identity a
      // result keeps); one that throws records the error's name.
      let result
      try {
        result = f(
          ...input.map((value) =>
            typeof value === `object` && value !== null && value !== VALUED
              ? { ...value }
              : value,
          ),
        )
      } catch (error) {
        result = `threw ${error.name}`
      }
      return { result, reads: globalReads + effects.count - before }
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

// An escape program's checker has the real standard library (it uses
// iterables, `Symbol.hasInstance`, and a Proxy), under strict null checks.
const escapeOptions = {
  noEmit: true,
  strict: true,
  types: [],
  target: ts.ScriptTarget.ESNext,
  lib: [`lib.esnext.d.ts`],
}
const escapeHost = ts.createCompilerHost(escapeOptions)
const escapeLibs = new Map()
function escapeTyped(path, text, strict) {
  const options = { ...escapeOptions, strictNullChecks: strict, allowJs: true }
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.ESNext, true)
  const base = ts.createCompilerHost(options)
  const host = {
    ...escapeHost,
    getSourceFile: (name, language) => {
      if (name === path) return file
      if (!escapeLibs.has(name))
        escapeLibs.set(name, base.getSourceFile(name, language))
      return escapeLibs.get(name)
    },
    fileExists: (name) => name === path || base.fileExists(name),
  }
  const program = ts.createProgram([path], options, host)
  return { file, checker: program.getTypeChecker(), strict }
}
// The types of an escape program erased: every type in a runtime position
// becomes `any`, and type arguments go. Types alone, without the runtime
// code (an enum, a class, a heritage clause), change.
function eraseTypes(text) {
  const file = ts.createSourceFile(
    `/erase.ts`,
    text,
    ts.ScriptTarget.ESNext,
    true,
  )
  const any = () => ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)
  const visit = (context) => (node) => {
    if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node))
      return node
    if (ts.isHeritageClause(node)) return node
    if (ts.isTypeNode(node) && !ts.isExpressionWithTypeArguments(node))
      return any()
    if (ts.isCallExpression(node) && node.typeArguments)
      return ts.visitEachChild(
        ts.factory.updateCallExpression(
          node,
          node.expression,
          undefined,
          node.arguments,
        ),
        visit(context),
        context,
      )
    return ts.visitEachChild(node, visit(context), context)
  }
  const [erased] = ts.transform(file, [visit]).transformed
  return ts.createPrinter().printFile(erased)
}
// The escape driver instruments the text, and the text with its types
// erased, and records both mutant lists.
function escapeDriver(program, observe) {
  const path = `/mutant-validity-escape.${program.ext}`
  const of = (text) =>
    instrument(ts, path, text, `src/escape.${program.ext}`).mutants.map(
      ({ operator, position, original, replacement, evidence }) => ({
        operator,
        position,
        original,
        replacement,
        ...(evidence ? { evidence } : {}),
      }),
    )
  observe(`instrumented`, {
    mutants: of(program.text),
    erased: of(program.ext === `js` ? program.text : eraseTypes(program.text)),
  })
}

// A text program's driver awaits each run's settling, as its model does.
async function textDriver(program, observe) {
  const domain = domainOf(program)
  const original = await settledRuns(loadText(program.text), domain)
  const ext = program.lang === `js` ? `js` : `ts`
  const path = `/mutant-validity.${ext}`
  const { code, mutants } = instrument(
    ts,
    path,
    program.text,
    `src/mutant-validity.${ext}`,
  )
  const under = async (active) => {
    const previous = globalThis.__oracleGaps
    globalThis.__oracleGaps = switchFor(active)
    try {
      return await settledRuns(load(code), domainOf(program))
    } finally {
      globalThis.__oracleGaps = previous
    }
  }
  const same = (runs) => runs.every((run, i) => sameRun(run, original[i]))
  const clean = same(await under(null))
  const emitted = []
  for (const mutant of mutants) {
    const runs = await under(mutant.number)
    emitted.push({
      operator: mutant.operator,
      position: mutant.position,
      differs: !same(runs),
      evidence: mutant.evidence,
      ...(mutant.outside ? { outside: mutant.outside } : {}),
      ...(mutant.operator === `return-undefined` ? { runs: digest(runs) } : {}),
    })
  }
  observe(`instrumented`, { clean, emitted })
}
function driver(program, observe) {
  if (program.kind === `escape`) return escapeDriver(program, observe)
  if (program.kind === `text`) return textDriver(program, observe)
  const { text } = sourceOf(program)
  const domain = domainOf(program)
  const original = runAll(load(text), domain)
  const ext = program.lang === `js` ? `js` : `ts`
  const path = `/mutant-validity.${ext}`
  const { code, mutants } = instrument(
    ts,
    path,
    text,
    `src/mutant-validity.${ext}`,
  )
  const clean = sameRuns(runsUnder(code, null, domain), original)
  const emitted = mutants.map((mutant) => {
    const runs = runsUnder(code, mutant.number, domain)
    return {
      operator: mutant.operator,
      position: mutant.position,
      differs: !sameRuns(runs, original),
      evidence: mutant.evidence,
      ...(mutant.outside ? { outside: mutant.outside } : {}),
      ...(mutant.operator === `return-undefined` ? { runs: digest(runs) } : {}),
    }
  })
  observe(`instrumented`, { clean, emitted })
}

// ## Comparison
const keyOf = (site) => `${site.operator}@${site.position}`
const DEAD = `dead code`
const BOUNDARY_EVIDENCE = `boundary: -0`

// A hostile program's laws. Types change nothing the CLI emits: its sites
// and dead-code marks are the same with the types erased (compared as
// operators and marks, since erasing moves positions). A dead-code mark
// holds: the mutant, applied as text, equals the program on every input.
// And a returned `undefined` that a declaration binds, by the oracle's own
// checker, is a site.
const markOf = (m) => `${m.operator}${m.evidence === DEAD ? ` (dead)` : ``}`
const tally = (mutants) => mutants.map(markOf).sort().join(`, `)
function checkEscape(program, found) {
  if (tally(found.mutants) !== tally(found.erased))
    return violation(
      `instrumented`,
      `erasing the types of ${program.name} changes its sites: ${tally(found.mutants)} against ${tally(found.erased)}`,
      LAW_TYPELESS,
    )
  const runs = runEscape(program, program.text)
  for (const mutant of found.mutants) {
    if (mutant.evidence !== DEAD) continue
    const mutated = runEscape(program, mutateText(program.text, mutant))
    if (mutated.join() !== runs.join())
      return violation(
        `instrumented`,
        `marks ${keyOf(mutant)} of ${program.name} dead code, but an input distinguishes it: ${runs.join(` `)} against ${mutated.join(` `)}`,
        LAW_DEAD,
      )
  }
  const { file, checker } = escapeTyped(
    `/mutant-validity-escape.${program.ext}`,
    program.text,
    true,
  )
  // Every return of a value is a site, but `return void x` and a return of
  // the global `undefined`, which the oracle's own checker resolves to no
  // declaration (and only where the file has no direct `eval` and no
  // `with`, which can bind it at run time).
  const sites = new Set(found.mutants.map(keyOf))
  const dynamic = /\beval\s*\(|\bwith\b/.test(program.text)
  const owed = []
  const visit = (node) => {
    if (ts.isReturnStatement(node) && node.expression) {
      const value = node.expression
      const global =
        ts.isIdentifier(value) &&
        value.text === `undefined` &&
        !dynamic &&
        (checker.getSymbolAtLocation(value)?.declarations?.length ?? 0) === 0
      if (!ts.isVoidExpression(value) && !global)
        owed.push(value.getStart(file))
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  const missed = owed.find(
    (position) => !sites.has(`return-undefined@${position}`),
  )
  if (missed !== undefined)
    return violation(
      `instrumented`,
      `leaves out the returned value at offset ${missed} of ${program.name}, which is no exact equivalent of its mutant`,
      LAW_2,
    )
  return pass
}

function check(program, observations, expected) {
  const found = observations.find((o) => o.checkpoint === `instrumented`)?.value
  if (!found)
    return violation(`instrumented`, `nothing was instrumented`, LAW_INERT)
  if (program.kind === `escape`) return checkEscape(program, found)
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
    if (!mutant)
      return violation(
        `instrumented`,
        site.distinct
          ? `skipped ${where}, but the model finds an input that distinguishes it`
          : `skipped ${where}: no site of the contract is skipped, and an undistinguished one is dead code`,
        LAW_2,
      )
    const marked = mutant.evidence === DEAD
    if (!marked && !site.distinct)
      return violation(
        `instrumented`,
        `emitted ${where}, which equals the original on every input, and is not marked dead code`,
        LAW_1,
      )
    if (marked !== site.dead)
      return violation(
        `instrumented`,
        `${marked ? `marked dead code` : `left unmarked`} ${where}, but ${site.dead ? `no input distinguishes it` : `an input distinguishes it`}`,
        LAW_DEAD,
      )
    if (mutant.differs !== site.distinct)
      return violation(
        `instrumented`,
        `${marked ? `marked dead code` : `emitted`} ${where}: its run ${mutant.differs ? `differs` : `matches`} the original, but the model says ${site.distinct ? `it is distinguishable` : `it is not`}`,
        LAW_REFINE,
      )
    if (site.runs !== undefined && mutant.runs !== site.runs)
      return violation(
        `instrumented`,
        `emitted ${where}: its runs and reads differ from the model's, which evaluates the returned expression and then returns undefined`,
        LAW_REFINE,
      )
    if (site.label && !mutant.outside)
      return violation(
        `instrumented`,
        `emitted ${where} without the outside-annotation label, though no input of its declared types distinguishes it`,
        LAW_LABEL,
      )
    if (!site.label && mutant.outside)
      return violation(
        `instrumented`,
        `labels ${where} outside-annotation (${mutant.outside}), though no annotation excludes every input that distinguishes it`,
        LAW_LABEL,
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

// Five calibrations, each a wrong answer the check must reject.
const observed = (trace) => {
  const index = trace.findIndex((o) => o.checkpoint === `instrumented`)
  // An escape program's observation has no emitted list to corrupt.
  return index < 0 || !trace[index].value.emitted
    ? undefined
    : { index, value: trace[index].value }
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
    statement: `No mutant is skipped or marked dead code on the basis of types (maintainer decision, 2026-11-11). Over the inputs JavaScript allows (each declared type's values, and foreign ties: a string beside the number of its digits, null beside a zero, a number beside a bigint, -0 beside 0, and an object whose valueOf has an effect; with the free global g counting its reads), every emitted mutant that is not marked dead code differs from the program on some input (law 1), no site of the operator contract is skipped (law 2), and a site is marked dead code exactly when no input distinguishes it. A mutant carries the outside-annotation label exactly when an annotation excludes every input that distinguishes it, in the first family and the coerced programs, and carries none elsewhere. A return-undefined mutant's runs and reads equal the model's, which evaluates the returned expression and then returns undefined. Erasing a hostile program's types changes none of its sites and no dead-code mark, every dead-code mark there holds on its inputs, and a returned undefined that a declaration binds is a site. Every emitted mutant's run agrees with the model, and a boundary hint sits only on a site that a history of 0 and -0 distinguishes.`,
    authority: `The maintainer's decision of 2026-11-11, relayed by the coordinator after the fifth soundness review: the gap CLI never skips a mutant, and never marks it dead code, on the basis of types; a mutant the type analysis judges undetectable by inputs of the declared types is a survivor in its own class, whose directive names the distinguishing input; an argument typed any counts as an input the types allow. The frozen design v20's decision of 2026-11-10 that anything an oracle can't possibly detect is an invalid mutant (freeze.md, "Undetectable mutants are invalid"). The dead-code and boundary evidence follow the coordinator's revision and the review of PR #8. The F17 operators follow the coordinator's F17 brief (2026-11-10).`,
    limits: `A finite domain: each type's values, a fixed set of foreign ties, and one free name. A small grammar, without property reads, calls, getters beyond g, or equal branches with a non-operand expression. A clamp at type bigint is left out. Dead code is tagged only under a pure condition where no ordering comparison runs or not because of the site. The label law requires a label in the first family and the coerced programs, and forbids one everywhere else; the narrowed family's narrowings and the optional chains are not labelled. The sixth review's dimensions are small generated programs judged by running their text: a dead-zone read in a parameter default or a loop head, each binding form of \`undefined\`, a sloppy script with or without a direct \`eval\` or a \`with\`, a returned call, and a coerced comparison at five annotations. The optional chains read one property of a parameter, a local, a wrapper's property, or a literal constant. The returned values are one return of a name, \`void a\`, \`void g\`, or \`undefined\`. Only a return-undefined site's runs are compared in full with the model's. The hostile programs are fixed texts with chosen inputs, compared with their own text with the types erased, as operators and marks; their dead-code marks are judged on their inputs only. Its mutants are applied as text, and an optional chain's \`?.\` is found as the first after the access's start, which a nested chain would misplace.`,
  },
  // Enumerated: every program of the grammar is one history, in order.
  histories: { enumerated: histories, states: REQUIRED_STATES },
  label: (program) => `${stateOf(program)}: ${sourceOf(program).text}`,
  model,
  reached,
  driver,
  check,
  calibrations,
  timeout: 120_000,
})
