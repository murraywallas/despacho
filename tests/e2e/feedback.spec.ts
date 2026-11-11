import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { longestRideMs, prototype, SHIFT_URL } from './balance.ts'

test.describe.configure({ timeout: 90_000 }) // Simula minutos de turno cuadro por cuadro.

/** Advances the page clock in small steps until the locator has the text (or gives up after maxMs). */
async function runUntil(page: Page, locator: Locator, text: string, maxMs: number) {
  for (let waited = 0; waited <= maxMs; waited += 500) {
    if ((await locator.textContent())?.includes(text)) return
    await page.clock.runFor(500)
  }
  await expect(locator).toContainText(text)
}

/** Records every delivery effect added to the map (they remove themselves when their animation ends). */
async function watchDeliveryFx(page: Page) {
  await page.addInitScript(() => {
    const seen: string[] = []
    ;(window as unknown as { deliveryFx: string[] }).deliveryFx = seen
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement && node.classList.contains('delivery-fx')) seen.push(node.className)
        }
      }
    }).observe(document, { childList: true, subtree: true })
  })
}

test('la radio cuenta el pedido nuevo, la salida del restaurante y la entrega, con su momento en el mapa', async ({ page }) => {
  await watchDeliveryFx(page)
  await page.clock.install()
  await page.goto(SHIFT_URL)
  const radio = page.getByTestId('radio')
  await expect(radio).toContainText('Sin novedades')

  await page.clock.runFor(prototype.orders.spawnIntervalSec * 1000 + 500)
  await expect(radio).toContainText(/#1 · pedido nuevo de [A-Z] · /)

  const orderPanel = page.getByRole('complementary', { name: /Pedidos/ })
  const riderPanel = page.getByRole('complementary', { name: /Repartidores/ })
  await orderPanel.getByTestId('order-card').first().getByRole('button').first().click()
  const closest = (await riderPanel.getByTestId('rider-card').first().getAttribute('data-rider-number')) ?? '1'
  await page.keyboard.press(closest)

  await runUntil(page, radio, `Repartidor ${closest} · salió de`, longestRideMs + prototype.kitchen.cookSec * 1000)
  await runUntil(page, radio, '#1 · entregado a tiempo', longestRideMs + 2000)
  const fx = await page.evaluate(() => (window as unknown as { deliveryFx: string[] }).deliveryFx)
  // One effect, the celebrating one (on time and warm). MapLibre adds its own marker classes.
  expect(fx).toHaveLength(1)
  expect(fx[0].split(' ')).toContain('delivery-fx--good')
})

test('la radio avisa la cancelación y se puede ocultar (y queda oculta al recargar)', async ({ page }) => {
  await page.clock.install()
  await page.goto(SHIFT_URL)
  const radio = page.getByTestId('radio')
  const { spawnIntervalSec, deadlineSec, cancelAfterSec } = prototype.orders
  await page.clock.runFor((spawnIntervalSec + deadlineSec + cancelAfterSec) * 1000 + 1000)
  await expect(radio).toContainText('se canceló')

  await page.getByRole('button', { name: 'Ocultar la radio del turno' }).click()
  await expect(radio).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Mostrar la radio del turno' })).toBeVisible()
  await expect(page.getByTestId('radio')).toHaveCount(0)
})

test('con movimiento reducido, el pulso de urgencia solo se funde (no crece)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.install()
  await page.goto(SHIFT_URL)
  const { spawnIntervalSec, deadlineSec, urgentBelowSec } = prototype.orders
  await page.clock.runFor((spawnIntervalSec + deadlineSec - urgentBelowSec) * 1000 + 1000)
  const urgent = page.locator('.order-card--urgent').first()
  await expect(urgent).toBeVisible()
  const pulse = await urgent.evaluate((element) => getComputedStyle(element, '::after').animationName)
  expect(pulse).toBe('urgent-fade')

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  // The page follows the system setting as soon as it changes.
  await expect
    .poll(() => urgent.evaluate((element) => getComputedStyle(element, '::after').animationName))
    .toBe('urgent-pulse')
})

test('ninguna regla CSS usa "transition: all"', () => {
  const root = new URL('../../src/', import.meta.url)
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (path.endsWith('.css')) files.push(path)
    }
  }
  walk(root.pathname.replace(/^\/(\w:)/, '$1'))
  expect(files.length).toBeGreaterThan(3)
  for (const file of files) {
    expect(readFileSync(file, 'utf8'), file).not.toMatch(/transition(-property)?:\s*all\b/)
  }
})
