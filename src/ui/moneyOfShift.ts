import { economy, experience, prototype, vehicles } from '../game/balance'
import { salaryKr } from '../game/experience'
import { suggestedFleetOf } from '../game/campaign'
import { shiftMoney, type ShiftMoney } from '../game/money'
import type { Order } from '../game/orders'

/** What a vehicle of the Vehículos tab costs per shift. */
function costOf(vehicle: string): number {
  return vehicles[vehicle]?.costPerShiftKr ?? 0
}

/**
 * The money of a shift with the game's numbers: the orders the riders handled, their salaries, and what their
 * vehicles cost beyond the level's own fleet, which comes free (#141).
 */
export function moneyOfShift(
  orders: readonly Order[],
  riders: readonly { readonly vehicle: string; readonly level?: number }[],
  levelId: string | null = null,
): ShiftMoney {
  return shiftMoney(
    orders,
    riders.map((rider) => rider.vehicle),
    costOf,
    prototype.heat,
    prototype.rating,
    economy,
    riders.reduce((sum, rider) => sum + salaryKr(rider.level ?? 0, experience), 0),
    levelId ? suggestedFleetOf(levelId) : [],
  )
}
