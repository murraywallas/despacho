import { expect, test } from '@playwright/test'
import { prototype, SHIFT_URL } from './balance.ts'

test.describe.configure({ timeout: 120_000 }) // Simula minutos de turno cuadro por cuadro.

test('un pedido que nadie atiende se cancela, sale de la cola y cuenta como 1 estrella', async ({ page }) => {
  await page.clock.install()
  await page.goto(SHIFT_URL)
  // Después de install() el reloj falso también avanza con el tiempo real. Este test mira 1,5 s antes de la
  // cancelación: con la máquina lenta, esperar un expect alcanzaba para pasarse. En pausa, solo avanza con runFor.
  // El salto de pauseAt dispara a lo sumo un cuadro, y el juego no avanza más de un cuarto de segundo por cuadro.
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000)
  const orderPanel = page.getByRole('complementary', { name: /Pedidos/ })
  const firstOrder = orderPanel.getByText('Pedido #1', { exact: true })

  // El pedido #1 llega a los spawnIntervalSec, vence deadlineSec después y se cancela cancelAfterSec más tarde.
  const { spawnIntervalSec, deadlineSec, cancelAfterSec } = prototype.orders
  const cancelAtMs = (spawnIntervalSec + deadlineSec + cancelAfterSec) * 1000
  await page.clock.runFor(spawnIntervalSec * 1000 + 500)
  await expect(firstOrder).toBeVisible()

  await page.clock.runFor(cancelAtMs - spawnIntervalSec * 1000 - 1500)
  await expect(firstOrder).toBeVisible()
  await expect(page.getByTestId('shift-rating')).toHaveText('–')

  await page.clock.runFor(2000)
  await expect(firstOrder).toHaveCount(0)
  await expect(orderPanel.getByTestId('cancelled-count')).toHaveText('Cancelados: 1')
  await expect(page.getByTestId('shift-rating')).toHaveText('1,0')
})
