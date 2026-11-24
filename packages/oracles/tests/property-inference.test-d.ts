import { expectTypeOf } from 'vitest'
import fc from 'fast-check'
import { oracleProperty, pass } from '../src/index.js'
import type { Observation } from '../src/index.js'

type VariantHistory =
  | {
      kind: `a`
      mode: `fast` | `safe`
      mask: [boolean, boolean]
      items: Array<number>
    }
  | {
      kind: `b`
      count: number
      pair: [`left` | `right`, [number, number]]
    }

const variantArbitrary: fc.Arbitrary<VariantHistory> = fc.oneof(
  fc.record({
    kind: fc.constant(`a` as const),
    mode: fc.constantFrom(`fast` as const, `safe` as const),
    mask: fc.tuple(fc.boolean(), fc.boolean()),
    items: fc.array(fc.integer()),
  }),
  fc.record({
    kind: fc.constant(`b` as const),
    count: fc.integer(),
    pair: fc.tuple(
      fc.constantFrom(`left` as const, `right` as const),
      fc.tuple(fc.integer(), fc.integer()),
    ),
  }),
)

// Mutable-array parameters, for the break's cases: a literal-inferred history's
// arrays are read-only, so they do not pass here without a copy.
function takesMutable(xs: Array<number>): number {
  return xs.length
}
function firstOf<T extends Array<number>>(xs: T): number {
  return xs.length
}
function identity<T>(x: T): T {
  return x
}

const law = {
  statement: `type inference regression`,
  authority: `oracleProperty type signature`,
  limits: `compile-time only`,
}

