const SECONDS_PER_MINUTE = 60

/** Formats seconds as mm:ss, rounding up so the clock shows 00:00 only when time is really over. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(total / SECONDS_PER_MINUTE)
  const rest = total % SECONDS_PER_MINUTE
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}
