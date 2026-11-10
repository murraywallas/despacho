import { ArrowLeft, Play } from 'lucide-react'
import { levels, shift as shiftBalance } from '../game/balance'
import { balanceFor, briefingOf } from '../game/levels'
import { shiftSettingsFrom } from '../game/shift'
import { t } from '../i18n'
import { useScreenStore } from '../store/screenStore'
import { useShiftStore } from '../store/shiftStore'
import { formatGameTime, gameMinutes } from './formatClock'
import { formatRating } from './formatRating'
import { levelHours, levelName, gameTimeOf, neighborhoodName } from './levelText'
import { VEHICLE_TEXT, VehicleIcon } from './VehicleIcon'
import './levels.css'

/** What's coming before a shift: the fleet, how many orders, the deadline and the rush hour. */
export function BriefingScreen() {
  const levelId = useScreenStore((state) => state.briefingLevelId)
  const showLevels = useScreenStore((state) => state.showLevels)
  const showShift = useScreenStore((state) => state.showShift)
  const startLevel = useShiftStore((state) => state.startLevel)
  if (!levelId || !levels[levelId]) return null

  const balance = balanceFor(levelId)
  const briefing = briefingOf(balance, shiftSettingsFrom(balance).orders)
  const time = gameTimeOf(levelId)
  const start = () => {
    startLevel(levelId)
    showShift()
  }

  return (
    <main className="levels" aria-labelledby="briefing-title">
      <section className="briefing" data-testid="briefing">
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

        <h2 className="briefing__subtitle">{t('briefing.fleet')}</h2>
        <ol className="briefing__fleet" data-testid="briefing-fleet">
          {briefing.fleet.map((vehicle, index) => {
            const key = VEHICLE_TEXT[vehicle]
            return (
              <li key={`${vehicle}-${index}`} className="briefing__rider">
                <span className="briefing__badge" aria-hidden>
                  {index + 1}
                </span>
                <VehicleIcon vehicle={vehicle} size={18} aria-hidden />
                {t('riders.name', { number: index + 1 })} · {key ? t(key) : vehicle}
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
