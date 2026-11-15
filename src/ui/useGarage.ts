import { economy, eventKinds, experience, fleetOf, levels, neighborhoods, struckOf, vehicles } from '../game/balance'
import { salariesKr } from '../game/experience'
import {
  canStart,
  canUseMoreRiders,
  chosenFleet,
  garageRules,
  suggestedFleet,
  weatherAdvice,
  type GarageRules,
  type WeatherAdvice,
} from '../game/garage'
import { balanceFor } from '../game/levels'
import { fleetCostKr } from '../game/money'
import { useProgressStore } from '../store/progressStore'

/** What a vehicle of the Vehículos tab costs per shift. */
export function vehicleCostKr(vehicle: string): number {
  return vehicles[vehicle]?.costPerShiftKr ?? 0
}

export interface Garage {
  readonly fleet: readonly string[]
  readonly suggested: readonly string[]
  /** Bad weather announced: the suggested fleet already swaps the vehicles it slows down too much. */
  readonly advice?: WeatherAdvice
  readonly rules: GarageRules
  /** Vehicles of the neighborhood on strike in this shift: shown, but can't be chosen. */
  readonly struck: readonly string[]
  /** Vehicles and salaries of the fleet chosen, for one shift. */
  readonly costKr: number
  readonly moneyKr: number
  readonly hired: number
  /** The fleet can be paid with the money in hand (or it is a single rider). */
  readonly canStart: boolean
  /** Hiring would let one more rider go out in this level. */
  readonly canHireHere: boolean
  readonly hireKr: number
  readonly setFleet: (fleet: readonly string[]) => void
  readonly hire: () => void
}

/** The garage of a level: the fleet chosen for it, what it costs and what the money allows. */
export function useGarage(levelId: string): Garage {
  const saved = useProgressStore((state) => state.fleets[levelId])
  const moneyKr = useProgressStore((state) => state.moneyKr)
  const hired = useProgressStore((state) => state.hired)
  const chooseFleet = useProgressStore((state) => state.chooseFleet)
  const hire = useProgressStore((state) => state.hire)
  const xp = useProgressStore((state) => state.xp)
  const balance = balanceFor(levelId)
  const levelFleet = fleetOf(balance)
  const struck = struckOf(levels[levelId])
  const rules = garageRules(levelFleet, neighborhoods[levels[levelId].neighborhood]?.vehicles ?? levelFleet, hired, struck)
  const advice = weatherAdvice(suggestedFleet(levelFleet, rules), balance.events ?? [], eventKinds, vehicles, rules.vehicles)
  const suggested = advice?.fleet ?? suggestedFleet(levelFleet, rules)
  const fleet = chosenFleet(saved, suggested, rules)
  // Riders 1 to n go out: their salaries are part of the shift's cost.
  const salaries = salariesKr(xp, fleet.length, experience)
  return {
    fleet,
    suggested,
    advice,
    rules,
    struck,
    costKr: fleetCostKr(fleet, vehicleCostKr) + salaries,
    moneyKr,
    hired,
    canStart: canStart(fleet, moneyKr, vehicleCostKr, salaries),
    canHireHere: canUseMoreRiders(levelFleet, hired),
    hireKr: economy.hireRiderKr,
    setFleet: (next) => chooseFleet(levelId, next),
    hire,
  }
}
