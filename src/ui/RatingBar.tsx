import { prototype, shift } from '../game/balance'
import { t } from '../i18n'
import { formatRating } from './formatRating'
import './RatingBar.css'

const PERCENT = 100

/**
 * The shift's average stars on a bar from 0 to the maximum, with a mark where it is lost (below loseBelow) and where
 * it is won (winAtLeast): how far the result was from the next step.
 */
export function RatingBar({ average }: { average: number | undefined }) {
  const max = prototype.rating.max
  const at = (stars: number) => `${Math.min(PERCENT, Math.max(0, (stars / max) * PERCENT))}%`
  const marks = [
    { key: 'lose', stars: shift.loseBelow },
    { key: 'win', stars: shift.winAtLeast },
  ]
  return (
    <div
      className="rating-bar"
      role="img"
      aria-label={t('results.barLabel', {
        rating: formatRating(average),
        max,
        lose: formatRating(shift.loseBelow),
        win: formatRating(shift.winAtLeast),
      })}
      data-testid="results-bar"
    >
      <span className="rating-bar__track" aria-hidden>
        <span className="rating-bar__fill" style={{ width: at(average ?? 0) }} />
        {marks.map((mark) => (
          <span key={mark.key} className={`rating-bar__mark rating-bar__mark--${mark.key}`} style={{ left: at(mark.stars) }} />
        ))}
      </span>
      <span className="rating-bar__labels" aria-hidden>
        {marks.map((mark) => (
          <span key={mark.key} className="rating-bar__label" style={{ left: at(mark.stars) }}>
            {formatRating(mark.stars)}
          </span>
        ))}
      </span>
    </div>
  )
}
