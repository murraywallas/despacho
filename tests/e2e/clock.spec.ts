import { expect, test } from '@playwright/test'
import { gameMinuteMs } from './balance.ts'

test('el reloj baja y la barra espaciadora lo pausa y lo reanuda', async ({ page }) => {
  await page.goto('/')
  const time = page.getByTestId('shift-time')

  const start = await time.textContent()
  await expect(time).not.toHaveText(start ?? '', { timeout: gameMinuteMs + 2000 })

  await page.keyboard.press('Space')
  await expect(page.getByRole('status')).toHaveText('En pausa')
  const paused = await time.textContent()
  await page.waitForTimeout(1500)
  await expect(time).toHaveText(paused ?? '')

  await page.keyboard.press('Space')
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(time).not.toHaveText(paused ?? '', { timeout: gameMinuteMs + 2000 })
})

test('el botón de pausa y el de 2x funcionan, y la barra espaciadora sigue pausando', async ({ page }) => {
  await page.goto('/')

  const speed = page.getByRole('button', { name: 'Velocidad del reloj' })
  await speed.click()
  await expect(speed).toHaveAttribute('aria-pressed', 'true')
  await expect(speed).toHaveText('2x')

  // El botón de 2x quedó con foco: Space tiene que pausar, no volver a 1x.
  await page.keyboard.press('Space')
  await expect(page.getByRole('status')).toHaveText('En pausa')
  await expect(speed).toHaveText('2x')

  await page.getByRole('button', { name: 'Seguir' }).click()
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible()
})
