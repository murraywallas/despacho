import { describe, expect, test } from 'vitest'
import { prototype } from '../../src/game/balance'
import type { Order } from '../../src/game/orders'
import { averageRating, heatOf, isCold, ratingOf, type HeatSettings, type RatingSettings } from '../../src/game/rating'

// The values of the GDD, written here so the tests don't move when the balance sheet changes.
const heat: HeatSettings = { start: 100, lossPerSec: 1, coldBelow: 40 }
const rating: RatingSettings = { max: 5, latePenalty: 2, coldPenalty: 1, min: 1, cancelled: 1 }

const base: Order = {
  id: 'o1',
  number: 1,
  restaurantId: 'r1',
  customer: { x: 1, y: 1 },
  createdAtSec: 0,
  deadlineAtSec: 120,
  status: 'pending',
}

/** An order picked up at pickedUpAtSec and delivered at deliveredAtSec. */
function delivered(pickedUpAtSec: number, deliveredAtSec: number): Order {
  return { ...base, status: 'delivered', pickedUpAtSec, deliveredAtSec }
}

describe('temperatura de la comida', () => {
  test('está al máximo hasta que sale del restaurante', () => {
    expect(heatOf({ ...base, status: 'assigned' }, 50, heat)).toBe(100)
  })

  test('baja con cada segundo de viaje al cliente', () => {
    const order: Order = { ...base, status: 'pickedUp', pickedUpAtSec: 30 }
    expect(heatOf(order, 45, heat)).toBe(85)
  })

  test('se congela al entregar y nunca baja de 0', () => {
    expect(heatOf(delivered(0, 20), 500, heat)).toBe(80)
    expect(heatOf({ ...base, status: 'pickedUp', pickedUpAtSec: 0 }, 1000, heat)).toBe(0)
  })

  test('está fría por debajo del umbral', () => {
    expect(isCold(40, heat)).toBe(false)
    expect(isCold(39.9, heat)).toBe(true)
  })
})

describe('estrellas de cada pedido', () => {
  test('a tiempo y caliente = 5', () => {
    expect(ratingOf(delivered(100, 110), heat, rating)).toBe(5)
  })

  test('justo en el plazo todavía es a tiempo', () => {
    expect(ratingOf(delivered(100, 120), heat, rating)).toBe(5)
  })

  test('tarde = 3', () => {
    expect(ratingOf(delivered(115, 125), heat, rating)).toBe(3)
  })

  test('a tiempo pero fría = 4', () => {
    expect(ratingOf(delivered(30, 100), heat, rating)).toBe(4)
  })

  test('tarde y fría = 2', () => {
    expect(ratingOf(delivered(60, 130), heat, rating)).toBe(2)
  })

  test('nunca baja del mínimo', () => {
    expect(ratingOf(delivered(60, 130), heat, { ...rating, latePenalty: 10 })).toBe(1)
  })

  test('cancelado = 1', () => {
    expect(ratingOf({ ...base, status: 'cancelled', cancelledAtSec: 180 }, heat, rating)).toBe(1)
  })

  test('un pedido en juego todavía no tiene estrellas', () => {
    expect(ratingOf({ ...base, status: 'pickedUp', pickedUpAtSec: 10 }, heat, rating)).toBeUndefined()
  })
})

describe('promedio del turno', () => {
  test('promedia las entregas y los cancelados, sin contar los que siguen en juego', () => {
    const orders: Order[] = [
      delivered(100, 110), // 5
      delivered(115, 125), // 3
      delivered(60, 130), // 2
      { ...base, status: 'cancelled', cancelledAtSec: 180 }, // 1
      { ...base, status: 'pending' },
    ]
    expect(averageRating(orders, heat, rating)).toBe(11 / 4)
  })

  test('sin pedidos terminados no hay promedio', () => {
    expect(averageRating([base], heat, rating)).toBeUndefined()
  })

  test('los números del prototipo salen de balance.json', () => {
    expect(ratingOf(delivered(100, 110), prototype.heat, prototype.rating)).toBe(prototype.rating.max)
    expect(ratingOf({ ...base, status: 'cancelled' }, prototype.heat, prototype.rating)).toBe(prototype.rating.cancelled)
  })
})
