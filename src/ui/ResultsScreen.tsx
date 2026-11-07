import { RotateCcw, Star } from 'lucide-react'
import { prototype, shift } from '../game/balance'
import { summarizeShift, type ShiftOutcome } from '../game/results'
import { t, type TextKey } from '../i18n'
import { useShiftStore } from '../store/shiftStore'
import { formatRating } from './formatRating'
import './ResultsScreen.css'

const STAR_SIZE = 28
const ICON_SIZE = 18

const OUTCOME_TEXT: Record<ShiftOutcome, TextKey> = {
  win: 'results.outcome.win',
  close: 'results.outcome.close',
  lose: 'results.outcome.lose',
}

/** Shown over the shift when the clock reaches 0:00: the shift's numbers, the outcome and "Jugar otra vez". */
export function ResultsScreen() {
  const orders = useShiftStore((state) => state.orderQueue.orders)
  const restartShift = useShiftStore((state) => state.restartShift)
  const results = summarizeShift(orders, prototype.heat, prototype.rating, shift)
  const rating = formatRating(results.average)

  const stats = [
    { key: 'delivered', label: t('results.delivered'), value: results.delivered },
    { key: 'late', label: t('results.late'), value: results.late },
    { key: 'cancelled', label: t('results.cancelled'), value: results.cancelled },
  ]

  return (
    <div className="results-backdrop">
      <section
        className={`results results--${results.outcome}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="results-title"
        aria-describedby="results-outcome"
        data-testid="results"
      >
        <p className="results__eyebrow">{t('topbar.finished')}</p>
        <h2 className="results__title" id="results-title">
          {t(OUTCOME_TEXT[results.outcome])}
        </h2>

        <p className="results__rating" role="img" aria-label={t('results.ratingLabel', { rating, max: prototype.rating.max })}>
          <Star size={STAR_SIZE} aria-hidden className="results__star" />
          <span className="results__rating-value" data-testid="results-rating" aria-hidden>
            {rating}
          </span>
          <span className="results__rating-max" aria-hidden>
            {t('results.ratingMax', { max: prototype.rating.max })}
          </span>
        </p>

        <p className="results__outcome" id="results-outcome">
          {t('results.thresholds', {
            win: formatRating(shift.winAtLeast),
            lose: formatRating(shift.loseBelow),
          })}
        </p>

        <dl className="results__stats">
          {stats.map((stat) => (
            <div className="results__stat" key={stat.key} data-testid={`results-${stat.key}`}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>

        <button type="button" className="results__again" onClick={restartShift} autoFocus>
          <RotateCcw size={ICON_SIZE} aria-hidden />
          {t('results.playAgain')}
        </button>
      </section>
    </div>
  )
}
