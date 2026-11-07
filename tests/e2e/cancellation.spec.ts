import { expect, test } from '@playwright/test'

test('un pedido que nadie atiende se cancela, sale de la cola y cuenta como 1 estrella', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  const orderPanel = page.getByRole('complementary', { name: /Pedidos/ })

  // El pedido #1 llega a los 10 s, vence a los 130 s y se cancela 60 s después: a los 190 s de juego.
  await page.getByRole('button', { name: 'Velocidad del reloj' }).click()
  await page.clock.runFor(10_500 / 2)
  await expect(orderPanel.getByText('Pedido #1', { exact: true })).toBeVisible()

  await page.clock.runFor(179_000 / 2)
  await expect(orderPanel.getByText('Pedido #1', { exact: true })).toBeVisible()
  await expect(page.getByTestId('shift-rating')).toHaveText('–')

  await page.clock.runFor(2000 / 2)
  await expect(orderPanel.getByText('Pedido #1', { exact: true })).toHaveCount(0)
  await expect(orderPanel.getByTestId('cancelled-count')).toHaveText('Cancelados: 1')
  await expect(page.getByTestId('shift-rating')).toHaveText('1,0')
})
