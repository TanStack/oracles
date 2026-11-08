import { readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import { tanstackViteConfig } from '@tanstack/vite-config'
import packageJson from './package.json'
import type { Plugin } from 'vite'

/**
 * Only the browser-safe `./declaration` entry has a CommonJS build. The main
 * entry imports Vitest, which refuses require(), so a CommonJS copy of it
 * could never load. The library build emits every entry in both formats, so
 * this plugin keeps only the CommonJS modules that the declaration entry
 * reaches, and their declaration files. `tests/package.test.ts` checks the
 * packed result.
 */
function commonJsForDeclarationOnly(): Plugin {
  const reached = new Set<string>()
  const commonJsDirectory = fileURLToPath(
    new URL(`./dist/cjs`, import.meta.url),
  )
  return {
    name: `oracles:commonjs-for-declaration-only`,
    // Tests serve the config, and a dev server's close calls closeBundle too.
    apply: `build`,
    generateBundle(output, bundle) {
      if (output.format !== `cjs`) return
      const visit = (file: string) => {
        if (reached.has(file)) return
        reached.add(file)
        const chunk = bundle[file]
        if (chunk?.type === `chunk`) chunk.imports.forEach(visit)
      }
      visit(`cjs/declaration.cjs`)
      for (const file of Object.keys(bundle))
        if (!reached.has(file.replace(/\.map$/, ``))) delete bundle[file]
    },
    // The declaration plugin writes every module's `.d.cts` after the bundle.
    closeBundle() {
      if (reached.size === 0) return
      for (const file of readdirSync(commonJsDirectory))
        if (
          file.endsWith(`.d.cts`) &&
          !reached.has(`cjs/${file.replace(/\.d\.cts$/, `.cjs`)}`)
        )
          rmSync(join(commonJsDirectory, file))
    },
  }
}

const config = defineConfig({
  plugins: [commonJsForDeclarationOnly()],
  test: {
    name: packageJson.name,
    dir: `./tests`,
    // The oracleProperty self-oracle spawns real Vitest runs; `pnpm
    // test:oracle-framework` runs it on its own.
    exclude: [
      ...configDefaults.exclude,
      `**/oracle-property-self-oracle.test.ts`,
    ],
  },
})

export default mergeConfig(
  config,
  tanstackViteConfig({
    entry: [`./src/index.ts`, `./src/declaration.ts`],
    srcDir: `./src`,
  }),
)
