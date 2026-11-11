import { readFileSync, statSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { SHIFT_URL } from './balance.ts'

const MAX_BYTES = 1024 * 1024

test('cada barrio de scripts/streets/config.json tiene sus calles y pesan menos de 1 MB', () => {
  const config = JSON.parse(readFileSync(new URL('../../scripts/streets/config.json', import.meta.url), 'utf8')) as {
    areas: { id: string; output: string }[]
  }
  expect(config.areas.map((area) => area.id)).toEqual(['norrebro', 'vesterbro', 'frederiksberg'])
  for (const area of config.areas) {
    expect(statSync(new URL(`../../${area.output}`, import.meta.url)).size, area.output).toBeLessThan(MAX_BYTES)
  }
})

test('el mapa del turno muestra la atribución de OpenStreetMap', async ({ page }) => {
  await page.goto(SHIFT_URL)
  await expect(page.getByText('OpenStreetMap contributors').first()).toBeVisible()
})
