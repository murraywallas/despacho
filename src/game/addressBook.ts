/**
 * Real addresses of an area (from OpenStreetMap, `npm run addresses`): a customer lives at the one nearest to their
 * crossing. Only for show: the game's routes still end at the crossing. Pure.
 */
import { distanceM, type LonLat } from './streetGraph'

/** data/streets/<area>.addresses.json */
export interface AddressBookFile {
  readonly attribution: string
  readonly osmTimestamp: string
  /** Street names, each once. */
  readonly streets: readonly string[]
  /** [lon, lat, street (position in streets), house number] */
  readonly addresses: readonly (readonly [number, number, number, string])[]
}

export interface Address {
  readonly street: string
  readonly number: string
}

/** The address nearest to a point (straight line); undefined for an empty book. */
export function nearestAddress(book: AddressBookFile, point: LonLat): Address | undefined {
  let best: (typeof book.addresses)[number] | undefined
  let bestM = Infinity
  for (const entry of book.addresses) {
    const meters = distanceM(point, [entry[0], entry[1]])
    if (meters < bestM) {
      bestM = meters
      best = entry
    }
  }
  return best ? { street: book.streets[best[2]], number: best[3] } : undefined
}
