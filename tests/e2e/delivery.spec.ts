import { expect, test, type Locator, type Page } from '@playwright/test'
import { longestRideMs, prototype } from './balance.ts'

/** Advances the page clock in small steps until the locator has the text (or gives up after maxMs). */
async function runUntil(page: Page, locator: Locator, text: string, maxMs: number) {
  for (let waited = 0; waited <= maxMs; waited += 500) {
    if ((await locator.textContent())?.includes(text)) return
    await page.clock.runFor(500)
  }
  await expect(locator).toContainText(text)
}

test('el repartidor va al restaurante, espera la cocina, entrega y queda libre', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.clock.runFor(prototype.orders.spawnIntervalSec * 1000 + 500)

  const orderPanel = page.getByRole('complementary', { name: /Pedidos/ })
  const riderPanel = page.getByRole('complementary', { name: /Repartidores/ })
  await orderPanel.getByTestId('order-card').first().getByRole('button').click()
  const closest = (await riderPanel.getByTestId('rider-card').first().getAttribute('data-rider-number')) ?? '1'
  await page.keyboard.press(closest)

  const rider = riderPanel.locator(`[data-rider-number="${closest}"]`)
  await expect(rider).toContainText(/Yendo al restaurante|Esperando la cocina/)

  // En el turno de la semilla del juego, el repartidor más cercano llega antes de que la comida esté lista.
  await runUntil(page, rider, 'Esperando la cocina', longestRideMs)
  await expect(rider).toContainText(/\(\d+ s\)/)

  // En pausa no avanza: el tiempo de cocina queda igual.
  await page.keyboard.press('Space')
  const kitchen = await rider.textContent()
  await page.clock.runFor(2000)
  await expect(rider).toHaveText(kitchen ?? '')
  await page.keyboard.press('Space')

  await expect(page.getByTestId('shift-rating')).toHaveText('–')
  await runUntil(page, rider, 'Yendo al cliente', prototype.kitchen.cookSec * 1000 + 2000)

  // La comida viaja todavía caliente (cómo se enfría lo prueban los tests de reglas).
  const heat = rider.getByTestId('food-heat')
  await expect(heat).toHaveText(/^\d+°$/)
  const value = parseInt((await heat.textContent()) ?? '', 10)
  expect(value).toBeGreaterThan(40)
  expect(value).toBeLessThanOrEqual(100)
  await expect(heat).toHaveAttribute('aria-label', `Temperatura de la comida: ${value} de 100`)

  await runUntil(page, rider, 'Libre', longestRideMs + 2000)
  await expect(rider.getByTestId('food-heat')).toHaveCount(0)

  await expect(orderPanel.getByTestId('delivered-count')).toHaveText('Entregados: 1')
  await expect(riderPanel.getByLabel('3 de 3 repartidores libres')).toBeVisible()
  // A tiempo y caliente: 5 estrellas de promedio.
  await expect(page.getByTestId('shift-rating')).toHaveText('5,0')
  await expect(page.getByLabel('Promedio del turno: 5,0 de 5 estrellas')).toBeVisible()
})
