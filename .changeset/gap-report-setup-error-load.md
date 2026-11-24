---
'@tanstack/oracles': patch
---

The `oracle-gaps` directive for a `setup-error` gap now says how to judge a module that fails to load. Before, it said to run an owner test that loads the module and asserts on its exports. An owner file that imports the module statically fails before any of its tests runs when the module throws while it loads, so that test never ran, and a Vitest setup file that imports the module statically fails every test file. The directive now says to load the module inside an owner test's driver with a dynamic `import()`, record a rejected load as an observation, and let a law reject it, and to import an owned module inside a setup file's hook, never at its top level. The design skill says the same.
