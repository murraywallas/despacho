import { expect, test, type Locator, type Page } from '@playwright/test'
import { longestRideMs, prototype, SHIFT_URL } from './balance.ts'

/** Advances the page clock in small steps until the locator has the text (or gives up after maxMs). */
async function runUntil(page: Page, locator: Locator, text: string, maxMs: number) {
  for (let waited = 0; waited <= maxMs; waited += 500) {
    if ((await locator.textContent())?.includes(text)) return
    await page.clock.runFor(500)
  }
  await expect(locator).toContainText(text)
}

test.describe.configure({ timeout: 90_000 }) // Simula minutos de turno cuadro por cuadro.

test('el repartidor va al restaurante por las calles, retira la comida, entrega y queda libre', async ({ page }) => {
  await page.clock.install()
  await page.goto(SHIFT_URL)
  await page.clock.runFor(prototype.orders.spawnIntervalSec * 1000 + 500)

  const orderPanel = page.getByRole('complementary', { name: /Pedidos/ })
  const riderPanel = page.getByRole('complementary', { name: /Repartidores/ })
  await orderPanel.getByTestId('order-card').first().getByRole('button').first().click()
  const closest = (await riderPanel.getByTestId('rider-card').first().getAttribute('data-rider-number')) ?? '1'
  await page.keyboard.press(closest)

  const rider = riderPanel.locator(`[data-rider-number="${closest}"]`)
  await expect(rider).toContainText(/Yendo al restaurante|Esperando la cocina/)

  // Llega al restaurante. Si la comida no está lista, espera y muestra los minutos de cocina que faltan
  // (esperar la cocina en detalle lo prueban los tests de reglas).
  for (let waited = 0; waited <= longestRideMs; waited += 250) {
    if (!(await rider.textContent())?.includes('Yendo al restaurante')) break
    await page.clock.runFor(250)
  }
  await page.keyboard.press('Space')
  const atRestaurant = (await rider.textContent()) ?? ''
  expect(atRestaurant).toMatch(/Esperando la cocina · pedido #\d+ \(\d+ min\)|Yendo al cliente/)

  // En pausa no avanza nada: ni el reloj ni el repartidor.
  const time = await page.getByTestId('shift-time').textContent()
  await page.clock.runFor(4000)
  await expect(rider).toHaveText(atRestaurant)
  await expect(page.getByTestId('shift-time')).toHaveText(time ?? '')
  await page.keyboard.press('Space')

  await expect(page.getByTestId('shift-rating')).toHaveText('–')
  await runUntil(page, rider, 'Yendo al cliente', prototype.kitchen.cookSec * 1000 + 2000)

  // La comida viaja todavía caliente (cómo se enfría lo prueban los tests de reglas). En pausa, para leerla quieta.
  await page.keyboard.press('Space')
  const heat = rider.getByTestId('food-heat')
  await expect(heat).toHaveText(/^\d+°$/)
  const value = parseInt((await heat.textContent()) ?? '', 10)
  expect(value).toBeGreaterThan(40)
  expect(value).toBeLessThanOrEqual(100)
  await expect(heat).toHaveAttribute('aria-label', `Temperatura de la comida: ${value} de 100`)
  await page.keyboard.press('Space')

  // El estado, no la tarjeta entera: mientras viaja, la tarjeta ya dice "Libre en ~X min".
  await runUntil(page, rider.locator('.rider-card__status'), 'Libre', longestRideMs + 2000)
  await expect(rider.getByTestId('food-heat')).toHaveCount(0)

  await expect(orderPanel.getByTestId('delivered-count')).toHaveText('Entregados: 1')
  await expect(riderPanel.getByLabel('3 de 3 repartidores libres')).toBeVisible()
  // A tiempo y caliente: 5 estrellas de promedio.
  await expect(page.getByTestId('shift-rating')).toHaveText('5,0')
  await expect(page.getByLabel('Promedio del turno: 5,0 de 5 estrellas')).toBeVisible()
})
