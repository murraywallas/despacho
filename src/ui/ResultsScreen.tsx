import { ArrowRight, List, RotateCcw, Star } from 'lucide-react'
import { levelIds, progression, prototype, shift } from '../game/balance'
import { isUnlocked, nextLevel } from '../game/levels'
import { averageLost, biggestLoss, starsLost, summarizeShift, type ShiftOutcome, type StarsLost } from '../game/results'
import { t, type TextKey } from '../i18n'
import { useProgressStore } from '../store/progressStore'
import { useScreenStore } from '../store/screenStore'
import { useShiftStore } from '../store/shiftStore'
import { formatRating } from './formatRating'
import { moneyOfShift } from './moneyOfShift'
import { ShiftMoneySummary } from './ShiftMoneySummary'
import './ResultsScreen.css'

const STAR_SIZE = 28
const ICON_SIZE = 18

const LOSS_CAUSES = ['late', 'cold', 'cancelled'] as const
const LOSS_TEXT: Record<keyof StarsLost, TextKey> = {
  late: 'results.lostLate',
  cold: 'results.lostCold',
  cancelled: 'results.lostCancelled',
}
/** One concrete tip for the next shift, about what cost the most stars. */
const TIP_TEXT: Record<keyof StarsLost | 'none', TextKey> = {
  late: 'results.tipLate',
  cold: 'results.tipCold',
  cancelled: 'results.tipCancelled',
  none: 'results.tipNone',
}

const OUTCOME_TEXT: Record<ShiftOutcome, TextKey> = {
  win: 'results.outcome.win',
  close: 'results.outcome.close',
  lose: 'results.outcome.lose',
}

/** Shown over the shift when the clock reaches 0:00: the shift's numbers, the outcome and "Jugar otra vez". */
export function ResultsScreen() {
  const orders = useShiftStore((state) => state.orderQueue.orders)
  const restartShift = useShiftStore((state) => state.restartShift)
  const levelId = useShiftStore((state) => state.levelId)
  const riders = useShiftStore((state) => state.riders)
  const best = useProgressStore((state) => state.best)
  const moneyKr = useProgressStore((state) => state.moneyKr)
  const showBriefing = useScreenStore((state) => state.showBriefing)
  const showLevels = useScreenStore((state) => state.showLevels)
  const results = summarizeShift(orders, prototype.heat, prototype.rating, shift)
  const lost = averageLost(starsLost(orders, prototype.heat, prototype.rating), results.delivered + results.cancelled)
  // The next level, once this one has opened it (now or in an earlier game).
  const following = levelId === null ? undefined : nextLevel(levelIds, levelId)
  const next =
    following && isUnlocked(levelIds, best, following, progression.unlockAvgRating) ? following : undefined
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

        <ShiftMoneySummary
          money={moneyOfShift(orders, riders)}
          totalKr={levelId === null ? undefined : moneyKr}
        />

        <div className="results__lost" data-testid="results-lost">
          <h3 className="results__lost-title">{t('results.lostTitle')}</h3>
          <ul className="results__lost-list">
            {LOSS_CAUSES.map((cause) => (
              <li key={cause} className={`results__lost-row${lost[cause] > 0 ? ' results__lost-row--hit' : ''}`}>
                <span>{t(LOSS_TEXT[cause])}</span>
                <span className="results__lost-value">
                  {lost[cause] > 0 ? t('results.lostValue', { stars: formatRating(lost[cause]) }) : t('results.lostNone')}
                </span>
              </li>
            ))}
          </ul>
          <p className="results__tip" data-testid="results-tip">
            {t(TIP_TEXT[biggestLoss(lost)])}
          </p>
        </div>

        <div className="results__actions">
          {next && (
            <button type="button" className="results__again" onClick={() => showBriefing(next)} autoFocus>
              <ArrowRight size={ICON_SIZE} aria-hidden />
              {t('results.nextLevel')}
            </button>
          )}
          <button
            type="button"
            className={next ? 'results__secondary' : 'results__again'}
            onClick={restartShift}
            autoFocus={!next}
          >
            <RotateCcw size={ICON_SIZE} aria-hidden />
            {t('results.playAgain')}
          </button>
          {levelId !== null && (
            <button type="button" className="results__secondary" onClick={showLevels}>
              <List size={ICON_SIZE} aria-hidden />
              {t('results.levels')}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
