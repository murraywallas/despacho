import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

const balance = JSON.parse(readFileSync(new URL('../../data/balance.json', import.meta.url), 'utf8')) as {
  riders: { xpPerLevel: number; trainingKr: number; speedBonusPerLevelPct: number }
}
const { xpPerLevel, trainingKr, speedBonusPerLevelPct } = balance.riders
const kr = (amount: number) => `${Math.abs(amount).toLocaleString('es-AR')} kr`
const MONEY = 1000

test('el garage muestra el nivel de cada repartidor, un curso lo sube y en el turno se ve su nivel', async ({ page }) => {
  await page.addInitScript(
    ({ xp, money }) => {
      if (!localStorage.getItem('despacho-progress')) {
        const state = { best: {}, played: 3, guideDone: true, moneyKr: money, hired: 3, fleets: {}, xp }
        localStorage.setItem('despacho-progress', JSON.stringify({ state, version: 2 }))
      }
    },
    { xp: [xpPerLevel * 2, 0, 0], money: MONEY },
  )
  await page.goto('/')
  await page.locator('[data-level="lunch"]').click()
  await page.getByTestId('briefing').getByRole('button', { name: 'Garage' }).click()

  const garage = page.getByTestId('garage')
  const levels = garage.getByTestId('rider-level')
  await expect(levels.nth(0)).toContainText('Nivel 2')
  await expect(levels.nth(0)).toContainText(`+${Math.round(2 * speedBonusPerLevelPct * 100)} %`)
  await expect(levels.nth(1)).toHaveText('Nivel 0')

  // Curso para el repartidor 2: sube un nivel y se paga.
  await garage.getByRole('button', { name: /^Pagar un curso a Repartidor 2/ }).click()
  await expect(levels.nth(1)).toContainText('Nivel 1')
  await expect(garage.getByTestId('garage-money')).toHaveText(kr(MONEY - trainingKr))

  // Queda guardado.
  await page.reload()
  await page.locator('[data-level="lunch"]').click()
  await page.getByTestId('briefing').getByRole('button', { name: 'Garage' }).click()
  await expect(garage.getByTestId('rider-level').nth(1)).toContainText('Nivel 1')
  await garage.getByRole('button', { name: 'Listo, volver al briefing' }).click()

  await page.getByRole('button', { name: 'Empezar turno' }).click()
  const riders = page.getByRole('complementary', { name: /Repartidores/ })
  await expect(riders.locator('[data-rider-number="1"]')).toContainText('Nv 2')
  await expect(riders.locator('[data-rider-number="2"]')).toContainText('Nv 1')
  await expect(riders.locator('[data-rider-number="3"]')).not.toContainText('Nv')
})
