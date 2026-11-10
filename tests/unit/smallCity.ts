/**
 * A tiny made-up neighborhood for rule tests: a square lattice of streets, every block exactly 100 m long.
 * Crossing (x, y) is node y * size + x; x grows to the east, y to the south. Row 0 is a main street.
 */
import type { CityMap, NodeId, Restaurant } from '../../src/game/cityMap'
import { bikeProfile, createNetwork, type StreetNetwork } from '../../src/game/routing'
import { FLAG, STREET_KINDS, type LonLat, type StreetGraphFile } from '../../src/game/streetGraph'

export const BLOCK_M = 100
const ORIGIN: LonLat = [12.55, 55.69]
// 100 m in degrees at the latitude of Copenhagen.
const LON_STEP = 0.0015936
const LAT_STEP = 0.00089932

/** Where crossing (x, y) is; fractional values fall between crossings. */
export function lonLatAt(x: number, y: number): LonLat {
  return [ORIGIN[0] + x * LON_STEP, ORIGIN[1] - y * LAT_STEP]
}

/** Lattice coordinates of a point of the map. */
export function latticeOf([lon, lat]: LonLat): { x: number; y: number } {
  return { x: (lon - ORIGIN[0]) / LON_STEP, y: (ORIGIN[1] - lat) / LAT_STEP }
}

export function smallStreets(size = 5): StreetGraphFile {
  const nodes: LonLat[] = []
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) nodes.push(lonLatAt(x, y))
  const edges: [number, number, number, number, number][] = []
  const road = FLAG.bike | FLAG.car
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const kind = STREET_KINDS.indexOf(y === 0 ? 'major' : 'minor')
      if (x + 1 < size) edges.push([y * size + x, y * size + x + 1, BLOCK_M, kind, road])
      if (y + 1 < size) edges.push([y * size + x, (y + 1) * size + x, BLOCK_M, STREET_KINDS.indexOf('minor'), road])
    }
  }
  const [lon0, lat0] = lonLatAt(0, 0)
  const [lon1, lat1] = lonLatAt(size - 1, size - 1)
  return { attribution: '', osmTimestamp: 'small', bbox: [lat1, lon0, lat0, lon1], kinds: STREET_KINDS, nodes, edges }
}

/** Every block costs its length: the shortest route is always the cheapest. */
export function smallNetwork(size = 5): StreetNetwork {
  return createNetwork(smallStreets(size), bikeProfile({ cycleTrackFactor: 1, majorWithoutTrackFactor: 1, pedestrianFactor: 1 }))
}

export function nodeAt(x: number, y: number, size = 5): NodeId {
  return y * size + x
}

/** A small city with restaurants on the given crossings ("A", "B"…) and every crossing as an address. */
export function smallCity(restaurantNodes: readonly NodeId[] = [nodeAt(3, 0)], size = 5): CityMap {
  const network = smallNetwork(size)
  const restaurants: Restaurant[] = restaurantNodes.map((node, index) => ({
    id: `r${index + 1}`,
    label: String.fromCharCode('A'.charCodeAt(0) + index),
    node,
  }))
  return { network, networks: {}, restaurants, addresses: Array.from({ length: size * size }, (_, node) => node) }
}
