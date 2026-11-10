import { describe, expect, test } from 'vitest'
import { cancelExpired } from '../../src/game/cancellation'
import { assignOrders } from '../../src/game/dispatch'
import { advanceFleet, reorderStops, startTrip, type MovementSettings } from '../../src/game/movement'
import type { Order } from '../../src/game/orders'
import type { Rider } from '../../src/game/riders'
import { stopEtas } from '../../src/game/stops'
import { BLOCK_M, nodeAt, smallCity } from './smallCity'

// Restaurant 3 blocks east of the rider. Customer of #1: 4 blocks south of it; customer of #2: one more block east.
// One block per second. #1 is ready 5 s after dispatch, #2 after 8 s.
const map = smallCity([nodeAt(3, 0), nodeAt(0, 4)])
const settings: MovementSettings = { metersPerSec: { bike: BLOCK_M } }
const START = 10

const order = (id: string, number: number, customer: number, readyAtSec: number, restaurantId = 'r1'): Order => ({
  id,
  number,
  restaurantId,
  customer,
  createdAtSec: START,
  readyAtSec,
  deadlineAtSec: START + 120,
  status: 'pending',
})
const first = order('o1', 1, nodeAt(3, 4), START + 5)
const second = order('o2', 2, nodeAt(4, 4), START + 8)
const rider: Rider = { id: 'k1', number: 1, vehicle: 'bike', node: nodeAt(0, 0), status: 'idle' }

function dispatched(ids = ['o1', 'o2'], orders: Order[] = [first, second]) {
  const result = assignOrders(orders, [rider], ids, 'k1', 2)
  if (!result.ok) throw new Error(result.error)
  return { riders: [startTrip(map, result.riders[0], result.orders)] as readonly Rider[], orders: result.orders as readonly Order[] }
}

function run(seconds: number, start = dispatched(), change?: { atSec: number; apply: (r: Rider) => Rider }) {
  let { riders, orders } = start
  let now = START
  const step = 0.1
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += step) {
    if (change && Math.abs(now - (START + change.atSec)) < step / 2) riders = riders.map(change.apply)
    ;({ riders, orders } = advanceFleet(map, riders, orders, step, now, settings))
    now += step
  }
  return { rider: riders[0], orders, byId: (id: string) => orders.find((o) => o.id === id) as Order }
}

describe('armar un viaje con varios pedidos', () => {
  test('dos pedidos del mismo restaurante van juntos, en el orden elegido', () => {
    const { riders, orders } = dispatched()
    expect(riders[0]).toMatchObject({ status: 'toRestaurant', orderIds: ['o1', 'o2'] })
    expect(orders.every((o) => o.status === 'assigned' && o.riderId === 'k1')).toBe(true)
  })

  test('no entran más pedidos que la capacidad del vehículo', () => {
    const third = order('o3', 3, nodeAt(2, 4), START + 5)
    expect(assignOrders([first, second, third], [rider], ['o1', 'o2', 'o3'], 'k1', 2)).toEqual({ ok: false, error: 'over-capacity' })
    expect(assignOrders([first, second], [rider], ['o1', 'o2'], 'k1', 1)).toEqual({ ok: false, error: 'over-capacity' })
  })

  test('no se mezclan restaurantes', () => {
    const other = order('o3', 3, nodeAt(2, 4), START + 5, 'r2')
    expect(assignOrders([first, other], [rider], ['o1', 'o3'], 'k1', 2)).toEqual({ ok: false, error: 'different-restaurants' })
  })
})

describe('el viaje', () => {
  test('espera en la cocina hasta que están listos los dos y los retira juntos', () => {
    const atKitchen = run(6)
    expect(atKitchen.rider.status).toBe('atKitchen')
    expect(atKitchen.rider.trip?.kitchenLeftSec).toBeCloseTo(2)
    const out = run(8.5)
    expect(out.byId('o1')).toMatchObject({ status: 'pickedUp', pickedUpAtSec: expect.closeTo(START + 8) })
    expect(out.byId('o2')).toMatchObject({ status: 'pickedUp', pickedUpAtSec: expect.closeTo(START + 8) })
  })

  test('entrega en orden: el primero a los 3 + 5 + 4 = 12 s, el segundo una cuadra después', () => {
    const { rider: done, byId } = run(14)
    expect(byId('o1').deliveredAtSec).toBeCloseTo(START + 12)
    expect(byId('o2').deliveredAtSec).toBeCloseTo(START + 13)
    expect(done).toMatchObject({ status: 'idle', node: nodeAt(4, 4) })
    expect(done.orderIds).toBeUndefined()
  })

  test('entre una entrega y otra le queda solo el pedido que falta', () => {
    const { rider: between, byId } = run(12.5)
    expect(byId('o1').status).toBe('delivered')
    expect(between).toMatchObject({ status: 'toCustomer', orderIds: ['o2'] })
  })
})

describe('cambiar el orden de las paradas', () => {
  test('con la comida en camino, el nuevo primero se entrega primero', () => {
    const swap = { atSec: 9, apply: (r: Rider) => reorderStops(r, ['o2', 'o1']) }
    const { byId } = run(20, dispatched(), swap)
    expect(byId('o2').deliveredAtSec).toBeLessThan(byId('o1').deliveredAtSec ?? Infinity)
  })

  test('un orden que no es el de sus pedidos no cambia nada', () => {
    const { riders } = dispatched()
    expect(reorderStops(riders[0], ['o1'])).toBe(riders[0])
    expect(reorderStops(riders[0], ['o1', 'o9'])).toBe(riders[0])
  })
})

describe('ETA de cada parada', () => {
  test('coincide con lo que pasa de verdad', () => {
    const start = dispatched()
    const etas = stopEtas(map, start.riders[0], start.orders, settings.metersPerSec, START)
    expect(etas.map((eta) => eta.orderId)).toEqual(['o1', 'o2'])
    const { byId } = run(14)
    expect(etas[0].atSec).toBeCloseTo(byId('o1').deliveredAtSec ?? 0)
    expect(etas[1].atSec).toBeCloseTo(byId('o2').deliveredAtSec ?? 0)
  })

  test('el último cliente espera más', () => {
    const start = dispatched()
    const [a, b] = stopEtas(map, start.riders[0], start.orders, settings.metersPerSec, START)
    expect(b.atSec).toBeGreaterThan(a.atSec)
  })
})

describe('si se cancela un pedido del viaje', () => {
  test('cancelando uno de dos con el reloj real, sigue entregando el que queda', () => {
    const start = dispatched()
    const withExpired = start.orders.map((o) => (o.id === 'o1' ? { ...o, deadlineAtSec: START + 1 } : o))
    const cancelled = cancelExpired(withExpired, start.riders, START + 2, 0)
    expect(cancelled.riders[0].orderIds).toEqual(['o2'])
    const { byId } = run(20, cancelled)
    expect(byId('o2').status).toBe('delivered')
  })
})
