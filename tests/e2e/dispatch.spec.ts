import { expect, test, type Page } from '@playwright/test'
import { prototype, SHIFT_URL } from './balance.ts'

/** Speeds up the clock and waits until `count` orders are in the queue, then pauses. */
async function waitForOrders(page: Page, count: number) {
  await page.goto(SHIFT_URL)
  await page.getByRole('button', { name: '2x', exact: true }).click()
  const orders = page.getByRole('complementary', { name: /Pedidos/ }).getByTestId('order-card')
  // A 2x, un pedido llega cada medio intervalo de balance.json.
  await expect(orders).toHaveCount(count, { timeout: (prototype.orders.spawnIntervalSec * 1000 * count) / 2 + 5000 })
  await page.keyboard.press('Space')
  return orders
}

test('elegir un pedido muestra la ETA de los repartidores y la tecla del primero lo asigna', async ({ page }) => {
  const orders = await waitForOrders(page, 1)
  const riderPanel = page.getByRole('complementary', { name: /Repartidores/ })
  const riders = riderPanel.getByTestId('rider-card')

  // Sin pedido elegido, los libres se pueden elegir primero (el pedido viene después, en el mapa).
  await expect(riders.first().getByRole('button')).toBeEnabled()

  await orders.first().getByRole('button').click()
  await expect(orders.first().getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  await expect(riderPanel.getByText('Ordenados por llegada al restaurante.')).toBeVisible()

  // Los tres muestran su ETA y están ordenados de menor a mayor.
  const etas = await riders.locator('.rider-card__eta').allTextContents()
  expect(etas).toHaveLength(3)
  const seconds = etas.map((text) => Number.parseInt(text, 10))
  expect(seconds).toEqual([...seconds].sort((a, b) => a - b))

  // La tecla del primero de la lista le asigna el pedido.
  const closest = await riders.first().getAttribute('data-rider-number')
  await page.keyboard.press(closest ?? '1')

  await expect(orders).toHaveCount(0)
  const busy = riderPanel.locator(`[data-rider-number="${closest}"]`)
  await expect(busy).toContainText('Yendo al restaurante')
  await expect(busy).toContainText('pedido #1')
  await expect(riderPanel.getByLabel('2 de 3 repartidores libres')).toBeVisible()
})

test('un repartidor ocupado se ve deshabilitado y el clic en otro asigna el pedido', async ({ page }) => {
  const orders = await waitForOrders(page, 2)
  const riderPanel = page.getByRole('complementary', { name: /Repartidores/ })

  await orders.first().getByRole('button').click()
  await page.keyboard.press('1')

  await orders.first().getByRole('button').click()
  const riderOne = riderPanel.getByRole('button', { name: /^Repartidor 1 / })
  await expect(riderOne).toBeDisabled()

  await riderPanel.locator('[data-rider-number="2"]').getByRole('button').click()
  await expect(orders).toHaveCount(0)
  await expect(riderPanel.getByLabel('1 de 3 repartidores libres')).toBeVisible()
})

test('Escape cancela la elección del pedido', async ({ page }) => {
  const orders = await waitForOrders(page, 1)
  await orders.first().getByRole('button').click()
  await page.keyboard.press('Escape')
  await expect(orders.first().getByRole('button')).toHaveAttribute('aria-pressed', 'false')
})
