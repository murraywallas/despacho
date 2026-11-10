/**
 * Nørrebro, the first area of the game: its streets (data/streets/norrebro.json, exported from OpenStreetMap)
 * and the network each vehicle sees.
 */
import streetsData from '../../data/streets/norrebro.json'
import { routing, vehicles } from './balance'
import { bikeProfile, createNetwork, vehicleProfile, type StreetNetwork } from './routing'
import type { StreetGraphFile } from './streetGraph'

export const norrebroStreets = streetsData as unknown as StreetGraphFile

let bikeNetwork: StreetNetwork | undefined
const vehicleNetworks = new Map<string, StreetNetwork>()

/** Built once, the first time it is needed. Addresses and restaurants are placed on it. */
export function norrebroBikeNetwork(): StreetNetwork {
  bikeNetwork ??= createNetwork(norrebroStreets, bikeProfile(routing))
  return bikeNetwork
}

/** The streets as a vehicle of the Vehículos tab sees them (built once per vehicle). */
export function norrebroNetworkFor(vehicle: string): StreetNetwork {
  let network = vehicleNetworks.get(vehicle)
  if (!network) {
    const row = vehicles[vehicle]
    if (!row) throw new Error(`El vehículo ${vehicle} no está en la hoja Vehículos.`)
    network = createNetwork(norrebroStreets, vehicleProfile(vehicle, row, routing))
    vehicleNetworks.set(vehicle, network)
  }
  return network
}
