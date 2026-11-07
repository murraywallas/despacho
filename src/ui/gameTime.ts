import { clock, prototype } from '../game/balance'
import type { GameTime } from './formatClock'

/** The game clock of the prototype shift, from balance.json. */
export const gameTime: GameTime = {
  startHour: prototype.shift.startHour,
  gameSecondsPerRealSecond: clock.gameSecondsPerRealSecond,
}
