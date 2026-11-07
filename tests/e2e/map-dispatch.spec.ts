import { expect, test, type Page } from '@playwright/test'
import { prototype } from './balance.ts'

/** Opens the game, lets the first order come in and pauses. */
async function firstOrderIn(page: Page) {
  await page.clock.install()
  await page.goto('/')
  await page.clock.runFor(prototype.orders.spawnIntervalSec * 1000 + 500)
  await page.keyboard.press('Space')
  const map = page.getByRole('region', { name: /^Mapa de Nørrebro/ })
  const waiting = map.getByRole('button', { name: /pedidos esperando: 1/ })
  await expect(waiting).toHaveCount(1)
  return { map, waiting }
}

test('primero el repartidor en el mapa, después el restaurante con "!": sale a buscar el pedido', async ({ page }) => {
  const { map, waiting } = await firstOrderIn(page)

  const rider = map.getByRole('button', { name: 'Repartidor 2' })
  await rider.click()
  await expect(rider).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Ahora tocá un restaurante')).toBeVisible()

  // Un toque en el restaurante y ya: sin tarjeta de por medio.
  await waiting.click()
  const card = page.getByRole('complementary', { name: /Repartidores/ }).locator('[data-rider-number="2"]')
  await expect(card).toContainText(/Yendo al restaurante|Esperando la cocina/)
  await expect(card).toContainText('pedido #1')
  await expect(map.getByRole('button', { name: /pedidos esperando/ })).toHaveCount(0)
  await expect(map.getByTestId('map-popup')).toHaveCount(0)
})

test('con el repartidor elegido, un restaurante sin pedidos abre su tarjeta y el repartidor sigue elegido', async ({
  page,
}) => {
  const { map } = await firstOrderIn(page)
  const rider = map.getByRole('button', { name: 'Repartidor 1' })
  await rider.click()
  const quiet = map.getByTestId('restaurant-marker').filter({ hasNot: page.locator('.map-pin__alert') }).first()
  await quiet.click()
  await expect(map.getByTestId('map-popup')).toContainText('Sin pedidos esperando.')
  await expect(rider).toHaveAttribute('aria-pressed', 'true')
})

test('primero el pedido en la tarjeta del restaurante, después el repartidor más cercano', async ({ page }) => {
  const { map, waiting } = await firstOrderIn(page)

  await waiting.click()
  const popup = map.getByTestId('map-popup')
  await expect(popup).toBeVisible()
  await popup.getByTestId('popup-order').first().click()

  // Aparecen los libres por ETA; el primero es el más cercano.
  const riders = popup.getByTestId('popup-rider')
  await expect(riders).toHaveCount(3)
  const first = (await riders.first().textContent()) ?? ''
  const number = /Repartidor (\d)/.exec(first)?.[1] ?? '1'
  await riders.first().click()

  const card = page.getByRole('complementary', { name: /Repartidores/ }).locator(`[data-rider-number="${number}"]`)
  await expect(card).toContainText('pedido #1')
  await expect(page.getByLabel('2 de 3 repartidores libres')).toBeVisible()
  await expect(popup).toHaveCount(0)
})

test('con el teclado: Tab hasta el restaurante, Enter abre la tarjeta y Esc la cierra', async ({ page }) => {
  const { map, waiting } = await firstOrderIn(page)

  await waiting.focus()
  await page.keyboard.press('Enter')
  const popup = map.getByTestId('map-popup')
  await expect(popup).toBeVisible()
  await popup.getByTestId('popup-order').first().click()
  await page.keyboard.press('Escape')
  await expect(popup).toHaveCount(0)
})
