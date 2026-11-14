/**
 * Wind with a direction: pedal vehicles go slower against it and faster with it, by the angle of each stretch,
 * and routes are worked out with it (a stretch against the wind costs more). While it blows, the city map swaps
 * each vehicle's streets for windy ones. Pure.
 */
import type { CityMap } from './cityMap'
import { createNetwork, type RoutingProfile, type StreetNetwork } from './routing'
import type { ShiftEvent } from './shiftEvents'
import type { LonLat } from './streetGraph'

const DEGREES = Math.PI / 180
const FULL_TURN_DEG = 360
const HALF_TURN_DEG = 180

/** Compass bearing from one point to another: 0 = north, 90 = east, 180 = south, 270 = west. */
export function bearingDeg(from: LonLat, to: LonLat): number {
  const east = (to[0] - from[0]) * Math.cos(((from[1] + to[1]) / 2) * DEGREES)
  const north = to[1] - from[1]
  return (Math.atan2(east, north) / DEGREES + FULL_TURN_DEG) % FULL_TURN_DEG
}

/**
 * Share of its speed a vehicle keeps on a stretch, with wind blowing from fromDeg: 1 + pct with the wind right
 * behind, 1 − pct straight into it, and in between by the angle (across it, no change).
 */
export function windSpeedFactor(from: LonLat, to: LonLat, fromDeg: number, pct: number): number {
  if (!pct) return 1
  const towardsDeg = fromDeg + HALF_TURN_DEG
  return 1 + pct * Math.cos((bearingDeg(from, to) - towardsDeg) * DEGREES)
}

/** A vehicle's way of using the streets, with the wind. */
export function windyProfile(profile: RoutingProfile, fromDeg: number, pct: number): RoutingProfile {
  if (!pct) return profile
  return {
    ...profile,
    directionFactor: (from, to) => windSpeedFactor(from, to, fromDeg, pct),
    // With the wind behind, a stretch costs less than its length: the A* estimate has to stay below that.
    minFactor: profile.minFactor / (1 + pct),
  }
}

const windyNetworks = new WeakMap<StreetNetwork, Map<string, StreetNetwork>>()

/** The same streets for the same vehicle, with the wind (built once per direction and strength). */
export function withWind(network: StreetNetwork, fromDeg: number, pct: number): StreetNetwork {
  if (!pct) return network
  let byWind = windyNetworks.get(network)
  if (!byWind) {
    byWind = new Map()
    windyNetworks.set(network, byWind)
  }
  const key = `${fromDeg}:${pct}`
  let windy = byWind.get(key)
  if (!windy) {
    windy = createNetwork(network.streets, windyProfile(network.profile, fromDeg, pct))
    byWind.set(key, windy)
  }
  return windy
}

/** The wind blowing now, if any: the first wind event going on. */
export function windOf(active: readonly ShiftEvent[], kinds: Readonly<Record<string, { readonly effectType: string }>>): ShiftEvent | undefined {
  return active.find((event) => kinds[event.event]?.effectType === 'wind' && event.directionDeg !== undefined)
}

// The calm map each windy map came from, to go back when the wind stops.
const calmOf = new WeakMap<CityMap, CityMap>()
const windyMaps = new WeakMap<CityMap, Map<string, CityMap>>()

/**
 * The city map for this moment: with each vehicle's streets windy while the wind blows (pctOf gives how much a
 * vehicle feels it), or the calm one. Returns the same map object while nothing changes.
 */
export function mapWithWind(map: CityMap, wind: ShiftEvent | undefined, pctOf: (vehicle: string) => number): CityMap {
  const calm = calmOf.get(map) ?? map
  if (!wind || wind.directionDeg === undefined) return calm
  const fromDeg = wind.directionDeg
  let byWind = windyMaps.get(calm)
  if (!byWind) {
    byWind = new Map()
    windyMaps.set(calm, byWind)
  }
  const key = String(fromDeg)
  let windy = byWind.get(key)
  if (!windy) {
    const networks = Object.fromEntries(
      Object.entries(calm.networks).map(([vehicle, network]) => [vehicle, withWind(network, fromDeg, pctOf(vehicle))]),
    )
    windy = { ...calm, networks }
    byWind.set(key, windy)
    calmOf.set(windy, calm)
  }
  return windy
}
