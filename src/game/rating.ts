/**
 * Food heat and stars. Heat drops from the moment the kitchen has the food ready until it reaches the customer,
 * so food waiting for a rider gets cold too.
 * Each delivery gets stars (late and cold cost stars); a cancelled order counts as the cancelled rating. Pure.
 */
import type { Order } from './orders'

export interface HeatSettings {
  readonly start: number
  readonly lossPerSec: number
  /** Food below this heat is cold. */
  readonly coldBelow: number
}

export interface RatingSettings {
  readonly max: number
  readonly latePenalty: number
  readonly coldPenalty: number
  readonly min: number
  readonly cancelled: number
}

/** Heat of the order's food at second of the shift nowSec. Full until it is ready; frozen once delivered. */
export function heatOf(order: Order, nowSec: number, settings: HeatSettings): number {
  const until = order.deliveredAtSec ?? nowSec
  const coolingSec = Math.max(0, until - order.readyAtSec)
  return Math.max(0, settings.start - settings.lossPerSec * coolingSec)
}

/** True once the kitchen has the food ready. */
export function isReady(order: Order, nowSec: number): boolean {
  return nowSec >= order.readyAtSec
}

export function isCold(heat: number, settings: HeatSettings): boolean {
  return heat < settings.coldBelow
}

export function isLate(order: Order): boolean {
  return order.deliveredAtSec !== undefined && order.deliveredAtSec > order.deadlineAtSec
}

/** Stars an order earned, or undefined while it is still in play. */
export function ratingOf(order: Order, heat: HeatSettings, rating: RatingSettings): number | undefined {
  if (order.status === 'cancelled') return rating.cancelled
  if (order.status !== 'delivered') return undefined
  let stars = rating.max
  if (isLate(order)) stars -= rating.latePenalty
  if (isCold(heatOf(order, order.deliveredAtSec ?? 0, heat), heat)) stars -= rating.coldPenalty
  return Math.max(rating.min, stars)
}

/** Average stars of the finished orders (delivered or cancelled), or undefined when none has finished yet. */
export function averageRating(orders: readonly Order[], heat: HeatSettings, rating: RatingSettings): number | undefined {
  const stars = orders.flatMap((order) => {
    const value = ratingOf(order, heat, rating)
    return value === undefined ? [] : [value]
  })
  if (stars.length === 0) return undefined
  return stars.reduce((sum, value) => sum + value, 0) / stars.length
}
