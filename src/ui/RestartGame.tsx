import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { t } from '../i18n'
import { useProgressStore } from '../store/progressStore'

/**
 * "Empezar de cero", at the bottom of the start screen: a first click asks, a second one forgets the whole game
 * (stars, money, riders, fleets). onRestart lets the screen go back to the first neighborhood.
 */
export function RestartGame({ onRestart }: { onRestart: () => void }) {
  const restart = useProgressStore((state) => state.restart)
  const [asking, setAsking] = useState(false)

  if (!asking) {
    return (
      <button type="button" className="restart-game__open" onClick={() => setAsking(true)} data-testid="restart-open">
        <RotateCcw size={14} aria-hidden />
        {t('restart.open')}
      </button>
    )
  }
  return (
    <div className="restart-game" role="alertdialog" aria-labelledby="restart-title" data-testid="restart-confirm">
      <p className="restart-game__title" id="restart-title">
        {t('restart.question')}
      </p>
      <div className="restart-game__actions">
        <button type="button" className="briefing__back" onClick={() => setAsking(false)} autoFocus>
          {t('restart.cancel')}
        </button>
        <button
          type="button"
          className="restart-game__confirm"
          onClick={() => {
            restart()
            setAsking(false)
            onRestart()
          }}
        >
          {t('restart.confirm')}
        </button>
      </div>
    </div>
  )
}
