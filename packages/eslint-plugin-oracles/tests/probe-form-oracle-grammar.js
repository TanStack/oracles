/**
 * The probe-form law's grammar, model, and renderer, which two oracles share:
 * the lint rule's (probe-form-oracle.property.test.js) and the gap CLI's
 * (probe-form-cli-oracle.property.test.js). See the first for the law.
 */
import fc from 'fast-check'

export const MESSAGE_ID = `probeForm`

// -- Kinds: the model's spec -------------------------------------------------
//
// A kind is legal, or it is a near-miss that breaks one part of the form. The
// table below is the law's spec: the grammar draws kinds from it, the model
// predicts reports from it, and the renderer below writes each kind's text.
// `mentions` counts the `__oracleProbe` references that a near-miss writes: a
// cast receiver adds one, the cast's type member.

const castMentions = (site) => 1 + (site.cast ? 1 : 0)
const one = () => 1
const two = () => 2

export const MODEL = {
  // Legal under the function's guard; with none, each mention is reported.
  probe: { legal: true, mentions: castMentions },
  // The guard declared in a block of the function, beside its probe.
  'block-guard': { legal: true, mentions: () => 0 },
  // The guard's initializer with each part parenthesized, which is the same
  // expression.
  'paren-init': { legal: true, mentions: () => 0 },
  // The guard declared in a switch case, beside its probe: a case's
  // bindings belong to the switch, within the function.
  'switch-guard': { legal: true, mentions: () => 0 },
  // The guard as one declarator of several.
  'multi-guard': { legal: true, mentions: () => 0 },
  // A binding of `probing` that shadows the function's guard: a loop
  // variable, a caught error, a destructured name. None is the guard.
  'loop-shadow': { legal: false, mentions: castMentions },
  'catch-shadow': { legal: false, mentions: castMentions },
  'destructured-shadow': { legal: false, mentions: castMentions },
  // The comparison read through optional chaining, another expression.
  'optional-env': { legal: false, mentions: castMentions },
  // A guard bound with `using` or `await using`, which is not a `const`.
  'using-guard': { legal: false, mentions: castMentions },
  'await-using-guard': { legal: false, mentions: castMentions },
  // The former form: the `NODE_ENV` comparison itself on the left of `&&`.
  'former-guard': { legal: false, mentions: castMentions },
  // A guard of the right initializer under another name.
  'other-name': { legal: false, mentions: castMentions },
  // A `let` guard.
  'let-guard': { legal: false, mentions: castMentions },
  // A guard whose initializer is the bare comparison, or the `typeof`
  // check joined by `&&`, which a build does not fold.
  'bare-init': { legal: false, mentions: castMentions },
  'and-init': { legal: false, mentions: castMentions },
  // A probe in a nested function, whose nearest function declares no guard.
  'outer-guard': { legal: false, mentions: castMentions },
  'if-guard': { legal: false, mentions: castMentions },
  'devbuild-and-guard': { legal: false, mentions: castMentions },
  'devbuild-only': { legal: false, mentions: castMentions },
  'no-guard': { legal: false, mentions: castMentions },
  'or-guard': { legal: false, mentions: castMentions },
  'equal-guard': { legal: false, mentions: castMentions },
  'reversed-guard': { legal: false, mentions: castMentions },
  'computed-env-guard': { legal: false, mentions: castMentions },
  'optional-receiver': { legal: false, mentions: one },
  'non-optional-call': { legal: false, mentions: castMentions },
  'one-argument': { legal: false, mentions: castMentions },
  'three-arguments': { legal: false, mentions: castMentions },
  'spread-argument': { legal: false, mentions: castMentions },
  'bad-condition': { legal: false, mentions: castMentions },
  'bad-name': { legal: false, mentions: castMentions },
  'receiver-window': { legal: false, mentions: one },
  'cast-other-receiver': { legal: false, mentions: two },
  'double-cast': { legal: false, mentions: two },
  'computed-key': { legal: false, mentions: castMentions },
  alias: { legal: false, mentions: castMentions },
  'declared-type-key': { legal: false, mentions: one },
  'variable-initializer': { legal: false, mentions: castMentions },
  sequence: { legal: false, mentions: castMentions },
  ternary: { legal: false, mentions: castMentions },
}

// -- 1. Grammar ---------------------------------------------------------------
//
// Each site draws every pool, and its kind decides which pools apply. The
// pools are small on purpose: the census enumerates them, and the random
// campaigns combine them.

export const QUOTES = [`'`, `"`, '`']

