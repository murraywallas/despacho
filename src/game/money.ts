/**
 * The money of a shift: what the deliveries pay, what the fleet costs and what is left. Pure.
 */
import type { Order } from './orders'
import { isLate, ratingOf, type HeatSettings, type RatingSettings } from './rating'

export interface MoneySettings {
  /** What each delivery on time pays, before the tip, in kr. */
  readonly deliveryPayKr: number
  /** Tip per star of the delivery, in kr. */
  readonly tipPerStarKr: number
}

export interface ShiftMoney {
  /** Base pay of the deliveries on time. */
  readonly payKr: number
  /** Tips of those deliveries, by their stars. */
  readonly tipsKr: number
  /** What the riders cost: their vehicles' cost per shift, beyond the level's free fleet. */
  readonly costKr: number
  /** The riders' salaries, by their level. */
  readonly salariesKr: number
  /** payKr + tipsKr − costKr − salariesKr; negative when the shift lost money. */
  readonly profitKr: number
}

/** What one order pays: base plus tip when delivered on time; nothing when late, cancelled or not delivered. */
export function orderEarningsKr(
  order: Order,
  heat: HeatSettings,
  rating: RatingSettings,
  money: MoneySettings,
): { payKr: number; tipsKr: number } {
  if (order.status !== 'delivered' || isLate(order)) return { payKr: 0, tipsKr: 0 }
  const stars = ratingOf(order, heat, rating) ?? 0
  return { payKr: money.deliveryPayKr, tipsKr: money.tipPerStarKr * stars }
}

/** What the fleet costs for one shift: each rider's vehicle cost per shift. */
export function fleetCostKr(fleet: readonly string[], costOf: (vehicle: string) => number): number {
  return fleet.reduce((sum, vehicle) => sum + costOf(vehicle), 0)
}

/**
 * What the player pays for a fleet when the level's own fleet (base) comes free (#141): for each rider of the base,
 * only what a dearer vehicle costs over the base one (nothing back for a cheaper one); each rider beyond the base,
 * their whole vehicle. Without a base, the whole fleet.
 */
export function extraCostKr(fleet: readonly string[], base: readonly string[], costOf: (vehicle: string) => number): number {
  return fleet.reduce((sum, vehicle, index) => {
    const included = base[index]
    return sum + (included === undefined ? costOf(vehicle) : Math.max(0, costOf(vehicle) - costOf(included)))
  }, 0)
}

/**
 * Income, cost and profit of a finished shift; salariesKr are the riders' salaries for it. baseFleet is the level's
 * own fleet, which comes free: only what goes beyond it is paid.
 */
export function shiftMoney(
  orders: readonly Order[],
  fleet: readonly string[],
  costOf: (vehicle: string) => number,
  heat: HeatSettings,
  rating: RatingSettings,
  money: MoneySettings,
  salariesKr = 0,
  baseFleet: readonly string[] = [],
): ShiftMoney {
  let payKr = 0
  let tipsKr = 0
  for (const order of orders) {
    const earned = orderEarningsKr(order, heat, rating, money)
    payKr += earned.payKr
    tipsKr += earned.tipsKr
  }
  const costKr = extraCostKr(fleet, baseFleet, costOf)
  return { payKr, tipsKr, costKr, salariesKr, profitKr: payKr + tipsKr - costKr - salariesKr }
}
