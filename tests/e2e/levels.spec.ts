import { expect, test, type Page } from '@playwright/test'
import { prototype, shiftStartsAt } from './balance.ts'

test.describe.configure({ timeout: 90_000 }) // Algunos juegan un turno entero con el reloj falso.

/** Plays the current shift to the end without dispatching anything (every order gets cancelled). */
async function runShiftToEnd(page: Page) {
  await page.getByRole('button', { name: '2x', exact: true }).click()
  await page.clock.runFor((prototype.shift.durationSec * 1000) / 2 + 2000)
  await expect(page.getByTestId('results')).toBeVisible()
}

/** Progress saved by an earlier game: the best stars of each level. */
async function withProgress(page: Page, best: Record<string, number>) {
  await page.addInitScript((saved) => {
    if (!localStorage.getItem('despacho-progress')) {
      localStorage.setItem('despacho-progress', JSON.stringify({ state: { best: saved }, version: 0 }))
    }
  }, best)
}

test('la pantalla de inicio muestra los 3 turnos; el briefing cuenta la flota y arranca el almuerzo', async ({ page }) => {
  await page.goto('/')
  const cards = page.getByTestId('level-card')
  await expect(cards).toHaveCount(3)
  await expect(cards.nth(0)).toContainText('Almuerzo')
  await expect(cards.nth(0)).toBeEnabled()
  await expect(cards.nth(1)).toBeDisabled()
  await expect(cards.nth(1)).toContainText('Se abre con 4,0 estrellas en Almuerzo')
  await expect(cards.nth(2)).toBeDisabled()

  await cards.nth(0).click()
  const briefing = page.getByTestId('briefing')
  await expect(briefing.getByRole('heading', { name: 'Almuerzo' })).toBeVisible()
  await expect(briefing.getByTestId('briefing-fleet').getByRole('listitem')).toHaveCount(3)
  await expect(briefing.getByTestId('briefing-orders')).toHaveText(/^Unos \d+$/)

  // "Empezar turno" tiene el foco: Enter arranca.
  await expect(briefing.getByRole('button', { name: 'Empezar turno' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('level-name')).toHaveText('Almuerzo')
  await expect(page.getByTestId('shift-time')).toHaveText(shiftStartsAt)
  await expect(page.getByLabel('3 de 3 repartidores libres')).toBeVisible()
})

test('el resultado de un turno queda guardado al recargar la página', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByTestId('level-card').first().click()
  await page.getByRole('button', { name: 'Empezar turno' }).click()
  await runShiftToEnd(page)

  // Perdido (1 estrella): no abre la cena, pero queda como mejor resultado del almuerzo.
  await expect(page.getByRole('button', { name: 'Siguiente nivel' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Turnos' }).click()
  await expect(page.getByTestId('level-card').first()).toContainText('Tu mejor: 1,0 estrellas')

  await page.reload()
  await expect(page.getByTestId('level-card').first()).toContainText('Tu mejor: 1,0 estrellas')
  await expect(page.getByTestId('level-card').nth(1)).toBeDisabled()
})

test('con 4 estrellas en el almuerzo se abre la cena, y los resultados ofrecen "Siguiente nivel"', async ({ page }) => {
  await withProgress(page, { lunch: 4.4 })
  await page.clock.install()
  await page.goto('/')
  const cards = page.getByTestId('level-card')
  await expect(cards.nth(1)).toBeEnabled()
  await expect(cards.nth(2)).toBeDisabled()

  await cards.nth(0).click()
  await page.getByRole('button', { name: 'Empezar turno' }).click()
  await runShiftToEnd(page)

  // Un turno peor no borra el mejor: la cena sigue abierta.
  await page.getByRole('button', { name: 'Siguiente nivel' }).click()
  const briefing = page.getByTestId('briefing')
  await expect(briefing.getByRole('heading', { name: 'Cena' })).toBeVisible()
  await expect(briefing.getByTestId('briefing-fleet').getByRole('listitem')).toHaveCount(4)
  await briefing.getByRole('button', { name: 'Empezar turno' }).click()
  await expect(page.getByTestId('level-name')).toHaveText('Cena')
  await expect(page.getByLabel('4 de 4 repartidores libres')).toBeVisible()
})

test('un nivel bloqueado no se abre desde la dirección', async ({ page }) => {
  await page.goto('/?level=friday')
  await expect(page.getByTestId('level-card')).toHaveCount(3)
})

test('Vesterbro aparece bloqueado hasta ganar el viernes de Nørrebro', async ({ page }) => {
  await page.goto('/')
  const tabs = page.getByTestId('neighborhood-tab')
  await expect(tabs).toHaveText(['Nørrebro', 'Vesterbro'])
  await expect(tabs.nth(0)).toHaveAttribute('aria-pressed', 'true')
  await tabs.nth(1).click()
  await expect(page.getByRole('heading', { name: 'Vesterbro' })).toBeVisible()
  await expect(page.getByTestId('level-card').first()).toBeDisabled()
  await expect(page.getByTestId('level-card').first()).toContainText('Se abre con 4,0 estrellas en Viernes a la noche')
})

test('con Vesterbro abierto, la pantalla de inicio arranca ahí: Kødbyen en el briefing y restaurantes con nombre propio', async ({ page }) => {
  await withProgress(page, { lunch: 4.5, dinner: 4.2, friday: 4.0 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Vesterbro' })).toBeVisible()
  const cards = page.getByTestId('level-card')
  await expect(cards).toHaveCount(3)
  await expect(cards.nth(0)).toBeEnabled()
  await expect(cards.nth(1)).toBeDisabled()

  await cards.nth(0).click()
  const briefing = page.getByTestId('briefing')
  await expect(briefing).toContainText('Vesterbro')
  await expect(briefing.getByTestId('briefing-zone')).toContainText('3 de los 4 restaurantes están juntos en Kødbyen')
  await expect(briefing.getByTestId('briefing-fleet')).toContainText('Rollers')
  await briefing.getByRole('button', { name: 'Empezar turno' }).click()
  await expect(page.getByLabel('4 de 4 repartidores libres')).toBeVisible()
  await expect(page.getByLabel(/^Mapa de Vesterbro/)).toBeAttached()
  await expect(page.getByRole('button', { name: /^A · Grill Slagterhallen/ })).toBeAttached()
})