// Legal names, as written without their quotes. Each is `package#name`.
export const LEGAL_NAMES = [
  `db#multiset.consolidate`,
  `db-ivm#multiset`,
  `offline-transactions#key-scheduler.retry`,
  `db#indexedDb.open`,
]

// Illegal names, as raw source. Each breaks the name form: no `#`, an empty
// package or name, an uppercase package, a second `#`, a space, or an
// expression instead of a literal.
export const BAD_NAMES = [
  `'probe'`,
  `'db#'`,
  `'#name'`,
  `'Db#multiset'`,
  `'db#multiset#x'`,
  `'db#name with space'`,
  `nameVar`,
  '`db#${name}`',
]

// Conditions that the rule must accept. Some contain calls, which are allowed.
export const LEGAL_CONDITIONS = [
  { text: `flag`, calls: false },
  { text: `input > 2`, calls: false },
  { text: `helper(input)`, calls: true },
  { text: `obj.value !== undefined`, calls: false },
  { text: `flag ? 1 : 0`, calls: false },
  { text: `typeof flag === 'boolean'`, calls: false },
  { text: `[input].length > 0`, calls: false },
  { text: `(flag || input === 3)`, calls: false },
  { text: `input?.toString() !== ''`, calls: true },
  { text: `probeCount(input, flag)`, calls: true },
  { text: `!flag`, calls: false },
  { text: `-input`, calls: false },
  { text: `void 0`, calls: false },
  // Arrows with an expression body (maintainer decision, 2026-11-05).
  { text: `items.every((item) => item > 0)`, calls: true, arrow: true },
  {
    text: `items.some(([a, b]) => a === b && typeof a === 'string')`,
    calls: true,
    arrow: true,
  },
  { text: `(() => flag)()`, calls: true, arrow: true },
]

// Each expression is a forbidden form: an assignment, an update, `new`,
// `delete`, `await`, `yield`, a function or class expression, an arrow with a
// block body, or an arrow whose expression body holds a forbidden form.
// The generated program is an async generator, so `await` and `yield` parse.
export const FORBIDDEN_CONDITIONS = [
  `(flag = true)`,
  `(input += 1)`,
  `(input++)`,
  `(--input)`,
  `new Set()`,
  `delete obj.key`,
  `(await flag)`,
  `(yield input)`,
  `(() => { return flag })()`,
  `items.every((item) => (item = 1))`,
  `items.some((item) => item++)`,
  `(function () { return flag })()`,
  `(class {})`,
]

// A forbidden form can sit inside a larger condition, which the rule must
// still find. `X` marks where the form goes.
export const WRAPS = [
  `X`,
  `helper(X)`,
  `[X]`,
  `{ key: X }`,
  `flag ? X : 0`,
  `(X, 0)`,
]

const CAST = `(globalThis as { __oracleProbe?: (name: string, condition: unknown) => void })`

const quoteArb = fc.constantFrom(...QUOTES)
const siteArbitrary = fc.record({
  kind: fc.constantFrom(...Object.keys(MODEL)),
  quote: quoteArb,
  cast: fc.boolean(),
  paren: fc.boolean(),
  guardParens: fc.boolean(),
  name: fc.constantFrom(...LEGAL_NAMES),
  badName: fc.constantFrom(...BAD_NAMES),
  cond: fc.constantFrom(...LEGAL_CONDITIONS),
  badCond: fc.constantFrom(...FORBIDDEN_CONDITIONS),
  wrap: fc.constantFrom(...WRAPS),
})

// A program is a list of sites, each one line in the rendered function, below
// the function's guard, whose strings take one quote style.
// A program's function declares the guard at its top, or does not, so a
// probe that relies on it names an undeclared `probing`.
export const programArbitrary = fc.record({
  guardQuote: quoteArb,
  header: fc.constantFrom(`guard`, `guard`, `guard`, `none`),
  sites: fc.array(siteArbitrary, { minLength: 1, maxLength: 6 }),
})

