import { expect, it } from 'vitest'
import * as oracles from '../src/index'

it('loads the package entry', () => {
  expect(typeof oracles).toBe('object')
})
