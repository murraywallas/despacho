/**
 * Closed streets (marathon): a route of the neighborhood, drawn in data/closures.json as a line of points, closes
 * every stretch that lies along it. Nobody rides there while it lasts, and a rider whose leg goes through it finds
 * another way from where they are. Pure.
 */
import { networkFor, type CityMap } from './cityMap'
import { passedIndex, routeNodes } from './movement'
import type { Rider } from './riders'
import { cumulativeMeters, stretchKey } from './routing'
import type { LonLat, StreetGraphFile } from './streetGraph'

/** A route of the closures file. */
export interface Closure {
  readonly neighborhood: string
  /** How far from the line a stretch can be and still count as on the route, in meters. */
  readonly toleranceM: number
  /** The route, as [lon, lat] points. */
  readonly path: readonly LonLat[]
}

const METERS_PER_DEGREE = 111_320
const DEGREES = Math.PI / 180

/** Meters from a point to a segment, on a flat map (fine at the size of a neighborhood). */
export function distanceToSegmentM(point: LonLat, a: LonLat, b: LonLat): number {
  const scaleX = Math.cos(point[1] * DEGREES) * METERS_PER_DEGREE
  const [px, py] = [point[0] * scaleX, point[1] * METERS_PER_DEGREE]
  const [ax, ay] = [a[0] * scaleX, a[1] * METERS_PER_DEGREE]
  const [bx, by] = [b[0] * scaleX, b[1] * METERS_PER_DEGREE]
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const along = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
  return Math.hypot(px - (ax + along * dx), py - (ay + along * dy))
}

function nearLine(point: LonLat, path: readonly LonLat[], toleranceM: number): boolean {
  for (let i = 0; i + 1 < path.length; i++) if (distanceToSegmentM(point, path[i], path[i + 1]) <= toleranceM) return true
  return false
}

const closedByStreets = new WeakMap<StreetGraphFile, Map<Closure, ReadonlySet<string>>>()

/** The stretches along a closed route: both ends within toleranceM of its line. Worked out once per route. */
export function closedStretches(streets: StreetGraphFile, closure: Closure): ReadonlySet<string> {
  let byClosure = closedByStreets.get(streets)
  if (!byClosure) {
    byClosure = new Map()
    closedByStreets.set(streets, byClosure)
  }
  let closed = byClosure.get(closure)
  if (!closed) {
    const keys = new Set<string>()
    for (const [a, b] of streets.edges) {
      if (nearLine(streets.nodes[a], closure.path, closure.toleranceM) && nearLine(streets.nodes[b], closure.path, closure.toleranceM)) {
        keys.add(stretchKey(a, b))
      }
    }
    closed = keys
    byClosure.set(closure, closed)
  }
  return closed
}

/** The closed stretches as lines, to draw them on the map. */
export function closedLines(streets: StreetGraphFile, closed: ReadonlySet<string>): LonLat[][] {
  return [...closed].map((key) => key.split('-').map((node) => streets.nodes[Number(node)]))
}

/** Whether what is left of the rider's leg goes through a closed stretch. */
export function legIsClosed(rider: Rider, closed: ReadonlySet<string>): boolean {
  const trip = rider.trip
  if (!trip || (rider.status !== 'toRestaurant' && rider.status !== 'toCustomer' && rider.status !== 'toBase')) return false
  const from = passedIndex(trip)
  for (let i = from; i + 1 < trip.path.length; i++) if (closed.has(stretchKey(trip.path[i], trip.path[i + 1]))) return true
  return false
}

/**
 * A rider whose leg goes through a closed stretch heads to the same stop another way, from the last crossing
 * passed, on the map's current streets. The orders stay with them. Others are returned as they were.
 */
export function rerouteAround(map: CityMap, rider: Rider, closed: ReadonlySet<string>): Rider {
  if (!legIsClosed(rider, closed) || !rider.trip) return rider
  const trip = rider.trip
  const network = networkFor(map, rider.vehicle)
  const here = trip.path[passedIndex(trip)]
  const path = routeNodes(network, here, trip.path[trip.path.length - 1])
  return { ...rider, node: here, trip: { ...trip, path, pathMeters: cumulativeMeters(network, path), traveledM: 0 } }
}
