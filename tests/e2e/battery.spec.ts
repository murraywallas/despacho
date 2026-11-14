import { expect, test } from '@playwright/test'
import { prototype, SHIFT_URL } from './balance.ts'

test.describe.configure({ timeout: 90_000 })

test('la tarjeta del monopatín muestra su batería, que baja con el viaje', async ({ page }) => {
  await page.clock.install()
  await page.goto(SHIFT_URL)
  const riderPanel = page.getByRole('complementary', { name: /Repartidores/ })
  const scooter = riderPanel.locator('[data-rider-number="3"]')
  await expect(scooter).toContainText('Monopatín')
  await expect(scooter.getByTestId('rider-battery')).toHaveAttribute('title', 'Batería: 100 %')
  await expect(scooter.getByTestId('rider-battery')).toHaveAttribute('data-low', 'false')
  // Bici y patineta no tienen batería.
  await expect(riderPanel.getByTestId('rider-battery')).toHaveCount(1)

  // Llega un pedido y se lo lleva el monopatín (tecla 3).
  const orders = page.getByRole('complementary', { name: /Pedidos/ }).getByTestId('order-card')
  await page.clock.runFor(prototype.orders.spawnIntervalSec * 1000 + 500)
  await expect(orders).toHaveCount(1)
  await orders.first().getByRole('button').first().click()
  await page.keyboard.press('3')
  await expect(scooter).toContainText('Yendo al restaurante')

  await page.clock.runFor(20_000)
  const title = (await scooter.getByTestId('rider-battery').getAttribute('title')) ?? ''
  const percent = Number.parseInt(title.replace(/\D+/g, ''), 10)
  expect(percent).toBeLessThan(100)
})
