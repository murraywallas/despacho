import { Phone } from 'lucide-react'
import { t } from '../i18n'
import { useShiftStore } from '../store/shiftStore'
import { formatGameTime } from './formatClock'
import { gameTimeOf, levelName } from './levelText'
import { ShiftRating } from './ShiftRating'
import { SoundControls } from './SoundControls'

export function TopBar() {
  const clock = useShiftStore((state) => state.clock)
  const togglePause = useShiftStore((state) => state.togglePause)
  const toggleSpeed = useShiftStore((state) => state.toggleSpeed)
  const callsLeft = useShiftStore((state) => state.callsLeft)
  const levelId = useShiftStore((state) => state.levelId)
  const gameTime = gameTimeOf(levelId)

  const status = clock.finished ? t('topbar.finished') : clock.paused ? t('topbar.paused') : null
  const now = formatGameTime(clock.elapsedSec, gameTime)
  const end = formatGameTime(clock.durationSec, gameTime)

  return (
    <header className="top-bar">
      <div className="top-bar__start">
        <h1 className="top-bar__title">{t('app.title')}</h1>
        {levelId !== null && (
          <span className="top-bar__level" data-testid="level-name">
            {levelName(levelId)}
          </span>
        )}
        <ShiftRating />
      </div>

      <div className="top-bar__clock">
        <span className="top-bar__label">{t('topbar.gameTime')}</span>
        <span
          className="top-bar__time"
          role="timer"
          aria-label={t('topbar.timeLabel', { time: now, end })}
          data-testid="shift-time"
        >
          {now}
        </span>
        {status ? (
          <span className="top-bar__status" role="status">
            {status}
          </span>
        ) : (
          <span className="top-bar__label">{t('topbar.endsAt', { end })}</span>
        )}
      </div>

      <div className="top-bar__controls">
        <SoundControls />
        <span className="top-bar__calls" aria-label={t('topbar.callsLabel', { calls: callsLeft })} data-testid="calls-left">
          <Phone size={14} aria-hidden />
          {callsLeft}
        </span>
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
