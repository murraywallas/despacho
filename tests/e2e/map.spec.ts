import { expect, test } from '@playwright/test'
import { SHIFT_URL } from './balance.ts'

test('el mapa de Nørrebro se ve completo, con restaurantes, repartidores y la atribución', async ({ page }) => {
  await page.goto(SHIFT_URL)

  const map = page.getByRole('region', { name: /^Mapa de Nørrebro con 4 restaurantes, 3 repartidores/ })
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

  // Marcadores: los 4 restaurantes y los 3 repartidores, con nombre para lectores de pantalla.
  await expect(map.getByTestId('restaurant-marker')).toHaveCount(4)
  await expect(map.getByTestId('rider-marker')).toHaveCount(3)
  await expect(map.getByRole('button', { name: /^A · Pho Søndag/ })).toBeVisible()
  await expect(map.getByRole('button', { name: 'Repartidor 1' })).toBeVisible()

  // Los restaurantes caen dentro del mapa visible.
  for (const marker of await map.getByTestId('restaurant-marker').all()) {
    const spot = await marker.boundingBox()
    expect(spot).not.toBeNull()
    if (!spot) continue
    expect(spot.x).toBeGreaterThanOrEqual(box.x - 1)
    expect(spot.x + spot.width).toBeLessThanOrEqual(box.x + box.width + 1)
    expect(spot.y).toBeGreaterThanOrEqual(box.y - 1)
    expect(spot.y + spot.height).toBeLessThanOrEqual(box.y + box.height + 1)
  }

  // Atribución obligatoria de OpenStreetMap, siempre visible.
  await expect(map.getByText('OpenStreetMap contributors')).toBeVisible()
})

test('el mapa no deja irse lejos del barrio y se puede acercar', async ({ page }) => {
  await page.goto(SHIFT_URL)
  const map = page.getByRole('region', { name: /^Mapa de Nørrebro/ })
  await expect(map.getByTestId('restaurant-marker')).toHaveCount(4)
  const box = await map.boundingBox()
  if (!box) throw new Error('El mapa no tiene tamaño.')

  // Arrastrar muy lejos: el barrio sigue a la vista.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 3000, box.y + box.height / 2 + 3000, { steps: 10 })
  await page.mouse.up()
  const visible = await map.getByTestId('restaurant-marker').evaluateAll(
    (markers, area) =>
      markers.filter((marker) => {
        const spot = marker.getBoundingClientRect()
        return spot.right > area.x && spot.left < area.x + area.width && spot.bottom > area.y && spot.top < area.y + area.height
      }).length,
    box,
  )
  expect(visible).toBeGreaterThan(0)

  // El botón de acercar mueve los marcadores (el mapa se agranda).
  const restaurant = map.getByRole('button', { name: /^A · Pho Søndag/ })
  const before = await restaurant.boundingBox()
  await page.getByRole('button', { name: 'Acercar' }).click()
  await expect.poll(async () => (await restaurant.boundingBox())?.x).not.toBe(before?.x)
})

test('los repartidores son tarjetas: libres en claro, y al despachar pasan a estar en viaje', async ({ page }) => {
  await page.clock.install()
  await page.goto(SHIFT_URL)
  const map = page.getByRole('region', { name: /^Mapa de Nørrebro/ })
  const free = map.locator('.map-marker--free')
  await expect(free).toHaveCount(3)
  await expect(map.getByTestId('rider-marker').first().locator('svg')).toBeVisible()

  await page.clock.runFor(10_000)
  await page.getByTestId('order-card').first().getByRole('button').click()
  // El pedido elegido marca su restaurante y su cliente en el mapa.
  await expect(map.locator('.map-marker--selected')).toHaveCount(2)
  await page.keyboard.press('1')

  await expect(free).toHaveCount(2)
  await expect(map.getByRole('button', { name: 'Repartidor 1' }).locator('.map-pin--toRestaurant, .map-pin--atKitchen')).toHaveCount(1)
})
