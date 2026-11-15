import { expect, test } from '@playwright/test'
import { prototype, SHIFT_URL } from './balance.ts'

test.describe.configure({ timeout: 90_000 }) // Simula minutos de turno cuadro por cuadro.

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
  // El aviso ya dice cuándo queda libre: la otra línea no lo repite.
  await expect(card.getByTestId('rider-free-in')).toHaveCount(0)
  await expect(orders).toHaveCount(1)
  await expect(orders.first().getByRole('button').first()).toHaveAttribute('aria-pressed', 'true')

  // Con clic, lo mismo.
  await card.getByRole('button').first().click()
  await expect(card.getByTestId('rider-refusal')).toBeVisible()
  await expect(orders).toHaveCount(1)
})

test('con todos ocupados, el cartel del restaurante dice quién se libera primero', async ({ page }) => {
  await page.clock.install()
  await page.goto(SHIFT_URL)
  const orderPanel = page.getByRole('complementary', { name: /Pedidos/ })
  const riderPanel = page.getByRole('complementary', { name: /Repartidores/ })
  const orders = orderPanel.getByTestId('order-card')
  const riders = riderPanel.getByTestId('rider-card')
  const count = await riders.count()
  await page.clock.runFor((count + 1) * prototype.orders.spawnIntervalSec * 1000 + 500)
  await expect(orders).toHaveCount(count + 1)
  await page.keyboard.press('Space') // En pausa.

  // Cada repartidor sale con un pedido: el primero de la lista es el que entrega antes.
  for (let sent = 0; sent < count; sent++) {
    await orders.first().getByRole('button').first().click()
    const number = (await riders.first().getAttribute('data-rider-number')) ?? '1'
    await page.keyboard.press(number)
    await expect(orders).toHaveCount(count - sent)
  }

  await orders.first().getByRole('button').first().click()
  const popup = page.getByTestId('map-popup')
  await expect(popup).toContainText('No hay repartidores libres.')
  await expect(popup.getByTestId('popup-first-free')).toHaveText(/^El primero que se libera: Repartidor \d+, en ~\d+ min\.$/)
})
