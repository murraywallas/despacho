import { remainingSec } from '../game/clock'
import { t } from '../i18n'
import { useShiftStore } from '../store/shiftStore'
import { formatClock } from './formatClock'
import { ShiftRating } from './ShiftRating'

export function TopBar() {
  const clock = useShiftStore((state) => state.clock)
  const togglePause = useShiftStore((state) => state.togglePause)
  const toggleSpeed = useShiftStore((state) => state.toggleSpeed)

  const status = clock.finished ? t('topbar.finished') : clock.paused ? t('topbar.paused') : null

  return (
    <header className="top-bar">
      <div className="top-bar__start">
        <h1 className="top-bar__title">{t('app.title')}</h1>
        <ShiftRating />
      </div>

      <div className="top-bar__clock">
        <span className="top-bar__label">{t('topbar.timeLeft')}</span>
        <span className="top-bar__time" role="timer" aria-label={t('topbar.timeLeft')} data-testid="shift-time">
          {formatClock(remainingSec(clock))}
        </span>
        {status && (
          <span className="top-bar__status" role="status">
            {status}
          </span>
        )}
      </div>

      <div className="top-bar__controls">
        <button
          type="button"
          className="top-bar__button"
          onClick={togglePause}
          disabled={clock.finished}
          aria-pressed={clock.paused}
        >
          {clock.paused ? t('topbar.resume') : t('topbar.pause')}
        </button>
        <button
          type="button"
          className="top-bar__button"
          onClick={toggleSpeed}
          disabled={clock.finished}
          aria-pressed={clock.speed !== 1}
          aria-label={t('topbar.speedLabel')}
          title={t('topbar.speedLabel')}
        >
          {t('topbar.speedValue', { speed: clock.speed })}
        </button>
      </div>
    </header>
  )
}
