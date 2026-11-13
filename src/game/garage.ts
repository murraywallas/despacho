/**
 * The garage, before a shift: which vehicle each rider takes, how many riders go out, and hiring one more.
 * Pure.
 */
import { fleetCostKr } from './money'

export interface GarageRules {
  /** Riders that can go out: the level's suggested fleet, but never more than the player has hired. */
  readonly maxRiders: number
  /** Vehicles of the neighborhood (Barrios tab). */
  readonly vehicles: readonly string[]
}

/** What the player can choose in a level, with this many riders hired. */
export function garageRules(levelFleet: readonly string[], neighborhoodVehicles: readonly string[], hired: number): GarageRules {
  return { maxRiders: Math.max(1, Math.min(levelFleet.length, hired)), vehicles: neighborhoodVehicles }
}

/** The level's fleet (Niveles tab), cut to the riders the player has. */
export function suggestedFleet(levelFleet: readonly string[], rules: GarageRules): string[] {
  return levelFleet.slice(0, rules.maxRiders)
}

/** A fleet the player can take out: one to maxRiders riders, each on a vehicle of the neighborhood. */
export function isValidFleet(fleet: readonly string[], rules: GarageRules): boolean {
  return (
    fleet.length >= 1 && fleet.length <= rules.maxRiders && fleet.every((vehicle) => rules.vehicles.includes(vehicle))
  )
}

/** The fleet saved for the level when it still fits the rules; the suggested one otherwise. */
export function chosenFleet(saved: readonly string[] | undefined, levelFleet: readonly string[], rules: GarageRules): string[] {
  return saved && isValidFleet(saved, rules) ? [...saved] : suggestedFleet(levelFleet, rules)
}

/**
 * Whether the shift can start: the fleet has to be paid with the money in hand. A single rider can always go out,
 * even without money (the money goes below zero), so the player never gets stuck.
 */
export function canStart(fleet: readonly string[], moneyKr: number, costOf: (vehicle: string) => number): boolean {
  if (fleet.length === 0) return false
  return fleet.length === 1 || fleetCostKr(fleet, costOf) <= moneyKr
}

/** Hiring one more rider: costs hireKr once and stays forever. Undefined when the money is not enough. */
export function hireRider(
  moneyKr: number,
  hired: number,
  hireKr: number,
): { moneyKr: number; hired: number } | undefined {
  if (moneyKr < hireKr) return undefined
  return { moneyKr: moneyKr - hireKr, hired: hired + 1 }
}

/** Whether hiring would let more riders go out in this level. */
export function canUseMoreRiders(levelFleet: readonly string[], hired: number): boolean {
  return hired < levelFleet.length
}
