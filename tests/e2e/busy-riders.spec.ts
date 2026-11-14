import { expect, test } from '@playwright/test'
import { prototype, SHIFT_URL } from './balance.ts'

test('apretar el número de un repartidor ocupado avisa cuándo queda libre, y no asigna nada', async ({ page }) => {
  await page.clock.install()
  await page.goto(SHIFT_URL)
  const orderPanel = page.getByRole('complementary', { name: /Pedidos/ })
  const riderPanel = page.getByRole('complementary', { name: /Repartidores/ })
  const orders = orderPanel.getByTestId('order-card')
  await page.clock.runFor(2 * prototype.orders.spawnIntervalSec * 1000 + 500)
  await expect(orders).toHaveCount(2)
  await page.keyboard.press('Space') // En pausa: nada se mueve mientras miramos.

  // El primer pedido sale con el repartidor más cercano.
  await orders.first().getByRole('button').first().click()
  const busy = (await riderPanel.getByTestId('rider-card').first().getAttribute('data-rider-number')) ?? '1'
  await page.keyboard.press(busy)
  const card = riderPanel.locator(`[data-rider-number="${busy}"]`)
  await expect(card.getByTestId('rider-free-in')).toHaveText(/^Libre en ~\d+ min$/)

  // Con el segundo pedido elegido, el número del ocupado no hace nada... salvo avisar por qué.
  await orders.first().getByRole('button').first().click()
  await page.keyboard.press(busy)
  await expect(card.getByTestId('rider-refusal')).toHaveText(new RegExp(`^Repartidor ${busy} ocupado · libre en ~\\d+ min$`))
  await expect(orders).toHaveCount(1)
  await expect(orders.first().getByRole('button').first()).toHaveAttribute('aria-pressed', 'true')

  // Con clic, lo mismo.
  await card.getByRole('button').first().click()
  await expect(card.getByTestId('rider-refusal')).toBeVisible()
  await expect(orders).toHaveCount(1)
})
