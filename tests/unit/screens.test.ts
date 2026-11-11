import { describe, expect, test } from 'vitest'
import { prototype } from '../../src/game/balance'
import type { Order } from '../../src/game/orders'
import { averageLost, biggestLoss, starsLost } from '../../src/game/results'
import { useSettingsStore } from '../../src/store/settingsStore'

const { heat, rating } = prototype
const order = (extra: Partial<Order>): Order => ({
  id: 'o',
  number: 1,
  restaurantId: 'r1',
  customer: 0,
  createdAtSec: 0,
  readyAtSec: 20,
  deadlineAtSec: 150,
  status: 'delivered',
  deliveredAtSec: 40,
  ...extra,
})

describe('dónde se fueron las estrellas', () => {
  test('cada causa resta lo suyo, sin bajar del mínimo de una entrega', () => {
    const onTime = order({})
    const late = order({ readyAtSec: 140, deliveredAtSec: 160 })
    const cancelled = order({ status: 'cancelled', deliveredAtSec: undefined })
    expect(starsLost([onTime, late, cancelled], heat, rating)).toEqual({
      late: rating.latePenalty,
      cold: 0,
      cancelled: rating.max - rating.cancelled,
    })
  })

  test('lo perdido, dividido entre los pedidos terminados, es lo que le falta al promedio', () => {
    const lost = averageLost({ late: 2, cold: 0, cancelled: 4 }, 3)
    expect(lost.late + lost.cold + lost.cancelled).toBeCloseTo(2)
    expect(averageLost({ late: 1, cold: 1, cancelled: 1 }, 0)).toEqual({ late: 0, cold: 0, cancelled: 0 })
  })

  test('el consejo habla de lo que más costó; sin pérdidas, felicita', () => {
    expect(biggestLoss({ late: 1, cold: 3, cancelled: 2 })).toBe('cold')
    expect(biggestLoss({ late: 0, cold: 0, cancelled: 0 })).toBe('none')
  })
})

describe('ajustes', () => {
  test('el tamaño de texto solo toma los valores del menú', () => {
    useSettingsStore.getState().setTextScale(1.3)
    expect(useSettingsStore.getState().textScale).toBe(1.3)
    useSettingsStore.getState().setTextScale(2)
    expect(useSettingsStore.getState().textScale).toBe(1.3)
    useSettingsStore.getState().setTextScale(1)
  })
})
