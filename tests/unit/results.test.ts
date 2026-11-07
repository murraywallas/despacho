import { describe, expect, test } from 'vitest'
import { shift } from '../../src/game/balance'
import type { Order } from '../../src/game/orders'
import type { HeatSettings, RatingSettings } from '../../src/game/rating'
import { outcomeOf, summarizeShift, type OutcomeThresholds } from '../../src/game/results'

// The values of the GDD, written here so the tests don't move when the balance sheet changes.
const thresholds: OutcomeThresholds = { winAtLeast: 4, loseBelow: 3 }
const heat: HeatSettings = { start: 100, lossPerSec: 1, coldBelow: 40 }
const rating: RatingSettings = { max: 5, latePenalty: 2, coldPenalty: 1, min: 1, cancelled: 1 }

describe('resultado del turno', () => {
  test('ganaste con 4 estrellas o más', () => {
    expect(outcomeOf(4.6, thresholds)).toBe('win')
  })

  test('pasaste justo entre 3 y 4', () => {
    expect(outcomeOf(3.5, thresholds)).toBe('close')
  })

  test('perdiste con menos de 3', () => {
    expect(outcomeOf(2.4, thresholds)).toBe('lose')
  })

  test('borde: 4,0 ya es ganar', () => {
    expect(outcomeOf(4.0, thresholds)).toBe('win')
    expect(outcomeOf(3.99, thresholds)).toBe('close')
  })

  test('borde: 3,0 todavía es justo', () => {
    expect(outcomeOf(3.0, thresholds)).toBe('close')
    expect(outcomeOf(2.99, thresholds)).toBe('lose')
  })

  test('un turno sin ninguna entrega ni cancelación es perder', () => {
    expect(outcomeOf(undefined, thresholds)).toBe('lose')
  })

  test('los umbrales del juego salen de balance.json', () => {
    expect(outcomeOf(shift.winAtLeast, shift)).toBe('win')
    expect(outcomeOf(shift.loseBelow, shift)).toBe('close')
  })
})

describe('números de la pantalla de resultados', () => {
  const base: Order = {
    id: 'o1',
    number: 1,
    restaurantId: 'r1',
    customer: { x: 1, y: 1 },
    createdAtSec: 0,
    deadlineAtSec: 120,
    status: 'pending',
  }

  test('cuenta entregados, tarde y cancelados, y promedia las estrellas', () => {
    const orders: Order[] = [
      { ...base, status: 'delivered', pickedUpAtSec: 100, deliveredAtSec: 110 }, // 5
      { ...base, status: 'delivered', pickedUpAtSec: 100, deliveredAtSec: 115 }, // 5
      { ...base, status: 'delivered', pickedUpAtSec: 115, deliveredAtSec: 125 }, // 3, tarde
      { ...base, status: 'cancelled', cancelledAtSec: 180 }, // 1
      { ...base, status: 'pickedUp', pickedUpAtSec: 200 }, // sigue en juego: no cuenta
    ]
    expect(summarizeShift(orders, heat, rating, thresholds)).toEqual({
      average: 14 / 4,
      delivered: 3,
      late: 1,
      cancelled: 1,
      outcome: 'close',
    })
  })

  test('sin pedidos terminados no hay promedio y se pierde', () => {
    expect(summarizeShift([base], heat, rating, thresholds)).toEqual({
      average: undefined,
      delivered: 0,
      late: 0,
      cancelled: 0,
      outcome: 'lose',
    })
  })
})
