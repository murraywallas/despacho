import { economy, eventKinds, experience, fleetOf, levels, neighborhoods, struckOf, vehicles } from '../game/balance'
import { salariesKr } from '../game/experience'
import {
  canStart,
  chosenFleet,
  garageRules,
  suggestedFleet,
  weatherAdvice,
  type GarageRules,
  type WeatherAdvice,
} from '../game/garage'
import { balanceFor } from '../game/levels'
import { extraCostKr } from '../game/money'
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
  /** What the fleet chosen costs per shift: vehicles beyond the level's free fleet, and salaries. */
  readonly costKr: number
  /** The level's own fleet: it goes out free (#141). */
  readonly base: readonly string[]
  readonly moneyKr: number
  readonly hired: number
  /** The fleet can be paid with the money in hand (or it is a single rider). */
  readonly canStart: boolean
  readonly hireKr: number
  /** As many extra riders are hired as can go out in a shift: no more hiring (#146). */
  readonly hiredAll: boolean
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
  const rules = garageRules(levelFleet, neighborhoods[levels[levelId].neighborhood]?.vehicles ?? levelFleet, hired, struck, economy.maxExtraRiders)
  const advice = weatherAdvice(suggestedFleet(levelFleet, rules), balance.events ?? [], eventKinds, vehicles, rules.vehicles)
  const suggested = advice?.fleet ?? suggestedFleet(levelFleet, rules)
  const fleet = chosenFleet(saved, suggested, rules)
  // Riders 1 to n go out: their salaries are part of the shift's cost.
  const salaries = salariesKr(xp, fleet.length, experience)
  // The level's own fleet comes free: the suggested one (with the weather swap).
  const base = suggested.slice(0, levelFleet.length)
  return {
    fleet,
    suggested,
    base,
    advice,
    rules,
    struck,
    costKr: extraCostKr(fleet, base, vehicleCostKr) + salaries,
    moneyKr,
    hired,
    canStart: canStart(fleet, moneyKr, vehicleCostKr, salaries, base),
    hireKr: economy.hireRiderKr,
    hiredAll: hired >= economy.maxExtraRiders,
    setFleet: (next) => chooseFleet(levelId, next),
    hire,
  }
}
