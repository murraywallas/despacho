import { describe, expect, test } from 'vitest'
import type { CityMap } from '../../src/game/cityMap'
import { assignOrder, plannedRoute, rankRiders, travelTimeSec } from '../../src/game/dispatch'
import { createGrid } from '../../src/game/grid'
import type { Order } from '../../src/game/orders'
import type { Rider } from '../../src/game/riders'

const map: CityMap = {
  grid: createGrid(10),
  restaurants: [{ id: 'r1', label: 'A', position: { x: 3, y: 4 } }],
}

const order: Order = {
  id: 'o1',
  number: 1,
  restaurantId: 'r1',
  customer: { x: 3, y: 9 },
  readyAtSec: 5,
  createdAtSec: 10,
  deadlineAtSec: 130,
  status: 'pending',
}

function rider(number: number, x: number, y: number, status: Rider['status'] = 'idle'): Rider {
  return { id: `k${number}`, number, vehicle: 'bike', position: { x, y }, status }
}

describe('ETA', () => {
  test('cuadras hasta el restaurante dividido la velocidad', () => {
    expect(travelTimeSec(map, { x: 0, y: 0 }, { x: 3, y: 4 }, 1)).toBe(7)
    expect(travelTimeSec(map, { x: 0, y: 0 }, { x: 3, y: 4 }, 2)).toBe(3.5)
  })

  test('ya en el restaurante: cero', () => {
    expect(travelTimeSec(map, { x: 3, y: 4 }, { x: 3, y: 4 }, 1)).toBe(0)
  })
})

describe('ranking de repartidores', () => {
  test('ordena a los libres por ETA y deja afuera a los ocupados', () => {
    const riders = [rider(1, 9, 9), rider(2, 3, 5), rider(3, 3, 4, 'toRestaurant'), rider(4, 0, 0)]
    const ranked = rankRiders(map, riders, order, 1)
    expect(ranked.map((entry) => entry.rider.number)).toEqual([2, 4, 1])
    expect(ranked.map((entry) => entry.etaSec)).toEqual([1, 7, 11])
  })

  test('con la misma ETA va primero el número más bajo', () => {
    const ranked = rankRiders(map, [rider(2, 3, 3), rider(1, 3, 5)], order, 1)
    expect(ranked.map((entry) => entry.rider.number)).toEqual([1, 2])
  })
})

describe('ruta planeada', () => {
  test('va del repartidor al restaurante y de ahí al cliente, sin repetir el restaurante', () => {
    const route = plannedRoute(map, rider(1, 3, 2), order)
    expect(route[0]).toEqual({ x: 3, y: 2 })
    expect(route).toContainEqual({ x: 3, y: 4 })
    expect(route.at(-1)).toEqual({ x: 3, y: 9 })
    expect(route).toHaveLength(2 + 5 + 1)
  })
})

describe('asignar un pedido', () => {
  test('el pedido queda asignado y el repartidor va al restaurante', () => {
    const result = assignOrder([order], [rider(1, 0, 0)], 'o1', 'k1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.orders[0]).toMatchObject({ status: 'assigned', riderId: 'k1' })
    expect(result.riders[0]).toMatchObject({ status: 'toRestaurant', orderId: 'o1' })
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
