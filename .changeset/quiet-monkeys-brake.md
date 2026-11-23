---
'@tanstack/oracles': patch
---

The gap report owns the functions of a module-level object literal when the literal is used dynamically (`handlers[key]()`) or as a whole value (passed to a function, spread, or read with `Object.values`), as the maintainers ruled on 2026-11-23. A static property read (`handlers.a()`) still owns only that member, and an `owns` entry that names the literal owns no member. Two related fixes: a property name in an object literal no longer counts as a reference to the function it names, and a shorthand property (`{ helper }`) resolves to the function it names, so the gap report no longer lists that function as unowned.
