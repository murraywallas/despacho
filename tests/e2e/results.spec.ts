import { expect, test } from '@playwright/test'
import { prototype, SHIFT_URL, shiftEndsAt, shiftStartsAt } from './balance.ts'

// El turno de 5 minutos se acorta con el reloj falso de Playwright: corre en 2x y se adelanta de golpe.
test.describe.configure({ timeout: 90_000 }) // Simula minutos de turno cuadro por cuadro.

test('al terminar el turno aparecen los resultados y "Jugar otra vez" reinicia todo', async ({ page }) => {
  await page.clock.install()
  await page.goto(SHIFT_URL)
  await page.getByRole('button', { name: '2x', exact: true }).click()

  const halfShiftMs = (prototype.shift.durationSec * 1000) / 2
  await page.clock.runFor(halfShiftMs - 10_000)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.clock.runFor(12_000)

  // Nadie despachó nada: todo lo que terminó fue cancelado, 1 estrella, turno perdido.
  const results = page.getByRole('dialog', { name: 'Perdiste el turno' })
  await expect(results).toBeVisible()
  await expect(results.getByTestId('results-rating')).toHaveText('1,0')
  await expect(results.getByTestId('results-delivered').locator('dd')).toHaveText('0')
  await expect(results.getByTestId('results-late').locator('dd')).toHaveText('0')
  await expect(results.getByTestId('results-cancelled').locator('dd')).toHaveText(/^[1-9]\d*$/)
  // Todo lo que se perdió fue por cancelados (4 estrellas de promedio), y el consejo habla de eso.
  const lost = results.getByTestId('results-lost')
  await expect(lost.locator('.results__lost-row--hit')).toHaveText(/Por pedidos cancelados\s*−4,0 ★/)
  await expect(results.getByTestId('results-tip')).toContainText('llamá al cliente (L)')
  await expect(results.getByText('Se gana con 4,0 estrellas o más; con menos de 3,0, se pierde.')).toBeVisible()
  await expect(page.getByTestId('shift-time')).toHaveText(shiftEndsAt)

  // El botón tiene el foco: Enter alcanza para volver a jugar.
  await expect(results.getByRole('button', { name: 'Jugar otra vez' })).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByTestId('shift-time')).toHaveText(shiftStartsAt)
  await expect(page.getByTestId('shift-rating')).toHaveText('–')
  await expect(page.getByRole('button', { name: '1x', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Todavía no hay pedidos. El primero llega en unos segundos.')).toBeVisible()
  await expect(page.getByLabel('3 de 3 repartidores libres')).toBeVisible()

  // Y el turno nuevo arranca de verdad.
  await page.clock.runFor(prototype.orders.spawnIntervalSec * 1000 + 500)
  await expect(page.getByTestId('order-card')).toHaveCount(1)
})
