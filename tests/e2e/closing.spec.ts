import { expect, test } from '@playwright/test'
import { clockSpeeds, prototype, SHIFT_URL, shiftEndsAt } from './balance.ts'

test.describe.configure({ timeout: 180_000 }) // Simula el turno entero cuadro por cuadro.

// Real seconds before the end when the held orders go out: a rider can pick one up before the closing hour, but
// not deliver it.
const DISPATCH_BEFORE_END_SEC = 30
const STEP_MS = 1000
// The fastest clock speed: the shift takes a third of the time.
const FAST = Math.max(...clockSpeeds)

test('al cierre, la comida en camino se entrega igual (con el reloj en la hora de cierre) y cuenta en los resultados', async ({
  page,
}) => {
  await page.clock.install()
  await page.goto(SHIFT_URL)
  await page.getByRole('button', { name: `${FAST}x`, exact: true }).click()
  const orders = page.getByRole('complementary', { name: /Pedidos/ }).getByTestId('order-card')
  const riderPanel = page.getByRole('complementary', { name: /Repartidores/ })

  // Nadie despacha hasta poco antes del cierre: los pedidos se juntan (y los viejos se cancelan).
  await page.clock.runFor(((prototype.shift.durationSec - DISPATCH_BEFORE_END_SEC) * 1000) / FAST)
  await page.keyboard.press('Space') // En pausa, para despachar tranquilos.
  // Cada repartidor libre sale con el pedido más nuevo (los viejos se cancelan antes de que lo retiren).
  for (let sent = 0; sent < 3 && (await orders.count()) > 0; sent++) {
    await orders.last().getByRole('button').first().click()
    const first = riderPanel.getByTestId('rider-card').first()
    const number = await first.getAttribute('data-rider-number')
    const before = await orders.count()
    await page.keyboard.press(number ?? '1')
    await expect(orders).toHaveCount(before - 1)
  }
  await page.keyboard.press('Space')

  // Llega la hora de cierre con comida en camino: el turno sigue, el reloj queda en la hora de cierre.
  const status = page.locator('.top-bar__status')
  for (let waited = 0; waited < DISPATCH_BEFORE_END_SEC * 1000 + 5000; waited += STEP_MS) {
    if ((await status.count()) > 0 && (await status.textContent()) === 'Cerrando el turno…') break
    await page.clock.runFor(STEP_MS)
  }
  await expect(status).toHaveText('Cerrando el turno…')
  await expect(page.getByTestId('shift-time')).toHaveText(shiftEndsAt)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '2x', exact: true })).toBeDisabled()

  // Cuando se entrega lo último, recién ahí aparecen los resultados, con esa entrega contada.
  const radio = page.getByTestId('radio')
  for (let waited = 0; waited < 60_000 && (await page.getByRole('dialog').count()) === 0; waited += STEP_MS) {
    await page.clock.runFor(STEP_MS)
  }
  const results = page.getByRole('dialog')
  await expect(results).toBeVisible()
  // La radio cuenta la entrega con su hora real, después del cierre.
  await expect(radio).toContainText(/· entregado/)
  await expect(results.getByTestId('results-delivered').locator('dd')).not.toHaveText('0')
})
