import { expect, test, type Page } from '@playwright/test'
import { prototype, SHIFT_URL } from './balance.ts'

test.describe.configure({ timeout: 90_000 }) // Simula minutos de turno cuadro por cuadro.

/** From the start screen into the first level, the way a player does it (the guide only shows then). */
async function startLunch(page: Page) {
  await page.goto('/')
  await page.getByTestId('level-card').first().click()
  await page.getByRole('button', { name: 'Empezar turno' }).click()
}

test('el primer turno guiado enseña dos despachos y no vuelve a aparecer', async ({ page }) => {
  await page.clock.install()
  await startLunch(page)
  const guide = page.getByTestId('guide')
  await expect(guide).toContainText('el primer pedido llega')

  const orders = page.getByRole('complementary', { name: /Pedidos/ }).getByTestId('order-card')
  const riders = page.getByRole('complementary', { name: /Repartidores/ }).getByTestId('rider-card')
  for (let dispatch = 1; dispatch <= 2; dispatch++) {
    await page.clock.runFor(prototype.orders.spawnIntervalSec * 1000 + 500)
    await expect(guide).toContainText(`despacho ${dispatch} de 2`)
    await expect(guide).toContainText('Elegí un pedido')
    await orders.first().getByRole('button').first().click()
    await expect(guide).toContainText('elegí quién lo lleva')
    const free = await riders.first().getAttribute('data-rider-number')
    await page.keyboard.press(free ?? '1')
  }
  await expect(guide).toHaveCount(0)

  // Otra vez el almuerzo: ya no hay guía.
  await page.reload()
  await startLunch(page)
  await page.clock.runFor(prototype.orders.spawnIntervalSec * 1000 + 500)
  await expect(page.getByTestId('order-card')).toHaveCount(1)
  await expect(page.getByTestId('guide')).toHaveCount(0)
})

test('la guía se puede saltar', async ({ page }) => {
  await startLunch(page)
  await page.getByRole('button', { name: 'Saltar la guía' }).click()
  await expect(page.getByTestId('guide')).toHaveCount(0)
  await page.reload()
  await startLunch(page)
  await expect(page.getByTestId('guide')).toHaveCount(0)
})

test('un pedido urgente sugiere el repartidor que llega primero, y un clic lo manda', async ({ page }) => {
  await page.clock.install()
  await page.goto(SHIFT_URL)
  const { spawnIntervalSec, deadlineSec, urgentBelowSec } = prototype.orders
  await page.clock.runFor((spawnIntervalSec + deadlineSec - urgentBelowSec) * 1000 + 1000)
  await page.keyboard.press('Space')

  const suggestion = page.getByTestId('order-suggestion').first()
  await expect(suggestion).toContainText(/llega en \d+ min/)
  const label = (await suggestion.getAttribute('aria-label')) ?? ''
  const [, order, rider] = /pedido #(\d+) con el repartidor (\d+)/.exec(label) ?? []
  await suggestion.click()
  const card = page.getByRole('complementary', { name: /Repartidores/ }).locator(`[data-rider-number="${rider}"]`)
  await expect(card).toContainText(`pedido #${order}`)
})

test('la barra de arriba muestra la luz del nivel', async ({ page }) => {
  await page.goto(SHIFT_URL)
  await expect(page.getByTestId('conditions')).toHaveText('Mediodía')
})
