import { expect, test } from '@playwright/test'

test('los 3 repartidores aparecen libres, cada uno con su vehículo, en el panel y en el mapa', async ({ page }) => {
  await page.goto('/')

  const panel = page.getByRole('complementary', { name: /Repartidores/ })
  const cards = panel.getByTestId('rider-card')
  await expect(cards).toHaveCount(3)
  // La flota de la planilla, en orden: bici, patineta y monopatín.
  const vehicles = ['Bicicleta', 'Patineta', 'Monopatín']
  for (const [index, card] of (await cards.all()).entries()) {
    await expect(card).toContainText(`Repartidor ${index + 1}`)
    await expect(card).toContainText(vehicles[index])
    await expect(card.locator('svg').first()).toBeVisible()
    await expect(card).toContainText('Libre')
  }
  await expect(panel.getByLabel('3 de 3 repartidores libres')).toBeVisible()

  await expect(page.getByRole('region', { name: /3 repartidores/ })).toBeVisible()
})
