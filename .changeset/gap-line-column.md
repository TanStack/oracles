---
'@tanstack/oracles': minor
---

A gap line now gives the column of its mutant: `oracle-gaps: gap <kind> L<line>:C<column> <id> <change>`. Before, it gave only `L<line>`. The line and column mark where the code the mutant replaces starts. Both count from 1, and the column counts UTF-16 code units, as TypeScript and editors do. Two sites of one change on one line now print apart. For example, the two `?.` of `a?.b?.c` print with different columns, where before both printed as `` ` ?. ` → ` . ` `` on the same line. For a `?.` link, the place is the `?.` itself, so its line is now the `?.`'s line when a chain spans lines. An authored mutant whose `find` no longer applies still prints `L?`. Each mutant in `results.json` gains `column`.
