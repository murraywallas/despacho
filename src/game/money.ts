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
  /** What the riders cost: their vehicles' cost per shift. */
  readonly costKr: number
  /** payKr + tipsKr − costKr; negative when the shift lost money. */
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

/** Income, cost and profit of a finished shift. */
export function shiftMoney(
  orders: readonly Order[],
  fleet: readonly string[],
  costOf: (vehicle: string) => number,
  heat: HeatSettings,
  rating: RatingSettings,
  money: MoneySettings,
): ShiftMoney {
  let payKr = 0
  let tipsKr = 0
  for (const order of orders) {
    const earned = orderEarningsKr(order, heat, rating, money)
    payKr += earned.payKr
    tipsKr += earned.tipsKr
  }
  const costKr = fleetCostKr(fleet, costOf)
  return { payKr, tipsKr, costKr, profitKr: payKr + tipsKr - costKr }
}
