---
'@tanstack/oracles': patch
---

The gap report owns the functions of a module-level object literal when the literal is read dynamically (`handlers[key]()`), passed as a whole value, spread, or read with `Object.values`. A static read (`handlers.a()`) owns only that member, and an `owns` entry that names the literal owns none of its methods. Module functions that the literal names by shorthand (`{ helper }`) are owned whenever the literal is reached, as `{ helper: helper }` already is. A property name in an object literal no longer counts as a reference, so a static read or an `owns` entry on the literal no longer owns its arrow-function properties beyond the member read.
