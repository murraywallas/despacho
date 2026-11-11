import { expect, test, type Page } from '@playwright/test'
import { prototype, SHIFT_URL } from './balance.ts'

/** Speeds up the clock until `count` orders wait in the queue, then pauses. */
async function waitForOrders(page: Page, count: number) {
  await page.goto(SHIFT_URL)
  await page.getByRole('button', { name: '2x', exact: true }).click()
  const orders = page.getByRole('complementary', { name: /Pedidos/ }).getByTestId('order-card')
  await expect(orders).toHaveCount(count, { timeout: (prototype.orders.spawnIntervalSec * 1000 * count) / 2 + 5000 })
  await page.keyboard.press('Space')
  return orders
}

const riderPanel = (page: Page) => page.getByRole('complementary', { name: /Repartidores/ })
const busy = (page: Page) => riderPanel(page).getByLabel(/de 3 repartidores libres/)

test('solo con teclado: ↓ elige el pedido más urgente y la tecla del repartidor lo manda', async ({ page }) => {
  const orders = await waitForOrders(page, 2)
  await page.keyboard.press('ArrowDown')
  await expect(orders.first().getByRole('button').first()).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('ArrowDown')
  await expect(orders.nth(1).getByRole('button').first()).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('ArrowUp')
  await expect(orders.first().getByRole('button').first()).toHaveAttribute('aria-pressed', 'true')

  const closest = await riderPanel(page).getByTestId('rider-card').first().getAttribute('data-rider-number')
  await page.keyboard.press(closest ?? '1')
  await expect(orders).toHaveCount(1)
  await expect(busy(page)).toHaveAttribute('aria-label', '2 de 3 repartidores libres')
})

test('arrastrando un repartidor libre a un pedido, o un pedido a un repartidor', async ({ page }) => {
  const orders = await waitForOrders(page, 2)
  const card = (number: number) => riderPanel(page).locator(`[data-rider-number="${number}"]`).getByRole('button').first()

  await card(1).dragTo(orders.first().getByRole('button').first())
  await expect(orders).toHaveCount(1)
  await expect(riderPanel(page).locator('[data-rider-number="1"]')).toContainText(/pedido #\d+/)

  await orders.first().getByRole('button').first().dragTo(card(2))
  await expect(orders).toHaveCount(0)
  await expect(busy(page)).toHaveAttribute('aria-label', '1 de 3 repartidores libres')
})

test('la lista, el mapa y la barra del pedido muestran la misma elección', async ({ page }) => {
  const orders = await waitForOrders(page, 2)
  const map = page.getByRole('region', { name: /^Mapa de Nørrebro/ })
  const numberOf = async (index: number) =>
    (await orders.nth(index).locator('.order-card__number').textContent())?.replace(/\D/g, '')

  const first = await numberOf(0)
  await orders.first().getByRole('button').first().click()
  await expect(map.getByRole('button', { name: new RegExp(`^Cliente del pedido #${first}\\b`) })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('selection-bar')).toContainText(`Pedido #${first}`)

  const second = await numberOf(1)
  await orders.nth(1).getByRole('button').first().click()
  await expect(map.getByRole('button', { name: new RegExp(`^Cliente del pedido #${second}\\b`) })).toHaveAttribute('aria-pressed', 'true')
  await expect(map.getByRole('button', { name: new RegExp(`^Cliente del pedido #${first}\\b`) })).toHaveAttribute('aria-pressed', 'false')
  await expect(orders.first().getByRole('button').first()).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('selection-bar')).toContainText(`Pedido #${second}`)
})

test('los controles chicos tienen al menos 32 × 32 px de área de clic', async ({ page }) => {
  await page.goto(SHIFT_URL)
  const controls = [
    page.getByRole('button', { name: 'Acercar' }),
    page.getByRole('button', { name: 'Alejar' }),
    page.getByRole('button', { name: /Menú de pausa/ }),
    page.getByTestId('sound-mute'),
    page.getByRole('button', { name: /Atajos de teclado/ }),
  ]
  for (const control of controls) {
    // The control (or its extended hit area) answers 15 px around its center in every direction.
    const reaches = await control.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const x = box.left + box.width / 2
      const y = box.top + box.height / 2
      return [
        [x - 15, y],
        [x + 15, y],
        [x, y - 15],
        [x, y + 15],
      ].every(([px, py]) => {
        const hit = document.elementFromPoint(px, py)
        return hit !== null && (hit === element || element.contains(hit))
      })
    })
    expect(reaches, await control.evaluate((element) => element.outerHTML.slice(0, 80))).toBe(true)
  }
})
