/**
 * The street graph format shared by the exporter (scripts/streets) and the game. Pure, no imports:
 * the exporter runs it straight from Node.
 */

/** major: main streets · minor: residential and small streets · cycleway: bike only · foot: pedestrian ways. */
export const STREET_KINDS = ['major', 'minor', 'cycleway', 'foot'] as const
export type StreetKind = (typeof STREET_KINDS)[number]

/** Flags of a stretch, as bits. */
export const FLAG = {
  bike: 1,
  car: 2,
  /** Cars may only go from the first node to the second. */
  carOneway: 4,
  /** Bikes may only go from the first node to the second. */
  bikeOneway: 8,
  /** Has a cycle track or lane (or is a cycleway). */
  cycleTrack: 16,
  /** Paved with cobblestones (sett): slow for small wheels. */
  cobblestone: 32,
  /** A pedestrian way (pedestrian street, footway, path): only vehicles allowed on foot ways use it. */
  foot: 64,
} as const

export const ATTRIBUTION = '© OpenStreetMap contributors (ODbL), https://www.openstreetmap.org/copyright'

/** [lon, lat] */
export type LonLat = readonly [number, number]

/** [from, to, length in meters, kind index, flags] */
export type StreetEdge = readonly [number, number, number, number, number]

export interface StreetGraphFile {
  readonly attribution: string
  /** When OpenStreetMap had this data. */
  readonly osmTimestamp: string
  /** [south, west, north, east] */
  readonly bbox: readonly [number, number, number, number]
  readonly kinds: readonly StreetKind[]
  /** [lon, lat] per node; the index is the node id. */
  readonly nodes: readonly LonLat[]
  readonly edges: readonly StreetEdge[]
}

const EARTH_RADIUS_M = 6_371_000

/** Distance in meters between two [lon, lat] points. */
export function distanceM(a: LonLat, b: LonLat): number {
  const toRad = Math.PI / 180
  const dLat = (b[1] - a[1]) * toRad
  const dLon = (b[0] - a[0]) * toRad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}
