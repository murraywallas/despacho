import { expect, test } from '@playwright/test'

test.describe.configure({ timeout: 90_000 })

const WIND_FROM_SEC = 60

test('el almuerzo de Frederiksberg avisa el viento del oeste, y en el turno una flecha muestra hacia dónde sopla', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('despacho-progress')) {
      const best = { lunch: 5, dinner: 5, friday: 5, vesterbro_lunch: 5, vesterbro_dinner: 5, vesterbro_friday: 5 }
      const state = { best, moneyKr: 100_000, hired: 10, played: 5, guideDone: true }
      localStorage.setItem('despacho-progress', JSON.stringify({ state, version: 0 }))
    }
  })
  await page.clock.install()
  await page.goto('/')
  await page.getByTestId('neighborhood').filter({ hasText: 'Frederiksberg' }).click()
  await page.locator('[data-level="frederiksberg_lunch"]').click()

  const briefing = page.getByTestId('briefing')
  await expect(briefing.getByTestId('briefing-event')).toContainText('Viento de 12:10 a 13:00')
  await expect(briefing.getByTestId('briefing-event')).toContainText('Sopla del oeste')
  await briefing.getByRole('button', { name: 'Empezar turno' }).click()

  await expect(page.getByTestId('shift-time')).toBeVisible()
  await expect(page.getByTestId('wind-arrow')).toHaveCount(0)

  await page.clock.runFor(WIND_FROM_SEC * 1000 + 1000)
  await expect(page.getByTestId('event-notice')).toHaveText('Viento')
  const arrow = page.getByTestId('wind-arrow')
  await expect(arrow).toBeVisible()
  await expect(arrow).toHaveAttribute('aria-label', /Viento del oeste/)
})
