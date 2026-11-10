import { expect, test } from '@playwright/test'
import { prototype, SHIFT_URL } from './balance.ts'

test('reasignar un pedido a otro repartidor y llamar al cliente una vez por turno', async ({ page }) => {
  await page.goto(SHIFT_URL)
  await page.getByRole('button', { name: 'Velocidad del reloj' }).click()
  const orders = page.getByRole('complementary', { name: /Pedidos/ }).getByTestId('order-card')
  await expect(orders).toHaveCount(1, { timeout: (prototype.orders.spawnIntervalSec * 1000) / 2 + 5000 })
  await page.keyboard.press('Space')

  const riderPanel = page.getByRole('complementary', { name: /Repartidores/ })
  const card = (number: number) => riderPanel.locator(`[data-rider-number="${number}"]`)

  // El pedido #1 va con el repartidor 2.
  await orders.first().getByRole('button').click()
  await page.keyboard.press('2')
  await expect(card(2)).toContainText('pedido #1')

  // Reasignarlo: se elige desde la tarjeta y la tecla 3 se lo da al repartidor 3.
  await card(2).getByRole('button', { name: 'Reasignar el pedido #1 a otro repartidor' }).click()
  const bar = page.getByTestId('selection-bar')
  await expect(bar).toContainText('Pedido #1')
  await expect(riderPanel.getByText('Elegí otro repartidor libre para el pedido #1.')).toBeVisible()
  await page.keyboard.press('3')
  await expect(card(3)).toContainText('pedido #1')
  await expect(card(2)).toContainText('Libre')
  await expect(bar).toHaveCount(0)

  // Llamar al cliente: suma minutos al plazo y gasta la única llamada del turno.
  const calls = page.getByTestId('calls-left')
  await expect(calls).toHaveText(String(prototype.tools.callsPerShift))
  await card(3).getByRole('button', { name: 'Reasignar el pedido #1 a otro repartidor' }).click()
  const before = Number.parseInt((await bar.locator('.selection-bar__title').textContent())?.split('·').at(-1) ?? '', 10)
  await page.keyboard.press('l')
  await expect(calls).toHaveText(String(prototype.tools.callsPerShift - 1))
  const after = Number.parseInt((await bar.locator('.selection-bar__title').textContent())?.split('·').at(-1) ?? '', 10)
  expect(after).toBeGreaterThan(before)
  await expect(bar.getByRole('button', { name: /Llamar al cliente/ })).toBeDisabled()
})
