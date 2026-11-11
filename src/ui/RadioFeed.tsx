import { Ban, Bike, CircleAlert, PackageCheck, Radio, ReceiptText } from 'lucide-react'
import { neighborhoodOf } from '../game/levels'
import type { RadioKind } from '../game/radio'
import { t } from '../i18n'
import { useRadioStore } from '../store/radioStore'
import { useShiftStore } from '../store/shiftStore'
import { formatGameTime } from './formatClock'
import { gameTimeOf } from './levelText'
import { radioText } from './radioText'

/** Lines on screen at once: the radio tells what just happened, it is not a log to read. */
const SHOWN = 3
const ICON_SIZE = 14

const ICONS: Record<RadioKind, typeof Radio> = {
  newOrder: ReceiptText,
  pickedUp: Bike,
  delivered: PackageCheck,
  late: CircleAlert,
  cancelled: Ban,
}

/** The event radio, at the bottom of the map between the panels. It can be hidden. */
export function RadioFeed() {
  const entries = useRadioStore((state) => state.entries)
  const hidden = useRadioStore((state) => state.hidden)
  const toggleHidden = useRadioStore((state) => state.toggleHidden)
  const restaurants = useShiftStore((state) => state.map.restaurants)
  const levelId = useShiftStore((state) => state.levelId)
  const neighborhood = neighborhoodOf(levelId)
  const time = gameTimeOf(levelId)
  const shown = entries.slice(-SHOWN)

  return (
    <section className={`radio${hidden ? ' radio--hidden' : ''}`} aria-label={t('radio.title')}>
      <button
        type="button"
        className="radio__toggle"
        onClick={toggleHidden}
        aria-pressed={!hidden}
        aria-label={hidden ? t('radio.show') : t('radio.hide')}
        title={hidden ? t('radio.show') : t('radio.hide')}
      >
        <Radio size={ICON_SIZE} aria-hidden />
      </button>
      {!hidden && (
        <ol className="radio__lines floating-panel" role="log" aria-live="polite" data-testid="radio">
          {shown.length === 0 && <li className="radio__line radio__line--empty">{t('radio.empty')}</li>}
          {shown.map(({ id, item }) => {
            const Icon = ICONS[item.kind]
            return (
              <li key={id} className={`radio__line radio__line--${item.kind}${item.mood ? ` radio__line--${item.mood}` : ''}`}>
                <span className="radio__time">{formatGameTime(item.atSec, time)}</span>
                <Icon size={ICON_SIZE} aria-hidden className="radio__icon" />
                <span className="radio__text">{radioText(item, restaurants, neighborhood)}</span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
