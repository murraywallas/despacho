/**
 * The streets as events leave them: windy (#67) and with closed stretches (marathon, #68). While an event is going
 * on, the city map swaps each vehicle's streets for ones built with these conditions; when it ends, the calm map
 * comes back. Pure.
 */
import type { CityMap } from './cityMap'
import { createNetwork, type StreetNetwork } from './routing'
import { windyProfile } from './wind'

export interface StreetConditions {
  /** Where the wind blows from, in degrees; missing: no wind. */
  readonly windFromDeg?: number
  /** Closed stretches, by stretchKey. */
  readonly closed?: ReadonlySet<string>
  /** What makes these conditions different from others (wind and closure ids): the cache key. */
  readonly key: string
}

const networksByCondition = new WeakMap<StreetNetwork, Map<string, StreetNetwork>>()

/** A vehicle's streets with these conditions; windPct is how much the vehicle feels the wind. */
export function networkWith(calm: StreetNetwork, windPct: number, conditions: StreetConditions): StreetNetwork {
  const windy = conditions.windFromDeg !== undefined && windPct !== 0
  const closing = (conditions.closed?.size ?? 0) > 0
  if (!windy && !closing) return calm
  let byKey = networksByCondition.get(calm)
  if (!byKey) {
    byKey = new Map()
    networksByCondition.set(calm, byKey)
  }
  const key = `${conditions.key}|${windy ? windPct : 0}`
  let network = byKey.get(key)
  if (!network) {
    const profile = windy ? windyProfile(calm.profile, conditions.windFromDeg!, windPct) : calm.profile
    network = createNetwork(calm.streets, profile, conditions.closed, closing ? calm : undefined)
    byKey.set(key, network)
  }
  return network
}

// The calm map each changed map came from, to go back when the events end.
const calmOf = new WeakMap<CityMap, CityMap>()
const mapsByCondition = new WeakMap<CityMap, Map<string, CityMap>>()

/** The calm map a map came from (itself, when it is the calm one). */
export function calmMapOf(map: CityMap): CityMap {
  return calmOf.get(map) ?? map
}

/**
 * The city map with each vehicle's streets under these conditions (windPctOf gives how much a vehicle feels the
 * wind), or the calm one without conditions. The same object while the conditions don't change.
 */
export function mapWith(map: CityMap, conditions: StreetConditions | undefined, windPctOf: (vehicle: string) => number): CityMap {
  const calm = calmMapOf(map)
  if (!conditions) return calm
  let byKey = mapsByCondition.get(calm)
  if (!byKey) {
    byKey = new Map()
    mapsByCondition.set(calm, byKey)
  }
  let changed = byKey.get(conditions.key)
  if (!changed) {
    const networks = Object.fromEntries(
      Object.entries(calm.networks).map(([vehicle, network]) => [vehicle, networkWith(network, windPctOf(vehicle), conditions)]),
    )
    changed = { ...calm, networks }
    byKey.set(conditions.key, changed)
    calmOf.set(changed, calm)
  }
  return changed
}