// The census gives every kind every pool value once, by index, so the
// declared reach does not depend on random draws. It is a fixed history, and
// it runs through the same model, drivers, and comparison.
export function censusProgram() {
  const sites = []
  const width = Math.max(
    LEGAL_NAMES.length,
    BAD_NAMES.length,
    LEGAL_CONDITIONS.length,
    FORBIDDEN_CONDITIONS.length,
    WRAPS.length,
    QUOTES.length,
    2,
  )
  for (const kind of Object.keys(MODEL)) {
    for (let i = 0; i < width; i++) {
      sites.push({
        kind,
        quote: QUOTES[i % QUOTES.length],
        cast: i % 2 === 0,
        paren: i % 3 === 0,
        guardParens: i % 2 === 1,
        name: LEGAL_NAMES[i % LEGAL_NAMES.length],
        badName: BAD_NAMES[i % BAD_NAMES.length],
        cond: LEGAL_CONDITIONS[i % LEGAL_CONDITIONS.length],
        badCond: FORBIDDEN_CONDITIONS[i % FORBIDDEN_CONDITIONS.length],
        wrap: WRAPS[i % WRAPS.length],
      })
    }
  }
  return { guardQuote: `'`, header: `guard`, sites }
}

// -- 2. Model -----------------------------------------------------------------
//
// The model is the spec, written from the law. A kind is legal or it is not,
// and a near-miss predicts reports on its own line. `mentions` counts the
// references to `__oracleProbe` that the site writes, which the grammar knows
// from the kind and the cast flag. A legal probe exempts its own mentions: the
// callee property, and the cast's type member when it casts.

// The header is line 1 and the guard line 2, so site `index` is on line
// `index + 3`.
export const siteLine = (index) => index + 3

// A site is legal when its kind is, and a probe on the function's guard has
// that guard.
export const isLegal = (site, program) =>
  MODEL[site.kind].legal &&
  (site.kind !== `probe` || program.header === `guard`)

export function predictReports(program) {
  return program.sites.flatMap((site, index) => {
    const form = MODEL[site.kind]
    if (isLegal(site, program)) return []
    return Array.from({ length: form.mentions(site) }, () => ({
      line: siteLine(index),
      messageId: MESSAGE_ID,
    }))
  })
}

// -- Rendering ---------------------------------------------------------------

// The former guard, the comparison alone, and the guard's initializer.
const comparisonText = (site) =>
  `process.env.NODE_ENV !== ${site.quote}production${site.quote}`
const initText = (quote) =>
  `typeof process === ${quote}undefined${quote} ? false : process.env.NODE_ENV !== ${quote}production${quote}`
const guardText = () => `probing`
const receiverText = (site) => {
  if (!site.cast) return `globalThis`
  return site.paren ? `(${CAST})` : CAST
}
const nameText = (site) => `${site.quote}${site.name}${site.quote}`
const legalCall = (site) =>
  `${receiverText(site)}.__oracleProbe?.(${nameText(site)}, ${site.cond.text})`
const withBadCondition = (site) => site.wrap.split(`X`).join(site.badCond)

