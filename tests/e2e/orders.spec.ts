import { expect, test } from '@playwright/test'
import { gameMinuteMs, prototype } from './balance.ts'

test('llegan pedidos a la cola con restaurante y cuenta regresiva, y el cliente aparece en el mapa', async ({
  page,
}) => {
  await page.goto('/')

  const panel = page.getByRole('complementary', { name: /Pedidos/ })
  await expect(panel.getByText('Todavía no hay pedidos')).toBeVisible()
  await expect(page.getByRole('region', { name: /0 clientes esperando/ })).toBeVisible()

  // A 2x el primer pedido llega en la mitad del intervalo de balance.json.
  await page.getByRole('button', { name: 'Velocidad del reloj' }).click()
  const card = panel.getByTestId('order-card').first()
  await expect(card).toBeVisible({ timeout: (prototype.orders.spawnIntervalSec * 1000) / 2 + 5000 })

  await expect(card).toContainText('Pedido #1')
  await expect(card).toContainText(/[A-D] · \S+/)
  await expect(page.getByRole('region', { name: /1 clientes esperando/ })).toBeVisible()
  await expect(page.getByTestId('customer-marker')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Cliente del pedido #1' })).toBeVisible()

  // La cuenta regresiva baja mientras el reloj corre y se frena en pausa.
  const time = card.locator('.order-card__time')
  const before = await time.textContent()
  await expect(time).not.toHaveText(before ?? '', { timeout: gameMinuteMs + 2000 })
  await page.keyboard.press('Space')
  const paused = await time.textContent()
  await page.waitForTimeout(gameMinuteMs + 500)
  await expect(time).toHaveText(paused ?? '')
})
