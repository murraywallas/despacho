import { expect, test } from '@playwright/test'

test.describe.configure({ timeout: 90_000 })

const RAIN_FROM_SEC = 180

test('la cena de Vesterbro avisa la lluvia en el briefing, y en el turno aparece en la barra de arriba cuando empieza', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('despacho-progress')) {
      const best = { lunch: 5, dinner: 5, friday: 5, vesterbro_lunch: 5 }
      const state = { best, moneyKr: 100_000, hired: 10, played: 5, guideDone: true }
      localStorage.setItem('despacho-progress', JSON.stringify({ state, version: 0 }))
    }
  })
  await page.clock.install()
  await page.goto('/')
  await page.getByTestId('neighborhood').filter({ hasText: 'Vesterbro' }).click()
  await page.locator('[data-level="vesterbro_dinner"]').click()

  const briefing = page.getByTestId('briefing')
  await expect(briefing.getByTestId('briefing-event')).toContainText('Lluvia de 19:30 a 19:50')
  await expect(briefing.getByTestId('briefing-event')).toContainText('30 % más de pedidos')

  // La flota sugerida ya sale en bici en vez de lo que más se frena con el agua.
  await expect(briefing.getByTestId('briefing-weather')).toHaveText(
    'Lluvia: la flota sugerida sale en bicicleta en vez de patineta y rollers, que se frenan mucho.',
  )
  await expect(briefing.getByTestId('briefing-fleet')).not.toContainText('Patineta')
  await expect(briefing.getByTestId('briefing-fleet')).not.toContainText('Rollers')

  // Si el jugador vuelve a poner una patineta, el garage avisa que conviene cambiarla.
  await briefing.getByTestId('briefing-garage').click()
  const garage = page.getByTestId('garage')
  await garage.getByLabel('Vehículo de Repartidor 3').selectOption('skateboard')
  await expect(garage.getByTestId('garage-weather')).toHaveText(
    'Lluvia: en patineta se va mucho más lento. Conviene salir en bicicleta.',
  )
  await garage.getByRole('button', { name: 'Usar la flota sugerida' }).click()
  await expect(garage.getByTestId('garage-weather')).toContainText('la flota sugerida sale en bicicleta')
  await garage.getByRole('button', { name: 'Listo, volver al briefing' }).click()
  await briefing.getByRole('button', { name: 'Empezar turno' }).click()

  // Todavía no llueve.
  await expect(page.getByTestId('shift-time')).toBeVisible()
  await expect(page.getByTestId('event-notice')).toHaveCount(0)

  await page.clock.runFor(RAIN_FROM_SEC * 1000 + 1000)
  const notice = page.getByTestId('event-notice')
  await expect(notice).toHaveText('Lluvia')
  await expect(notice).toHaveAttribute('aria-label', /más lentos/)
})
