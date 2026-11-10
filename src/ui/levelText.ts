import { clock } from '../game/balance'
import { balanceFor } from '../game/levels'
import { hasText, t } from '../i18n'
import { formatGameTime, type GameTime } from './formatClock'

/** The game clock of a level: its own start hour. */
export function gameTimeOf(levelId: string | null): GameTime {
  return { startHour: balanceFor(levelId).shift.startHour, gameSecondsPerRealSecond: clock.gameSecondsPerRealSecond }
}

/** "Almuerzo"; the id itself when es.json has no name for it. */
export function levelName(levelId: string): string {
  const key = `levels.${levelId}.name`
  return hasText(key) ? t(key) : levelId
}

export function levelTagline(levelId: string): string {
  const key = `levels.${levelId}.tagline`
  return hasText(key) ? t(key) : ''
}

/** "12:00 a 13:10". */
export function levelHours(levelId: string): string {
  const time = gameTimeOf(levelId)
  const from = formatGameTime(0, time)
  const to = formatGameTime(balanceFor(levelId).shift.durationSec, time)
  return t('levels.hours', { from, to })
}

/** "Nørrebro". */
export function neighborhoodName(id: string): string {
  const key = `neighborhoods.${id}`
  return hasText(key) ? t(key) : id
}
