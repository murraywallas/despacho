import { expect, test, type Page } from '@playwright/test'
import { prototype, SHIFT_URL } from './balance.ts'

/** Each rider card's vehicle name, and whether it shows whole (nothing cut or hidden). */
async function vehicleNames(page: Page) {
  return page.locator('.rider-card__vehicle-name').evaluateAll((elements) =>
    elements.map((element) => ({
      name: element.textContent ?? '',
      whole: element.scrollWidth <= element.clientWidth + 1 && getComputedStyle(element).textOverflow !== 'ellipsis',
    })),
  )
}

test('el vehículo de cada repartidor se lee entero, también con un pedido elegido', async ({ page }) => {
  await page.clock.install()
  await page.goto(SHIFT_URL)
  const names = await vehicleNames(page)
  expect(names.map((entry) => entry.name)).toEqual(['Bicicleta', 'Skate', 'Monopatín eléctrico'])
  for (const entry of names) expect(entry.whole, entry.name).toBe(true)

  // Con un pedido elegido aparece la columna de minutos: el nombre sigue entero.
  await page.clock.runFor(prototype.orders.spawnIntervalSec * 1000 + 500)
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('.rider-card__eta').first()).toBeVisible()
  for (const entry of await vehicleNames(page)) expect(entry.whole, entry.name).toBe(true)
})
