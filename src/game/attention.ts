/**
 * Riders who just became free: the key fact of triage, so the game points at them. A rider who goes free stands
 * out for a few seconds, and for as long as orders are waiting, until they get an order or the player looks at
 * them (picks them). Pure.
 */
import type { Rider } from './riders'

/** Second of the shift each free rider went free, by rider id: the ones the game is pointing at. */
export type FreeSince = Readonly<Record<string, number>>

/** Riders who were busy (riding, at a kitchen, recharging) and are free now. */
export function ridersFreed(before: readonly Rider[], after: readonly Rider[]): Rider[] {
  const was = new Map(before.map((rider) => [rider.id, rider.status]))
  return after.filter((rider) => rider.status === 'idle' && was.has(rider.id) && was.get(rider.id) !== 'idle')
}

/**
 * The riders to point at after a step: the ones that just went free join (since nowSec), the ones that got busy
 * again leave. Returns the same object when nothing changed.
 */
export function updateFreeSince(previous: FreeSince, before: readonly Rider[], after: readonly Rider[], nowSec: number): FreeSince {
  const freed = ridersFreed(before, after)
  const busy = new Set(after.filter((rider) => rider.status !== 'idle').map((rider) => rider.id))
  const leaving = Object.keys(previous).filter((id) => busy.has(id))
  if (freed.length === 0 && leaving.length === 0) return previous
  const next: Record<string, number> = { ...previous }
  for (const id of leaving) delete next[id]
  for (const rider of freed) next[rider.id] = nowSec
  return next
}

/** The player looked at this rider (picked them): stop pointing at them. */
export function markSeen(previous: FreeSince, riderId: string): FreeSince {
  if (!(riderId in previous)) return previous
  const next: Record<string, number> = { ...previous }
  delete next[riderId]
  return next
}

/**
 * Whether a rider stands out now: went free and not seen yet, and either orders are waiting (then until they get
 * one) or it was less than highlightSec ago.
 */
export function needsAttention(freeSince: FreeSince, riderId: string, nowSec: number, waiting: number, highlightSec: number): boolean {
  const since = freeSince[riderId]
  if (since === undefined) return false
  return waiting > 0 || nowSec - since < highlightSec
}
