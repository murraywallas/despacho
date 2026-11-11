import { describe, expect, test } from 'vitest'
import { clock, routing, vehicles } from '../../src/game/balance'
import { capacityOf, riderTimeSec } from '../../src/game/dispatch'
import { advanceRider, startTrip } from '../../src/game/movement'
import type { Order } from '../../src/game/orders'
import { parkingSecOf } from '../../src/game/parking'
import type { Rider } from '../../src/game/riders'
import { createNetwork, findRoute, vehicleProfile } from '../../src/game/routing'
import { metersPerSecOf } from '../../src/game/shift'
import { stopEtas } from '../../src/game/stops'
import { FLAG, STREET_KINDS, type StreetGraphFile } from '../../src/game/streetGraph'
import { nodeAt, smallCity } from './smallCity'

const MINOR = STREET_KINDS.indexOf('minor')
const CYCLEWAY = STREET_KINDS.indexOf('cycleway')
const FOOT = STREET_KINDS.indexOf('foot')
const ROAD = FLAG.bike | FLAG.car

function streets(edges: StreetGraphFile['edges']): StreetGraphFile {
  return {
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
    edges,
  }
}
const network = (vehicle: string, graph: StreetGraphFile) => createNetwork(graph, vehicleProfile(vehicle, vehicles[vehicle], routing))

describe('moto y rollers, con los números de la hoja Vehículos', () => {
  test('la moto va por las calles de autos: ni ciclovías ni peatonales', () => {
    // From 0 to 1: a cycleway (0-2-1), a pedestrian way (0-3-1) and no street for cars.
    const noRoad = streets([
      [0, 2, 50, CYCLEWAY, FLAG.bike | FLAG.cycleTrack],
      [2, 1, 50, CYCLEWAY, FLAG.bike | FLAG.cycleTrack],
      [0, 3, 50, FOOT, FLAG.foot],
      [3, 1, 50, FOOT, FLAG.foot],
    ])
    expect(vehicles.motorcycle.roads).toBe('car')
    expect(findRoute(network('motorcycle', noRoad), 0, 1)).toBeUndefined()
    expect(findRoute(network('bike', noRoad), 0, 1)).toBeDefined()
    // With a street, it takes it.
    const withRoad = streets([...noRoad.edges, [0, 1, 300, MINOR, ROAD]])
    expect(findRoute(network('motorcycle', withRoad), 0, 1)?.nodes).toEqual([0, 1])
  })

  test('los rollers van a la mitad en adoquines', () => {
    const onlyCobbles = streets([[0, 1, 100, MINOR, ROAD | FLAG.cobblestone]])
    const route = findRoute(network('rollers', onlyCobbles), 0, 1)
    expect(route?.effectiveM).toBeCloseTo(100 / (1 + (vehicles.rollers.cobblestoneSpeedPct ?? 0)))
    expect(vehicles.rollers.cobblestoneSpeedPct).toBe(-0.5)
  })

  test('velocidad, capacidad y estacionamiento salen de la planilla', () => {
    expect(capacityOf('motorcycle')).toBe(vehicles.motorcycle.capacity)
    expect(capacityOf('rollers')).toBe(vehicles.rollers.capacity)
    expect(parkingSecOf('motorcycle')).toBe(((vehicles.motorcycle.parkingMin ?? 0) * 60) / clock.gameSecondsPerRealSecond)
    expect(parkingSecOf('rollers')).toBe(0)
    expect(parkingSecOf('bike')).toBe(0)
  })
})

/** A rider of that vehicle takes the orders at a restaurant; returns when each one is delivered. */
function rideAndDeliver(vehicle: string, restaurant: number, customers: number[], size: number) {
  const map = smallCity([restaurant], size)
  const orders: Order[] = customers.map((customer, index) => ({
    id: `o${index + 1}`,
    number: index + 1,
    restaurantId: 'r1',
    customer,
    createdAtSec: 0,
    readyAtSec: 0,
    deadlineAtSec: 9999,
    status: 'assigned',
    riderId: 'k1',
  }))
  const settings = { metersPerSec: { [vehicle]: metersPerSecOf(vehicle) } }
  let rider: Rider = { id: 'k1', number: 1, vehicle, node: restaurant, status: 'toRestaurant', orderIds: orders.map((order) => order.id) }
  rider = startTrip(map, rider, orders)
  const predicted = stopEtas(map, rider, orders, settings.metersPerSec, 0)
  const delivered: number[] = []
  let now = 0
  let left = [...orders]
  while (rider.trip && now < 1000) {
    const step = advanceRider(map, rider, left, 0.25, now, settings)
    for (const { orderId, atSec } of step.delivered) {
      delivered.push(atSec)
      left = left.filter((order) => order.id !== orderId)
    }
    rider = step.rider
    now += 0.25
  }
  return { delivered, predicted: predicted.map((eta) => eta.atSec), last: delivered[delivered.length - 1] }
}

describe('tiempo de estacionar', () => {
  test('la moto suma estacionar en el restaurante y en cada cliente, en el viaje y en la ETA', () => {
    const moto = rideAndDeliver('motorcycle', nodeAt(0, 0), [nodeAt(4, 0), nodeAt(4, 4)], 5)
    expect(moto.delivered).toHaveLength(2)
    moto.delivered.forEach((atSec, index) => expect(atSec).toBeCloseTo(moto.predicted[index], 0))
    // Estacionó tres veces: restaurante, cliente 1 y cliente 2.
    const map = smallCity([nodeAt(0, 0)], 5)
    const rideSec = (400 + 400) / metersPerSecOf('motorcycle')
    expect(moto.last).toBeCloseTo(rideSec + 3 * parkingSecOf('motorcycle'), 0)
    // La ETA al restaurante del ranking también cuenta estacionar.
    const rider: Rider = { id: 'k1', number: 1, vehicle: 'motorcycle', node: nodeAt(0, 4), status: 'idle' }
    const speeds = { motorcycle: metersPerSecOf('motorcycle') }
    expect(riderTimeSec(map, rider, nodeAt(0, 0), speeds)).toBeCloseTo(400 / speeds.motorcycle + parkingSecOf('motorcycle'))
  })

  test('en un viaje largo la moto llega antes que la bici; en uno corto con dos paradas, no', () => {
    const size = 21
    const far = [nodeAt(20, 20, size)]
    expect(rideAndDeliver('motorcycle', nodeAt(0, 0), far, size).last).toBeLessThan(rideAndDeliver('bike', nodeAt(0, 0), far, size).last)
    const near = [nodeAt(1, 0, size), nodeAt(1, 1, size)]
    expect(rideAndDeliver('motorcycle', nodeAt(0, 0), near, size).last).toBeGreaterThan(
      rideAndDeliver('bike', nodeAt(0, 0), near, size).last,
    )
  })
})
