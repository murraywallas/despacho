import { describe, expect, test } from 'vitest'
import { cancelExpired, closeShift, hasFoodOnTheWay } from '../../src/game/cancellation'
import type { Order } from '../../src/game/orders'
import type { Rider } from '../../src/game/riders'

const CANCEL_AFTER = 60

const pending: Order = {
  id: 'o1',
  number: 1,
  restaurantId: 'r1',
  customer: 24,
  createdAtSec: 0,
  readyAtSec: 5,
  deadlineAtSec: 120,
  status: 'pending',
}
const idle: Rider = { id: 'k1', number: 1, vehicle: 'bike', node: 17, status: 'idle' }

describe('cancelación de pedidos vencidos', () => {
  test('antes del margen no pasa nada y devuelve los mismos arreglos', () => {
    const orders = [pending]
    const riders = [idle]
    const result = cancelExpired(orders, riders, 179.9, CANCEL_AFTER)
    expect(result.orders).toBe(orders)
    expect(result.riders).toBe(riders)
  })

  test('un pedido sin entregar se cancela al pasar plazo + margen', () => {
    const { orders } = cancelExpired([pending], [idle], 180, CANCEL_AFTER)
    expect(orders[0]).toMatchObject({ status: 'cancelled', cancelledAtSec: 180 })
  })

  test('asignado pero sin recoger: se cancela y el repartidor queda libre donde está', () => {
    const assigned: Order = { ...pending, status: 'assigned', riderId: 'k1' }
    const busy: Rider = {
      ...idle,
      status: 'toRestaurant',
      orderIds: ['o1'],
      trip: { path: [17, 18], pathMeters: [0, 100], traveledM: 50, kitchenLeftSec: 0 },
    }
    const other: Rider = { ...idle, id: 'k2', number: 2 }
    const result = cancelExpired([assigned], [busy, other], 200, CANCEL_AFTER)
    expect(result.orders[0].status).toBe('cancelled')
    expect(result.riders[0]).toMatchObject({ status: 'idle', node: 17 })
    expect(result.riders[0].trip).toBeUndefined()
    expect(result.riders[0].orderIds).toBeUndefined()
    expect(result.riders[1]).toBe(other)
  })

  test('la comida ya recogida no se cancela nunca: llega tarde, y cuenta como tarde', () => {
    const carrying: Order = { ...pending, status: 'pickedUp', riderId: 'k1', pickedUpAtSec: 150 }
    const busy: Rider = { ...idle, status: 'toCustomer', orderIds: ['o1'] }
    const orders = [carrying]
    const riders = [busy]
    // Mucho después del plazo + el margen.
    const result = cancelExpired(orders, riders, 1000, CANCEL_AFTER)
    expect(result.orders).toBe(orders)
    expect(result.riders).toBe(riders)
  })

  test('los entregados y los ya cancelados no cambian', () => {
    const done: Order = { ...pending, status: 'delivered', deliveredAtSec: 150 }
    const gone: Order = { ...pending, id: 'o2', status: 'cancelled', cancelledAtSec: 180 }
    const orders = [done, gone]
    expect(cancelExpired(orders, [idle], 1000, CANCEL_AFTER).orders).toBe(orders)
  })
})

describe('cierre del turno', () => {
  test('al cierre se cancela lo que nadie recogió; la comida en camino sigue', () => {
    const assigned: Order = { ...pending, id: 'o2', status: 'assigned', riderId: 'k1' }
    const toRestaurant: Rider = { ...idle, status: 'toRestaurant', orderIds: ['o2'] }
    const carrying: Order = { ...pending, id: 'o3', status: 'pickedUp', riderId: 'k2', pickedUpAtSec: 150 }
    const toCustomer: Rider = { ...idle, id: 'k2', number: 2, status: 'toCustomer', orderIds: ['o3'] }
    const done: Order = { ...pending, id: 'o4', status: 'delivered', deliveredAtSec: 100 }
    const result = closeShift([pending, assigned, carrying, done], [toRestaurant, toCustomer], 300)
    expect(result.orders.map((order) => [order.id, order.status, order.cancelledAtSec])).toEqual([
      ['o1', 'cancelled', 300],
      ['o2', 'cancelled', 300],
      ['o3', 'pickedUp', undefined],
      ['o4', 'delivered', undefined],
    ])
    expect(result.riders[0]).toMatchObject({ status: 'idle' })
    expect(result.riders[1]).toBe(toCustomer)
    expect(hasFoodOnTheWay(result.orders)).toBe(true)
  })

  test('si todo estaba entregado o cancelado, devuelve los mismos arreglos', () => {
    const orders = [{ ...pending, status: 'delivered' as const, deliveredAtSec: 100 }]
    const riders = [idle]
    const result = closeShift(orders, riders, 300)
    expect(result.orders).toBe(orders)
    expect(result.riders).toBe(riders)
  })
})
