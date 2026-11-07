/**
 * Routes on real streets: the cheapest way between two crossings for a kind of vehicle, with A* (ngraph.path).
 * The cost of a stretch is its length times a factor: a bike prefers cycle tracks and avoids main streets
 * without one. Pure.
 */
import createGraph, { type Graph } from 'ngraph.graph'
import { aStar, type PathFinder } from 'ngraph.path'
import type { RoutingBalance } from './balance'
import { distanceM, FLAG, type LonLat, type StreetGraphFile, type StreetKind } from './streetGraph'

/** How a kind of vehicle uses the streets. */
export interface RoutingProfile {
  readonly id: 'bike' | 'car'
  /** Flag a stretch needs to be usable. */
  readonly allowedFlag: number
  /** Flag that makes a stretch one-way for this vehicle. */
  readonly onewayFlag: number
  /** Cost of a stretch as a multiple of its length. */
  readonly factor: (kind: StreetKind, flags: number) => number
  /** The lowest factor, so the A* estimate never overshoots. */
  readonly minFactor: number
}

export function bikeProfile(balance: RoutingBalance): RoutingProfile {
  return {
    id: 'bike',
    allowedFlag: FLAG.bike,
    onewayFlag: FLAG.bikeOneway,
    factor: (kind, flags) => {
      if (flags & FLAG.cycleTrack) return balance.cycleTrackFactor
      if (kind === 'major') return balance.majorWithoutTrackFactor
      if (kind === 'foot') return balance.pedestrianFactor
      return 1
    },
    minFactor: Math.min(1, balance.cycleTrackFactor, balance.majorWithoutTrackFactor, balance.pedestrianFactor),
  }
}

export const carProfile: RoutingProfile = {
  id: 'car',
  allowedFlag: FLAG.car,
  onewayFlag: FLAG.carOneway,
  factor: () => 1,
  minFactor: 1,
}

interface Stretch {
  readonly lengthM: number
  readonly cost: number
  readonly kind: StreetKind
  readonly flags: number
}

/** The streets as one kind of vehicle sees them, ready to find routes. */
export interface StreetNetwork {
  readonly streets: StreetGraphFile
  readonly profile: RoutingProfile
  readonly graph: Graph<undefined, Stretch>
  readonly finder: PathFinder<undefined>
}

export function createNetwork(streets: StreetGraphFile, profile: RoutingProfile): StreetNetwork {
  const graph = createGraph<undefined, Stretch>()
  const add = (from: number, to: number, stretch: Stretch) => {
    const existing = graph.getLink(from, to)
    // Two OSM ways over the same pair of crossings: keep the cheaper one.
    if (!existing || stretch.cost < existing.data.cost) graph.addLink(from, to, stretch)
  }
  for (const [a, b, lengthM, kindIndex, flags] of streets.edges) {
    if (!(flags & profile.allowedFlag)) continue
    const kind = streets.kinds[kindIndex]
    const stretch = { lengthM, cost: lengthM * profile.factor(kind, flags), kind, flags }
    add(a, b, stretch)
    if (!(flags & profile.onewayFlag)) add(b, a, stretch)
  }
  const finder = aStar(graph, {
    oriented: true,
    distance: (_from, _to, link) => link.data.cost,
    heuristic: (from, to) =>
      distanceM(streets.nodes[from.id as number], streets.nodes[to.id as number]) * profile.minFactor,
  })
  return { streets, profile, graph, finder }
}

export interface StreetRoute {
  /** Crossings from start to end. */
  readonly nodes: readonly number[]
  readonly lengthM: number
}

// Routes already found, per network. The game asks for the same few routes over and over
// (riders to restaurants, restaurants to customers); a cache keeps that cheap. It never changes a result.
const routeCache = new WeakMap<StreetNetwork, Map<number, StreetRoute | null>>()
const ROUTE_CACHE_LIMIT = 50_000

/** The cheapest route between two crossings, or undefined when this vehicle can't get there. */
export function findRoute(network: StreetNetwork, from: number, to: number): StreetRoute | undefined {
  let cache = routeCache.get(network)
  if (!cache) {
    cache = new Map()
    routeCache.set(network, cache)
  }
  const key = from * network.streets.nodes.length + to
  const cached = cache.get(key)
  if (cached !== undefined) return cached ?? undefined
  const route = searchRoute(network, from, to)
  if (cache.size >= ROUTE_CACHE_LIMIT) cache.clear()
  cache.set(key, route ?? null)
  return route
}

function searchRoute(network: StreetNetwork, from: number, to: number): StreetRoute | undefined {
  const { graph } = network
  if (!graph.hasNode(from) || !graph.hasNode(to)) return undefined
  if (from === to) return { nodes: [from], lengthM: 0 }
  // ngraph.path returns the path from the end back to the start.
  const path = network.finder.find(from, to)
  if (path.length === 0) return undefined
  const nodes = path.map((node) => node.id as number).reverse()
  return { nodes, lengthM: stretchesOf(network, nodes).reduce((sum, stretch) => sum + stretch.lengthM, 0) }
}

/** The stretches a route goes through, in order. */
export function stretchesOf(network: StreetNetwork, nodes: readonly number[]): Stretch[] {
  const stretches: Stretch[] = []
  for (let i = 0; i + 1 < nodes.length; i++) {
    const link = network.graph.getLink(nodes[i], nodes[i + 1])
    if (!link) throw new Error(`No hay tramo entre ${nodes[i]} y ${nodes[i + 1]}.`)
    stretches.push(link.data)
  }
  return stretches
}

/** Meters of the route that go on cycle tracks or cycleways. */
export function cycleTrackMeters(network: StreetNetwork, nodes: readonly number[]): number {
  return stretchesOf(network, nodes)
    .filter((stretch) => stretch.flags & FLAG.cycleTrack)
    .reduce((sum, stretch) => sum + stretch.lengthM, 0)
}

/** The crossing this vehicle can use that is closest to a point. */
export function nearestNode(network: StreetNetwork, point: LonLat): number {
  let best = -1
  let bestDistance = Infinity
  network.graph.forEachNode((node) => {
    const distance = distanceM(network.streets.nodes[node.id as number], point)
    if (distance < bestDistance) {
      bestDistance = distance
      best = node.id as number
    }
  })
  if (best < 0) throw new Error('La red de calles está vacía.')
  return best
}

/** Meters from the start of a route to each of its crossings: [0, first stretch, first two stretches, …]. */
export function cumulativeMeters(network: StreetNetwork, nodes: readonly number[]): number[] {
  const meters = [0]
  for (const stretch of stretchesOf(network, nodes)) meters.push(meters[meters.length - 1] + stretch.lengthM)
  return meters
}

/**
 * Crossings that can reach the seed and be reached from it, respecting one-ways: between any two of them
 * there is always a route, both ways.
 */
export function mutuallyReachable(network: StreetNetwork, seed: number): Set<number> {
  const walk = (forward: boolean) => {
    const seen = new Set([seed])
    const queue = [seed]
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i]
      network.graph.forEachLinkedNode(
        current,
        (other, link) => {
          const goesOut = link.fromId === current
          if (goesOut !== forward || seen.has(other.id as number)) return
          seen.add(other.id as number)
          queue.push(other.id as number)
        },
        false,
      )
    }
    return seen
  }
  const reached = walk(true)
  const reaching = walk(false)
  return new Set([...reached].filter((node) => reaching.has(node)))
}
