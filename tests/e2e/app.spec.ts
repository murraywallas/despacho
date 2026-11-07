import { expect, test } from '@playwright/test'

test('el juego abre y muestra el título', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')

  await expect(page).toHaveTitle('Despacho')
  await expect(page.getByRole('heading', { name: 'Despacho' })).toBeVisible()
  expect(errors).toEqual([])
})
