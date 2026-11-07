import { describe, expect, test } from 'vitest'
import { cancelExpired } from '../../src/game/cancellation'
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

  test('el repartidor que lo llevaba queda libre donde está', () => {
    const carrying: Order = { ...pending, status: 'pickedUp', riderId: 'k1', pickedUpAtSec: 150 }
    const busy: Rider = {
      ...idle,
      status: 'toCustomer',
      orderId: 'o1',
      trip: { orderId: 'o1', path: [17, 18], pathMeters: [0, 100], traveledM: 50, kitchenLeftSec: 0, toCustomer: [] },
    }
    const other: Rider = { ...idle, id: 'k2', number: 2 }
    const result = cancelExpired([carrying], [busy, other], 200, CANCEL_AFTER)
    expect(result.orders[0].status).toBe('cancelled')
    expect(result.riders[0]).toMatchObject({ status: 'idle', node: 17 })
    expect(result.riders[0].trip).toBeUndefined()
    expect(result.riders[0].orderId).toBeUndefined()
    expect(result.riders[1]).toBe(other)
  })

  test('los entregados y los ya cancelados no cambian', () => {
    const done: Order = { ...pending, status: 'delivered', deliveredAtSec: 150 }
    const gone: Order = { ...pending, id: 'o2', status: 'cancelled', cancelledAtSec: 180 }
    const orders = [done, gone]
    expect(cancelExpired(orders, [idle], 1000, CANCEL_AFTER).orders).toBe(orders)
  })
})
