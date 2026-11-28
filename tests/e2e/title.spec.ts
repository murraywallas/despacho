import { expect, test } from '@playwright/test'

test('la pantalla de inicio muestra Copenhague en movimiento; Jugar lleva a los barrios y no vuelve al recargar', async ({ page }) => {
  await page.goto('/')
  const title = page.getByTestId('title-screen')
  await expect(title.getByRole('heading', { name: 'Despacho' })).toBeVisible()
  // De fondo, el mapa con restaurantes y repartidores (decoración: fuera del orden de tabulación).
  const map = page.getByTestId('title-map')
  await expect(map.locator('.map-marker--restaurant')).not.toHaveCount(0)
  await expect(map.locator('.map-marker--rider')).not.toHaveCount(0)
  await expect(map).toHaveAttribute('aria-hidden', 'true')

  // Los repartidores se mueven.
  const positions = () => map.locator('.map-marker--rider').evaluateAll((markers) => markers.map((marker) => marker.style.transform).join('|'))
  const before = await positions()
  await expect.poll(positions, { timeout: 10_000 }).not.toBe(before)

  // El idioma se elige acá también.
  await title.getByTestId('language-switch').getByRole('button', { name: 'English' }).click()
  await expect(title.getByRole('button', { name: 'Play' })).toBeVisible()
  await title.getByTestId('language-switch').getByRole('button', { name: 'Español' }).click()

  await title.getByRole('button', { name: 'Jugar' }).click()
  await expect(page.getByTestId('level-card').first()).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('level-card').first()).toBeVisible()
  await expect(page.getByTestId('title-screen')).toHaveCount(0)
})

test.describe('con movimiento reducido', () => {
  test.use({ reducedMotion: 'reduce' })

  test('el mapa de la pantalla de inicio queda quieto', async ({ page }) => {
    await page.goto('/')
    const riders = page.getByTestId('title-map').locator('.map-marker--rider')
    await expect(riders).not.toHaveCount(0)
    const positions = () => riders.evaluateAll((markers) => markers.map((marker) => marker.style.transform).join('|'))
    const before = await positions()
    await page.waitForTimeout(1500)
    expect(await positions()).toBe(before)
  })
})
