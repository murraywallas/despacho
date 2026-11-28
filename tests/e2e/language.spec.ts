import { expect, test } from '@playwright/test'
import { SHIFT_URL } from './balance.ts'

test.describe('con el navegador en inglés', () => {
  test.use({ locale: 'en-US' })

  test('arranca en inglés; ES lo pasa a español y queda guardado al recargar', async ({ page }) => {
    await page.goto('/')
    const switcher = page.getByTestId('language-switch')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByTestId('neighborhood-status')).toContainText('Each shift opens with')
    await expect(switcher.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')

    await switcher.getByRole('button', { name: 'Español' }).click()
    await expect(page.getByTestId('neighborhood-status')).toContainText('Cada turno se abre con')
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    await page.reload()
    await expect(page.getByTestId('neighborhood-status')).toContainText('Cada turno se abre con')
  })

  test('el turno en inglés, y el menú de pausa también tiene el selector', async ({ page }) => {
    await page.clock.install()
    await page.goto(SHIFT_URL)
    await expect(page.getByRole('complementary', { name: /^Orders/ })).toBeVisible()
    await expect(page.getByRole('complementary', { name: /^Riders/ })).toContainText('Bicycle')
    await page.keyboard.press('Escape')
    const menu = page.getByRole('dialog')
    await expect(menu).toContainText('Settings')
    await menu.getByTestId('language-switch').getByRole('button', { name: 'Español' }).click()
    await expect(page.getByRole('complementary', { name: /^Repartidores/ })).toContainText('Bicicleta')
  })
})

test('con el navegador en español arranca en español, y EN lo pasa a inglés', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('neighborhood-status')).toContainText('Cada turno se abre con')
  await page.getByTestId('language-switch').getByRole('button', { name: 'English' }).click()
  await expect(page.getByTestId('neighborhood-status')).toContainText('Each shift opens with')
})
