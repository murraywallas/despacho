import { expect, test, type Page } from '@playwright/test'
import { prototype, SHIFT_URL } from './balance.ts'

test.describe.configure({ timeout: 90_000 }) // El segundo caso simula casi todo el plazo cuadro por cuadro.

/** Plays until the first order has been waiting `waitSec`, pauses and picks it in the queue. */
async function pickFirstOrder(page: Page, waitSec: number) {
  await page.clock.install()
  await page.goto(SHIFT_URL)
  await page.clock.runFor((prototype.orders.spawnIntervalSec + waitSec) * 1000 + 500)
  await page.keyboard.press('Space')
  await page.getByTestId('order-card').first().getByRole('button').first().click()
  return page.getByRole('complementary', { name: /Repartidores/ }).locator('.rider-card__eta')
}

test('cada repartidor libre muestra en cuántos minutos llega la comida al cliente, el que entrega antes arriba', async ({
  page,
}) => {
  const etas = await pickFirstOrder(page, 0)
  await expect(etas).toHaveCount(3)
  for (const eta of await etas.all()) {
    await expect(eta).toContainText(/Entrega al cliente en \d+ min/)
    await expect(eta).toHaveAttribute('data-late', 'false')
  }
  const minutes = (await etas.allTextContents()).map((text) => Number.parseInt(text, 10))
  expect(minutes).toEqual([...minutes].sort((a, b) => a - b))

  // La tarjeta del restaurante (con el pedido ya elegido) muestra los mismos minutos, en el mismo orden.
  await page.getByRole('button', { name: /pedidos esperando: 1/ }).click()
  const popupEtas = page.getByTestId('map-popup').locator('.map-popup__eta')
  await expect(popupEtas).toHaveCount(3)
  const popupMinutes = (await popupEtas.allTextContents()).map((text) => Number.parseInt(text, 10))
  expect(popupMinutes).toEqual(minutes)
})

test('si ni el más rápido llega antes del plazo, todos se marcan tarde', async ({ page }) => {
  // Quedan 2 s de plazo: no hay repartidor que llegue.
  const etas = await pickFirstOrder(page, prototype.orders.deadlineSec - 2)
  await expect(etas).toHaveCount(3)
  for (const eta of await etas.all()) {
    await expect(eta).toHaveAttribute('data-late', 'true')
    await expect(eta).toContainText('llega tarde')
  }
})
