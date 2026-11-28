import { expect, test } from '@playwright/test'
import { openLevels } from './title.ts'

test.describe.configure({ timeout: 90_000 })

const MARATHON_FROM_SEC = 84

test('la cena de Nørrebro avisa el maratón por Nørrebrogade, y en el turno aparece cuando empieza', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('despacho-progress')) {
      const state = { best: { lunch: 5 }, moneyKr: 100_000, hired: 10, played: 5, guideDone: true }
      localStorage.setItem('despacho-progress', JSON.stringify({ state, version: 0 }))
    }
  })
  await page.clock.install()
  await openLevels(page)
  await page.locator('[data-level="dinner"]').click()

  const briefing = page.getByTestId('briefing')
  await expect(briefing.getByTestId('briefing-event')).toContainText('Maratón de 19:14 a 19:36')
  await expect(briefing.getByTestId('briefing-event')).toContainText('Nørrebrogade queda cortada')
  await briefing.getByRole('button', { name: 'Empezar turno' }).click()

  await expect(page.getByTestId('shift-time')).toBeVisible()
  await expect(page.getByTestId('event-notice')).toHaveCount(0)
  await page.clock.runFor(MARATHON_FROM_SEC * 1000 + 1000)
  await expect(page.getByTestId('event-notice')).toHaveText('Maratón')
  await expect(page.getByTestId('event-notice')).toHaveAttribute('aria-label', /rutas la rodean/)
})
