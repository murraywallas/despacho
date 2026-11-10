import { describe, expect, test } from 'vitest'
import { assignOrder, rankRiders, travelTimeSec } from '../../src/game/dispatch'
import type { Order } from '../../src/game/orders'
import type { Rider } from '../../src/game/riders'
import { BLOCK_M, nodeAt as latticeNode, smallCity } from './smallCity'

// A 10 × 10 lattice of 100 m blocks, the restaurant at crossing (3, 4).
const SIZE = 10
const nodeAt = (x: number, y: number) => latticeNode(x, y, SIZE)
const map = smallCity([nodeAt(3, 4)], SIZE)
/** One block per second, so ETAs read as blocks. */
const BLOCK_PER_SEC = BLOCK_M

const order: Order = {
  id: 'o1',
  number: 1,
  restaurantId: 'r1',
  customer: nodeAt(3, 9),
  readyAtSec: 5,
  createdAtSec: 10,
  deadlineAtSec: 130,
  status: 'pending',
}

function rider(number: number, x: number, y: number, status: Rider['status'] = 'idle'): Rider {
  return { id: `k${number}`, number, vehicle: 'bike', node: nodeAt(x, y), status }
}

describe('ETA', () => {
  test('metros de la ruta hasta el restaurante dividido la velocidad', () => {
    expect(travelTimeSec(map.network, nodeAt(0, 0), nodeAt(3, 4), BLOCK_PER_SEC)).toBe(7)
    expect(travelTimeSec(map.network, nodeAt(0, 0), nodeAt(3, 4), 2 * BLOCK_PER_SEC)).toBe(3.5)
  })

  test('ya en el restaurante: cero', () => {
    expect(travelTimeSec(map.network, nodeAt(3, 4), nodeAt(3, 4), BLOCK_PER_SEC)).toBe(0)
  })

  test('sin ruta posible: infinito', () => {
    expect(travelTimeSec(map.network, nodeAt(0, 0), 999, BLOCK_PER_SEC)).toBe(Infinity)
  })
})

describe('ranking de repartidores', () => {
  test('ordena a los libres por ETA y deja afuera a los ocupados', () => {
    const riders = [rider(1, 9, 9), rider(2, 3, 5), rider(3, 3, 4, 'toRestaurant'), rider(4, 0, 0)]
    const ranked = rankRiders(map, riders, order, { bike: BLOCK_PER_SEC })
    expect(ranked.map((entry) => entry.rider.number)).toEqual([2, 4, 1])
    expect(ranked.map((entry) => entry.etaSec)).toEqual([1, 7, 11])
  })

  test('con la misma ETA va primero el número más bajo', () => {
    const ranked = rankRiders(map, [rider(2, 3, 3), rider(1, 3, 5)], order, { bike: BLOCK_PER_SEC })
    expect(ranked.map((entry) => entry.rider.number)).toEqual([1, 2])
  })
})

describe('asignar un pedido', () => {
  test('el pedido queda asignado y el repartidor va al restaurante', () => {
    const result = assignOrder([order], [rider(1, 0, 0)], 'o1', 'k1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.orders[0]).toMatchObject({ status: 'assigned', riderId: 'k1' })
    expect(result.riders[0]).toMatchObject({ status: 'toRestaurant', orderIds: ['o1'] })
  })

  test('no se puede asignar a un repartidor ocupado', () => {
    expect(assignOrder([order], [rider(1, 0, 0, 'toCustomer')], 'o1', 'k1')).toEqual({
      ok: false,
      error: 'rider-busy',
    })
  })

  test('no se puede asignar un pedido que ya tiene repartidor', () => {
    const assigned: Order = { ...order, status: 'assigned', riderId: 'k2' }
    expect(assignOrder([assigned], [rider(1, 0, 0)], 'o1', 'k1')).toEqual({ ok: false, error: 'order-not-pending' })
  })

  test('falla si el pedido o el repartidor no existen', () => {
    expect(assignOrder([order], [rider(1, 0, 0)], 'o9', 'k1')).toEqual({ ok: false, error: 'order-not-found' })
    expect(assignOrder([order], [rider(1, 0, 0)], 'o1', 'k9')).toEqual({ ok: false, error: 'rider-not-found' })
  })

  test('no cambia los arreglos originales', () => {
    const orders = [order]
    const riders = [rider(1, 0, 0)]
    assignOrder(orders, riders, 'o1', 'k1')
    expect(orders[0].status).toBe('pending')
    expect(riders[0].status).toBe('idle')
  })
})
