import { describe, expect, test } from 'vitest'
import { routing, vehicles } from '../../src/game/balance'
import type { CityMap } from '../../src/game/cityMap'
import { assignOrders } from '../../src/game/dispatch'
import { advanceFleet, startTrip } from '../../src/game/movement'
import type { Order } from '../../src/game/orders'
import { parkingSecOf } from '../../src/game/parking'
import type { Rider } from '../../src/game/riders'
import { createNetwork, vehicleProfile } from '../../src/game/routing'
import { plannedEtas, rankByDelivery, suggestRider } from '../../src/game/stops'
import { FLAG, STREET_KINDS, type StreetGraphFile } from '../../src/game/streetGraph'
import { BLOCK_M, nodeAt, smallCity } from './smallCity'

// Restaurant at (3, 0); the customer 4 blocks south of it, at (3, 4). One block per second.
const map = smallCity([nodeAt(3, 0)])
const NOW = 10
const speeds = { bike: BLOCK_M, motorcycle: BLOCK_M }

const order = (readyInSec: number, deadlineInSec = 100): Order => ({
  id: 'o1',
  number: 1,
  restaurantId: 'r1',
  customer: nodeAt(3, 4),
  createdAtSec: NOW,
  readyAtSec: NOW + readyInSec,
  deadlineAtSec: NOW + deadlineInSec,
  status: 'pending',
})
const rider = (number: number, x: number, y: number, vehicle = 'bike'): Rider => ({
  id: `k${number}`,
  number,
  vehicle,
  node: nodeAt(x, y),
  status: 'idle',
})

/** Plays the trip with the real movement rules and returns when the order reached its customer. */
function deliveredAt(cityMap: CityMap, who: Rider, trip: Order, riderSpeeds: Record<string, number>): number {
  const assigned = assignOrders([trip], [who], [trip.id], who.id)
  if (!assigned.ok) throw new Error(assigned.error)
  let riders: readonly Rider[] = [startTrip(cityMap, assigned.riders[0], assigned.orders)]
  let orders: readonly Order[] = assigned.orders
  const step = 0.05
  for (let now = NOW; now < NOW + 200 && orders[0].status !== 'delivered'; now += step) {
    ;({ riders, orders } = advanceFleet(cityMap, riders, orders, step, now, { metersPerSec: riderSpeeds }))
  }
  return orders[0].deliveredAtSec ?? Infinity
}

describe('llegada estimada al cliente', () => {
  test('la comida ya está lista: viaje al restaurante y después al cliente', () => {
    // 3 cuadras hasta el restaurante y 4 hasta el cliente.
    const [eta] = plannedEtas(map, rider(1, 0, 0), [order(0)], speeds, NOW)
    expect(eta.atSec).toBeCloseTo(NOW + 3 + 4)
  })

  test('la cocina todavía no terminó: el repartidor la espera', () => {
    // Llega en 3 s, pero la comida sale a los 10 s.
    const [eta] = plannedEtas(map, rider(1, 0, 0), [order(10)], speeds, NOW)
    expect(eta.atSec).toBeCloseTo(NOW + 10 + 4)
  })

  test('coincide con lo que pasa de verdad al despacharlo', () => {
    for (const readyIn of [0, 2, 10]) {
      const [eta] = plannedEtas(map, rider(1, 0, 0), [order(readyIn)], speeds, NOW)
      expect(eta.atSec).toBeCloseTo(deliveredAt(map, rider(1, 0, 0), order(readyIn), speeds), 1)
    }
  })

  test('un vehículo que estaciona suma el estacionamiento en el restaurante y en el cliente', () => {
    const park = parkingSecOf('motorcycle')
    expect(park).toBeGreaterThan(0)
    const [eta] = plannedEtas(map, rider(1, 0, 0, 'motorcycle'), [order(0)], speeds, NOW)
    expect(eta.atSec).toBeCloseTo(NOW + 3 + park + 4 + park)
    expect(eta.atSec).toBeCloseTo(deliveredAt(map, rider(1, 0, 0, 'motorcycle'), order(0), speeds), 1)
  })
})

