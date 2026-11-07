/**
 * The city of a shift: the street network of the area and where the restaurants are.
 * Everything in the game stands on a crossing of the network (a node id). Pure.
 */
import { randomInt, type Random } from './random'
import { mutuallyReachable, type StreetNetwork } from './routing'
import { distanceM, FLAG, type LonLat } from './streetGraph'

/** A crossing of the street network. */
export type NodeId = number

export interface Restaurant {
  /** "r1", "r2"… */
  readonly id: string
  /** Short label drawn on the map: "A", "B"… */
  readonly label: string
  readonly node: NodeId
}

export interface CityMap {
  readonly network: StreetNetwork
  readonly restaurants: readonly Restaurant[]
  /**
   * Crossings where people live: on a street cars can use (not inside a park), and with a route to and from
   * every other one. Customers and riders start here.
   */
  readonly addresses: readonly NodeId[]
}

const FIRST_LABEL = 'A'.charCodeAt(0)

/** Where a crossing is on the map. */
export function positionOf(map: Pick<CityMap, 'network'>, node: NodeId): LonLat {
  return map.network.streets.nodes[node]
}

/** The crossing closest to the middle of the area: the seed for "everything reachable from everything". */
function centralNode(network: StreetNetwork): NodeId {
  const [south, west, north, east] = network.streets.bbox
  const middle: LonLat = [(west + east) / 2, (south + north) / 2]
  let best = 0
  let bestDistance = Infinity
  network.graph.forEachNode((node) => {
    const distance = distanceM(network.streets.nodes[node.id as number], middle)
    if (distance < bestDistance) {
      bestDistance = distance
      best = node.id as number
    }
  })
  return best
}

/** Crossings on streets cars can use, reachable both ways from the middle of the area, in id order. */
export function findAddresses(network: StreetNetwork, kind?: 'major'): NodeId[] {
  const reachable = mutuallyReachable(network, centralNode(network))
  const nodes = new Set<NodeId>()
  for (const [a, b, , kindIndex, flags] of network.streets.edges) {
    if (!(flags & FLAG.car)) continue
    if (kind && network.streets.kinds[kindIndex] !== kind) continue
    if (reachable.has(a)) nodes.add(a)
    if (reachable.has(b)) nodes.add(b)
  }
  return [...nodes].sort((a, b) => a - b)
}

/** Picks `count` different crossings on main streets for the restaurants. */
export function placeRestaurants(network: StreetNetwork, count: number, random: Random): Restaurant[] {
  const spots = findAddresses(network, 'major')
  if (count > spots.length) throw new Error(`No entran ${count} restaurantes en las avenidas del barrio.`)
  const restaurants: Restaurant[] = []
  while (restaurants.length < count) {
    const node = spots[randomInt(random, spots.length)]
    if (restaurants.some((restaurant) => restaurant.node === node)) continue
    const number = restaurants.length + 1
    restaurants.push({ id: `r${number}`, label: String.fromCharCode(FIRST_LABEL + number - 1), node })
  }
  return restaurants
}

export function createCityMap(network: StreetNetwork, restaurantCount: number, random: Random): CityMap {
  return {
    network,
    restaurants: placeRestaurants(network, restaurantCount, random),
    addresses: findAddresses(network),
  }
}

/** A random address at least minDistanceM away (straight line) from a crossing. */
export function randomAddress(map: CityMap, random: Random, awayFrom: NodeId, minDistanceM: number): NodeId {
  const from = positionOf(map, awayFrom)
  for (;;) {
    const node = map.addresses[randomInt(random, map.addresses.length)]
    if (distanceM(positionOf(map, node), from) >= minDistanceM) return node
  }
}
