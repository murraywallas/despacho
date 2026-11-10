import { Star } from 'lucide-react'
import { prototype, shift } from '../game/balance'
import { averageRating } from '../game/rating'
import { t } from '../i18n'
import { useShiftStore } from '../store/shiftStore'
import { formatRating } from './formatRating'

const ICON_SIZE = 18
const PERCENT = 100

type Standing = 'win' | 'close' | 'lose'

function standingOf(average: number): Standing {
  if (average >= shift.winAtLeast) return 'win'
  if (average < shift.loseBelow) return 'lose'
  return 'close'
}

/**
 * Average stars of the shift so far, and a small meter against the goal: the line marks the stars needed to win.
 * A dash until the first order is delivered or cancelled.
 */
export function ShiftRating() {
  const orders = useShiftStore((state) => state.orderQueue.orders)
  const average = averageRating(orders, prototype.heat, prototype.rating)
  const text = formatRating(average)
  const max = prototype.rating.max
  const goal = formatRating(shift.winAtLeast)
  const label =
    average === undefined
      ? t('topbar.ratingNone', { goal })
      : t('topbar.ratingValue', { rating: text, max, goal })
  const standing = average === undefined ? undefined : standingOf(average)

  return (
    <div className="top-bar__rating" aria-label={label} title={label} role="group">
      <Star size={ICON_SIZE} aria-hidden className="top-bar__star" />
      <span className="top-bar__rating-value" data-testid="shift-rating" aria-hidden>
        {text}
      </span>
      <span className={`rating-meter${standing ? ` rating-meter--${standing}` : ''}`} aria-hidden>
        <span
          className="rating-meter__fill"
          style={{ transform: `scaleX(${average === undefined ? 0 : average / max})` }}
        />
        <span className="rating-meter__goal" style={{ left: `${(shift.winAtLeast / max) * PERCENT}%` }} />
      </span>
    </div>
  )
}
