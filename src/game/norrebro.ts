/**
 * Nørrebro, the first area of the game: its streets (data/streets/norrebro.json, exported from OpenStreetMap)
 * and the network a bike sees.
 */
import streetsData from '../../data/streets/norrebro.json'
import { routing } from './balance'
import { bikeProfile, createNetwork, type StreetNetwork } from './routing'
import type { StreetGraphFile } from './streetGraph'

export const norrebroStreets = streetsData as unknown as StreetGraphFile

let bikeNetwork: StreetNetwork | undefined

/** Built once, the first time it is needed. */
export function norrebroBikeNetwork(): StreetNetwork {
  bikeNetwork ??= createNetwork(norrebroStreets, bikeProfile(routing))
  return bikeNetwork
}
