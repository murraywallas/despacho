import { Lock, Star } from 'lucide-react'
import { useState } from 'react'
import { levelIds, progression } from '../game/balance'
import { isNeighborhoodOpen, isUnlocked, levelNeighborhoods, levelsOf, neighborhoodAverage, neighborhoodOf } from '../game/levels'
import { t } from '../i18n'
import { useProgressStore } from '../store/progressStore'
import { useScreenStore } from '../store/screenStore'
import { CityMap, type CityArea } from './CityMap'
import { RestartGame } from './RestartGame'
import { formatRating } from './formatRating'
import { levelHours, levelName, levelTagline, neighborhoodName, PANEL_INSET } from './levelText'
import './levels.css'

const NEIGHBORHOODS = levelNeighborhoods()

/** The start screen: Copenhagen with its neighborhoods, and the shifts of the one chosen. */
export function LevelSelect() {
  const best = useProgressStore((state) => state.best)
  const showBriefing = useScreenStore((state) => state.showBriefing)
  const lastLevelId = useScreenStore((state) => state.briefingLevelId)
  const unlock = progression.unlockAvgRating
  const areas: CityArea[] = NEIGHBORHOODS.map((id) => ({
    id,
    open: isNeighborhoodOpen(levelIds, best, id, unlock),
    average: neighborhoodAverage(best, id),
    played: levelsOf(id).some((levelId) => best[levelId] !== undefined),
  }))
  // The neighborhood last looked at, or the newest one the player has opened.
  const [neighborhood, setNeighborhood] = useState(() =>
    lastLevelId ? neighborhoodOf(lastLevelId) : (areas.filter((area) => area.open).at(-1)?.id ?? NEIGHBORHOODS[0]),
  )
  const stars = formatRating(unlock)
  const index = NEIGHBORHOODS.indexOf(neighborhood)
  const before = index > 0 ? neighborhoodName(NEIGHBORHOODS[index - 1]) : ''
  const open = areas[index]?.open ?? false
  const ids = levelsOf(neighborhood)

  return (
    <main className="levels" aria-labelledby="levels-title">
      <CityMap areas={areas} selected={neighborhood} onSelect={setNeighborhood} leftInset={PANEL_INSET} stars={stars} />
      <div className="levels__panel floating-panel">
        <header className="levels__header">
          <p className="levels__app">{t('app.title')}</p>
          <h1 className="levels__title" id="levels-title">
            {neighborhoodName(neighborhood)}
          </h1>
          <p className="levels__intro" data-testid="neighborhood-status">
            {open
              ? t('levels.intro', { stars })
              : t('levels.areaLockedIntro', { stars, previous: before })}
          </p>
        </header>

        <ol className="levels__list">
          {ids.map((levelId, position) => {
            const unlocked = isUnlocked(levelIds, best, levelId, unlock)
            const previous = position > 0 ? levelName(ids[position - 1]) : ''
            const locked = position === 0 ? t('levels.lockedArea', { stars, previous: before }) : t('levels.locked', { stars, previous })
            const record = best[levelId]
            return (
              <li key={levelId}>
                <button
                  type="button"
                  className="level-card"
                  disabled={!unlocked}
                  onClick={() => showBriefing(levelId)}
                  data-testid="level-card"
                  data-level={levelId}
                  aria-label={unlocked ? undefined : t('levels.lockedLabel', { name: levelName(levelId), reason: locked })}
                  autoFocus={position === 0}
                >
                  <span className="level-card__head">
                    <span className="level-card__number">{t('levels.number', { number: position + 1 })}</span>
                    <span className="level-card__hours">{levelHours(levelId)}</span>
                  </span>
                  <span className="level-card__name">{levelName(levelId)}</span>
                  <span className="level-card__tagline">{levelTagline(levelId)}</span>
                  <span className="level-card__footer">
                    {!unlocked ? (
                      <>
                        <Lock size={14} aria-hidden />
                        {locked}
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

        <RestartGame onRestart={() => setNeighborhood(NEIGHBORHOODS[0])} />
      </div>
    </main>
  )
}
