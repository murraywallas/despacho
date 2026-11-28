import { expect, test, type Page } from '@playwright/test'
import { openLevels } from './title.ts'
import { startingKr, vehicleCostKr } from './balance.ts'

test.describe.configure({ timeout: 60_000 }) // Varios turnos y pantallas por test: con la máquina cargada, 30 s no alcanzan.

/** "1.296 kr", as the screens show it. */
const kr = (amount: number) => `${amount < 0 ? '−' : ''}${Math.abs(amount).toLocaleString('es-AR')} kr`

test('la flota del nivel sale gratis; cambiar el skate por un monopatín eléctrico cuesta la diferencia, y el turno sale con él', async ({ page }) => {
  await openLevels(page)
  await page.getByTestId('level-card').first().click()
  const briefing = page.getByTestId('briefing')
  await expect(briefing.getByTestId('briefing-cost')).toContainText(`${kr(0)} extra por turno`)
  await expect(briefing.getByTestId('briefing-cost')).toContainText(`en caja ${kr(startingKr)}`)
  await briefing.getByRole('button', { name: 'Garage' }).click()

  const garage = page.getByTestId('garage')
  await expect(garage.getByTestId('garage-money')).toHaveText(kr(startingKr))
  await expect(garage.getByTestId('garage-cost')).toHaveText(kr(0))
  const skateboard = garage.getByRole('combobox', { name: 'Vehículo de Repartidor 2' })
  await expect(skateboard).toHaveValue('skateboard')
  await expect(skateboard.locator('option[value="skateboard"]')).toHaveText('Skate · incluido')
  await skateboard.selectOption('e_scooter')
  await expect(garage.getByTestId('garage-cost')).toHaveText(kr(vehicleCostKr('e_scooter') - vehicleCostKr('skateboard')))
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

/** Opens the Cena briefing with this much money and no extra riders. */
async function dinnerWith(page: Page, moneyKr: number) {
  await page.addInitScript((money) => {
    if (!localStorage.getItem('despacho-progress')) {
      const state = { best: { lunch: 4.5 }, played: 2, guideDone: true, moneyKr: money, hired: 0, fleets: {}, xp: [] }
      localStorage.setItem('despacho-progress', JSON.stringify({ state, version: 3 }))
    }
  }, moneyKr)
  await openLevels(page)
  await page.getByTestId('level-card').nth(1).click()
  return page.getByTestId('briefing')
}

const PLENTY_KR = 5000

test('sin plata, la flota del nivel sale igual; lo que se agrega sin poder pagarlo no deja empezar', async ({ page }) => {
  const briefing = await dinnerWith(page, 0)
  await expect(briefing.getByTestId('briefing-warning')).toHaveCount(0)
  await expect(briefing.getByRole('button', { name: 'Empezar turno' })).toBeEnabled()
  await expect(briefing.getByTestId('briefing-fleet').getByRole('listitem')).toHaveCount(4)

  await briefing.getByRole('button', { name: 'Garage' }).click()
  const garage = page.getByTestId('garage')
  await expect(garage.getByTestId('garage-hire')).toBeDisabled()
  // Un vehículo más caro cuesta la diferencia: sin plata, no se puede salir con él.
  await garage.getByRole('combobox', { name: 'Vehículo de Repartidor 3' }).selectOption('e_scooter')
  await expect(garage.getByTestId('garage-warning')).toBeVisible()
  await garage.getByRole('button', { name: 'Usar la flota sugerida' }).click()
  await expect(garage.getByTestId('garage-warning')).toHaveCount(0)
})

test('contratar suma un repartidor extra, que paga su vehículo, hasta el tope por turno', async ({ page }) => {
  const briefing = await dinnerWith(page, PLENTY_KR)
  await briefing.getByRole('button', { name: 'Garage' }).click()
  const garage = page.getByTestId('garage')
  await expect(garage.getByTestId('garage-hired')).toHaveText('0')
  await expect(garage.getByTestId('garage-vehicle')).toHaveCount(4)
  await garage.getByRole('button', { name: /^Contratar un repartidor extra/ }).click()
  await expect(garage.getByTestId('garage-hired')).toHaveText('1')
  // Con el tope de extras por turno (#146) ya no se contrata más.
  await expect(garage.getByTestId('garage-hire')).toHaveCount(0)
  await garage.getByRole('button', { name: 'Sumar un repartidor' }).click()
  await expect(garage.getByRole('button', { name: 'Sumar un repartidor' })).toHaveCount(0)
  await expect(garage.getByTestId('garage-vehicle')).toHaveCount(5)
  await expect(garage.getByTestId('garage-extra')).toHaveCount(1)
  await expect(garage.getByTestId('garage-cost')).toHaveText(kr(vehicleCostKr('bike')))
})
