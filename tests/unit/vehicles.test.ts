import { describe, expect, test } from 'vitest'
import { routing, vehicles } from '../../src/game/balance'
import { createNetwork, findRoute, vehicleProfile } from '../../src/game/routing'
import { FLAG, STREET_KINDS, type StreetGraphFile } from '../../src/game/streetGraph'

const MINOR = STREET_KINDS.indexOf('minor')
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

const network = (vehicle: string, graph: StreetGraphFile) =>
  createNetwork(graph, vehicleProfile(vehicle, vehicles[vehicle], routing))

// From 0 to 1: 300 m around the block by street (0-3-1), or 100 m across a pedestrian square (0-2-1).
const square = streets([
  [0, 3, 150, MINOR, ROAD],
  [3, 1, 150, MINOR, ROAD],
  [0, 2, 50, FOOT, FLAG.foot],
  [2, 1, 50, FOOT, FLAG.foot],
])

// From 0 to 1: 100 m straight over cobblestones (0-1), or 160 m on asphalt (0-3-1).
const cobbles = streets([
  [0, 1, 100, MINOR, ROAD | FLAG.cobblestone],
  [0, 3, 80, MINOR, ROAD],
  [3, 1, 80, MINOR, ROAD],
])

describe('cada vehículo, sus calles', () => {
  test('la patineta corta por la peatonal; la bici y el monopatín dan la vuelta', () => {
    expect(vehicles.skateboard.allowedInPedestrian).toBe(true)
    expect(findRoute(network('skateboard', square), 0, 1)?.nodes).toEqual([0, 2, 1])
    expect(findRoute(network('bike', square), 0, 1)?.nodes).toEqual([0, 3, 1])
    expect(findRoute(network('e_scooter', square), 0, 1)?.nodes).toEqual([0, 3, 1])
  })

  test('en adoquines la patineta va más lenta y prefiere el asfalto, aunque sea más largo', () => {
    const skate = findRoute(network('skateboard', cobbles), 0, 1)
    expect(skate?.nodes).toEqual([0, 3, 1])
    // Por los adoquines, 100 m le llevarían lo que 100 / (1 − 0,5) = 200 m sobre asfalto.
    const slow = 100 / (1 + (vehicles.skateboard.cobblestoneSpeedPct ?? 0))
    expect(slow).toBeGreaterThan(160)
  })

  test('a la bici los adoquines no la frenan: va derecho', () => {
    const bike = findRoute(network('bike', cobbles), 0, 1)
    expect(bike).toMatchObject({ nodes: [0, 1], lengthM: 100, effectiveM: 100 })
  })

  test('el tiempo de un tramo de adoquines cuenta doble para la patineta', () => {
    const onlyCobbles = streets([[0, 1, 100, MINOR, ROAD | FLAG.cobblestone]])
    const route = findRoute(network('skateboard', onlyCobbles), 0, 1)
    expect(route?.lengthM).toBe(100)
    expect(route?.effectiveM).toBeCloseTo(100 / (1 + (vehicles.skateboard.cobblestoneSpeedPct ?? 0)))
  })
})

describe('los números de la hoja Vehículos', () => {
  test('bici, patineta y monopatín: velocidad y capacidad', () => {
    for (const id of ['bike', 'skateboard', 'e_scooter']) {
      expect(vehicles[id].speedKmh, id).toBeGreaterThan(0)
      expect(vehicles[id].capacity, id).toBeGreaterThanOrEqual(1)
    }
    expect(vehicles.e_scooter.speedKmh).toBeGreaterThan(vehicles.bike.speedKmh)
    expect(vehicles.skateboard.speedKmh).toBeLessThan(vehicles.bike.speedKmh)
  })
})
