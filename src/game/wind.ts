/**
 * Wind with a direction: pedal vehicles go slower against it and faster with it, by the angle of each stretch,
 * and routes are worked out with it (a stretch against the wind costs more). The windy streets themselves are built
 * in streetConditions.ts. Pure.
 */
import type { RoutingProfile, StreetNetwork } from './routing'
import { networkWith } from './streetConditions'
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

/** The same streets for the same vehicle, with the wind (built once per direction and strength). */
export function withWind(network: StreetNetwork, fromDeg: number, pct: number): StreetNetwork {
  return networkWith(network, pct, { windFromDeg: fromDeg, key: `wind:${fromDeg}` })
}

/** The wind blowing now, if any: the first wind event going on. */
export function windOf(active: readonly ShiftEvent[], kinds: Readonly<Record<string, { readonly effectType: string }>>): ShiftEvent | undefined {
  return active.find((event) => kinds[event.event]?.effectType === 'wind' && event.directionDeg !== undefined)
}
