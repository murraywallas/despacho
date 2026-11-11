import { Lock, Star } from 'lucide-react'
import { levelIds, levels, progression } from '../game/balance'
import { isUnlocked } from '../game/levels'
import { t } from '../i18n'
import { useProgressStore } from '../store/progressStore'
import { useScreenStore } from '../store/screenStore'
import { formatRating } from './formatRating'
import { levelHours, levelName, levelTagline, neighborhoodName, PANEL_INSET } from './levelText'
import { BackdropMap } from './BackdropMap'
import './levels.css'

/** The start screen: the neighborhood's shifts, locked until the one before is won. */
export function LevelSelect() {
  const best = useProgressStore((state) => state.best)
  const showBriefing = useScreenStore((state) => state.showBriefing)
  const stars = formatRating(progression.unlockAvgRating)
  const neighborhood = levels[levelIds[0]]?.neighborhood ?? ''

  return (
    <main className="levels" aria-labelledby="levels-title">
      <BackdropMap leftInset={PANEL_INSET} />
      <div className="levels__panel floating-panel">
      <header className="levels__header">
        <p className="levels__app">{t('app.title')}</p>
        <h1 className="levels__title" id="levels-title">
          {neighborhoodName(neighborhood)}
        </h1>
        <p className="levels__intro">{t('levels.intro', { stars })}</p>
      </header>

      <ol className="levels__list">
        {levelIds.map((levelId, index) => {
          const open = isUnlocked(levelIds, best, levelId, progression.unlockAvgRating)
          const previous = index > 0 ? levelName(levelIds[index - 1]) : ''
          const record = best[levelId]
          return (
            <li key={levelId}>
              <button
                type="button"
                className="level-card"
                disabled={!open}
                onClick={() => showBriefing(levelId)}
                data-testid="level-card"
                data-level={levelId}
                aria-label={open ? undefined : t('levels.lockedLabel', { name: levelName(levelId), stars, previous })}
                autoFocus={index === 0}
              >
                <span className="level-card__number">{t('levels.number', { number: index + 1 })}</span>
                <span className="level-card__name">{levelName(levelId)}</span>
                <span className="level-card__hours">{levelHours(levelId)}</span>
                <span className="level-card__tagline">{levelTagline(levelId)}</span>
                <span className="level-card__footer">
                  {!open ? (
                    <>
                      <Lock size={14} aria-hidden />
                      {t('levels.locked', { stars, previous })}
                    </>
                  ) : record !== undefined ? (
                    <>
                      <Star size={14} aria-hidden className="level-card__star" />
                      {t('levels.best', { rating: formatRating(record) })}
                    </>
                  ) : (
                    t('levels.notPlayed')
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      </div>
    </main>
  )
}
