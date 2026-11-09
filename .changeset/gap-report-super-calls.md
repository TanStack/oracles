---
'@tanstack/oracles': patch
---

Fix `oracle-gaps` instrumenting `super(...)` calls. Its statement-deletion mutant wrapped a `super(...)` call, so a derived class's constructor could skip the call, or read `this` before it, and every construction failed with no mutant active. A derived constructor now gets no mutation site in its super region: the statements before its first statement that calls `super(...)`, and that statement. So no mutant can prevent or delay the call. Statements after the call keep their sites. The check covers the call as a statement, as an arrow argument, and as a logical operand, and an early `return` before it. Limit: the check runs the derived class under TypeScript's ES2022 CommonJS transpile with a copy of the mutant switch, not under Vitest's transform.
