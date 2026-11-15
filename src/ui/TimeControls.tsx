import { Pause, Play } from 'lucide-react'
import { isOver } from '../game/clock'
import { clock as clockBalance, clockSpeeds } from '../game/balance'
import { t } from '../i18n'
import { useShiftStore } from '../store/shiftStore'
import { Keycap } from './Keycap'

const SPEEDS = clockSpeeds(clockBalance)

/** Pause (Space) and a segmented control with the clock speeds of balance.json: 1x / 2x / 3x. */
export function TimeControls() {
  const paused = useShiftStore((state) => state.clock.paused)
  // Closing (the last deliveries go by fast) or finished: the speed is no longer the player's.
  const finished = useShiftStore((state) => isOver(state.clock))
  const speed = useShiftStore((state) => state.clock.speed)
  const togglePause = useShiftStore((state) => state.togglePause)
  const setSpeed = useShiftStore((state) => state.setSpeed)

  return (
    <div className="time-controls">
      <button
        type="button"
        className="time-controls__pause"
        onClick={togglePause}
        disabled={finished}
        aria-pressed={paused}
        aria-keyshortcuts="Space"
      >
        {paused ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />}
        {paused ? t('topbar.resume') : t('topbar.pause')}
        <Keycap label="␣" />
      </button>
      <div className="segmented" role="group" aria-label={t('topbar.speedLabel')}>
        {SPEEDS.map((option) => (
          <button
            key={option}
            type="button"
            className="segmented__option"
            onClick={() => setSpeed(option)}
            disabled={finished}
            aria-pressed={speed === option}
          >
            {t('topbar.speedValue', { speed: option })}
          </button>
        ))}
      </div>
    </div>
  )
}
