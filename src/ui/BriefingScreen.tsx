import { ArrowLeft, Play } from 'lucide-react'
import { levels, shift as shiftBalance, vehicles } from '../game/balance'
import { balanceFor, briefingOf, createLevelShift, neighborhoodOf } from '../game/levels'
import { positionOf } from '../game/cityMap'
import { shiftSettingsFrom } from '../game/shift'
import { hasText, t } from '../i18n'
import { useScreenStore } from '../store/screenStore'
import { useShiftStore } from '../store/shiftStore'
import { formatGameTime, gameMinutes } from './formatClock'
import { formatRating } from './formatRating'
import { levelHours, levelName, gameTimeOf, mapLightOf, neighborhoodName, PANEL_INSET } from './levelText'
import { VEHICLE_TEXT, VehicleIcon } from './VehicleIcon'
import { BackdropMap, type BackdropPin } from './BackdropMap'
import './levels.css'

/** "Kødbyen"; the id itself when es.json has no name for it. */
function zoneName(zone: string): string {
  const key = `zones.${zone}`
  return hasText(key) ? t(key) : zone
}

const METERS_PER_KM = 1000

/** "1,1": kilometers with one decimal, the Spanish way. */
function formatKm(meters: number): string {
  return (meters / METERS_PER_KM).toLocaleString('es', { maximumFractionDigits: 1 })
}

const pinsByLevel = new Map<string, readonly BackdropPin[]>()

/** The level's restaurants, where its shift puts them (same seed, same places). Worked out once per level. */
function restaurantPins(levelId: string): readonly BackdropPin[] {
  const known = pinsByLevel.get(levelId)
  if (known) return known
  const { map } = createLevelShift(levelId).shift
  const pins = map.restaurants.map((restaurant) => ({
    key: restaurant.id,
    label: restaurant.label,
    lngLat: positionOf(map, restaurant.node),
  }))
  pinsByLevel.set(levelId, pins)
  return pins
}

/** What's coming before a shift: the fleet, how many orders, the deadline and the rush hour. */
export function BriefingScreen() {
  const levelId = useScreenStore((state) => state.briefingLevelId)
  const showLevels = useScreenStore((state) => state.showLevels)
  const startFromBriefing = useScreenStore((state) => state.startFromBriefing)
  const startLevel = useShiftStore((state) => state.startLevel)
  if (!levelId || !levels[levelId]) return null

  const balance = balanceFor(levelId)
  const pins = restaurantPins(levelId)
  const briefing = briefingOf(balance, shiftSettingsFrom(balance).orders)
  const time = gameTimeOf(levelId)
  const start = () => {
    startLevel(levelId)
    startFromBriefing()
  }

  return (
    <main className="levels" aria-labelledby="briefing-title">
      <BackdropMap pins={pins} leftInset={PANEL_INSET} light={mapLightOf(levelId)} neighborhood={neighborhoodOf(levelId)} />
      <section className="briefing levels__panel floating-panel" data-testid="briefing">
        <p className="levels__app">{t('briefing.eyebrow')}</p>
        <h1 className="levels__title" id="briefing-title">
          {levelName(levelId)}
        </h1>
        <p className="levels__intro">
          {neighborhoodName(levels[levelId].neighborhood)} · {levelHours(levelId)}
        </p>

        <dl className="briefing__facts">
          <div className="briefing__fact">
            <dt>{t('briefing.orders')}</dt>
            <dd data-testid="briefing-orders">{t('briefing.ordersValue', { count: briefing.orders })}</dd>
          </div>
          <div className="briefing__fact">
            <dt>{t('briefing.deadline')}</dt>
            <dd>{t('briefing.deadlineValue', { minutes: gameMinutes(briefing.deadlineSec, time) })}</dd>
          </div>
          <div className="briefing__fact">
            <dt>{t('briefing.peak')}</dt>
            <dd>
              {briefing.peak
                ? t('briefing.peakValue', {
                    from: formatGameTime(briefing.peak.fromSec, time),
                    to: formatGameTime(briefing.peak.toSec, time),
                  })
                : t('briefing.noPeak')}
            </dd>
          </div>
        </dl>

        {balance.restaurants.zone && balance.restaurants.zoneRestaurants !== undefined && (
          <p className="briefing__zone" data-testid="briefing-zone">
            {t('briefing.zone', {
              count: balance.restaurants.zoneRestaurants,
              total: balance.restaurants.count,
              zone: zoneName(balance.restaurants.zone),
            })}
          </p>
        )}

        {levels[levelId].minCustomerDistanceM !== undefined && (
          <p className="briefing__zone" data-testid="briefing-far">
            {t('briefing.far', { km: formatKm(balance.orders.minCustomerDistanceM) })}
          </p>
        )}

        <h2 className="briefing__subtitle">{t('briefing.fleet')}</h2>
        <ol className="briefing__fleet" data-testid="briefing-fleet">
          {briefing.fleet.map((vehicle, index) => {
            const key = VEHICLE_TEXT[vehicle]
            const row = vehicles[vehicle]
            const noteKey = `vehicles.${vehicle}.note`
            return (
              <li key={`${vehicle}-${index}`} className="briefing__rider">
                <span className="briefing__badge" aria-hidden>
                  {index + 1}
                </span>
                <VehicleIcon vehicle={vehicle} size={18} aria-hidden />
                <span className="briefing__rider-body">
                  <span className="briefing__rider-name">
                    {t('riders.name', { number: index + 1 })} · {key ? t(key) : vehicle}
                  </span>
                  {hasText(noteKey) && <span className="briefing__rider-note">{t(noteKey)}</span>}
                </span>
                {row && (
                  <span className="briefing__rider-stats">
                    {t('briefing.vehicleStats', { speed: row.speedKmh, capacity: row.capacity })}
                  </span>
                )}
              </li>
            )
          })}
        </ol>

        <p className="briefing__goal">{t('briefing.goal', { win: formatRating(shiftBalance.winAtLeast) })}</p>

        <div className="briefing__actions">
          <button type="button" className="briefing__back" onClick={showLevels}>
            <ArrowLeft size={16} aria-hidden />
            {t('briefing.back')}
          </button>
          <button type="button" className="briefing__start" onClick={start} autoFocus>
            <Play size={16} aria-hidden />
            {t('briefing.start')}
          </button>
        </div>
      </section>
    </main>
  )
}
