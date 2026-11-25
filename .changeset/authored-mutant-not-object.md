---
'@tanstack/oracles': patch
---

`oracle-gaps` now refuses an authored mutant file whose entry is not an object, and names the entry. Before, a `null` entry (`null`, or `[null]` in a list) crashed the CLI with an internal error (exit 3, "Cannot read properties of null"). A number, a string, a boolean, or a nested array was refused, but as a mutant that "lacks id, source, find, replace, intent, author", which did not say what was wrong. Each of these is now refused with exit 2: `refused: <file>: entry <n> is not an object (it is null)`, with a `fix:` line that asks for an authored mutant object.
