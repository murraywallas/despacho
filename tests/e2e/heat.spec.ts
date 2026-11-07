import { expect, test } from '@playwright/test'
import { prototype } from './balance.ts'

test('la comida de un pedido sin repartidor se enfría desde que la cocina la tiene lista', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  const { spawnIntervalSec } = prototype.orders
  const firstOrder = page.getByTestId('order-card').filter({ has: page.getByText('Pedido #1', { exact: true }) })

  await page.clock.runFor(spawnIntervalSec * 1000 + 500)
  await expect(firstOrder.getByRole('img', { name: 'En la cocina' })).toBeVisible()
  await expect(firstOrder.getByTestId('food-heat')).toHaveCount(0)

  // Lista: aparece la temperatura y baja mientras espera repartidor.
  await page.clock.runFor(prototype.kitchen.cookSec * 1000)
  const heat = firstOrder.getByTestId('food-heat')
  await expect(heat).toHaveText(/^\d+°$/)
  const before = parseInt((await heat.textContent()) ?? '', 10)
  await page.clock.runFor(4000)
  await expect(heat).not.toHaveText(`${before}°`)
  expect(parseInt((await heat.textContent()) ?? '', 10)).toBeLessThan(before)
})
