/** Nørrebro, the first area of the game. Kept as shortcuts to neighborhoods.ts for the code that only plays here. */
import { bikeNetworkOf, networkOf, streetsOf } from './neighborhoods'
import type { StreetNetwork } from './routing'

export const norrebroStreets = streetsOf('norrebro')

export function norrebroBikeNetwork(): StreetNetwork {
  return bikeNetworkOf('norrebro')
}

export function norrebroNetworkFor(vehicle: string): StreetNetwork {
  return networkOf('norrebro', vehicle)
}
