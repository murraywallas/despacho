import { expect, test } from '@playwright/test'
import { longestRideMs, prototype, SHIFT_URL } from './balance.ts'

test.describe.configure({ timeout: 120_000 }) // Simula minutos de turno cuadro por cuadro.

test('la bici se lleva los 2 pedidos del restaurante (Shift saca uno), se cambia el orden y entrega los dos', async ({ page }) => {
  await page.clock.install()
  await page.goto(SHIFT_URL)
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
  // Elegir uno ya suma el otro que espera ahí (#134).
  await popupOrders.nth(0).click()
  await expect(popup).toContainText('2 pedidos en el viaje')
  await expect(popupOrders.nth(1)).toHaveAttribute('aria-pressed', 'true')
  // Shift + clic lo saca del viaje, y otra vez lo vuelve a poner.
  await popupOrders.nth(1).click({ modifiers: ['Shift'] })
  await expect(popupOrders.nth(1)).toHaveAttribute('aria-pressed', 'false')
  await popupOrders.nth(1).click({ modifiers: ['Shift'] })
  await expect(popupOrders.nth(1)).toHaveAttribute('aria-pressed', 'true')

  // Antes de confirmar: cuándo llegaría cada uno, parada por parada, y los clientes numerados en el mapa.
  const tripStops = popup.getByTestId('popup-trip-stop')
  await expect(tripStops).toHaveCount(2)
  await expect(tripStops.nth(0)).toContainText(/^1\. Pedido #\d+/)
  await expect(tripStops.nth(1)).toContainText(/^2\. Pedido #\d+/)
  await expect(map.getByRole('button', { name: /parada 1 del viaje/ })).toHaveCount(1)
  await expect(map.getByRole('button', { name: /parada 2 del viaje/ })).toHaveCount(1)
  // La barra nombra los dos pedidos.
  await expect(page.getByTestId('selection-bar')).toContainText(/Pedidos #\d+ y #\d+/)

  // Solo la bici lleva los 2; el skate y el monopatín se llevarían uno, y lo dicen.
  const riders = popup.getByTestId('popup-rider')
  await expect(riders.filter({ hasText: 'lleva 1' })).toHaveCount(2)
  const bike = riders.filter({ hasText: 'Repartidor 1' })
  await expect(bike).not.toContainText('lleva')
  await bike.click()

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
    if ((await card.locator('.rider-card__status').textContent())?.startsWith('Libre')) break
    await page.clock.runFor(2000)
  }
  await expect(card.locator('.rider-card__status')).toHaveText(/^Libre/)
  await expect(page.getByTestId('delivered-count')).toContainText(/Entregados: [2-9]/)
})
