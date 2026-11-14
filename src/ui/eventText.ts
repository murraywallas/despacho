import { eventKinds } from '../game/balance'
import { hasText, t } from '../i18n'

const PERCENT = 100

/** "Lluvia"; the id itself when es.json has no name for it. */
export function eventName(event: string): string {
  const key = `events.${event}.name`
  return hasText(key) ? t(key) : event
}

/** What the event does, for the player: "Todos van más lentos… y llegan un 30 % más de pedidos." */
export function eventEffect(event: string): string {
  const key = `events.${event}.effect`
  const demand = Math.round((eventKinds[event]?.demandPct ?? 0) * PERCENT)
  return hasText(key) ? t(key, { demand }) : ''
}
