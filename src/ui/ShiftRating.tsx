import { Star } from 'lucide-react'
import { prototype } from '../game/balance'
import { averageRating } from '../game/rating'
import { t } from '../i18n'
import { useShiftStore } from '../store/shiftStore'
import { formatRating } from './formatRating'

const ICON_SIZE = 18

/** Average stars of the shift so far, for the top bar. A dash until the first order is delivered or cancelled. */
export function ShiftRating() {
  const orders = useShiftStore((state) => state.orderQueue.orders)
  const average = averageRating(orders, prototype.heat, prototype.rating)
  const text = formatRating(average)
  const label =
    average === undefined
      ? t('topbar.ratingNone')
      : t('topbar.ratingValue', { rating: text, max: prototype.rating.max })

  return (
    <div className="top-bar__rating" aria-label={label} title={label} role="group">
      <Star size={ICON_SIZE} aria-hidden className="top-bar__star" />
      <span className="top-bar__rating-value" data-testid="shift-rating" aria-hidden>
        {text}
      </span>
      <span className="top-bar__label" aria-hidden>
        {t('topbar.rating')}
      </span>
    </div>
  )
}
