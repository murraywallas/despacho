import { expect, test, type Page } from '@playwright/test'
import { prototype, SHIFT_URL } from './balance.ts'

/** The smallest text the game shows, in CSS pixels (skill game-ui, tasks #72 and #73). */
const MIN_TEXT_PX = 12
/** Critical numbers (clock, countdowns) are at least this big. */
const CRITICAL_TEXT_PX = 16

/** Page scroll and the smallest visible text, measured in the browser. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement
    let smallest = Infinity
    let smallestText = ''
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim()
      const parent = node.parentElement
      if (!text || !parent) continue
      const box = parent.getBoundingClientRect()
      const style = getComputedStyle(parent)
      if (box.width === 0 || box.height === 0 || style.visibility === 'hidden' || style.display === 'none') continue
      const size = Number.parseFloat(style.fontSize)
      if (size < smallest) {
        smallest = size
        smallestText = text
      }
    }
    return {
      scrollsDown: root.scrollHeight > window.innerHeight,
      scrollsAcross: root.scrollWidth > window.innerWidth,
      smallest,
      smallestText,
    }
  })
}

test('la pantalla de turno: el mapa de borde a borde, sin scroll y sin textos de menos de 12 px', async ({ page }) => {
  await page.goto(SHIFT_URL)
  await page.getByRole('button', { name: '2x', exact: true }).click()
  const orders = page.getByRole('complementary', { name: /Pedidos/ }).getByTestId('order-card')
  await expect(orders).toHaveCount(1, { timeout: (prototype.orders.spawnIntervalSec * 1000) / 2 + 5000 })
  await page.keyboard.press('Space')
  await orders.first().getByRole('button').first().click()

  // El mapa ocupa toda la ventana; los paneles flotan encima.
  const viewport = page.viewportSize()
  const map = await page.getByRole('main', { name: /mapa/i }).boundingBox()
  expect(map).toMatchObject({ x: 0, y: 0, width: viewport?.width, height: viewport?.height })

  const result = await measure(page)
  expect(result.scrollsDown).toBe(false)
  expect(result.scrollsAcross).toBe(false)
  expect(result.smallest, `"${result.smallestText}" mide ${result.smallest} px`).toBeGreaterThanOrEqual(MIN_TEXT_PX)

  // Lo que decide el triage se lee primero: el reloj y la cuenta regresiva de cada pedido.
  for (const critical of [page.getByTestId('shift-time'), orders.first().locator('.order-card__time')]) {
    const size = await critical.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
    expect(size).toBeGreaterThanOrEqual(CRITICAL_TEXT_PX)
  }
})

test('inicio y briefing entran en la pantalla, sin textos de menos de 12 px', async ({ page }) => {
  await page.goto('/')
  let result = await measure(page)
  expect(result.scrollsDown).toBe(false)
  expect(result.smallest, `"${result.smallestText}" mide ${result.smallest} px`).toBeGreaterThanOrEqual(MIN_TEXT_PX)

  await page.getByTestId('level-card').first().click()
  await expect(page.getByTestId('briefing')).toBeVisible()
  result = await measure(page)
  expect(result.scrollsDown).toBe(false)
  expect(result.smallest, `"${result.smallestText}" mide ${result.smallest} px`).toBeGreaterThanOrEqual(MIN_TEXT_PX)
})
