import { expect, test } from '@playwright/test'

test('el mapa de grilla se ve completo y tiene calles y restaurantes dibujados', async ({ page }) => {
  await page.goto('/')

  const map = page.getByRole('img', { name: 'Mapa: grilla de 10 por 10 calles con 4 restaurantes' })
  await expect(map).toBeVisible()

  // Entra entero en la pantalla y no está aplastado.
  const box = await map.boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()
  if (!box || !viewport) return
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
  expect(Math.min(box.width, box.height)).toBeGreaterThan(300)

  // Hay al menos tres colores distintos: fondo, calles y restaurantes.
  const colors = await map.evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d')
    if (!context) return 0
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    const seen = new Set<string>()
    for (let i = 0; i < data.length; i += 4 * 97) seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`)
    return seen.size
  })
  expect(colors).toBeGreaterThanOrEqual(3)
})