// Type-level regressions checked by `tsc --noEmit` (not executed at runtime).
export function checkOraclePropertyInference(): void {
  // 1. Generated histories with discriminated unions and fixed-length tuples:
  //    `fixed[].history` and `constructed[].build` get contextual typing from
  //    `arbitrary` without interfering with `THistory` inference.
  oracleProperty({
    id: `type.generated`,
    law,
    histories: {
      arbitrary: variantArbitrary,
      runs: 10,
      fixedSeeds: [1],
      states: [`a-fast`, `b-left`],
      constructed: [
        {
          name: `a-fast`,
          enters: [`a-fast`],
          build: (base) =>
            base.kind === `a`
              ? { ...base, mode: `fast`, mask: [true, false] }
              : {
                  kind: `a`,
                  mode: `fast`,
                  mask: [true, false],
                  items: [base.count],
                },
        },
        {
          name: `b-left`,
          enters: [`b-left`],
          build: (_base) => ({
            kind: `b`,
            count: 2,
            pair: [`left`, [0, 1]],
          }),
        },
        {
          name: `block-body`,
          enters: [`a-fast`],
          build: (base) => {
            if (base.kind === `a`) {
              return { ...base, mode: `safe`, mask: [false, true] }
            }
            return { kind: `b`, count: base.count, pair: [`right`, [1, 2]] }
          },
        },
      ],
      fixed: [
        {
          name: `fixed-a`,
          history: {
            kind: `a`,
            mode: `safe`,
            mask: [false, true],
            items: [1, 2],
          },
        },
        {
          name: `fixed-b`,
          history: {
            kind: `b`,
            count: 3,
            pair: [`right`, [4, 5]],
          },
        },
      ],
    },
    label: (history) => {
      expectTypeOf(history).toEqualTypeOf<VariantHistory>()
      return history.kind
    },
    model: (plan, trace) => {
      expectTypeOf(plan).toEqualTypeOf<VariantHistory>()
      expectTypeOf(trace).toEqualTypeOf<ReadonlyArray<Observation>>()
      return plan.kind === `a`
        ? { tag: plan.mode, flags: plan.mask }
        : { tag: plan.pair[0], count: plan.count }
    },
    reached: (plan, _trace, expected) => {
      expectTypeOf(plan).toEqualTypeOf<VariantHistory>()
      expectTypeOf(expected.tag).toEqualTypeOf<
        `fast` | `safe` | `left` | `right`
      >()
      expectTypeOf(expected.flags).toEqualTypeOf<
        [boolean, boolean] | undefined
      >()
      expectTypeOf(expected.count).toEqualTypeOf<number | undefined>()
      return [plan.kind, expected.tag]
    },
    driver: (plan, observe) => {
      expectTypeOf(plan).toEqualTypeOf<VariantHistory>()
      observe(`kind`, plan.kind)
    },
    check: (plan, _observations, expected) => {
      expectTypeOf(plan).toEqualTypeOf<VariantHistory>()
      expectTypeOf(expected.tag).toEqualTypeOf<
        `fast` | `safe` | `left` | `right`
      >()
      expectTypeOf(expected.flags).toEqualTypeOf<
        [boolean, boolean] | undefined
      >()
      expectTypeOf(expected.count).toEqualTypeOf<number | undefined>()
      return pass
    },
    predict: (plan) => {
      expectTypeOf(plan).toEqualTypeOf<VariantHistory>()
      return { 'a-fast': plan.kind === `a` && plan.mode === `fast` }
    },
    calibrations: [
      {
        name: `corrupt-calibration`,
        law: `type.generated`,
        corrupt: (trace, plan) => {
          expectTypeOf(plan).toEqualTypeOf<VariantHistory>()
          return trace
        },
      },
      {
        name: `driver-calibration`,
        law: `type.generated`,
        driver: (plan, observe) => {
          expectTypeOf(plan).toEqualTypeOf<VariantHistory>()
          observe(`kind`, plan.kind)
        },
      },
    ],
  })

  // 2. With `resolve`: `THistory` comes from `histories.arbitrary`, `TPlan`
  //    comes from `resolve`, and downstream callbacks + `calibrations` receive
  //    `TPlan` without polluting inference.
  oracleProperty({
    id: `type.resolved`,
    law,
    histories: {
      arbitrary: variantArbitrary,
      runs: 10,
      fixedSeeds: [1],
      constructed: [
        {
          name: `c`,
          enters: [],
          build: (base) =>
            base.kind === `a`
              ? { ...base, mode: `fast`, mask: [true, true] }
              : { ...base, pair: [`left`, [0, 0]] },
        },
      ],
      fixed: [
        {
          name: `f`,
          history: { kind: `b`, count: 0, pair: [`left`, [1, 2]] },
        },
      ],
    },
    resolve: (history) => {
      expectTypeOf(history).toEqualTypeOf<VariantHistory>()
      const bounds: [number, number] =
        history.kind === `a` ? [0, history.items.length] : history.pair[1]
      return {
        resolvedKind: history.kind,
        bounds,
      }
    },
    model: (plan) => {
      expectTypeOf(plan).toEqualTypeOf<{
        resolvedKind: `a` | `b`
        bounds: [number, number]
      }>()
      return plan.bounds[1] - plan.bounds[0]
    },
    reached: (plan, _trace, expected) => {
      expectTypeOf(plan.resolvedKind).toEqualTypeOf<`a` | `b`>()
      expectTypeOf(expected).toEqualTypeOf<number>()
      return [plan.resolvedKind]
    },
    driver: (plan, observe) => {
      expectTypeOf(plan.bounds).toEqualTypeOf<[number, number]>()
      observe(`kind`, plan.resolvedKind)
    },
    check: (plan, _trace, expected) => {
      expectTypeOf(plan.bounds).toEqualTypeOf<[number, number]>()
      expectTypeOf(expected).toEqualTypeOf<number>()
      return pass
    },
    predict: (plan) => {
      expectTypeOf(plan.resolvedKind).toEqualTypeOf<`a` | `b`>()
      return { ok: plan.resolvedKind === `a` }
    },
    calibrations: [
      {
        name: `corrupt-resolved`,
        law: `type.resolved`,
        corrupt: (trace, plan) => {
          expectTypeOf(plan.bounds).toEqualTypeOf<[number, number]>()
          return trace
        },
      },
      {
        name: `driver-resolved`,
        law: `type.resolved`,
        driver: (plan, observe) => {
          expectTypeOf(plan.resolvedKind).toEqualTypeOf<`a` | `b`>()
          observe(`bounds`, plan.bounds)
        },
      },
    ],
  })

  // 3. Enumerated histories (plain array and `{ enumerated }`).
  const enumeratedList: ReadonlyArray<VariantHistory> = [
    { kind: `a`, mode: `fast`, mask: [true, false], items: [] },
    { kind: `b`, count: 1, pair: [`left`, [0, 1]] },
  ]
  oracleProperty({
    id: `type.enumerated`,
    law,
    histories: { enumerated: enumeratedList, states: [`seen`] },
    label: (history) => {
      expectTypeOf(history).toEqualTypeOf<VariantHistory>()
      return history.kind
    },
    model: (plan) => plan.kind,
    driver: (plan, observe) => {
      expectTypeOf(plan).toEqualTypeOf<VariantHistory>()
      observe(`kind`, plan.kind)
    },
    check: (plan, _trace, expected) => {
      expectTypeOf(plan).toEqualTypeOf<VariantHistory>()
      expectTypeOf(expected).toEqualTypeOf<`a` | `b`>()
      return pass
    },
  })

  // 4. Explicit type arguments remain backwards-compatible, including 0-arg
  //    `build` callbacks.
  oracleProperty<VariantHistory, boolean>({
    id: `type.explicit`,
    law,
    histories: {
      arbitrary: variantArbitrary,
      runs: 10,
      fixedSeeds: [1],
      constructed: [
        {
          name: `zero-arg`,
          enters: [],
          build: () => ({ kind: `b`, count: 0, pair: [`right`, [0, 1]] }),
        },
      ],
      fixed: [
        {
          name: `fixed`,
          history: { kind: `a`, mode: `fast`, mask: [true, false], items: [] },
        },
      ],
    },
    model: (plan) => plan.kind === `a`,
    driver: () => {},
    check: (_plan, _trace, expected) => {
      expectTypeOf(expected).toEqualTypeOf<boolean>()
      return pass
    },
  })

  // 5. Negative checks: invalid union literals, wrong tuple lengths, and
  //    mismatched callback/calibration parameter types are still rejected.
  oracleProperty({
    id: `type.error.constructed-discriminant`,
    law,
    // @ts-expect-error invalid union literal returned from constructed[].build
    histories: {
      arbitrary: variantArbitrary,
      runs: 10,
      fixedSeeds: [1],
      constructed: [
        {
          name: `bad-discriminant`,
          enters: [],
          build: (base) =>
            base.kind === `a`
              ? { ...base, mode: `invalid`, mask: [true, false] }
              : base,
        },
      ],
    },
    model: (plan) => plan.kind,
    driver: () => {},
    check: () => pass,
  })

  oracleProperty({
    id: `type.error.constructed-tuple`,
    law,
    // @ts-expect-error wrong tuple length returned from constructed[].build
    histories: {
      arbitrary: variantArbitrary,
      runs: 10,
      fixedSeeds: [1],
      constructed: [
        {
          name: `bad-tuple`,
          enters: [],
          build: (base) =>
            base.kind === `a` ? { ...base, mode: `fast`, mask: [true] } : base,
        },
      ],
    },
    model: (plan) => plan.kind,
    driver: () => {},
    check: () => pass,
  })

  oracleProperty({
    id: `type.error.fixed-discriminant`,
    law,
    // @ts-expect-error invalid union literal in fixed[].history
    histories: {
      arbitrary: variantArbitrary,
      runs: 10,
      fixedSeeds: [1],
      fixed: [
        {
          name: `bad-fixed-discriminant`,
          history: {
            kind: `a`,
            mode: `invalid`,
            mask: [true, false],
            items: [],
          },
        },
      ],
    },
    model: (plan) => plan.kind,
    driver: () => {},
    check: () => pass,
  })

  oracleProperty({
    id: `type.error.fixed-tuple`,
    law,
    // @ts-expect-error wrong tuple length in fixed[].history
    histories: {
      arbitrary: variantArbitrary,
      runs: 10,
      fixedSeeds: [1],
      fixed: [
        {
          name: `bad-fixed-tuple`,
          history: {
            kind: `a`,
            mode: `fast`,
            mask: [true],
            items: [],
          },
        },
      ],
    },
    model: (plan) => plan.kind,
    driver: () => {},
    check: () => pass,
  })

  // R7 weakening, accepted with the break (maintainers, 2026-11-23): the four
  // negative checks that rejected mismatched annotated callbacks are removed.
  // Main compiles those programs, and the maintainer said behavior holds.

  // 6. Main-compatible callbacks. An annotated callback whose parameter is
  //    not the history type still compiles, as it does on main: the
  //    annotation is not checked against the history the driver receives.
  //    (Unsound, and kept as main's behavior: see the PR's break notes.)
  oracleProperty({
    id: `type.compat.callbacks`,
    law,
    histories: {
      arbitrary: variantArbitrary,
      runs: 10,
      fixedSeeds: [1],
    },
    model: () => 1,
    driver: (_plan: { unrelated: string }) => {},
    check: () => pass,
    calibrations: [
      {
        name: `compat-calibration-corrupt`,
        law: `type.compat.callbacks`,
        corrupt: (_trace, _plan: { unrelated: string }) => undefined,
      },
      {
        name: `compat-calibration-driver`,
        law: `type.compat.callbacks`,
        driver: (_plan: { unrelated: string }) => {},
      },
    ],
  })

  // 7. Main-compatible annotated model narrower than the history, with no
  //    `resolve`: compiles on main, and still compiles here.
  oracleProperty({
    id: `type.compat.annotated-model`,
    law,
    histories: { arbitrary: variantArbitrary, runs: 10, fixedSeeds: [1] },
    model: (plan: Extract<VariantHistory, { kind: `a` }>) => plan.mode,
    driver: () => {},
    check: () => pass,
  })

  // 8. Zero-argument `constructed[].build` returning a literal, with no type
  //    arguments. `const THistory` keeps the literal's type, so a flat literal
  //    and a literal with tuples both compile (tuples are read-only in the
  //    literal, and `build` accepts that view).
  oracleProperty({
    id: `type.zero-arg-literal`,
    law,
    histories: {
      arbitrary: variantArbitrary,
      runs: 10,
      fixedSeeds: [1],
      constructed: [
        {
          name: `zero-arg-tuple`,
          enters: [],
          build: () => ({ kind: `b`, count: 0, pair: [`right`, [0, 1]] }),
        },
      ],
    },
    model: (plan) => plan.kind,
    driver: () => {},
    check: () => pass,
  })

  // 9. The break (accepted by the maintainers, 2026-11-23). A history that a
  //    literal in `enumerated` infers is read-only, so mutating it no longer
  //    compiles. The migration copies the array before it mutates it.
  oracleProperty({
    id: `type.break.literal-mutated`,
    law,
    histories: {
      enumerated: [
        { kind: `a`, mode: `fast`, mask: [true, false], items: [1] },
      ],
      states: [],
    },
    model: (plan) => {
      // @ts-expect-error a literal history is read-only: copy the array first
      plan.items.push(2)
      return plan.kind
    },
    driver: () => {},
    check: () => pass,
  })

  oracleProperty({
    id: `type.break.literal-migrated`,
    law,
    histories: {
      enumerated: [
        { kind: `a`, mode: `fast`, mask: [true, false], items: [1] },
      ],
      states: [],
    },
    model: (plan) => {
      const items: Array<number> = [...plan.items]
      items.push(2)
      return plan.kind
    },
    driver: () => {},
    check: () => pass,
  })

  // 10. Function-valued properties keep their type under ReadonlyHistory. A
  //     wrong value in a function field is rejected, as on main. (A mapped
  //     type over a function has no keys, so the read-only view must keep
  //     the function type.)
  type FnHistory = {
    kind: `f`
    fn: () => number
    inner: { fn: () => number }
    run: () => number
  }
  const fnArbitrary: fc.Arbitrary<FnHistory> = fc.record({
    kind: fc.constant(`f` as const),
    fn: fc.constant(() => 1),
    inner: fc.record({ fn: fc.constant(() => 1) }),
    run: fc.constant(() => 1),
  })
  oracleProperty({
    id: `type.fn.correct`,
    law,
    histories: {
      arbitrary: fnArbitrary,
      runs: 10,
      fixedSeeds: [1],
      constructed: [
        {
          name: `fn-correct`,
          enters: [],
          build: () => ({
            kind: `f`,
            fn: () => 1,
            inner: { fn: () => 1 },
            run: () => 1,
          }),
        },
      ],
    },
    model: (plan) => plan.kind,
    driver: () => {},
    check: () => pass,
  })
  oracleProperty({
    id: `type.error.fn-number`,
    law,
    // @ts-expect-error a number where a function-valued field is required
    histories: {
      arbitrary: fnArbitrary,
      runs: 10,
      fixedSeeds: [1],
      constructed: [
        {
          name: `fn-number`,
          enters: [],
          build: () => ({
            kind: `f`,
            fn: 123,
            inner: { fn: () => 1 },
            run: () => 1,
          }),
        },
      ],
    },
    model: (plan) => plan.kind,
    driver: () => {},
    check: () => pass,
  })
  oracleProperty({
    id: `type.error.fn-string`,
    law,
    // @ts-expect-error a string where a function-valued field is required
    histories: {
      arbitrary: fnArbitrary,
      runs: 10,
      fixedSeeds: [1],
      constructed: [
        {
          name: `fn-string`,
          enters: [],
          build: () => ({
            kind: `f`,
            fn: `str`,
            inner: { fn: () => 1 },
            run: () => 1,
          }),
        },
      ],
    },
    model: (plan) => plan.kind,
    driver: () => {},
    check: () => pass,
  })
  oracleProperty({
    id: `type.error.fn-nested`,
    law,
    // @ts-expect-error a number in a nested function-valued field
    histories: {
      arbitrary: fnArbitrary,
      runs: 10,
      fixedSeeds: [1],
      constructed: [
        {
          name: `fn-nested`,
          enters: [],
          build: () => ({
            kind: `f`,
            fn: () => 1,
            inner: { fn: 5 },
            run: () => 1,
          }),
        },
      ],
    },
    model: (plan) => plan.kind,
    driver: () => {},
    check: () => pass,
  })
  oracleProperty({
    id: `type.error.fn-method`,
    law,
    // @ts-expect-error a number where a method is required
    histories: {
      arbitrary: fnArbitrary,
      runs: 10,
      fixedSeeds: [1],
      constructed: [
        {
          name: `fn-method`,
          enters: [],
          build: () => ({
            kind: `f`,
            fn: () => 1,
            inner: { fn: () => 1 },
            run: 5,
          }),
        },
      ],
    },
    model: (plan) => plan.kind,
    driver: () => {},
    check: () => pass,
  })

  // 11. Main-compatible: a fixed history's literal keeps mutable arrays, so
  //     a model may mutate it, as on main. (Main-compatibility, not a witness
  //     of any wrapper: the fixed literal's type is inferred the same way with
  //     or without NoInfer, so `fixed` has no NoInfer.)
  oracleProperty({
    id: `type.fixed.mutable`,
    law,
    histories: {
      arbitrary: variantArbitrary,
      runs: 10,
      fixedSeeds: [1],
      fixed: [
        {
          name: `mutable-fixed`,
          history: { kind: `a`, mode: `fast`, mask: [true, false], items: [1] },
        },
      ],
    },
    model: (plan) => {
      if (plan.kind === `a`) plan.items.push(2)
      return plan.kind
    },
    driver: () => {},
    check: () => pass,
  })

  // 12. The break, class: a literal-inferred array passed to a mutable-array
  //     parameter. The migration copies the array.
  oracleProperty({
    id: `type.break.mutable-parameter`,
    law,
    histories: {
      enumerated: [
        { kind: `a`, mode: `fast`, mask: [true, false], items: [1] },
      ],
      states: [],
    },
    model: (plan) => {
      // @ts-expect-error a literal history's array is read-only
      takesMutable(plan.items)
      return plan.kind
    },
    driver: () => {},
    check: () => pass,
  })
  oracleProperty({
    id: `type.break.mutable-parameter-migrated`,
    law,
    histories: {
      enumerated: [
        { kind: `a`, mode: `fast`, mask: [true, false], items: [1] },
      ],
      states: [],
    },
    model: (plan) => {
      takesMutable([...plan.items])
      return plan.kind
    },
    driver: () => {},
    check: () => pass,
  })

  // 13. The break, class: a discriminated-union branch. Each branch keeps its
  //     own read-only array; the migration copies it inside the branch.
  oracleProperty({
    id: `type.break.union-branch`,
    law,
    histories: {
      enumerated: [
        { kind: `a`, items: [1] },
        { kind: `b`, count: 1 },
      ],
      states: [],
    },
    model: (plan) => {
      if (plan.kind === `a`) {
        // @ts-expect-error the branch's array is read-only
        takesMutable(plan.items)
      }
      return plan.kind
    },
    driver: () => {},
    check: () => pass,
  })
  oracleProperty({
    id: `type.break.union-branch-migrated`,
    law,
    histories: {
      enumerated: [
        { kind: `a`, items: [1] },
        { kind: `b`, count: 1 },
      ],
      states: [],
    },
    model: (plan) => {
      if (plan.kind === `a`) takesMutable([...plan.items])
      return plan.kind
    },
    driver: () => {},
    check: () => pass,
  })

  // 14. The break, class: a generic constrained to a mutable array. The
  //     migration copies the array.
  oracleProperty({
    id: `type.break.constrained-generic`,
    law,
    histories: {
      enumerated: [
        { kind: `a`, mode: `fast`, mask: [true, false], items: [1] },
      ],
      states: [],
    },
    model: (plan) => {
      // @ts-expect-error a read-only array does not satisfy number[]
      firstOf(plan.items)
      return plan.kind
    },
    driver: () => {},
    check: () => pass,
  })
  oracleProperty({
    id: `type.break.constrained-generic-migrated`,
    law,
    histories: {
      enumerated: [
        { kind: `a`, mode: `fast`, mask: [true, false], items: [1] },
      ],
      states: [],
    },
    model: (plan) => {
      firstOf([...plan.items])
      return plan.kind
    },
    driver: () => {},
    check: () => pass,
  })

  // 15. Unbroken: a generic with no array constraint keeps the read-only type.
  oracleProperty({
    id: `type.generic-identity`,
    law,
    histories: {
      enumerated: [
        { kind: `a`, mode: `fast`, mask: [true, false], items: [1] },
      ],
      states: [],
    },
    model: (plan) => {
      identity(plan.items)
      return plan.kind
    },
    driver: () => {},
    check: () => pass,
  })
}