// Each kind renders one site, on one line, ending in a semicolon.
const RENDER = {
  probe: (s) =>
    `${s.guardParens ? `(${guardText(s)})` : guardText(s)} && ${legalCall(s)};`,
  'block-guard': (s) =>
    `{ const probing = ${initText(s.quote)}; probing && ${legalCall(s)}; }`,
  'paren-init': (s) =>
    `{ const probing = (typeof (process) === (${s.quote}undefined${s.quote})) ? (false) : ((process.env.NODE_ENV) !== (${s.quote}production${s.quote})); probing && ${legalCall(s)}; }`,
  'multi-guard': (s) =>
    `{ const before = 1, probing = ${initText(s.quote)}; probing && ${legalCall(s)}; }`,
  'loop-shadow': (s) =>
    `for (const probing of [true]) { probing && ${legalCall(s)}; }`,
  'catch-shadow': (s) =>
    `try { throw 0 } catch (probing) { probing && ${legalCall(s)}; }`,
  'destructured-shadow': (s) =>
    `{ const { probing } = { probing: true }; probing && ${legalCall(s)}; }`,
  'optional-env': (s) =>
    `{ const probing = typeof process === ${s.quote}undefined${s.quote} ? false : ${s.paren ? `process?.env.NODE_ENV` : `process.env?.NODE_ENV`} !== ${s.quote}production${s.quote}; probing && ${legalCall(s)}; }`,
  'using-guard': (s) =>
    `{ using probing = ${initText(s.quote)}; probing && ${legalCall(s)}; }`,
  'await-using-guard': (s) =>
    `{ await using probing = ${initText(s.quote)}; probing && ${legalCall(s)}; }`,
  'switch-guard': (s) =>
    `switch (input) { case 1: const probing = ${initText(s.quote)}; probing && ${legalCall(s)}; break; }`,
  'former-guard': (s) =>
    `${s.guardParens ? `(${comparisonText(s)})` : comparisonText(s)} && ${legalCall(s)};`,
  'other-name': (s) =>
    `{ const enabled = ${initText(s.quote)}; enabled && ${legalCall(s)}; }`,
  'let-guard': (s) =>
    `{ let probing = ${initText(s.quote)}; probing && ${legalCall(s)}; }`,
  'bare-init': (s) =>
    `{ const probing = ${comparisonText(s)}; probing && ${legalCall(s)}; }`,
  'and-init': (s) =>
    `{ const probing = typeof process !== ${s.quote}undefined${s.quote} && ${comparisonText(s)}; probing && ${legalCall(s)}; }`,
  'outer-guard': (s) => `(() => { probing && ${legalCall(s)}; })();`,
  'if-guard': (s) => `if (${guardText(s)}) ${legalCall(s)};`,
  'devbuild-and-guard': (s) =>
    `devBuild() && ${guardText(s)} && ${legalCall(s)};`,
  'devbuild-only': (s) => `devBuild() && ${legalCall(s)};`,
  'no-guard': (s) => `${legalCall(s)};`,
  'or-guard': (s) => `${guardText(s)} || ${legalCall(s)};`,
  'equal-guard': (s) =>
    `process.env.NODE_ENV === ${s.quote}production${s.quote} && ${legalCall(s)};`,
  'reversed-guard': (s) =>
    `${s.quote}production${s.quote} !== process.env.NODE_ENV && ${legalCall(s)};`,
  'computed-env-guard': (s) =>
    `process.env[${s.quote}NODE_ENV${s.quote}] !== ${s.quote}production${s.quote} && ${legalCall(s)};`,
  'optional-receiver': (s) =>
    `${guardText(s)} && globalThis?.__oracleProbe?.(${nameText(s)}, ${s.cond.text});`,
  'non-optional-call': (s) =>
    `${guardText(s)} && ${receiverText(s)}.__oracleProbe(${nameText(s)}, ${s.cond.text});`,
  'one-argument': (s) =>
    `${guardText(s)} && ${receiverText(s)}.__oracleProbe?.(${nameText(s)});`,
  'three-arguments': (s) =>
    `${guardText(s)} && ${receiverText(s)}.__oracleProbe?.(${nameText(s)}, ${s.cond.text}, 0);`,
  'spread-argument': (s) =>
    `${guardText(s)} && ${receiverText(s)}.__oracleProbe?.(...[${nameText(s)}, ${s.cond.text}]);`,
  'bad-condition': (s) =>
    `${guardText(s)} && ${receiverText(s)}.__oracleProbe?.(${nameText(s)}, ${withBadCondition(s)});`,
  'bad-name': (s) =>
    `${guardText(s)} && ${receiverText(s)}.__oracleProbe?.(${s.badName}, ${s.cond.text});`,
  'receiver-window': (s) =>
    `${guardText(s)} && window.__oracleProbe?.(${nameText(s)}, ${s.cond.text});`,
  'cast-other-receiver': (s) =>
    `${guardText(s)} && (window as { __oracleProbe?: (name: string, condition: unknown) => void }).__oracleProbe?.(${nameText(s)}, ${s.cond.text});`,
  'double-cast': (s) =>
    `${guardText(s)} && (globalThis as unknown as { __oracleProbe?: (name: string, condition: unknown) => void }).__oracleProbe?.(${nameText(s)}, ${s.cond.text});`,
  'computed-key': (s) =>
    `${guardText(s)} && ${receiverText(s)}[${s.quote}__oracleProbe${s.quote}]?.(${nameText(s)}, ${s.cond.text});`,
  alias: (s, index) =>
    `const probe${index} = ${receiverText(s)}.__oracleProbe;`,
  'declared-type-key': (s, index) =>
    `const declared${index}: { __oracleProbe?: () => void } = {};`,
  'variable-initializer': (s, index) =>
    `const result${index} = ${guardText(s)} && ${legalCall(s)};`,
  sequence: (s) => `${guardText(s)} && ${legalCall(s)}, 0;`,
  ternary: (s) => `${guardText(s)} ? ${legalCall(s)} : undefined;`,
}

export function renderProgram(program) {
  return [
    `export async function* run(input: number, flag: boolean): AsyncGenerator<number> {`,
    program.header === `guard`
      ? `  const probing = ${initText(program.guardQuote)};`
      : `  // no guard`,
    ...program.sites.map(
      (site, index) => `  ${RENDER[site.kind](site, index)}`,
    ),
    `}`,
  ].join(`\n`)
}
