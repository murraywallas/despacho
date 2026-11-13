import { economy, fleetOf, levels, neighborhoods, vehicles } from '../game/balance'
import { canStart, canUseMoreRiders, chosenFleet, garageRules, suggestedFleet, type GarageRules } from '../game/garage'
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
  readonly rules: GarageRules
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
  const levelFleet = fleetOf(balanceFor(levelId))
  const rules = garageRules(levelFleet, neighborhoods[levels[levelId].neighborhood]?.vehicles ?? levelFleet, hired)
  const fleet = chosenFleet(saved, levelFleet, rules)
  return {
    fleet,
    suggested: suggestedFleet(levelFleet, rules),
    rules,
    costKr: fleetCostKr(fleet, vehicleCostKr),
    moneyKr,
    hired,
    canStart: canStart(fleet, moneyKr, vehicleCostKr),
    canHireHere: canUseMoreRiders(levelFleet, hired),
    hireKr: economy.hireRiderKr,
    setFleet: (next) => chooseFleet(levelId, next),
    hire,
  }
}
