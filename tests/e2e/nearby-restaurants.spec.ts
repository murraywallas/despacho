import { expect, test } from '@playwright/test'
import { prototype, SHIFT_URL } from './balance.ts'

test.describe.configure({ timeout: 120_000 }) // Simula minutos de turno cuadro por cuadro.

test('con Shift se suma un pedido de un restaurante cercano: la barra nombra los dos y la bici los lleva', async ({ page }) => {
  await page.clock.install()
  await page.goto(SHIFT_URL)
  const cards = page.getByRole('complementary', { name: /Pedidos/ }).getByTestId('order-card')
  const names = async () => cards.locator('.order-card__name').allTextContents()
  const bar = page.getByTestId('selection-bar')

  // Dejar correr el turno hasta tener pedidos de varios restaurantes, y probar sumar uno de otro restaurante.
  let pair: [string, string] | undefined
  for (let waited = 0; waited < prototype.shift.durationSec * 1000 && !pair; waited += prototype.orders.spawnIntervalSec * 1000) {
    await page.clock.runFor(prototype.orders.spawnIntervalSec * 1000)
    const waiting = await names()
    if (new Set(waiting).size < 2) continue
    await page.keyboard.press('Space') // pausa
    for (let first = 0; first < waiting.length && !pair; first++) {
      for (let other = 0; other < waiting.length && !pair; other++) {
        if (waiting[other] === waiting[first]) continue
        await cards.nth(first).getByRole('button').first().click()
        await cards.nth(other).getByRole('button').first().click({ modifiers: ['Shift'] })
        // Si los restaurantes quedan cerca, la barra nombra los dos.
        if (((await bar.textContent()) ?? '').includes(`${waiting[first]} y ${waiting[other]}`)) pair = [waiting[first], waiting[other]]
        else await page.keyboard.press('Escape')
      }
    }
    if (!pair) await page.keyboard.press('Space')
  }
  if (!pair) throw new Error('No hubo pedidos de dos restaurantes cercanos esperando a la vez.')

  await expect(bar).toContainText(`${pair[0]} y ${pair[1]}`)
  // Los dos restaurantes quedan marcados en el mapa.
  await expect(page.locator('.map-marker--restaurant.map-marker--selected')).toHaveCount(2)
  // La tarjeta del restaurante cuenta el viaje entero: dos paradas, y solo la bici, que lleva 2, para elegir.
  const popup = page.getByTestId('map-popup')
  await expect(popup).toContainText('2 pedidos en el viaje')
  await expect(popup.getByTestId('popup-trip-stop')).toHaveCount(2)
  await expect(popup.getByTestId('popup-rider')).toHaveCount(1)
  await page.keyboard.press('1') // la bici lleva 2
  const card = page.getByRole('complementary', { name: /Repartidores/ }).locator('[data-rider-number="1"]')
  await expect(card).toContainText('2 pedidos')
})
