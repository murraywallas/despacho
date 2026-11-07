import { describe, expect, test } from 'vitest'
import streetsData from '../../data/streets/norrebro.json'
import { routing } from '../../src/game/balance'
import {
  bikeProfile,
  carProfile,
  createNetwork,
  cycleTrackMeters,
  findRoute,
  nearestNode,
} from '../../src/game/routing'
import { distanceM, FLAG, STREET_KINDS, type LonLat, type StreetGraphFile } from '../../src/game/streetGraph'

const norrebro = streetsData as unknown as StreetGraphFile
const MAJOR = STREET_KINDS.indexOf('major')
const MINOR = STREET_KINDS.indexOf('minor')
const CYCLEWAY = STREET_KINDS.indexOf('cycleway')
const ROAD = FLAG.bike | FLAG.car

// A square block of about 100 m per side:  3 ── 2
//                                           │    │
//                                           0 ── 1
// 0-1 is a main street with no bike lane, 0-3 a cycleway, 1-2 and 3-2 residential streets.
const square: StreetGraphFile = {
  attribution: '',
  osmTimestamp: '',
  bbox: [55.68, 12.54, 55.7, 12.56],
  kinds: STREET_KINDS,
  nodes: [
    [12.55, 55.69],
    [12.5516, 55.69],
    [12.5516, 55.6909],
    [12.55, 55.6909],
  ],
  edges: [
    [0, 1, 100, MAJOR, ROAD],
    [1, 2, 100, MINOR, ROAD | FLAG.carOneway],
    [0, 3, 100, CYCLEWAY, FLAG.bike | FLAG.cycleTrack],
    [3, 2, 100, MINOR, ROAD],
  ],
}
/** Distance in meters from a point to the segment a-b (flat approximation, fine at city scale). */
function metersFromLine(point: LonLat, a: LonLat, b: LonLat): number {
  const metersPerLon = distanceM([0, a[1]], [1, a[1]])
  const metersPerLat = distanceM([0, 0], [0, 1])
  const toXY = (p: LonLat) => [(p[0] - a[0]) * metersPerLon, (p[1] - a[1]) * metersPerLat]
  const [px, py] = toXY(point)
  const [bx, by] = toXY(b)
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / (bx * bx + by * by)))
  return Math.hypot(px - t * bx, py - t * by)
}

const neutral = { cycleTrackFactor: 1, majorWithoutTrackFactor: 1, pedestrianFactor: 1 }

describe('rutas en un grafo chico', () => {
  test('la bici prefiere la ciclovía a la avenida sin ciclovía, a igual distancia', () => {
    const route = findRoute(createNetwork(square, bikeProfile(routing)), 0, 2)
    expect(route).toEqual({ nodes: [0, 3, 2], lengthM: 200 })
  })

  test('el auto no entra en la ciclovía', () => {
    expect(findRoute(createNetwork(square, carProfile), 0, 2)?.nodes).toEqual([0, 1, 2])
  })

  test('respeta las manos únicas: el auto no puede volver de 2 a 0', () => {
    expect(findRoute(createNetwork(square, carProfile), 2, 0)).toBeUndefined()
    expect(findRoute(createNetwork(square, bikeProfile(routing)), 2, 0)?.nodes).toEqual([2, 3, 0])
  })

  test('sin preferencias, el camino es el más corto en metros', () => {
    const longCycleway: StreetGraphFile = {
      ...square,
      edges: square.edges.map((edge) => (edge[2] === 100 && edge[3] === CYCLEWAY ? [0, 3, 400, CYCLEWAY, edge[4]] : edge)),
    }
    expect(findRoute(createNetwork(longCycleway, bikeProfile(neutral)), 0, 2)?.nodes).toEqual([0, 1, 2])
    // Con la preferencia de la planilla, 400 m de ciclovía tampoco compensan: el desvío es demasiado largo.
    expect(findRoute(createNetwork(longCycleway, bikeProfile(routing)), 0, 2)?.nodes).toEqual([0, 1, 2])
  })

  test('mismo punto: ruta de un solo cruce; cruce inexistente: no hay ruta', () => {
    const network = createNetwork(square, bikeProfile(routing))
    expect(findRoute(network, 1, 1)).toEqual({ nodes: [1], lengthM: 0 })
    expect(findRoute(network, 0, 99)).toBeUndefined()
  })

  test('el cruce más cercano a un punto, entre los que puede usar el vehículo', () => {
    const nearCorner3: LonLat = [12.5501, 55.6908]
    expect(nearestNode(createNetwork(square, bikeProfile(routing)), nearCorner3)).toBe(3)
    // Si al 3 solo se llega por la ciclovía, para el auto el más cercano es el 0.
    const onlyByCycleway: StreetGraphFile = { ...square, edges: square.edges.filter((edge) => edge[0] !== 3) }
    expect(nearestNode(createNetwork(onlyByCycleway, carProfile), nearCorner3)).toBe(0)
  })
})

describe('rutas en Nørrebro', () => {
  const bike = createNetwork(norrebro, bikeProfile(routing))
  const plain = createNetwork(norrebro, bikeProfile(neutral))

  test('en bici, de Nørrebros Runddel a Dronning Louises Bro va por la ciclovía de Nørrebrogade', () => {
    const runddel: LonLat = [12.5486, 55.6942]
    const dronningLouisesBro: LonLat = [12.5655, 55.6872]
    const route = findRoute(bike, nearestNode(bike, runddel), nearestNode(bike, dronningLouisesBro))
    expect(route).toBeDefined()
    if (!route) return
    expect(cycleTrackMeters(bike, route.nodes) / route.lengthM).toBeGreaterThan(0.99)
    // Nørrebrogade: dos rectas con un quiebre a la altura del cementerio Assistens, y al final se sube al puente.
    const nørrebrogade: LonLat[] = [runddel, [12.555, 55.6903], [12.5654, 55.686], dronningLouisesBro]
    const fromStreet = (point: LonLat) =>
      Math.min(...nørrebrogade.slice(1).map((end, i) => metersFromLine(point, nørrebrogade[i], end)))
    const farthest = Math.max(...route.nodes.map((node) => fromStreet(norrebro.nodes[node])))
    // Las calles paralelas más cercanas están a más de una cuadra (unos 80 m).
    expect(farthest).toBeLessThan(60)
  })

  test('en 100 viajes cualquiera, la bici usa más ciclovía y casi no se alarga', () => {
    const count = bike.graph.getNodesCount()
    let bikeTrack = 0
    let plainTrack = 0
    let bikeLength = 0
    let plainLength = 0
    for (let i = 0; i < 100; i++) {
      const from = (i * 7919) % count
      const to = (i * 104_729 + 13) % count
      const withPreference = findRoute(bike, from, to)
      const shortest = findRoute(plain, from, to)
      if (!withPreference || !shortest) continue
      bikeTrack += cycleTrackMeters(bike, withPreference.nodes)
      plainTrack += cycleTrackMeters(plain, shortest.nodes)
      bikeLength += withPreference.lengthM
      plainLength += shortest.lengthM
    }
    expect(bikeTrack / bikeLength).toBeGreaterThan(plainTrack / plainLength + 0.05)
    expect(bikeLength / plainLength).toBeLessThan(1.15)
  })

  test('buscar una ruta tarda menos de 10 ms', () => {
    const count = bike.graph.getNodesCount()
    const start = performance.now()
    for (let i = 0; i < 50; i++) findRoute(bike, (i * 31) % count, (i * 977 + 500) % count)
    expect((performance.now() - start) / 50).toBeLessThan(10)
  })
})
