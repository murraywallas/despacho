import { expect, test, type Page } from '@playwright/test'
import { fleetCostKr, startingKr } from './balance.ts'

test.describe.configure({ timeout: 60_000 }) // Varios turnos y pantallas por test: con la máquina cargada, 30 s no alcanzan.

/** "1.296 kr", as the screens show it. */
const kr = (amount: number) => `${amount < 0 ? '−' : ''}${Math.abs(amount).toLocaleString('es-AR')} kr`

test('en el garage se cambia el skate por un monopatín eléctrico, y el turno sale con él en el mapa', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('level-card').first().click()
  const briefing = page.getByTestId('briefing')
  await expect(briefing.getByTestId('briefing-cost')).toContainText(`${kr(fleetCostKr)} por turno`)
  await expect(briefing.getByTestId('briefing-cost')).toContainText(`en caja ${kr(startingKr)}`)
  await briefing.getByRole('button', { name: 'Garage' }).click()

  const garage = page.getByTestId('garage')
  await expect(garage.getByTestId('garage-money')).toHaveText(kr(startingKr))
  const skateboard = garage.getByRole('combobox', { name: 'Vehículo de Repartidor 2' })
  await expect(skateboard).toHaveValue('skateboard')
  await skateboard.selectOption('e_scooter')
  await garage.getByRole('button', { name: 'Listo, volver al briefing' }).click()

  await expect(briefing.getByTestId('briefing-fleet')).toContainText('Repartidor 2 · Monopatín')
  await briefing.getByRole('button', { name: 'Empezar turno' }).click()
  const map = page.getByTestId('map')
  await expect(map.getByRole('button', { name: 'Repartidor 2 · Monopatín' })).toBeVisible()
  await expect(map.getByRole('button', { name: 'Repartidor 3 · Monopatín' })).toBeVisible()

  // La flota elegida queda guardada para la próxima vez.
  await page.reload()
  await page.getByTestId('level-card').first().click()
  await expect(page.getByTestId('briefing-fleet')).toContainText('Repartidor 2 · Monopatín')
})

/** Opens the Cena briefing with this much money and three riders hired. */
async function dinnerWith(page: Page, moneyKr: number) {
  await page.addInitScript((money) => {
    if (!localStorage.getItem('despacho-progress')) {
      const state = { best: { lunch: 4.5 }, played: 2, guideDone: true, moneyKr: money, hired: 3 }
      localStorage.setItem('despacho-progress', JSON.stringify({ state, version: 0 }))
    }
  }, moneyKr)
  await page.goto('/')
  await page.getByTestId('level-card').nth(1).click()
  return page.getByTestId('briefing')
}

// Poca plata: alcanza para salir con un repartidor, no para la flota de tres ni para contratar.
const LITTLE_KR = 150
const PLENTY_KR = 5000

test('sin plata para la flota no se empieza; con un solo repartidor sí', async ({ page }) => {
  const briefing = await dinnerWith(page, LITTLE_KR)
  await expect(briefing.getByTestId('briefing-warning')).toBeVisible()
  await expect(briefing.getByRole('button', { name: 'Empezar turno' })).toBeDisabled()

  await briefing.getByRole('button', { name: 'Garage' }).click()
  const garage = page.getByTestId('garage')
  await expect(garage.getByTestId('garage-hire')).toBeDisabled()

  // Sacando repartidores hasta que quede uno, se puede salir aunque no alcance.
  for (const rider of [3, 2]) await garage.getByRole('button', { name: `Sacar a Repartidor ${rider} de este turno` }).click()
  await expect(garage.getByTestId('garage-warning')).toHaveCount(0)
  await garage.getByRole('button', { name: 'Listo, volver al briefing' }).click()
  await expect(briefing.getByRole('button', { name: 'Empezar turno' })).toBeEnabled()
  await expect(briefing.getByTestId('briefing-fleet').getByRole('listitem')).toHaveCount(1)
})

test('contratar suma un lugar en el garage', async ({ page }) => {
  const briefing = await dinnerWith(page, PLENTY_KR)
  await briefing.getByRole('button', { name: 'Garage' }).click()
  const garage = page.getByTestId('garage')
  await expect(garage.getByTestId('garage-hired')).toHaveText('3')
  await garage.getByRole('button', { name: /^Contratar un repartidor/ }).click()
  await expect(garage.getByTestId('garage-hired')).toHaveText('4')
  await expect(garage.getByTestId('garage-vehicle')).toHaveCount(4)
})
