import { Lock, Star } from 'lucide-react'
import { useState } from 'react'
import { levelIds, progression } from '../game/balance'
import { isUnlocked, levelNeighborhoods, levelsOf, neighborhoodOf, type Progress } from '../game/levels'
import { t } from '../i18n'
import { useProgressStore } from '../store/progressStore'
import { useScreenStore } from '../store/screenStore'
import { formatRating } from './formatRating'
import { levelHours, levelName, levelTagline, neighborhoodName, PANEL_INSET } from './levelText'
import { BackdropMap } from './BackdropMap'
import './levels.css'

const NEIGHBORHOODS = levelNeighborhoods()

/** A neighborhood opens with its first level. */
function neighborhoodOpen(best: Progress, neighborhood: string): boolean {
  const first = levelsOf(neighborhood)[0]
  return first !== undefined && isUnlocked(levelIds, best, first, progression.unlockAvgRating)
}

/** The start screen: the shifts of each neighborhood, locked until the one before is won. */
export function LevelSelect() {
  const best = useProgressStore((state) => state.best)
  const showBriefing = useScreenStore((state) => state.showBriefing)
  const lastLevelId = useScreenStore((state) => state.briefingLevelId)
  // The neighborhood last looked at, or the newest one the player has opened.
  const [neighborhood, setNeighborhood] = useState(() =>
    lastLevelId
      ? neighborhoodOf(lastLevelId)
      : (NEIGHBORHOODS.filter((each) => neighborhoodOpen(best, each)).at(-1) ?? NEIGHBORHOODS[0]),
  )
  const stars = formatRating(progression.unlockAvgRating)
  const ids = levelsOf(neighborhood)

  return (
    <main className="levels" aria-labelledby="levels-title">
      <BackdropMap leftInset={PANEL_INSET} neighborhood={neighborhood} />
      <div className="levels__panel floating-panel">
        <header className="levels__header">
          <p className="levels__app">{t('app.title')}</p>
          {NEIGHBORHOODS.length > 1 && (
            <div className="levels__areas" role="group" aria-label={t('levels.neighborhoods')}>
              {NEIGHBORHOODS.map((area, index) => {
                const open = neighborhoodOpen(best, area)
                const previous = index > 0 ? neighborhoodName(NEIGHBORHOODS[index - 1]) : ''
                return (
                  <button
                    key={area}
                    type="button"
                    className="levels__area"
                    aria-pressed={area === neighborhood}
                    onClick={() => setNeighborhood(area)}
                    title={open ? undefined : t('levels.neighborhoodLocked', { name: neighborhoodName(area), previous })}
                    data-testid="neighborhood-tab"
                  >
                    {!open && <Lock size={12} aria-hidden />}
                    {neighborhoodName(area)}
                  </button>
                )
              })}
            </div>
          )}
          <h1 className="levels__title" id="levels-title">
            {neighborhoodName(neighborhood)}
          </h1>
          <p className="levels__intro">{t('levels.intro', { stars })}</p>
        </header>

        <ol className="levels__list">
          {ids.map((levelId, index) => {
            const open = isUnlocked(levelIds, best, levelId, progression.unlockAvgRating)
            const before = levelIds[levelIds.indexOf(levelId) - 1]
            const previous = before ? levelName(before) : ''
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
