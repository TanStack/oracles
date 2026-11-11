---
'@tanstack/oracles': patch
---

The `oracle-gaps` CLI's TypeScript is now the npm alias dependency `typescript-for-tanstack-oracles` (`npm:typescript@^5.9.2`), and the CLI resolves it by that name. Before, the plain `typescript` dependency was hoisted by npm to an adopter's root. A project without TypeScript got a `typescript` package, and a project with its own TypeScript range could have that range deduped up to 5.9. Now neither happens. npm still links the alias's `tsc` and `tsserver` into `node_modules/.bin` when no other package provides them: in a project without TypeScript, and after an incremental `npm install` of this package into a project with TypeScript, until the next clean install. On a clean install, the project's own `typescript` provides `tsc`. pnpm links only direct dependencies' commands, so it is not affected.
