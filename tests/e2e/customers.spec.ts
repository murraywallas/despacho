import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { prototype, SHIFT_URL } from './balance.ts'

const names = JSON.parse(readFileSync(new URL('../../data/names.json', import.meta.url), 'utf8')) as { first: string[]; last: string[] }

test('cada pedido dice quién lo pidió y en qué calle vive; el punto del cliente también', async ({ page }) => {
  await page.clock.install()
  await page.goto(SHIFT_URL)
  await page.clock.runFor(prototype.orders.spawnIntervalSec * 1000 + 500)
  await page.keyboard.press('Space')

  // "Mette Hansen · Jagtvej 34": nombre de la lista, calle real con número.
  const line = (await page.getByTestId('order-customer').first().textContent()) ?? ''
  const [name, address] = line.split(' · ')
  const [first, last] = name.split(' ')
  expect(names.first).toContain(first)
  expect(names.last).toContain(last)
  expect(address).toMatch(/^\S.* \d+\w*$/)

  // El punto del cliente en el mapa lo dice al pasar el mouse, y a los lectores de pantalla.
  const dot = page.getByRole('button', { name: /^Cliente del pedido #1/ })
  await expect(dot).toHaveAttribute('aria-label', new RegExp(`${name} · ${address}`))
  await dot.hover()
  await expect(dot.locator('.map-dot__card')).toBeVisible()
  await expect(dot.locator('.map-dot__card')).toHaveText(line)
})
