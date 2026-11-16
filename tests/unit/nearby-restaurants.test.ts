import { describe, expect, test } from 'vitest'
import { tripMeters } from '../../src/game/battery'
import { assignOrders } from '../../src/game/dispatch'
import { advanceFleet, startTrip, upcomingLegs, type MovementSettings } from '../../src/game/movement'
import type { Order } from '../../src/game/orders'
import { canShareTrip, pickupsOf } from '../../src/game/pickups'
import type { Rider } from '../../src/game/riders'
import { stopEtas } from '../../src/game/stops'
import { BLOCK_M, nodeAt, smallCity } from './smallCity'

// Restaurant A 2 blocks east of the rider, B 2 more blocks east (200 m apart), C far away in the south-west corner.
// One block per second. #1 (A) is ready 1 s after dispatch, #2 (B) after 6 s.
const map = smallCity([nodeAt(2, 0), nodeAt(4, 0), nodeAt(0, 4)])
const settings: MovementSettings = { metersPerSec: { bike: BLOCK_M } }
const START = 10
const NEARBY_M = 300

const order = (id: string, restaurantId: string, customer: number, readyAtSec: number): Order => ({
  id,
  number: Number(id.slice(1)),
  restaurantId,
  customer,
  createdAtSec: START,
  readyAtSec,
  deadlineAtSec: START + 120,
  status: 'pending',
})
const fromA = order('o1', 'r1', nodeAt(2, 4), START + 1)
const fromB = order('o2', 'r2', nodeAt(4, 4), START + 6)
const fromC = order('o3', 'r3', nodeAt(1, 4), START + 1)
const rider: Rider = { id: 'k1', number: 1, vehicle: 'bike', node: nodeAt(0, 0), status: 'idle' }
const nearby = (trip: readonly Order[]) => canShareTrip(map, trip, NEARBY_M)

function dispatched() {
  const result = assignOrders([fromA, fromB], [rider], ['o1', 'o2'], 'k1', 2, nearby)
  if (!result.ok) throw new Error(result.error)
  return { riders: [startTrip(map, result.riders[0], result.orders)] as readonly Rider[], orders: result.orders as readonly Order[] }
}

function run(seconds: number) {
  let { riders, orders } = dispatched()
  let now = START
  const step = 0.1
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += step) {
    ;({ riders, orders } = advanceFleet(map, riders, orders, step, now, settings))
    now += step
  }
  return { rider: riders[0], byId: (id: string) => orders.find((o) => o.id === id) as Order }
}

describe('restaurantes cercanos en un mismo viaje', () => {
  test('dos restaurantes a 200 m comparten viaje; uno lejano, no', () => {
    expect(canShareTrip(map, [fromA, fromB], NEARBY_M)).toBe(true)
    expect(canShareTrip(map, [fromA, fromC], NEARBY_M)).toBe(false)
    // Todos contra todos: B queda cerca de A, pero C no queda cerca de ninguno.
    expect(canShareTrip(map, [fromA, fromB, fromC], NEARBY_M)).toBe(false)
    expect(canShareTrip(map, [fromA, fromB], 0)).toBe(false)
    expect(assignOrders([fromA, fromC], [rider], ['o1', 'o3'], 'k1', 2, nearby)).toEqual({ ok: false, error: 'restaurants-too-far' })
  })

  test('los restaurantes se visitan en el orden en que aparecen sus pedidos, una vez cada uno', () => {
    const another = order('o4', 'r1', nodeAt(3, 3), START + 2)
    const pickups = pickupsOf(map, [fromB, fromA, another])
    expect(pickups.map((pickup) => pickup.restaurant.id)).toEqual(['r2', 'r1'])
    expect(pickups[1].orders.map((o) => o.id)).toEqual(['o1', 'o4'])
    expect(pickups[1].readyAtSec).toBe(START + 2)
    // Lo que ya está a bordo no se vuelve a buscar.
    expect(pickupsOf(map, [{ ...fromB, status: 'pickedUp' }, fromA]).map((pickup) => pickup.restaurant.id)).toEqual(['r1'])
  })

  test('retira en A, sigue a B, espera su cocina y recién después reparte', () => {
    const atB = run(5)
    expect(atB.byId('o1')).toMatchObject({ status: 'pickedUp', pickedUpAtSec: expect.closeTo(START + 2) })
    expect(atB.byId('o2').status).toBe('assigned')
    expect(atB.rider.status).toBe('atKitchen')
    expect(atB.rider.node).toBe(nodeAt(4, 0))

    // B a los 2 + 2 = 4 s, su pedido listo a los 6; de B al cliente de #1, 6 cuadras; de ahí al de #2, 2 más.
    const done = run(15)
    expect(done.byId('o2').pickedUpAtSec).toBeCloseTo(START + 6)
    expect(done.byId('o1').deliveredAtSec).toBeCloseTo(START + 12)
    expect(done.byId('o2').deliveredAtSec).toBeCloseTo(START + 14)
    expect(done.rider.status).toBe('idle')
  })

  test('las ETAs, el recorrido dibujado y la batería cuentan los dos restaurantes', () => {
    const { riders, orders } = dispatched()
    const etas = stopEtas(map, riders[0], orders, settings.metersPerSec, START)
    expect(etas.map((eta) => eta.atSec)).toEqual([expect.closeTo(START + 12), expect.closeTo(START + 14)])
    // A, de A a B, de B al primer cliente, y al segundo.
    const legs = upcomingLegs(map, riders[0], orders)
    expect(legs.map((nodes) => nodes.at(-1))).toEqual([nodeAt(2, 0), nodeAt(4, 0), nodeAt(2, 4), nodeAt(4, 4)])
    expect(tripMeters(map, rider, [fromA, fromB])).toBeCloseTo(12 * BLOCK_M)

    // Ya en la cocina de B: lo que falta se calcula igual.
    const atB = run(5)
    const later = stopEtas(map, atB.rider, [atB.byId('o1'), atB.byId('o2')], settings.metersPerSec, START + 5)
    expect(later.map((eta) => eta.atSec)).toEqual([expect.closeTo(START + 12), expect.closeTo(START + 14)])
  })
})
