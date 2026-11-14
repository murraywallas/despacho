import { expect, test, type Locator, type Page } from '@playwright/test'
import { longestRideMs, prototype, SHIFT_URL } from './balance.ts'

test.describe.configure({ timeout: 90_000 }) // Simula minutos de turno cuadro por cuadro.

/** Advances the page clock in small steps until the locator has the text (or gives up after maxMs). */
async function runUntil(page: Page, locator: Locator, text: string, maxMs: number) {
  for (let waited = 0; waited <= maxMs; waited += 500) {
    if ((await locator.textContent())?.includes(text)) return
    await page.clock.runFor(500)
  }
  await expect(locator).toContainText(text)
}

test('al terminar la entrega, la radio avisa que el repartidor quedó libre y su tarjeta se destaca hasta elegirlo', async ({ page }) => {
  await page.clock.install()
  await page.goto(SHIFT_URL)
  const radio = page.getByTestId('radio')
  await page.clock.runFor(prototype.orders.spawnIntervalSec * 1000 + 500)

  const orderPanel = page.getByRole('complementary', { name: /Pedidos/ })
  const riderPanel = page.getByRole('complementary', { name: /Repartidores/ })
  await orderPanel.getByTestId('order-card').first().getByRole('button').first().click()
  const closest = (await riderPanel.getByTestId('rider-card').first().getAttribute('data-rider-number')) ?? '1'
  await page.keyboard.press(closest)

  await runUntil(page, radio, `Repartidor ${closest} quedó libre`, 2 * longestRideMs + prototype.kitchen.cookSec * 1000)
  await page.keyboard.press('Space') // En pausa, para mirar con calma.

  // Siempre llegan más pedidos mientras viajaba: el destaque se mantiene hasta que se lo use o se lo elija.
  await expect(orderPanel.getByTestId('order-card').first()).toBeVisible()
  const card = riderPanel.locator(`[data-rider-number="${closest}"] .rider-card`)
  await expect(card).toHaveAttribute('data-attention', 'true')
  await expect(page.locator('.map-pin--attention')).toHaveCount(1)

  await card.click()
  await expect(card).not.toHaveAttribute('data-attention', 'true')
  await expect(page.locator('.map-pin--attention')).toHaveCount(0)
})
