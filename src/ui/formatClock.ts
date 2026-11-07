const SECONDS_PER_MINUTE = 60

/** Formats seconds as mm:ss, rounding up so the clock shows 00:00 only when time is really over. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(total / SECONDS_PER_MINUTE)
  const rest = total % SECONDS_PER_MINUTE
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 24

/** How the game clock relates to seconds of play. */
export interface GameTime {
  /** Hour of the game clock when the shift starts (18 = 18:00). */
  readonly startHour: number
  /** Game seconds that pass in one second of play. */
  readonly gameSecondsPerRealSecond: number
}

/** Game clock time at a second of the shift: "18:23". */
export function formatGameTime(elapsedSec: number, time: GameTime): string {
  const minutes = Math.floor(
    time.startHour * MINUTES_PER_HOUR + (elapsedSec * time.gameSecondsPerRealSecond) / SECONDS_PER_MINUTE,
  )
  const hour = Math.floor(minutes / MINUTES_PER_HOUR) % HOURS_PER_DAY
  return `${String(hour).padStart(2, '0')}:${String(minutes % MINUTES_PER_HOUR).padStart(2, '0')}`
}

/** Seconds of play as whole game minutes, rounded up so "0 min" means really nothing left. */
export function gameMinutes(seconds: number, time: GameTime): number {
  return Math.max(0, Math.ceil((seconds * time.gameSecondsPerRealSecond) / SECONDS_PER_MINUTE - 1e-9))
}
