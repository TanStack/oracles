---
'@tanstack/oracles': minor
---

`oracleProperty` infers a history from a literal with `const`, so a zero-argument `constructed[].build` that returns a literal compiles, and an annotated `model` without `resolve` keeps its annotated type, as on main. `constructed[].build` may return the read-only view of a history, `ReadonlyHistory`, which is a new public type export.

**Breaking (types only, accepted by the maintainers on 2026-11-23).** A history that a literal infers is read-only: its arrays are read-only tuples. Code that needs a mutable array type no longer accepts it, in five cases:

1. **Mutating it.** `model: (plan) => { plan.items.push(2) }` on an `enumerated` literal fails. Migrate by copying the array first: `const items: Array<number> = [...plan.items]`, then mutate `items`.
2. **Passing it to a mutable-array parameter.** `takesMutable(plan.items)`, where the parameter is `Array<number>`, fails. Migrate with a copy: `takesMutable([...plan.items])`.
3. **A discriminated-union branch.** Each branch keeps its own read-only array, so case 2 applies inside `if (plan.kind === 'a')`. Migrate the same way, inside the branch.
4. **A generic constrained to a mutable array** (`T extends Array<number>`). Migrate by passing a copy: `firstOf([...plan.items])`.
5. **The new `ReadonlyHistory` export.** Code that names it receives the read-only view of a history.

Generic functions without an array constraint (`identity(plan.items)`) keep the read-only type. Histories from `arbitrary` and `fixed` are unchanged.
