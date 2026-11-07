/**
 * Turns an Overpass answer (OpenStreetMap ways and nodes) into the game's street graph. Pure.
 *
 * The graph keeps every OSM node on a kept way (no simplification), so routes follow the real street shape.
 * Only the largest piece that a bike can ride through is kept: no unreachable corners.
 */
import {
  ATTRIBUTION,
  distanceM,
  FLAG,
  STREET_KINDS,
  type StreetGraphFile,
  type StreetKind,
} from '../../src/game/streetGraph.ts'

export { ATTRIBUTION, distanceM, FLAG, STREET_KINDS, type StreetGraphFile }

/** One element of an Overpass `out body` answer. */
export type OverpassElement =
  | { type: 'node'; id: number; lat: number; lon: number }
  | { type: 'way'; id: number; nodes: number[]; tags?: Record<string, string> }

export interface OverpassAnswer {
  osm3s?: { timestamp_osm_base?: string }
  elements: OverpassElement[]
}

const MAJOR = new Set(['primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link'])
const MINOR = new Set(['residential', 'unclassified', 'living_street', 'service'])
const FOOT = new Set(['footway', 'pedestrian', 'path'])
const YES = new Set(['yes', 'designated', 'permissive'])
const NO = new Set(['no', 'private'])
const TRACK = /^(track|lane|opposite_track|opposite_lane|shared_lane)$/

function kindOf(tags: Record<string, string>): StreetKind | undefined {
  const highway = tags.highway ?? ''
  if (MAJOR.has(highway)) return 'major'
  if (MINOR.has(highway)) {
    // Parking aisles and driveways are not streets a rider would use.
    if (highway === 'service' && tags.service && tags.service !== 'alley') return undefined
    return 'minor'
  }
  if (highway === 'cycleway' || (highway === 'path' && YES.has(tags.bicycle ?? ''))) return 'cycleway'
  if (FOOT.has(highway)) {
    // Sidewalks run next to a street that is already in the graph.
    if (tags.footway === 'sidewalk' || tags.footway === 'crossing') return undefined
    return 'foot'
  }
  return undefined
}

function hasCycleTrack(tags: Record<string, string>): boolean {
  return ['cycleway', 'cycleway:both', 'cycleway:right', 'cycleway:left'].some((key) => TRACK.test(tags[key] ?? ''))
}

/** Flags of a way, or undefined when nobody in the game may use it. */
export function flagsOf(tags: Record<string, string>): { kind: StreetKind; flags: number } | undefined {
  const kind = kindOf(tags)
  if (!kind || NO.has(tags.access ?? '')) return undefined

  const bike =
    !NO.has(tags.bicycle ?? '') && (kind !== 'foot' || YES.has(tags.bicycle ?? ''))
  const car = (kind === 'major' || kind === 'minor') && !NO.has(tags.motor_vehicle ?? '') && !NO.has(tags.motorcar ?? '')
  const oneway = tags.oneway === 'yes' || tags.oneway === '1' || tags.oneway === 'true' || tags.oneway === '-1'
  const bikeExempt = tags['oneway:bicycle'] === 'no' || /^opposite/.test(tags.cycleway ?? '')

  let flags = 0
  if (bike) flags |= FLAG.bike
  if (car) flags |= FLAG.car
  if (car && oneway) flags |= FLAG.carOneway
  if (bike && oneway && !bikeExempt) flags |= FLAG.bikeOneway
  if (kind === 'cycleway' || hasCycleTrack(tags)) flags |= FLAG.cycleTrack
  return flags === 0 ? undefined : { kind, flags }
}

const COORD_DECIMALS = 6
const round = (value: number, decimals: number) => Number(value.toFixed(decimals))

type Edge = [number, number, number, number, number]
type Bbox = [number, number, number, number]

/** The largest group of nodes connected by bike stretches, ignoring direction. */
function largestBikeComponent(nodeCount: number, edges: readonly Edge[]): Set<number> {
  const neighbors = Array.from({ length: nodeCount }, () => [] as number[])
  for (const [a, b, , , flags] of edges) {
    if (flags & FLAG.bike) {
      neighbors[a].push(b)
      neighbors[b].push(a)
    }
  }
  const visited = new Uint8Array(nodeCount)
  let largest: number[] = []
  for (let start = 0; start < nodeCount; start++) {
    if (visited[start]) continue
    visited[start] = 1
    const component = [start]
    for (let i = 0; i < component.length; i++) {
      for (const next of neighbors[component[i]]) {
        if (!visited[next]) {
          visited[next] = 1
          component.push(next)
        }
      }
    }
    if (component.length > largest.length) largest = component
  }
  return new Set(largest)
}

/** Builds the street graph of the area. Throws when the answer has no usable streets. */
export function buildStreetGraph(answer: OverpassAnswer, bbox: Bbox): StreetGraphFile {
  const coords = new Map<number, [number, number]>()
  for (const element of answer.elements) {
    if (element.type === 'node') coords.set(element.id, [element.lon, element.lat])
  }

  // First pass: every kept stretch between two consecutive OSM nodes, with OSM ids.
  const osmEdges: Edge[] = []
  for (const element of answer.elements) {
    if (element.type !== 'way') continue
    const usage = flagsOf(element.tags ?? {})
    if (!usage) continue
    const nodes = element.tags?.oneway === '-1' ? [...element.nodes].reverse() : element.nodes
    for (let i = 0; i + 1 < nodes.length; i++) {
      const a = coords.get(nodes[i])
      const b = coords.get(nodes[i + 1])
      if (!a || !b) continue
      osmEdges.push([nodes[i], nodes[i + 1], distanceM(a, b), STREET_KINDS.indexOf(usage.kind), usage.flags])
    }
  }
  if (osmEdges.length === 0) throw new Error('La respuesta de OpenStreetMap no trae calles usables en el área.')

  // Compact ids in the order nodes first appear.
  const index = new Map<number, number>()
  const idOf = (osmId: number) => {
    let id = index.get(osmId)
    if (id === undefined) {
      id = index.size
      index.set(osmId, id)
    }
    return id
  }
  const edges: Edge[] = osmEdges.map(([a, b, length, kind, flags]) => [idOf(a), idOf(b), length, kind, flags])
  const osmIds = [...index.keys()]

  // Keep the largest piece a bike can ride through.
  const largest = largestBikeComponent(osmIds.length, edges)

  const finalId = new Map<number, number>()
  const nodes: [number, number][] = []
  for (let node = 0; node < osmIds.length; node++) {
    if (!largest.has(node)) continue
    finalId.set(node, nodes.length)
    const [lon, lat] = coords.get(osmIds[node]) as [number, number]
    nodes.push([round(lon, COORD_DECIMALS), round(lat, COORD_DECIMALS)])
  }
  const kept: Edge[] = []
  for (const [a, b, length, kind, flags] of edges) {
    const from = finalId.get(a)
    const to = finalId.get(b)
    if (from !== undefined && to !== undefined) kept.push([from, to, round(length, 1), kind, flags])
  }

  return {
    attribution: ATTRIBUTION,
    osmTimestamp: answer.osm3s?.timestamp_osm_base ?? '',
    bbox,
    kinds: STREET_KINDS,
    nodes,
    edges: kept,
  }
}
