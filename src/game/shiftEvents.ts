/**
 * Events of a shift (Eventos de turno tab): modifiers that last a while, from one second of the shift to another.
 * They can be announced in the briefing or come as a surprise. Rain slows every vehicle by its rainSpeedPct and
 * brings more orders (demandPct). Pure.
 */
import type { Speeds } from './movement'

/** One event of a level's shift. */
export interface ShiftEvent {
  /** Row id of the Eventos de turno tab, e.g. "vesterbro_dinner_rain". */
  readonly id: string
  /** Kind, a row of the Eventos tab, e.g. "rain". */
  readonly event: string
  readonly fromSec: number
  readonly toSec: number
  /** Told in the briefing; otherwise it is a surprise. */
  readonly announced: boolean
  /** Wind: where it blows from, in degrees (0 = north, 90 = east, 270 = west). */
  readonly directionDeg?: number
}

/** What a kind of event does (Eventos tab), only what the game uses so far. */
export interface EventKind {
  readonly effectType: string
  /** Extra orders while it lasts (0.3 = 30 % more). */
  readonly demandPct?: number
}

/** A vehicle row with its speed change for each speed event: rainSpeedPct, snowSpeedPct… */
export type VehicleSpeedChanges = object

/** The events going on at this second of the shift. */
export function activeEvents(events: readonly ShiftEvent[], nowSec: number): ShiftEvent[] {
  return events.filter((event) => nowSec >= event.fromSec && nowSec < event.toSec)
}

/** Speed change of a vehicle under an event, from its <event>SpeedPct column (0 when it has none). */
export function speedChangeOf(vehicle: VehicleSpeedChanges | undefined, event: string): number {
  const change = (vehicle as Record<string, unknown> | undefined)?.[`${event}SpeedPct`]
  return typeof change === 'number' ? change : 0
}

/** Every vehicle's speed with the speed events going on (each one multiplies: −10 % is 0.9). */
export function speedsWith(
  speeds: Speeds,
  active: readonly ShiftEvent[],
  kinds: Readonly<Record<string, EventKind>>,
  vehicles: Readonly<Record<string, VehicleSpeedChanges>>,
): Speeds {
  const slowing = active.filter((event) => kinds[event.event]?.effectType === 'speed')
  if (slowing.length === 0) return speeds
  return Object.fromEntries(
    Object.entries(speeds).map(([vehicle, metersPerSec]) => {
      const factor = slowing.reduce((product, event) => product * (1 + speedChangeOf(vehicles[vehicle], event.event)), 1)
      return [vehicle, metersPerSec * factor]
    }),
  )
}

/** A stretch of the shift with more (or fewer) orders: they come demand times as often. */
export interface DemandWindow {
  readonly fromSec: number
  readonly toSec: number
  readonly demand: number
}

/** The stretches of the shift where events change how many orders come. */
export function demandWindows(events: readonly ShiftEvent[], kinds: Readonly<Record<string, EventKind>>): DemandWindow[] {
  return events.flatMap((event) => {
    const extra = kinds[event.event]?.demandPct
    return extra ? [{ fromSec: event.fromSec, toSec: event.toSec, demand: 1 + extra }] : []
  })
}

/** How many times as often orders come at this second (1 without events). */
export function demandAt(windows: readonly DemandWindow[] | undefined, atSec: number): number {
  return (windows ?? []).reduce(
    (product, window) => (atSec >= window.fromSec && atSec < window.toSec ? product * window.demand : product),
    1,
  )
}
