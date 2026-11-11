/**
 * Routes on real streets: the quickest way between two crossings for a kind of vehicle, with A* (ngraph.path).
 * Each vehicle has its own streets (a skateboard may cut through pedestrian ways, a scooter may not) and its own
 * speed on each stretch (small wheels crawl on cobblestones). The cost of a stretch is the time it takes, times a
 * preference: a bike prefers cycle tracks and avoids main streets without one. Pure.
 */
import createGraph, { type Graph } from 'ngraph.graph'
import { aStar, type PathFinder } from 'ngraph.path'
import type { RoutingBalance, VehicleBalance } from './balance'
import { distanceM, FLAG, type LonLat, type StreetGraphFile, type StreetKind } from './streetGraph'

/** How a kind of vehicle uses the streets. */
export interface RoutingProfile {
  readonly id: string
  /** A stretch is usable when it has any of these flags. */
  readonly allowedFlags: number
  /** Flag that makes a stretch one-way for this vehicle. */
  readonly onewayFlag: number
  /** Preference for a stretch: its cost is the time it takes times this. */
  readonly factor: (kind: StreetKind, flags: number) => number
  /** Speed on a stretch, as a share of the vehicle's speed (1 = full speed). */
  readonly speedFactor: (flags: number) => number
  /** The lowest cost per meter at full speed, so the A* estimate never overshoots. */
  readonly minFactor: number
}

/** Slowest share of its speed a vehicle keeps, so a bad surface never stops it outright. */
const MIN_SPEED_FACTOR = 0.1

/** The streets and speeds of a vehicle of the Vehículos tab. */
export function vehicleProfile(id: string, vehicle: VehicleBalance, balance: RoutingBalance): RoutingProfile {
  // Motorbike and car: the streets cars may use (one-way for cars), never cycle tracks or pedestrian ways.
  if (vehicle.roads === 'car') {
    const onCobblesByCar = Math.max(MIN_SPEED_FACTOR, 1 + (vehicle.cobblestoneSpeedPct ?? 0))
    return {
      id,
      allowedFlags: FLAG.car,
      onewayFlag: FLAG.carOneway,
      factor: () => 1,
      speedFactor: (flags) => (flags & FLAG.cobblestone ? onCobblesByCar : 1),
      minFactor: 1,
    }
  }
  const lanes = vehicle.usesBikeLanes === true
  const pedestrian = vehicle.allowedInPedestrian === true
  const onCobbles = Math.max(MIN_SPEED_FACTOR, 1 + (vehicle.cobblestoneSpeedPct ?? 0))
  const factors = [1, balance.majorWithoutTrackFactor, lanes ? balance.cycleTrackFactor : 1, pedestrian ? 1 : balance.pedestrianFactor]
  return {
    id,
    allowedFlags: FLAG.bike | (pedestrian ? FLAG.foot : 0),
    onewayFlag: FLAG.bikeOneway,
    factor: (kind, flags) => {
      if (lanes && flags & FLAG.cycleTrack) return balance.cycleTrackFactor
      if (kind === 'major' && !(flags & FLAG.cycleTrack)) return balance.majorWithoutTrackFactor
      if (kind === 'foot') return pedestrian ? 1 : balance.pedestrianFactor
      return 1
    },
    speedFactor: (flags) => (flags & FLAG.cobblestone ? onCobbles : 1),
    minFactor: Math.min(...factors),
  }
}

/** A plain bike: cycle tracks, no pedestrian ways, full speed everywhere. */
export function bikeProfile(balance: RoutingBalance): RoutingProfile {
  return vehicleProfile('bike', { speedKmh: 0, capacity: 1, usesBikeLanes: true }, balance)
}

export const carProfile: RoutingProfile = {
  id: 'car',
  allowedFlags: FLAG.car,
  onewayFlag: FLAG.carOneway,
  factor: () => 1,
  speedFactor: () => 1,
  minFactor: 1,
}

interface Stretch {
  readonly lengthM: number
  /** Meters at full speed that take as long as this stretch: longer than lengthM on slow surfaces. */
  readonly effectiveM: number
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
    if (!(flags & profile.allowedFlags)) continue
    const kind = streets.kinds[kindIndex]
    const effectiveM = lengthM / profile.speedFactor(flags)
    const stretch = { lengthM, effectiveM, cost: effectiveM * profile.factor(kind, flags), kind, flags }
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
  /** Meters at full speed that take as long as the route (time = effectiveM / speed). */
  readonly effectiveM: number
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
  if (from === to) return { nodes: [from], lengthM: 0, effectiveM: 0 }
  // ngraph.path returns the path from the end back to the start.
  const path = network.finder.find(from, to)
  if (path.length === 0) return undefined
  const nodes = path.map((node) => node.id as number).reverse()
  const stretches = stretchesOf(network, nodes)
  const sum = (pick: (stretch: Stretch) => number) => stretches.reduce((total, stretch) => total + pick(stretch), 0)
  return { nodes, lengthM: sum((stretch) => stretch.lengthM), effectiveM: sum((stretch) => stretch.effectiveM) }
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

/**
 * Meters at full speed from the start of a route to each of its crossings: [0, first stretch, first two, …].
 * A rider moving at their vehicle's speed along these meters takes the real time of each stretch.
 */
export function cumulativeMeters(network: StreetNetwork, nodes: readonly number[]): number[] {
  const meters = [0]
  for (const stretch of stretchesOf(network, nodes)) meters.push(meters[meters.length - 1] + stretch.effectiveM)
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
