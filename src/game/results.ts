/**
 * End of the shift: the numbers of the results screen and whether the player won. Pure.
 */
import type { Order } from './orders'
import { averageRating, heatOf, isCold, isLate, type HeatSettings, type RatingSettings } from './rating'

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

/** Stars lost in the shift, by cause: lateness, cold food and cancelled orders. */
export interface StarsLost {
  readonly late: number
  readonly cold: number
  readonly cancelled: number
}

/**
 * Where the stars went. Each delivered order loses its late and cold penalties (never below the minimum, late
 * counted first); each cancelled order loses the difference between a perfect delivery and a cancellation.
 */
export function starsLost(orders: readonly Order[], heat: HeatSettings, rating: RatingSettings): StarsLost {
  let late = 0
  let cold = 0
  let cancelled = 0
  for (const order of orders) {
    if (order.status === 'cancelled') {
      cancelled += rating.max - rating.cancelled
      continue
    }
    if (order.status !== 'delivered') continue
    let room = rating.max - rating.min
    if (isLate(order)) {
      const lost = Math.min(rating.latePenalty, room)
      late += lost
      room -= lost
    }
    if (isCold(heatOf(order, order.deliveredAtSec ?? 0, heat), heat)) cold += Math.min(rating.coldPenalty, room)
  }
  return { late, cold, cancelled }
}

/** What each cause took off the shift's average (the average is max minus these, over the finished orders). */
export function averageLost(lost: StarsLost, finished: number): StarsLost {
  if (finished === 0) return { late: 0, cold: 0, cancelled: 0 }
  return { late: lost.late / finished, cold: lost.cold / finished, cancelled: lost.cancelled / finished }
}

/** The cause that cost the most stars, for the tip of the results screen; none when nothing was lost. */
export function biggestLoss(lost: StarsLost): keyof StarsLost | 'none' {
  const causes = (['cancelled', 'late', 'cold'] as const).filter((cause) => lost[cause] > 0)
  if (causes.length === 0) return 'none'
  return causes.reduce((worst, cause) => (lost[cause] > lost[worst] ? cause : worst))
}
