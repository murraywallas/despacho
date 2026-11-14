import { expect, test } from '@playwright/test'
import { startingKr } from './balance.ts'

const kr = (amount: number) => `${amount < 0 ? '−' : ''}${Math.abs(amount).toLocaleString('es-AR')} kr`

test('recargar la página en medio del recorrido conserva todo; "Empezar de cero" lo borra', async ({ page }) => {
  // Una partida guardada por una versión vieja del juego (sin plata ni garage): se migra al cargar.
  await page.addInitScript(() => {
    if (!localStorage.getItem('despacho-progress')) {
      const state = { best: { lunch: 5, dinner: 4, friday: 3 }, played: 3, guideDone: true }
      localStorage.setItem('despacho-progress', JSON.stringify({ state, version: 0 }))
    }
  })
  await page.goto('/')
  // Con Nørrebro ganado arranca en Vesterbro.
  await expect(page.getByRole('heading', { name: 'Vesterbro' })).toBeVisible()

  // En el garage de la cena de Nørrebro: contratar y cambiar un vehículo.
  await page.getByTestId('neighborhood').filter({ hasText: 'Nørrebro' }).click()
  await page.locator('[data-level="dinner"]').click()
  await page.getByTestId('briefing').getByRole('button', { name: 'Garage' }).click()
  const garage = page.getByTestId('garage')
  await expect(garage.getByTestId('garage-money')).toHaveText(kr(startingKr))
  await garage.getByRole('button', { name: /^Contratar un repartidor/ }).click()
  await expect(garage.getByTestId('garage-hired')).toHaveText('4')
  await garage.getByRole('combobox', { name: 'Vehículo de Repartidor 3' }).selectOption('e_scooter')
  const money = await garage.getByTestId('garage-money').textContent()

  await page.reload()
  await page.getByTestId('neighborhood').filter({ hasText: 'Nørrebro' }).click()
  await expect(page.locator('[data-level="dinner"]')).toContainText('Tu mejor: 4,0 estrellas')
  await page.locator('[data-level="dinner"]').click()
  await page.getByTestId('briefing').getByRole('button', { name: 'Garage' }).click()
  await expect(garage.getByTestId('garage-hired')).toHaveText('4')
  await expect(garage.getByTestId('garage-money')).toHaveText(money ?? '')
  await expect(garage.getByRole('combobox', { name: 'Vehículo de Repartidor 3' })).toHaveValue('e_scooter')

  // Empezar de cero: pregunta antes, y después no queda nada.
  await garage.getByRole('button', { name: 'Listo, volver al briefing' }).click()
  await page.getByRole('button', { name: 'Volver a los turnos' }).click()
  await page.getByTestId('restart-open').click()
  const confirm = page.getByTestId('restart-confirm')
  await expect(confirm).toContainText('No se puede deshacer')
  await confirm.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.locator('[data-level="dinner"]')).toContainText('Tu mejor: 4,0 estrellas')
  await page.getByTestId('restart-open').click()
  await page.getByTestId('restart-confirm').getByRole('button', { name: 'Sí, borrar todo' }).click()

  await expect(page.getByRole('heading', { name: 'Nørrebro' })).toBeVisible()
  await expect(page.locator('[data-level="lunch"]')).toContainText('Sin jugar')
  await expect(page.locator('[data-level="dinner"]')).toBeDisabled()
  await page.reload()
  await expect(page.locator('[data-level="dinner"]')).toBeDisabled()
  await page.locator('[data-level="lunch"]').click()
  await expect(page.getByTestId('briefing-cost')).toContainText(`en caja ${kr(startingKr)}`)
})

test('un guardado roto no rompe el juego: arranca una partida nueva, sin errores', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('despacho-progress', '{"state": {"best": '))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Nørrebro' })).toBeVisible()
  await expect(page.locator('[data-level="lunch"]')).toBeEnabled()
  expect(errors).toEqual([])
})
