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
  /**
   * The closing hour passed, but riders still carry food: the clock keeps going (past durationSec) until they
   * deliver it, and only then the shift is finished.
   */
  readonly closing: boolean
  readonly finished: boolean
}

export function createClock(durationSec: number): ShiftClock {
  return { durationSec, elapsedSec: 0, paused: false, speed: 1, closing: false, finished: false }
}

/**
 * Advances the clock by dtSec real seconds. Does nothing while paused or after the shift ends. It stops at the
 * closing hour, unless the shift is closing (then it goes on until finishClosing).
 */
export function tick(clock: ShiftClock, dtSec: number): ShiftClock {
  if (clock.paused || clock.finished || dtSec <= 0) return clock
  if (clock.closing) return { ...clock, elapsedSec: clock.elapsedSec + dtSec * clock.speed }
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

/** The closing hour came with food on its way: the clock goes on, at closingSpeed, until it is delivered. */
export function startClosing(clock: ShiftClock, closingSpeed: number): ShiftClock {
  return { ...clock, closing: true, finished: false, speed: closingSpeed }
}

/** The last food on its way was delivered: now the shift is finished. */
export function finishClosing(clock: ShiftClock): ShiftClock {
  return { ...clock, closing: false, finished: true }
}

/** The shift no longer takes orders or dispatches: closing (finishing deliveries) or finished. */
export function isOver(clock: Pick<ShiftClock, 'closing' | 'finished'>): boolean {
  return clock.closing || clock.finished
}

/** Seconds of play to show on the clock: it stays at the closing hour while the last deliveries finish. */
export function shownSec(clock: Pick<ShiftClock, 'elapsedSec' | 'durationSec'>): number {
  return Math.min(clock.elapsedSec, clock.durationSec)
}