describe('el que no entra en peatonales da la vuelta también hasta el cliente', () => {
  // Restaurante en 0 y cliente en 1: 300 m por la calle (0-3-1) o 100 m cruzando una plaza peatonal (0-2-1).
  const MINOR = STREET_KINDS.indexOf('minor')
  const FOOT = STREET_KINDS.indexOf('foot')
  const ROAD = FLAG.bike | FLAG.car
  const square: StreetGraphFile = {
    attribution: '',
    osmTimestamp: '',
    bbox: [55.68, 12.54, 55.7, 12.56],
    kinds: STREET_KINDS,
    nodes: [
      [12.55, 55.69],
      [12.553, 55.69],
      [12.5515, 55.6905],
      [12.5515, 55.6895],
    ],
    edges: [
      [0, 3, 150, MINOR, ROAD],
      [3, 1, 150, MINOR, ROAD],
      [0, 2, 50, FOOT, FLAG.foot],
      [2, 1, 50, FOOT, FLAG.foot],
    ],
  }
  const network = (vehicle: string) => createNetwork(square, vehicleProfile(vehicle, vehicles[vehicle], routing))
  const plaza: CityMap = {
    network: network('bike'),
    networks: { skateboard: network('skateboard'), e_scooter: network('e_scooter') },
    restaurants: [{ id: 'r1', label: 'A', node: 0 }],
    addresses: [0, 1, 2, 3],
  }
  const atPlaza: Order = { ...order(0), customer: 1 }
  // Los dos a la misma velocidad y parados en la puerta del restaurante.
  const same = { skateboard: 10, e_scooter: 10 }
  const skate: Rider = { id: 'k1', number: 1, vehicle: 'skateboard', node: 0, status: 'idle' }
  const scooter: Rider = { id: 'k2', number: 2, vehicle: 'e_scooter', node: 0, status: 'idle' }

  test('el monopatín tarda los 300 m de la vuelta; la patineta corta por la plaza', () => {
    const [byScooter] = plannedEtas(plaza, scooter, [atPlaza], same, NOW)
    const [bySkate] = plannedEtas(plaza, skate, [atPlaza], same, NOW)
    expect(byScooter.atSec).toBeCloseTo(NOW + 300 / 10)
    expect(bySkate.atSec).toBeLessThan(byScooter.atSec)
  })

  test('el ranking pone primero al que entrega antes, aunque los dos lleguen juntos al restaurante', () => {
    const ranked = rankByDelivery(plaza, [scooter, skate], [atPlaza], same, NOW)
    expect(ranked.map((entry) => entry.rider.vehicle)).toEqual(['skateboard', 'e_scooter'])
    expect(ranked.map((entry) => entry.etaSec)).toEqual([0, 0])
  })
})

describe('ranking por entrega', () => {
  test('ordena a los libres por cuándo entregan y marca los que llegan tarde', () => {
    // El 2 está en la puerta (entrega en 4 s); el 1, a 3 cuadras (7 s). Plazo: 5 s.
    const riders = [rider(1, 0, 0), rider(2, 3, 0), { ...rider(3, 3, 1), status: 'toCustomer' as const }]
    const ranked = rankByDelivery(map, riders, [order(0, 5)], speeds, NOW)
    expect(ranked.map((entry) => entry.rider.number)).toEqual([2, 1])
    expect(ranked.map((entry) => entry.deliverAtSec)).toEqual([NOW + 4, NOW + 7])
    expect(ranked.map((entry) => entry.late)).toEqual([false, true])
  })

  test('con varios pedidos deja afuera a los que no los llevan y espera a que salgan todos', () => {
    const second: Order = { ...order(12), id: 'o2', number: 2, customer: nodeAt(4, 4) }
    const skate = rider(4, 3, 0, 'skateboard')
    const ranked = rankByDelivery(map, [rider(1, 0, 0), skate], [order(0), second], { ...speeds, skateboard: BLOCK_M }, NOW)
    expect(ranked.map((entry) => entry.rider.number)).toEqual([1])
    // La comida del segundo sale a los 12 s; desde ahí, 4 cuadras hasta el primer cliente.
    expect(ranked[0].deliverAtSec).toBeCloseTo(NOW + 12 + 4)
  })

  test('la sugerencia es el primero del ranking por entrega', () => {
    const riders = [rider(1, 0, 0), rider(2, 3, 0)]
    expect(suggestRider(map, riders, order(0), speeds, NOW)?.rider.number).toBe(2)
    expect(suggestRider(map, riders.map((r) => ({ ...r, status: 'toCustomer' as const })), order(0), speeds, NOW)).toBeUndefined()
  })
})
