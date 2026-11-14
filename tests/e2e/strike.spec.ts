import { expect, test } from '@playwright/test'

test('el almuerzo de Frederiksberg anuncia la huelga de bicis, y el garage no deja elegir la bici', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('despacho-progress')) {
      const best = { lunch: 5, dinner: 5, friday: 5, vesterbro_lunch: 5, vesterbro_dinner: 5, vesterbro_friday: 5 }
      const state = { best, moneyKr: 100_000, hired: 10, played: 5, guideDone: true }
      localStorage.setItem('despacho-progress', JSON.stringify({ state, version: 0 }))
    }
  })
  await page.goto('/')
  await page.getByTestId('neighborhood').filter({ hasText: 'Frederiksberg' }).click()
  await page.locator('[data-level="frederiksberg_lunch"]').click()

  const briefing = page.getByTestId('briefing')
  const strike = briefing.getByTestId('briefing-event').filter({ hasText: 'Huelga' })
  await expect(strike).toContainText('Huelga todo el turno')
  await expect(strike).toContainText('Nadie sale en bicicleta')
  await expect(briefing.getByTestId('briefing-fleet')).not.toContainText('Bicicleta')

  await briefing.getByRole('button', { name: 'Garage' }).click()
  const garage = page.getByTestId('garage')
  await expect(garage.getByTestId('garage-strike')).toContainText('nadie sale en bicicleta')
  const first = garage.getByTestId('garage-vehicle').first()
  await expect(first.locator('option[value="bike"]')).toBeDisabled()
  await expect(first.locator('option[value="bike"]')).toHaveText('Bicicleta · en huelga')
})
