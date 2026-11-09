import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  ...tanstackConfig,
  { ignores: [`**/dist/**`, `**/.self-oracle-*/**`] },
]
