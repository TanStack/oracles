---
'@tanstack/oracles': patch
'@tanstack/eslint-plugin-oracles': patch
---

Ship agent skills and docs inside `@tanstack/oracles`. The package now includes `skills/` with five skills: `oracles-explore` (the entry point: it probes a repository, shows what an oracle can find, and builds the first oracle with the developer), `oracles-setup`, `oracles-design`, `oracles-review`, and `oracles-evaluate-review`. It also includes `docs/`: an introduction to oracles, the oracle checklist (version 1, ORC-001 to ORC-016), a glossary, a techniques guide, model-style examples, and six instrument cards. A coding agent reads them from `node_modules`. `@tanstack/eslint-plugin-oracles` gains a README that lists its configs and rules.
