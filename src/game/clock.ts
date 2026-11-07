/**
 * The shift clock. Game time only moves through tick(dt), so pause, fast speed and tests
 * all work the same way. Pure: every function returns a new clock.
 */

export interface ShiftClock {
  /** Length of the shift, in seconds of play. */
  readonly durationSec: number
  /** Seconds played so far. */
  readonly elapsedSec: number
  readonly paused: boolean
  /** Seconds of play per real second (1 at normal speed). */
  readonly speed: number
  readonly finished: boolean
}

export function createClock(durationSec: number): ShiftClock {
  return { durationSec, elapsedSec: 0, paused: false, speed: 1, finished: false }
}

/** Advances the clock by dtSec real seconds. Does nothing while paused or after the shift ends. */
export function tick(clock: ShiftClock, dtSec: number): ShiftClock {
  if (clock.paused || clock.finished || dtSec <= 0) return clock
  const elapsedSec = Math.min(clock.durationSec, clock.elapsedSec + dtSec * clock.speed)
  return { ...clock, elapsedSec, finished: elapsedSec >= clock.durationSec }
}

export function togglePause(clock: ShiftClock): ShiftClock {
  if (clock.finished) return clock
  return { ...clock, paused: !clock.paused }
}

export function setSpeed(clock: ShiftClock, speed: number): ShiftClock {
  return { ...clock, speed }
}

export function remainingSec(clock: ShiftClock): number {
  return clock.durationSec - clock.elapsedSec
}
