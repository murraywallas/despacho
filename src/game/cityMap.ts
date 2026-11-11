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
  /** The streets of the area as a bike sees them: positions, addresses and restaurants are placed on it. */
  readonly network: StreetNetwork
  /** The streets as each vehicle of the fleet sees them, by vehicle id. */
  readonly networks: Readonly<Record<string, StreetNetwork>>
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

/** The streets a vehicle uses on this map (the bike's, for a vehicle without its own). */
export function networkFor(map: Pick<CityMap, 'network' | 'networks'>, vehicle: string): StreetNetwork {
  return map.networks[vehicle] ?? map.network
}

/**
 * Crossings on streets cars can use, reachable both ways from the middle of the area by every vehicle given,
 * in id order.
 */
export function findAddresses(network: StreetNetwork, kind?: 'major', others: readonly StreetNetwork[] = []): NodeId[] {
  const everyone = [network, ...others].map((each) => mutuallyReachable(each, centralNode(network)))
  const reachable = { has: (node: NodeId) => everyone.every((set) => set.has(node)) }
  const nodes = new Set<NodeId>()
  for (const [a, b, , kindIndex, flags] of network.streets.edges) {
    if (!(flags & FLAG.car)) continue
    if (kind && network.streets.kinds[kindIndex] !== kind) continue
    if (reachable.has(a)) nodes.add(a)
    if (reachable.has(b)) nodes.add(b)
  }
  return [...nodes].sort((a, b) => a - b)
}

/** Several restaurants close together (Kødbyen in Vesterbro): many orders leave from the same corner. */
export interface RestaurantCluster {
  readonly center: LonLat
  readonly radiusM: number
  /** How many of the restaurants stand inside the circle. */
  readonly count: number
}

/**
 * Picks `count` different crossings for the restaurants: first the cluster's, on any street inside its circle,
 * then the rest on main streets anywhere. The cluster's restaurants get the first letters (A, B…).
 */
export function placeRestaurants(
  network: StreetNetwork,
  count: number,
  random: Random,
  others: readonly StreetNetwork[] = [],
  cluster?: RestaurantCluster,
): Restaurant[] {
  const spots = findAddresses(network, 'major', others)
  const inCluster = Math.min(cluster?.count ?? 0, count)
  const clusterSpots = cluster
    ? findAddresses(network, undefined, others).filter(
        (node) => distanceM(network.streets.nodes[node], cluster.center) <= cluster.radiusM,
      )
    : []
  if (inCluster > clusterSpots.length) throw new Error(`No entran ${inCluster} restaurantes en la zona elegida.`)
  if (count - inCluster > spots.length) throw new Error(`No entran ${count} restaurantes en las avenidas del barrio.`)
  const restaurants: Restaurant[] = []
  while (restaurants.length < count) {
    const from = restaurants.length < inCluster ? clusterSpots : spots
    const node = from[randomInt(random, from.length)]
    if (restaurants.some((restaurant) => restaurant.node === node)) continue
    const number = restaurants.length + 1
    restaurants.push({ id: `r${number}`, label: String.fromCharCode(FIRST_LABEL + number - 1), node })
  }
  return restaurants
}

/** The city of a shift. networks: the streets of each vehicle of the fleet, by vehicle id. */
export function createCityMap(
  network: StreetNetwork,
  restaurantCount: number,
  random: Random,
  networks: Readonly<Record<string, StreetNetwork>> = {},
  cluster?: RestaurantCluster,
): CityMap {
  const others = Object.values(networks)
  return {
    network,
    networks,
    restaurants: placeRestaurants(network, restaurantCount, random, others, cluster),
    addresses: findAddresses(network, undefined, others),
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
