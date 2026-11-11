/**
 * The streets of each neighborhood of the game (data/streets/<id>.json, exported from OpenStreetMap with
 * `npm run streets`) and the network each vehicle sees in them. Built once per neighborhood and vehicle.
 */
import frederiksberg from '../../data/streets/frederiksberg.json'
import norrebro from '../../data/streets/norrebro.json'
import vesterbro from '../../data/streets/vesterbro.json'
import { routing, vehicles } from './balance'
import { bikeProfile, createNetwork, vehicleProfile, type StreetNetwork } from './routing'
import type { LonLat, StreetGraphFile } from './streetGraph'

/** Neighborhoods with streets, by the id of the Barrios tab. */
export const STREETS: Readonly<Record<string, StreetGraphFile>> = {
  norrebro: norrebro as unknown as StreetGraphFile,
  vesterbro: vesterbro as unknown as StreetGraphFile,
  frederiksberg: frederiksberg as unknown as StreetGraphFile,
}

/**
 * Zones a level can pack restaurants into (Niveles tab, column zone): the middle of each, as [lon, lat].
 * Places, not game numbers: how many restaurants and how close is in the Niveles tab.
 */
export const ZONES: Readonly<Record<string, LonLat>> = {
  // Kødbyen, the old meatpacking district of Vesterbro, full of restaurants.
  kodbyen: [12.5605, 55.6688],
}

/** The first neighborhood: the prototype shift and the levels without one play here. */
export const DEFAULT_NEIGHBORHOOD = 'norrebro'

export function streetsOf(neighborhood: string): StreetGraphFile {
  const streets = STREETS[neighborhood]
  if (!streets) throw new Error(`No hay calles para el barrio ${neighborhood}: falta en scripts/streets/config.json.`)
  return streets
}

const bikeNetworks = new Map<string, StreetNetwork>()
const vehicleNetworks = new Map<string, StreetNetwork>()

/** The streets as a bike sees them: addresses and restaurants are placed on this network. */
export function bikeNetworkOf(neighborhood: string): StreetNetwork {
  let network = bikeNetworks.get(neighborhood)
  if (!network) {
    network = createNetwork(streetsOf(neighborhood), bikeProfile(routing))
    bikeNetworks.set(neighborhood, network)
  }
  return network
}

/** The streets as a vehicle of the Vehículos tab sees them. */
export function networkOf(neighborhood: string, vehicle: string): StreetNetwork {
  const key = `${neighborhood}:${vehicle}`
  let network = vehicleNetworks.get(key)
  if (!network) {
    const row = vehicles[vehicle]
    if (!row) throw new Error(`El vehículo ${vehicle} no está en la hoja Vehículos.`)
    network = createNetwork(streetsOf(neighborhood), vehicleProfile(vehicle, row, routing))
    vehicleNetworks.set(key, network)
  }
  return network
}
