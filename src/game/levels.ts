/**
 * The levels of a neighborhood and the player's progress through them: which ones are open, the best stars of
 * each, and what the briefing tells before a shift. Pure.
 */
import { fleetOf, levelBalance, levelIds, levels, prototype, type PrototypeBalance } from './balance'
import type { RestaurantCluster } from './cityMap'
import { bikeNetworkOf, DEFAULT_NEIGHBORHOOD, networkOf, ZONES } from './neighborhoods'
import { spawnIntervalAt, type OrderSettings } from './orders'
import { createShift } from './shift'

/** Best average stars reached in each level, by level id. A level never finished is missing. */
export type Progress = Readonly<Record<string, number>>

/** The rules of a level; null is the prototype shift of the Reglas tab (the one the rule tests play). */
export function balanceFor(levelId: string | null, base: PrototypeBalance = prototype): PrototypeBalance {
  const level = levelId === null ? undefined : levels[levelId]
  return level ? levelBalance(base, level) : base
}

/** The level after this one, if any. */
export function nextLevel(levelIds: readonly string[], levelId: string): string | undefined {
  const index = levelIds.indexOf(levelId)
  return index < 0 ? undefined : levelIds[index + 1]
}

/** The first level is always open; each next one opens with enough stars in the one before. */
export function isUnlocked(
  levelIds: readonly string[],
  progress: Progress,
  levelId: string,
  unlockAvgRating: number,
): boolean {
  const index = levelIds.indexOf(levelId)
  if (index < 0) return false
  if (index === 0) return true
  return (progress[levelIds[index - 1]] ?? 0) >= unlockAvgRating
}

/** Keeps the best result of each level. Returns the same progress when the new result is not better. */
export function recordResult(progress: Progress, levelId: string, average: number): Progress {
  const best = progress[levelId]
  if (best !== undefined && best >= average) return progress
  return { ...progress, [levelId]: average }
}

/** How many orders the shift will bring (the kitchen closes at lastSpawnBeforeSec). */
export function expectedOrders(settings: OrderSettings): number {
  let count = 0
  for (let atSec = spawnIntervalAt(settings, 0); atSec < settings.lastSpawnBeforeSec; atSec += spawnIntervalAt(settings, atSec)) {
    count++
  }
  return count
}

export interface Briefing {
  /** One vehicle id per rider. */
  readonly fleet: readonly string[]
  readonly orders: number
  readonly deadlineSec: number
  /** Seconds of the shift when the rush starts and ends, if there is one. */
  readonly peak?: { readonly fromSec: number; readonly toSec: number }
}

/** What the player is told before the shift starts. */
export function briefingOf(balance: PrototypeBalance, settings: OrderSettings): Briefing {
  const peak = settings.peak
  return {
    fleet: fleetOf(balance),
    orders: expectedOrders(settings),
    deadlineSec: settings.deadlineSec,
    ...(peak ? { peak: { fromSec: peak.fromSec, toSec: peak.toSec } } : {}),
  }
}

/** Neighborhood a level plays in; the prototype plays in the first one. */
export function neighborhoodOf(levelId: string | null): string {
  const level = levelId === null ? undefined : levels[levelId]
  return level?.neighborhood ?? DEFAULT_NEIGHBORHOOD
}

/** Where a level packs restaurants together, if it does. */
export function clusterOf(balance: PrototypeBalance): RestaurantCluster | undefined {
  const { zone, zoneRestaurants, zoneRadiusM } = balance.restaurants
  if (!zone || !zoneRestaurants || !zoneRadiusM) return undefined
  const center = ZONES[zone]
  if (!center) throw new Error(`La zona ${zone} de la hoja Niveles no está en neighborhoods.ts.`)
  return { center, radiusM: zoneRadiusM, count: zoneRestaurants }
}

/** A fresh shift with these rules and seed, on the streets of a neighborhood. */
export function createAreaShift(balance: PrototypeBalance, seed: number, area: string): ReturnType<typeof createShift> {
  return createShift(balance, seed, bikeNetworkOf(area), (vehicle) => networkOf(area, vehicle), clusterOf(balance))
}

/** A fresh shift of a level, on its neighborhood's streets. */
export function createLevelShift(levelId: string | null): ReturnType<typeof createShift> {
  const balance = balanceFor(levelId)
  return createAreaShift(balance, balance.seed, neighborhoodOf(levelId))
}

/** Neighborhoods with levels, in the order they are played. */
export function levelNeighborhoods(ids: readonly string[] = levelIds): string[] {
  return [...new Set(ids.map((id) => neighborhoodOf(id)))]
}

/** The levels of a neighborhood, in order. */
export function levelsOf(neighborhood: string, ids: readonly string[] = levelIds): string[] {
  return ids.filter((id) => neighborhoodOf(id) === neighborhood)
}
