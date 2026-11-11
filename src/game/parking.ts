/**
 * Parking: a motorbike or a car needs time to park at each stop (restaurant and customer); bikes, scooters,
 * skateboards and rollers ride up to the door. The minutes come from the Vehículos tab, in game time. Pure.
 */
import { clock, vehicles } from './balance'

const SECONDS_PER_MINUTE = 60

/** Seconds of play a vehicle spends parking at each stop (0 for the ones that don't park). */
export function parkingSecOf(vehicle: string): number {
  return ((vehicles[vehicle]?.parkingMin ?? 0) * SECONDS_PER_MINUTE) / clock.gameSecondsPerRealSecond
}
