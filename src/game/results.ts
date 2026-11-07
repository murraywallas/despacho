/**
 * End of the shift: the numbers of the results screen and whether the player won. Pure.
 */
import type { Order } from './orders'
import { averageRating, isLate, type HeatSettings, type RatingSettings } from './rating'

/** win: at least winAtLeast stars. close: between loseBelow and winAtLeast. lose: below loseBelow. */
export type ShiftOutcome = 'win' | 'close' | 'lose'

export interface OutcomeThresholds {
  readonly winAtLeast: number
  readonly loseBelow: number
}

export interface ShiftResults {
  /** Average stars of the shift; undefined when no order was delivered or cancelled. */
  readonly average: number | undefined
  readonly delivered: number
  /** Delivered after the deadline (also counted in delivered). */
  readonly late: number
  readonly cancelled: number
  readonly outcome: ShiftOutcome
}

/** A shift without any stars counts as lost: nobody got their food. */
export function outcomeOf(average: number | undefined, thresholds: OutcomeThresholds): ShiftOutcome {
  if (average === undefined || average < thresholds.loseBelow) return 'lose'
  if (average >= thresholds.winAtLeast) return 'win'
  return 'close'
}

export function summarizeShift(
  orders: readonly Order[],
  heat: HeatSettings,
  rating: RatingSettings,
  thresholds: OutcomeThresholds,
): ShiftResults {
  const delivered = orders.filter((order) => order.status === 'delivered')
  const average = averageRating(orders, heat, rating)
  return {
    average,
    delivered: delivered.length,
    late: delivered.filter(isLate).length,
    cancelled: orders.filter((order) => order.status === 'cancelled').length,
    outcome: outcomeOf(average, thresholds),
  }
}
