import { expect, test } from '@playwright/test'
import { SHIFT_URL } from './balance.ts'

test('Esc sin nada elegido abre el menú de pausa y frena el juego; Esc lo cierra y sigue', async ({ page }) => {
  await page.goto(SHIFT_URL)
  await page.keyboard.press('Escape')
  const menu = page.getByRole('dialog', { name: 'Pausa' })
  await expect(menu).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('En pausa')
  await expect(menu.getByRole('button', { name: /Seguir/ })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveCount(0)
})

test('con teclado: tamaño de texto al 130 % y colores para daltonismo, y se recuerdan al recargar', async ({ page }) => {
  await page.goto(SHIFT_URL)
  const textScale = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim())
  const urgent = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--urgent').trim())
  const clockSize = () =>
    page.getByTestId('shift-time').evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
  const before = { size: await clockSize(), urgent: await urgent() }

  await page.keyboard.press('Escape')
  const menu = page.getByRole('dialog', { name: 'Pausa' })
  await menu.getByRole('button', { name: '130 %' }).focus()
  await page.keyboard.press('Enter')
  await menu.getByRole('switch', { name: 'Colores para daltonismo' }).focus()
  await page.keyboard.press('Space')
  await expect(menu.getByRole('switch', { name: 'Colores para daltonismo' })).toHaveAttribute('aria-checked', 'true')

  expect(await textScale()).toBe('1.3')
  expect(await clockSize()).toBeCloseTo(before.size * 1.3, 0)
  expect(await urgent()).not.toBe(before.urgent)

  await page.reload()
  expect(await textScale()).toBe('1.3')
  expect(await urgent()).not.toBe(before.urgent)
})

test('movimiento reducido desde el menú, aunque el sistema no lo pida', async ({ page }) => {
  await page.goto(SHIFT_URL)
  const motion = () => page.evaluate(() => document.documentElement.dataset.motion)
  expect(await motion()).toBe('full')
  await page.keyboard.press('Escape')
  await page.getByRole('switch', { name: 'Movimiento reducido' }).click()
  expect(await motion()).toBe('reduced')
})

test('inicio y briefing sobre el mapa del barrio; el briefing marca los restaurantes y los trade-offs de la flota', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('backdrop-map')).toBeVisible()
  await page.getByTestId('level-card').first().click()
  const briefing = page.getByTestId('briefing')
  await expect(briefing.getByRole('listitem').first()).toContainText(/\d+ km\/h · lleva \d+/)
  await expect(page.locator('.backdrop-pin')).toHaveCount(4)
})
