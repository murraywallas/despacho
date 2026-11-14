import { describe, expect, test } from 'vitest'
import { balanceFor, createLevelShift } from '../../src/game/levels'
import { closedLines, closedStretches, legIsClosed } from '../../src/game/closures'
import { networkFor, type CityMap } from '../../src/game/cityMap'
import { CLOSURES, streetsOf } from '../../src/game/neighborhoods'
import type { Order } from '../../src/game/orders'
import { cumulativeMeters, findRoute, stretchKey } from '../../src/game/routing'
import { startTrip } from '../../src/game/movement'
import { advanceShift, mapAt, shiftSettingsFrom, type ShiftSnapshot } from '../../src/game/shift'
import type { Rider } from '../../src/game/riders'

const LEVEL = 'dinner'
const settings = shiftSettingsFrom(balanceFor(LEVEL))
const marathon = settings.events.find((event) => event.event === 'marathon')!
const closed = closedStretches(streetsOf('norrebro'), CLOSURES.norrebrogade)

const usesClosed = (nodes: readonly number[]) => nodes.some((node, i) => i > 0 && closed.has(stretchKey(nodes[i - 1], node)))
const touchesClosed = (map: CityMap, node: number) => {
  let touches = false
  networkFor(map, 'bike').graph.forEachLinkedNode(node, (other) => {
    if (closed.has(stretchKey(node, other.id as number))) touches = true
  })
  return touches
}

/** Pairs of addresses whose usual bike route goes along Nørrebrogade. */
function crossingPairs(map: CityMap): [number, number][] {
  const pairs: [number, number][] = []
  const addresses = map.addresses
  for (let i = 0; i < addresses.length && pairs.length < 12; i += 7) {
    for (let j = addresses.length - 1; j > i && pairs.length < 12; j -= 11) {
      const route = findRoute(networkFor(map, 'bike'), addresses[i], addresses[j])
      if (route && usesClosed(route.nodes)) pairs.push([addresses[i], addresses[j]])
    }
  }
  return pairs
}

describe('maratón: calles cortadas', () => {
  test('el recorrido sale de data/closures.json y corta Nørrebrogade', () => {
    expect(marathon).toMatchObject({ closure: 'norrebrogade', announced: true })
    expect(closed.size).toBeGreaterThan(20)
    expect(closedLines(streetsOf('norrebro'), closed)).toHaveLength(closed.size)
  })

  test('ninguna ruta usa una calle cortada mientras dura el maratón; al terminar se vuelven a usar', () => {
    const { map } = createLevelShift(LEVEL).shift
    const pairs = crossingPairs(map)
    expect(pairs.length).toBeGreaterThan(3)
    const during = mapAt(map, settings, marathon.fromSec + 1)
    const after = mapAt(during, settings, marathon.toSec)
    for (const vehicle of ['bike', 'skateboard', 'e_scooter']) {
      for (const [from, to] of pairs) {
        if (touchesClosed(map, from) || touchesClosed(map, to)) continue
        const detour = findRoute(networkFor(during, vehicle), from, to)
        expect(detour).toBeDefined()
        expect(usesClosed(detour!.nodes)).toBe(false)
      }
    }
    expect(after).toBe(map)
    expect(pairs.some(([from, to]) => usesClosed(findRoute(networkFor(after, 'bike'), from, to)!.nodes))).toBe(true)
  })

  test('alguien que vive sobre el recorrido igual recibe su pedido: la última parte se hace a pie', () => {
    const { map } = createLevelShift(LEVEL).shift
    const during = mapAt(map, settings, marathon.fromSec + 1)
    const onRoute = map.addresses.find((node) => touchesClosed(map, node))
    expect(onRoute).toBeDefined()
    expect(findRoute(networkFor(during, 'bike'), map.addresses[0], onRoute!)).toBeDefined()
  })

  test('un repartidor que iba por el recorrido cambia de ruta cuando empieza el corte, sin perder el pedido', () => {
    const { shift } = createLevelShift(LEVEL)
    const [from, to] = crossingPairs(shift.map)[0]
    const restaurant = shift.map.restaurants[0]
    const order: Order = {
      id: 'o1',
      number: 1,
      restaurantId: restaurant.id,
      customer: to,
      createdAtSec: 0,
      readyAtSec: 0,
      deadlineAtSec: 10_000,
      status: 'pickedUp',
      riderId: 'k1',
      pickedUpAtSec: 0,
    }
    const bike = shift.riders.find((rider) => rider.vehicle === 'bike')!
    // On the way to the customer, on a leg that goes along Nørrebrogade.
    const going: Rider = { ...startTrip(shift.map, { ...bike, node: from, status: 'toCustomer', orderIds: ['o1'] }, [order]), status: 'toCustomer' }
    const leg = findRoute(networkFor(shift.map, 'bike'), from, to)!
    const onTheWay: Rider = {
      ...going,
      trip: { path: leg.nodes, pathMeters: cumulativeMeters(networkFor(shift.map, 'bike'), leg.nodes), traveledM: 0, kitchenLeftSec: 0 },
    }
    expect(legIsClosed(onTheWay, closed)).toBe(true)
    const before: ShiftSnapshot = {
      ...shift,
      clock: { ...shift.clock, elapsedSec: marathon.fromSec - 0.1 },
      riders: shift.riders.map((rider) => (rider.id === bike.id ? onTheWay : rider)),
      orderQueue: { ...shift.orderQueue, orders: [order], nextSpawnAtSec: 1e9 },
    }
    // First step: the marathon hasn't started. Second: it has, and the rider finds another way.
    const started = advanceShift(advanceShift(before, 0.2, () => 0.5, settings), 0.2, () => 0.5, settings)
    const after = started.riders.find((rider) => rider.id === bike.id)!
    expect(after.orderIds).toEqual(['o1'])
    expect(after.status).toBe('toCustomer')
    expect(after.trip!.path[after.trip!.path.length - 1]).toBe(to)
    expect(legIsClosed(after, closed)).toBe(false)
  })
})
