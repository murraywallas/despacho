/**
 * Riders get better with use: every delivery gives experience, enough experience is a level, and each level makes
 * the rider faster. A course (paid) takes a rider to the next level at once. The riders are the places hired:
 * rider 1 of the garage is always the same person. Pure.
 */
import type { Order } from './orders'

export interface ExperienceRules {
  readonly xpPerDelivery: number
  readonly xpPerLevel: number
  readonly maxLevel: number
  /** Extra speed per level, as a share (0.05 = 5 %). */
  readonly speedBonusPerLevelPct: number
  /** Price of a course that takes a rider up one level, in kr. */
  readonly trainingKr: number
}

/** A rider's level from their experience (0 to maxLevel). */
export function levelOf(xp: number, rules: ExperienceRules): number {
  return Math.min(rules.maxLevel, Math.floor(Math.max(0, xp) / rules.xpPerLevel))
}

/** Extra speed of a level, as a share: level 2 with 5 % per level is 0.1. */
export function speedBonusOf(level: number, rules: ExperienceRules): number {
  return level * rules.speedBonusPerLevelPct
}

/** Experience of each rider (by place, 0 = rider 1), as long as the riders hired; new places start at zero. */
export function xpOfRiders(xp: readonly number[], hired: number): number[] {
  return Array.from({ length: hired }, (_, index) => xp[index] ?? 0)
}

/**
 * The experience after a shift: each rider gets xpPerDelivery for every order they delivered (late ones too: the
 * rider still rode it). Rider number n is place n − 1.
 */
export function addShiftXp(
  xp: readonly number[],
  riders: readonly { readonly id: string; readonly number: number }[],
  orders: readonly Order[],
  rules: ExperienceRules,
): number[] {
  const next = [...xp]
  for (const rider of riders) {
    const delivered = orders.filter((order) => order.status === 'delivered' && order.riderId === rider.id).length
    const place = rider.number - 1
    next[place] = (next[place] ?? 0) + delivered * rules.xpPerDelivery
  }
  return next
}

/**
 * A course for one rider: up to the start of the next level, for trainingKr. Undefined when the rider is already at
 * the top level or the money is not enough.
 */
export function train(
  xp: readonly number[],
  place: number,
  moneyKr: number,
  rules: ExperienceRules,
): { xp: number[]; moneyKr: number } | undefined {
  const current = xp[place] ?? 0
  const level = levelOf(current, rules)
  if (level >= rules.maxLevel || moneyKr < rules.trainingKr) return undefined
  const next = [...xp]
  next[place] = (level + 1) * rules.xpPerLevel
  return { xp: next, moneyKr: moneyKr - rules.trainingKr }
}

/** How far into the current level a rider is, from 0 to 1 (1 at the top level). */
export function levelProgress(xp: number, rules: ExperienceRules): number {
  if (levelOf(xp, rules) >= rules.maxLevel) return 1
  return (Math.max(0, xp) % rules.xpPerLevel) / rules.xpPerLevel
}
