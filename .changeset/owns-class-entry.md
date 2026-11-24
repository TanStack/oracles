---
'@tanstack/oracles': patch
---

An `owns` entry can name a class: `src/x.ts#Failure` owns the whole class, its constructor, methods, accessors, field initializers, static blocks, and `extends` clause, with each one's static call tree. Before, `#Failure` was refused with "names no function", and only its members could be named. A named class declaration is now a unit of its own, so a mutant in a field initializer, a static block, or an `extends` clause is reported under the class's name (`src/x.ts#Failure:…`), not `<module>`. A class used as a value also brings that code, as it already brought all the methods. `new Failure()` and an entry that names `#Failure.constructor` still bring only the constructor.

Gap keys of mutants in a class's field initializers, static blocks, and `extends` clauses change once, from `<module>` to the class's name. Re-baseline any stored gaps for them. A top-level statement that is neither a function nor data, such as `Failure.prototype.name = '…'` after the class, still belongs to `<module>`, and only a whole-file entry owns it. The design skill now says so.

An unnamed function called in place inside module data's initializer or a class's own code (`const D = (() => helper())()`, `t = (() => helper())()`) is no unit, so its code belongs to the declaration, and what it calls is now in the declaration's tree. Before, every function in an initializer was skipped as if it were a unit of its own, so `helper` stayed unowned.
