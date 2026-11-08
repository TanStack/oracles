import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import { tanstackViteConfig } from '@tanstack/vite-config'
import packageJson from './package.json'

const config = defineConfig({
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
