import { Menu, Phone } from 'lucide-react'
import { t } from '../i18n'
import { useShiftStore } from '../store/shiftStore'
import { ConditionsSlot } from './ConditionsSlot'
import { formatGameTime } from './formatClock'
import { Keycap } from './Keycap'
import { gameTimeOf, levelName } from './levelText'
import { ShiftProgress } from './ShiftProgress'
import { ShiftRating } from './ShiftRating'
import { SoundControls } from './SoundControls'
import { TimeControls } from './TimeControls'

interface TopBarProps {
  /** Opens the list of keyboard shortcuts (key ?). */
  onShowShortcuts: () => void
  /** Opens the pause menu with the settings (Esc with nothing picked). */
  onOpenMenu: () => void
}

/**
 * Resources and time: level and stars against the goal on the left, the clock in the middle, calls, sound,
 * shortcuts and the time controls on the right. A thin bar along the bottom shows the shift passing.
 */
export function TopBar({ onShowShortcuts, onOpenMenu }: TopBarProps) {
  const clock = useShiftStore((state) => state.clock)
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
        <ConditionsSlot />
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
        <span className="top-bar__calls" aria-label={t('topbar.callsLabel', { calls: callsLeft })} data-testid="calls-left">
          <Phone size={14} aria-hidden />
          {callsLeft}
        </span>
        <SoundControls />
        <button
          type="button"
          className="top-bar__icon-button"
          onClick={onShowShortcuts}
          aria-keyshortcuts="Shift+?"
          aria-label={t('shortcuts.open')}
          title={t('shortcuts.open')}
        >
          <Keycap label="?" />
        </button>
        <TimeControls />
        <button
          type="button"
          className="top-bar__icon-button"
          onClick={onOpenMenu}
          aria-label={t('pause.open')}
          title={t('pause.open')}
        >
          <Menu size={16} aria-hidden />
        </button>
      </div>

      <ShiftProgress />
    </header>
  )
}
