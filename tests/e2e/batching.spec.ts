import { expect, test } from '@playwright/test'
import { longestRideMs, prototype } from './balance.ts'

test.describe.configure({ timeout: 90_000 }) // Simula minutos de turno cuadro por cuadro.

test('la bici arma un viaje de 2 pedidos con Shift, se cambia el orden y entrega los dos', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  const map = page.getByRole('region', { name: /^Mapa de Nørrebro/ })
  const twoWaiting = map.getByRole('button', { name: /pedidos esperando: 2/ }).first()

  // Dejar correr el turno hasta que un restaurante tenga 2 pedidos esperando.
  for (let waited = 0; waited < prototype.shift.durationSec * 1000 && (await twoWaiting.count()) === 0; waited += 1000) {
    await page.clock.runFor(1000)
  }
  await page.keyboard.press('Space')
  await twoWaiting.click()

  const popup = map.getByTestId('map-popup')
  const popupOrders = popup.getByTestId('popup-order')
  await popupOrders.nth(0).click()
  await popupOrders.nth(1).click({ modifiers: ['Shift'] })
  await expect(popup).toContainText('2 pedidos elegidos')
  await expect(popupOrders.nth(1)).toHaveAttribute('aria-pressed', 'true')

  // Solo la bici lleva 2: es la única que aparece para elegir.
  const riders = popup.getByTestId('popup-rider')
  await expect(riders).toHaveCount(1)
  await expect(riders.first()).toContainText('Repartidor 1')
  await riders.first().click()

  const card = page.getByRole('complementary', { name: /Repartidores/ }).locator('[data-rider-number="1"]')
  await expect(card).toContainText('2 pedidos')
  const stops = card.getByTestId('rider-stop')
  await expect(stops).toHaveCount(2)
  // "1. #4", "2. #6": the order number without the position.
  const numbers = async () => (await stops.locator('.rider-stops__number').allTextContents()).map((text) => text.slice(3))
  const before = await numbers()

  // Cambiar el orden: el primero pasa a ser el segundo.
  await stops.first().getByRole('button', { name: /Entregar después/ }).click()
  expect(await numbers()).toEqual([before[1], before[0]])

  // Seguir hasta que entregue los dos.
  await page.keyboard.press('Space')
  for (let waited = 0; waited < longestRideMs * 3 + 30_000; waited += 2000) {
    if ((await card.textContent())?.includes('Libre')) break
    await page.clock.runFor(2000)
  }
  await expect(card).toContainText('Libre')
  await expect(page.getByTestId('delivered-count')).toContainText(/Entregados: [2-9]/)
})
