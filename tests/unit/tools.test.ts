import { describe, expect, test } from 'vitest'
import { prototype } from '../../src/game/balance'
import type { Order } from '../../src/game/orders'
import type { Rider } from '../../src/game/riders'
import { callCustomer, reassignOrder } from '../../src/game/tools'

const PENALTY = 15
const order = (id: string, status: Order['status'], riderId?: string): Order => ({
  id,
  number: Number(id.slice(1)),
  restaurantId: 'r1',
  customer: 24,
  createdAtSec: 0,
  readyAtSec: 20,
  deadlineAtSec: 150,
  status,
  ...(riderId ? { riderId } : {}),
})
const trip = { path: [0, 1], pathMeters: [0, 100], traveledM: 30, kitchenLeftSec: 0 }
const going: Rider = { id: 'k1', number: 1, vehicle: 'bike', node: 0, status: 'toRestaurant', orderIds: ['o1'], trip }
const free: Rider = { id: 'k2', number: 2, vehicle: 'bike', node: 5, status: 'idle' }

describe('reasignar un pedido', () => {
  test('pasa al otro repartidor, pierde tiempo de plazo y el primero queda libre', () => {
    const result = reassignOrder([order('o1', 'assigned', 'k1')], [going, free], 'o1', 'k2', PENALTY, 10)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.orders[0]).toMatchObject({ status: 'assigned', riderId: 'k2', deadlineAtSec: 150 - PENALTY })
    expect(result.riders[0]).toMatchObject({ status: 'idle' })
    expect(result.riders[0].trip).toBeUndefined()
    expect(result.riders[1]).toMatchObject({ status: 'toRestaurant', orderIds: ['o1'] })
  })

  test('si el primero llevaba otro pedido, sigue con ese', () => {
    const both: Rider = { ...going, orderIds: ['o1', 'o2'] }
    const orders = [order('o1', 'assigned', 'k1'), order('o2', 'assigned', 'k1')]
    const result = reassignOrder(orders, [both, free], 'o1', 'k2', PENALTY, 10, 2)
    expect(result.ok && result.riders[0]).toMatchObject({ status: 'toRestaurant', orderIds: ['o2'] })
  })

  test('en la cocina, el primero espera solo por los pedidos que le quedan', () => {
    const waiting: Rider = { ...going, status: 'atKitchen', orderIds: ['o1', 'o2'], trip: { ...trip, kitchenLeftSec: 30 } }
    const late = { ...order('o1', 'assigned', 'k1'), readyAtSec: 40 }
    const soon = { ...order('o2', 'assigned', 'k1'), readyAtSec: 15 }
    const result = reassignOrder([late, soon], [waiting, free], 'o1', 'k2', PENALTY, 10, 2)
    expect(result.ok && result.riders[0].trip?.kitchenLeftSec).toBe(5)
  })

  test('no se puede: con la comida ya en camino, sin asignar, al mismo repartidor o a uno ocupado', () => {
    expect(reassignOrder([order('o1', 'pickedUp', 'k1')], [going, free], 'o1', 'k2', PENALTY, 10)).toEqual({
      ok: false,
      error: 'order-not-assigned',
    })
    expect(reassignOrder([order('o1', 'pending')], [going, free], 'o1', 'k2', PENALTY, 10)).toEqual({
      ok: false,
      error: 'order-not-assigned',
    })
    expect(reassignOrder([order('o1', 'assigned', 'k1')], [going, free], 'o1', 'k1', PENALTY, 10)).toEqual({
      ok: false,
      error: 'same-rider',
    })
    const busy: Rider = { ...free, status: 'toCustomer', orderIds: ['o9'], trip }
    expect(reassignOrder([order('o1', 'assigned', 'k1')], [going, busy], 'o1', 'k2', PENALTY, 10)).toEqual({
      ok: false,
      error: 'rider-busy',
    })
  })
})

describe('llamar al cliente', () => {
  test('suma tiempo al plazo y deja el pedido marcado', () => {
    const [called] = callCustomer([order('o1', 'pickedUp', 'k1')], 'o1', 30)
    expect(called).toMatchObject({ deadlineAtSec: 180, called: true })
  })

  test('un pedido entregado o cancelado no se puede llamar', () => {
    const orders = [order('o1', 'delivered'), order('o2', 'cancelled')]
    expect(callCustomer(orders, 'o1', 30)).toBe(orders)
    expect(callCustomer(orders, 'o2', 30)).toBe(orders)
  })

  test('los números salen de la planilla', () => {
    expect(prototype.tools.callsPerShift).toBeGreaterThanOrEqual(1)
    expect(prototype.tools.callExtendSec).toBeGreaterThan(0)
    expect(prototype.tools.reassignPenaltySec).toBeGreaterThan(0)
  })
})
