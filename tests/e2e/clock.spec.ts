import { expect, test } from '@playwright/test'
import { clockSpeeds, gameMinuteMs, SHIFT_URL } from './balance.ts'

test('el reloj baja y la barra espaciadora lo pausa y lo reanuda', async ({ page }) => {
  await page.goto(SHIFT_URL)
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

test('pausa y velocidades 1x / 2x / 3x desde la planilla; la barra espaciadora sigue pausando', async ({ page }) => {
  await page.goto(SHIFT_URL)

  const speeds = page.getByRole('group', { name: 'Velocidad del reloj' })
  await expect(speeds.getByRole('button')).toHaveText(clockSpeeds.map((speed) => `${speed}x`))
  await expect(speeds.getByRole('button', { name: '1x', exact: true })).toHaveAttribute('aria-pressed', 'true')

  const fast = speeds.getByRole('button', { name: '3x', exact: true })
  await fast.click()
  await expect(fast).toHaveAttribute('aria-pressed', 'true')
  await expect(speeds.getByRole('button', { name: '1x', exact: true })).toHaveAttribute('aria-pressed', 'false')

  // El botón de 3x quedó con foco: Space tiene que pausar, no cambiar la velocidad.
  await page.keyboard.press('Space')
  await expect(page.getByRole('status')).toHaveText('En pausa')
  await expect(fast).toHaveAttribute('aria-pressed', 'true')
  // La pausa se nota en toda la pantalla, no solo en un cartel.
  await expect(page.locator('.shift-screen--paused')).toHaveCount(1)

  await page.getByRole('button', { name: 'Seguir' }).click()
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible()
  await expect(page.locator('.shift-screen--paused')).toHaveCount(0)
})

test('la barra del turno avanza con el reloj', async ({ page }) => {
  await page.clock.install()
  await page.goto(SHIFT_URL)
  const progress = page.getByRole('progressbar', { name: 'Avance del turno' })
  await expect(progress).toHaveAttribute('aria-valuenow', '0')
  await page.clock.runFor(gameMinuteMs * 10)
  await expect(progress).not.toHaveAttribute('aria-valuenow', '0')
})

test('la tecla ? muestra los atajos sin frenar el juego, y Esc los cierra', async ({ page }) => {
  await page.goto(SHIFT_URL)
  await page.keyboard.press('Shift+?')
  const legend = page.getByRole('dialog', { name: 'Atajos de teclado' })
  await expect(legend).toBeVisible()
  await expect(legend).toContainText('Llamar al cliente')
  await expect(page.getByRole('status')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(legend).toHaveCount(0)
})
