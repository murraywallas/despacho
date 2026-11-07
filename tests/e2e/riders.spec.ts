import { expect, test } from '@playwright/test'

test('los 3 repartidores aparecen libres en el panel y en el mapa', async ({ page }) => {
  await page.goto('/')

  const panel = page.getByRole('complementary', { name: /Repartidores/ })
  const cards = panel.getByTestId('rider-card')
  await expect(cards).toHaveCount(3)
  for (const [index, card] of (await cards.all()).entries()) {
    await expect(card).toContainText(`Repartidor ${index + 1}`)
    await expect(card).toContainText('Bicicleta')
    await expect(card).toContainText('Libre')
  }
  await expect(panel.getByLabel('3 de 3 repartidores libres')).toBeVisible()

  await expect(page.getByRole('img', { name: /3 repartidores/ })).toBeVisible()
})
