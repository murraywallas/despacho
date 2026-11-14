import { eventKinds } from '../game/balance'
import { hasText, t } from '../i18n'
import { VEHICLE_TEXT } from './VehicleIcon'

const PERCENT = 100

/** "Lluvia"; the id itself when es.json has no name for it. */
export function eventName(event: string): string {
  const key = `events.${event}.name`
  return hasText(key) ? t(key) : event
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] as const
const COMPASS_STEP_DEG = 45
const FULL_TURN_DEG = 360

/** "del oeste": where the wind blows from, to the nearest of the eight compass points. */
export function windFromName(directionDeg: number): string {
  const index = Math.round((((directionDeg % FULL_TURN_DEG) + FULL_TURN_DEG) % FULL_TURN_DEG) / COMPASS_STEP_DEG) % COMPASS.length
  return t(`wind.from.${COMPASS[index]}`)
}

/** "Nørrebrogade": the name of a closed route; the id itself when es.json has no name for it. */
export function closureName(closure: string): string {
  const key = `closures.${closure}`
  return hasText(key) ? t(key) : closure
}

/** What the event does, for the player: "Todos van más lentos… y llegan un 30 % más de pedidos." */
export function eventEffect(event: {
  readonly event: string
  readonly directionDeg?: number
  readonly closure?: string
  readonly vehicle?: string
}): string {
  const key = `events.${event.event}.effect`
  const demand = Math.round((eventKinds[event.event]?.demandPct ?? 0) * PERCENT)
  const from = event.directionDeg === undefined ? '' : windFromName(event.directionDeg)
  const route = event.closure === undefined ? '' : closureName(event.closure)
  const vehicleKey = event.vehicle === undefined ? undefined : VEHICLE_TEXT[event.vehicle]
  const vehicle = vehicleKey ? t(vehicleKey).toLocaleLowerCase('es') : (event.vehicle ?? '')
  return hasText(key) ? t(key, { demand, from, route, vehicle }) : ''
}
