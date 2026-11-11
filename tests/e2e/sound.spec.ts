import { expect, test } from '@playwright/test'
import { SHIFT_URL } from './balance.ts'

test('los sonidos cargan al primer clic, sin errores, y el silencio se recuerda entre partidas', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  const loaded: string[] = []
  page.on('response', (response) => {
    if (response.url().includes('/sounds/') && response.ok()) loaded.push(response.url())
  })

  await page.goto(SHIFT_URL)
  const mute = page.getByTestId('sound-mute')
  await expect(mute).toHaveAttribute('aria-pressed', 'false')

  // Hasta que el jugador toca la página no se pide ningún sonido; después, los siete.
  expect(loaded).toHaveLength(0)
  await mute.click()
  await expect.poll(() => loaded.length).toBe(7)
  await expect(mute).toHaveAttribute('aria-pressed', 'true')

  // Se recuerda al volver a abrir el juego, y la tecla M lo cambia.
  await page.reload()
  await expect(page.getByTestId('sound-mute')).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('m')
  await expect(page.getByTestId('sound-mute')).toHaveAttribute('aria-pressed', 'false')

  // El volumen también se recuerda.
  // El volumen está en el menú de pausa.
  await page.getByRole('button', { name: /Menú de pausa/ }).click()
  await page.getByRole('slider', { name: 'Volumen' }).fill('30')
  await page.reload()
  await page.getByRole('button', { name: /Menú de pausa/ }).click()
  await expect(page.getByRole('slider', { name: 'Volumen' })).toHaveValue('30')

  expect(errors).toEqual([])
})
