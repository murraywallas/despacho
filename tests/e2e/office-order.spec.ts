import { expect, test } from '@playwright/test'
import { openLevels } from './title.ts'

test.describe.configure({ timeout: 120_000 }) // Simula minutos de turno cuadro por cuadro.

const OFFICE_FROM_SEC = 108
const OFFICE_ORDERS = 5

test('el Almuerzo de Vesterbro anuncia el pedido de oficina; con la bici de carga, los 5 llegan de golpe', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('despacho-progress')) {
      const best = { lunch: 5, dinner: 5, friday: 5 }
      const state = { best, moneyKr: 100_000, hired: 10, played: 3, guideDone: true }
      localStorage.setItem('despacho-progress', JSON.stringify({ state, version: 0 }))
    }
  })
  await page.clock.install()
  await openLevels(page)
  await page.getByTestId('neighborhood').filter({ hasText: 'Vesterbro' }).click()
  await page.locator('[data-level="vesterbro_lunch"]').click()

  const briefing = page.getByTestId('briefing')
  const event = briefing.getByTestId('briefing-event')
  await expect(event).toContainText('Pedido de oficina a las 12:18')
  await expect(event).toContainText(`${OFFICE_ORDERS} pedidos de golpe`)
  await expect(event).toContainText('bici de carga')

  // En el garage la bici de carga se puede elegir.
  await briefing.getByTestId('briefing-garage').click()
  const garage = page.getByTestId('garage')
  await garage.getByLabel('Vehículo de Repartidor 1').selectOption('cargo_bike')
  await garage.getByRole('button', { name: 'Listo, volver al briefing' }).click()
  await expect(briefing.getByTestId('briefing-fleet')).toContainText('Bici de carga')
  await briefing.getByRole('button', { name: 'Empezar turno' }).click()

  const riders = page.getByRole('complementary', { name: /Repartidores/ })
  await expect(riders.locator('[data-rider-number="1"]')).toContainText('Bici de carga')
  await expect(riders.locator('[data-rider-number="1"]')).toContainText('0/5')

  // A las 12:18 llegan los 5 del mismo restaurante, todos juntos.
  await page.clock.runFor(OFFICE_FROM_SEC * 1000 + 500)
  await page.keyboard.press('Space')
  const names = await page.getByRole('complementary', { name: /Pedidos/ }).locator('.order-card__name').allTextContents()
  const counts = new Map<string, number>()
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1)
  expect(Math.max(...counts.values())).toBeGreaterThanOrEqual(OFFICE_ORDERS)
})
