import { expect, test } from '@playwright/test'
import { openLevels } from './title.ts'
import { fastestSpeed, prototype, startingKr } from './balance.ts'

test.describe.configure({ timeout: 90_000 }) // Juega un turno entero con el reloj falso.

/** "1.296 kr", as the results show it. */
const kr = (amount: number) => `${amount < 0 ? '−' : ''}${Math.abs(amount).toLocaleString('es-AR')} kr`

test('los resultados muestran el dinero del turno y el total queda guardado al recargar', async ({ page }) => {
  await page.clock.install()
  await openLevels(page)
  await page.getByTestId('level-card').first().click()
  await page.getByRole('button', { name: 'Empezar turno' }).click()
  await page.getByRole('button', { name: `${fastestSpeed}x`, exact: true }).click()
  await page.clock.runFor((prototype.shift.durationSec * 1000) / fastestSpeed + 2000)
  await expect(page.getByTestId('results')).toBeVisible()

  // Sin despachar nada no entra plata; la flota del nivel no cuesta (#141) y nadie cobra sueldo todavía.
  const money = page.getByTestId('results-money')
  await expect(money.getByTestId('money-pay')).toContainText('0 kr')
  await expect(money.getByTestId('money-cost')).toContainText(kr(0))
  await expect(money.getByTestId('money-total')).toContainText(kr(startingKr))

  // El total sobrevive a recargar: el turno siguiente lo suma.
  await page.reload()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('despacho-progress') ?? '{}').state.moneyKr)
  expect(saved).toBe(startingKr)
})
