import { readdirSync, readFileSync, statSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const MAX_BYTES = 200 * 1024
const folder = new URL('../../public/sounds/', import.meta.url)

test('cada sonido del juego existe y ninguno pesa más de 200 KB', () => {
  // Los archivos que nombra src/audio/mix.ts.
  const mix = readFileSync(new URL('../../src/audio/mix.ts', import.meta.url), 'utf8')
  const named = [...mix.matchAll(/'sounds\/([^']+)'/g)].map((match) => match[1])
  expect(named).toHaveLength(7)
  const files = new Set(readdirSync(folder))
  for (const name of named) {
    expect(files.has(name)).toBe(true)
    expect(statSync(new URL(name, folder)).size).toBeLessThanOrEqual(MAX_BYTES)
  }
})
