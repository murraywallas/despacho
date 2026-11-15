import { expect, test } from '@playwright/test'
import { clockSpeeds, prototype, SHIFT_URL } from './balance.ts'

test.describe.configure({ timeout: 240_000 }) // Simula el turno entero cuadro por cuadro.

const STEP_MS = 1000
// The fastest clock speed: the whole shift takes a third of the time.
const FAST = Math.max(...clockSpeeds)
// Orders sent out before stopping: the rest is cancelled, and the average lands between losing and winning.
const DISPATCHED = 8

test('con un promedio entre 3 y 4, el resultado dice "Casi" y qué nivel abriría, con la barra de estrellas', async ({
  page,
}) => {
  await page.clock.install()
  await page.goto(SHIFT_URL)
  await page.getByRole('button', { name: `${FAST}x`, exact: true }).click()
  const orders = page.getByRole('complementary', { name: /Pedidos/ }).getByTestId('order-card')
  const riderPanel = page.getByRole('complementary', { name: /Repartidores/ })

  // Cada pedido sale apenas hay alguien libre, hasta despachar DISPATCHED; después, nadie más.
  let sent = 0
  let ms = 0
  const shiftMs = (prototype.shift.durationSec * 1000) / FAST
  while (ms < shiftMs) {
    await page.clock.runFor(STEP_MS)
    ms += STEP_MS
    if (sent >= DISPATCHED || (await orders.count()) === 0) continue
    await page.keyboard.press('ArrowDown')
    const first = riderPanel.getByTestId('rider-card').first()
    if ((await first.locator('.rider-card--idle').count()) > 0) {
      const before = await orders.count()
      await page.keyboard.press((await first.getAttribute('data-rider-number')) ?? '1')
      // A rider without battery for the trip goes to recharge instead: then the order stays.
      if ((await orders.count()) < before) sent++
      else await page.keyboard.press('Escape')
    } else {
      await page.keyboard.press('Escape')
    }
  }
  // El cierre, si alguien todavía lleva comida.
  for (let waited = 0; waited < 60_000 && (await page.getByRole('dialog').count()) === 0; waited += 5000) {
    await page.clock.runFor(5000)
  }

  const results = page.getByRole('dialog')
  await expect(results).toBeVisible()
  const rating = Number((await results.getByTestId('results-rating').textContent())?.replace(',', '.'))
  expect(rating).toBeGreaterThanOrEqual(3)
  expect(rating).toBeLessThan(4)
  // El título no dice que pasó: dice cuánto falta y qué se abre con eso.
  await expect(results.getByRole('heading', { level: 2 })).toHaveText('Casi: necesitás 4,0 para abrir Cena')
  await expect(results.getByTestId('results-bar')).toHaveAttribute('aria-label', /Promedio \d,\d de 5\. Con menos de 3,0 se pierde; con 4,0 o más se gana\./)
  await expect(results.getByTestId('results-bar')).toContainText('3,0')
  await expect(results.getByTestId('results-bar')).toContainText('4,0')
})
