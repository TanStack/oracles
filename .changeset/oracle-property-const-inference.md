---
'@tanstack/oracles': minor
---

`oracleProperty` infers a history from a literal with `const`, so a zero-argument `constructed[].build` that returns a literal compiles, and an annotated `model` without `resolve` keeps its type as it did before this change.

**Breaking (types only, accepted by the maintainers).** A history that a literal infers is now read-only: `const THistory` gives it readonly properties and readonly tuples, so code that mutates such a history no longer compiles. Two cases:

- `enumerated` (or a plain array of) literal histories: `model: (plan) => { plan.items.push(2) }` becomes an error (`Property 'push' does not exist on type 'readonly [1]'`). Migrate by copying the array first: `const items: Array<number> = [...plan.items]`, then mutate `items`.
- A literal history that is written as a value and then mutated has the same break: copy the value before the mutation, or annotate the literal with the history type.

`constructed[].build` may return the read-only view of the history (`ReadonlyHistory<THistory>`), so a literal with tuples compiles. Histories from `arbitrary` and `fixed` are unchanged.
