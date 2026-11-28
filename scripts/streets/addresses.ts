/**
 * Turns an Overpass answer (OpenStreetMap address nodes and buildings) into the game's address book: the real
 * street and house number of each address in the area. Pure.
 */
import { ATTRIBUTION } from '../../src/game/streetGraph.ts'

/** One element of an Overpass answer with `out center`: address nodes, and buildings with their middle. */
export type AddressElement =
  | { type: 'node'; id: number; lat: number; lon: number; tags?: Record<string, string> }
  | { type: 'way'; id: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

export interface AddressAnswer {
  osm3s?: { timestamp_osm_base?: string }
  elements: AddressElement[]
}

/** data/streets/<area>.addresses.json (the game reads it as AddressBookFile, src/game/addressBook.ts). */
export interface AddressBookFile {
  attribution: string
  osmTimestamp: string
  streets: string[]
  /** [lon, lat, street (position in streets), house number] */
  addresses: [number, number, number, string][]
}

/** Six decimals: about 10 cm, plenty to find the nearest door. */
const round = (value: number) => Math.round(value * 1e6) / 1e6

/**
 * The addresses inside the area, each street and number once, sorted by street and number (stable diffs). Streets
 * are listed once; each address points to its street by position.
 */
export function buildAddressBook(answer: AddressAnswer, bbox: [number, number, number, number]): AddressBookFile {
  const [south, west, north, east] = bbox
  const found = new Map<string, { lon: number; lat: number; street: string; number: string }>()
  for (const element of answer.elements) {
    const street = element.tags?.['addr:street']?.trim()
    const number = element.tags?.['addr:housenumber']?.trim()
    const point = element.type === 'node' ? element : element.center
    if (!street || !number || !point) continue
    if (point.lat < south || point.lat > north || point.lon < west || point.lon > east) continue
    const key = `${street}\u0000${number}`
    if (!found.has(key)) found.set(key, { lon: round(point.lon), lat: round(point.lat), street, number })
  }
  const byStreet = [...found.values()].sort(
    (a, b) => a.street.localeCompare(b.street, 'da') || a.number.localeCompare(b.number, 'da', { numeric: true }),
  )
  const streets = [...new Set(byStreet.map((address) => address.street))]
  return {
    attribution: ATTRIBUTION,
    osmTimestamp: answer.osm3s?.timestamp_osm_base ?? '',
    streets,
    addresses: byStreet.map((address) => [address.lon, address.lat, streets.indexOf(address.street), address.number]),
  }
}
