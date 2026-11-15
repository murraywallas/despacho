import type { WeatherAdvice } from '../game/garage'
import { t } from '../i18n'
import { EventIcon } from './EventNotices'
import { eventName } from './eventText'
import { VEHICLE_TEXT } from './VehicleIcon'

/** "skate": a vehicle's name in lower case, for the middle of a sentence. */
function lowerName(vehicle: string): string {
  const key = VEHICLE_TEXT[vehicle]
  return (key ? t(key) : vehicle).toLocaleLowerCase('es')
}

/** "skate y rollers": a list the Spanish way. */
function listOf(names: readonly string[]): string {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} ${t('list.and')} ${names.at(-1)}`
}

/**
 * Bad weather announced: which vehicles slow down too much, and what the suggested fleet takes instead. When the
 * fleet chosen still has some of them, it names those and says what to take instead.
 */
export function WeatherAdviceNote({
  advice,
  fleet,
  className,
  testId,
}: {
  advice: WeatherAdvice
  fleet: readonly string[]
  className: string
  testId: string
}) {
  // The slow vehicles still in the fleet chosen: those are the ones to change.
  const kept = advice.slow.filter((vehicle) => fleet.includes(vehicle))
  const slow = listOf((kept.length > 0 ? kept : advice.slow).map(lowerName))
  const values = { name: eventName(advice.event), slow, to: lowerName(advice.to) }
  return (
    <p className={className} data-testid={testId}>
      <EventIcon event={advice.event} size={14} />
      {t(kept.length > 0 ? 'weather.keep' : 'weather.swapped', values)}
    </p>
  )
}
