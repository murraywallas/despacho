import { expect, test, type Page } from '@playwright/test'
import { prototype, SHIFT_URL } from './balance.ts'

type Box = { left: number; top: number; right: number; bottom: number }

/** Long enough for the map's animations (a slide, the glide after a drag) to end, on the page's clock. */
const SETTLE_MS = 1500

/** The part of the screen the panels and bars leave free, and every marker's box (its card, when it has one). */
async function layout(page: Page) {
  return page.evaluate(() => {
    const box = (element: Element) => {
      const rect = element.getBoundingClientRect()
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
    }
    const [left, right] = [...document.querySelectorAll('aside')].map(box)
    const markers = [...document.querySelectorAll('.maplibregl-marker')].map((marker) => ({
      name: marker.getAttribute('aria-label') ?? '',
      ...box(marker.firstElementChild ?? marker),
    }))
    const free = {
      left: left.right,
      right: right.left,
      top: box(document.querySelector('.top-bar')!).bottom,
      bottom: box(document.querySelector('.radio')!).top,
    }
    return { free, markers }
  })
}

const inside = (marker: Box, free: Box) =>
  marker.left >= free.left && marker.right <= free.right && marker.top >= free.top && marker.bottom <= free.bottom
const overlap = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

test('al empezar, todos los marcadores quedan fuera de los paneles y las barras, y ningún restaurante tapa a otro', async ({ page }) => {
  await page.goto(SHIFT_URL)
  await expect(page.getByTestId('restaurant-marker').first()).toBeVisible()
  const { free, markers } = await layout(page)
  expect(markers.length).toBeGreaterThan(0)
  for (const marker of markers) expect(inside(marker, free), marker.name).toBe(true)
  const restaurants = markers.filter((marker) => / · /.test(marker.name) && !marker.name.startsWith('Repartidor'))
  for (const [i, a] of restaurants.entries()) {
    for (const b of restaurants.slice(i + 1)) expect(overlap(a, b), `${a.name} / ${b.name}`).toBe(false)
  }
})

test('la cámara se mueve solo si lo elegido está tapado', async ({ page }) => {
  await page.clock.install()
  await page.goto(SHIFT_URL)
  const orders = page.getByRole('complementary', { name: /Pedidos/ }).getByTestId('order-card')
  await page.clock.runFor(prototype.orders.spawnIntervalSec * 1000 + 500)
  await expect(orders).toHaveCount(1)
  await page.keyboard.press('Space')

  // Elegirlo una vez lo deja a la vista (si la barra del pedido lo tapaba, el mapa se corre).
  await page.keyboard.press('ArrowDown')
  await page.clock.runFor(SETTLE_MS)
  await page.keyboard.press('Escape')
  await page.clock.runFor(SETTLE_MS)
  // Ya a la vista: elegirlo otra vez no mueve nada.
  const before = (await layout(page)).markers
  await page.keyboard.press('ArrowDown')
  await page.clock.runFor(SETTLE_MS)
  expect((await layout(page)).markers.map((marker) => [marker.left, marker.top])).toEqual(
    before.map((marker) => [marker.left, marker.top]),
  )
  await page.keyboard.press('Escape')

  // Arrastrado fuera de la pantalla: al elegirlo, el mapa trae su restaurante a la parte libre.
  const map = page.getByTestId('map')
  const area = (await map.boundingBox())!
  const startX = area.x + area.width / 2
  const startY = area.y + area.height / 2
  const restaurantName = (await orders.first().textContent())?.match(/([A-Z]) · /)?.[1]
  const restaurant = () => layout(page).then(({ free, markers }) => ({ free, marker: markers.find((m) => m.name.startsWith(`${restaurantName} · `))! }))
  // Away from the middle: the restaurant leaves through the nearest edge.
  const start = (await restaurant()).marker
  const away = (start.top + start.bottom) / 2 > startY ? 1 : -1
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX, startY + away * area.height * 0.6, { steps: 8 })
  await page.mouse.up()
  // The drag glides on a little (on the page's clock).
  await page.clock.runFor(SETTLE_MS)
  expect(inside((await restaurant()).marker, (await restaurant()).free)).toBe(false)
  // With a click on its card: after a drag the map has the focus, and its arrows pan it (a choice of #74).
  await orders.first().getByRole('button').first().click()
  // The slide is animated, on the page's clock too.
  await page.clock.runFor(SETTLE_MS)
  const { free, marker } = await restaurant()
  expect(inside(marker, free)).toBe(true)
})

test('pasar el mouse por un pedido de la cola destaca su restaurante y su cliente', async ({ page }) => {
  await page.clock.install()
  await page.goto(SHIFT_URL)
  const orders = page.getByRole('complementary', { name: /Pedidos/ }).getByTestId('order-card')
  await page.clock.runFor(prototype.orders.spawnIntervalSec * 1000 + 500)
  await expect(orders).toHaveCount(1)
  await orders.first().hover()
  await expect(page.locator('.map-marker--highlighted')).toHaveCount(2)
})
