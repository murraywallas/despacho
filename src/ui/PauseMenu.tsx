import { Keyboard, List, Play, RotateCcw } from 'lucide-react'
import { t } from '../i18n'
import { useScreenStore } from '../store/screenStore'
import { TEXT_SCALES, useSettingsStore } from '../store/settingsStore'
import { useShiftStore } from '../store/shiftStore'
import { useSoundStore } from '../store/soundStore'
import { Keycap } from './Keycap'

const PERCENT = 100
const ICON_SIZE = 16

interface PauseMenuProps {
  onClose: () => void
  onShowShortcuts: () => void
}

/** A setting that is on or off, shown as a switch. */
function Switch({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="switch" role="switch" aria-checked={on} onClick={onToggle}>
      <span className="switch__label">{label}</span>
      <span className="switch__track" aria-hidden>
        <span className="switch__thumb" />
      </span>
    </button>
  )
}

/**
 * The pause menu (Esc with nothing picked, or the menu button): go on, start over or back to the shifts, and the
 * settings (sound, text size, color-blind palette, reduced motion). The game is paused while it is open.
 */
export function PauseMenu({ onClose, onShowShortcuts }: PauseMenuProps) {
  const levelId = useShiftStore((state) => state.levelId)
  const restartShift = useShiftStore((state) => state.restartShift)
  const showLevels = useScreenStore((state) => state.showLevels)
  const muted = useSoundStore((state) => state.muted)
  const volume = useSoundStore((state) => state.volume)
  const toggleMute = useSoundStore((state) => state.toggleMute)
  const setVolume = useSoundStore((state) => state.setVolume)
  const textScale = useSettingsStore((state) => state.textScale)
  const setTextScale = useSettingsStore((state) => state.setTextScale)
  const colorblind = useSettingsStore((state) => state.colorblind)
  const toggleColorblind = useSettingsStore((state) => state.toggleColorblind)
  const reducedMotion = useSettingsStore((state) => state.reducedMotion)
  const toggleReducedMotion = useSettingsStore((state) => state.toggleReducedMotion)
  const shownVolume = muted ? 0 : Math.round(volume * PERCENT)

  return (
    <div className="pause-backdrop">
      <section
        className="pause-menu floating-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onClose()
          }
        }}
      >
        <h2 className="pause-menu__title" id="pause-title">
          {t('pause.title')}
        </h2>

        <div className="pause-menu__actions">
          <button type="button" className="pause-menu__primary" onClick={onClose} autoFocus>
            <Play size={ICON_SIZE} aria-hidden />
            {t('pause.resume')}
            <Keycap label="Esc" />
          </button>
          <button
            type="button"
            className="pause-menu__secondary"
            onClick={() => {
              restartShift()
              onClose()
            }}
          >
            <RotateCcw size={ICON_SIZE} aria-hidden />
            {t('pause.restart')}
          </button>
          {levelId !== null && (
            <button type="button" className="pause-menu__secondary" onClick={showLevels}>
              <List size={ICON_SIZE} aria-hidden />
              {t('results.levels')}
            </button>
          )}
        </div>

        <h3 className="pause-menu__section">{t('pause.settings')}</h3>
        <div className="pause-menu__settings">
          <Switch label={t('pause.sound')} on={!muted} onToggle={toggleMute} />
          <label className="pause-menu__row">
            <span>{t('sound.volume')}</span>
            <input
              type="range"
              min={0}
              max={PERCENT}
              step={5}
              value={shownVolume}
              onChange={(event) => setVolume(Number(event.target.value) / PERCENT)}
              aria-valuetext={t('sound.volumeValue', { percent: shownVolume })}
            />
            <span className="pause-menu__value">{t('sound.volumeValue', { percent: shownVolume })}</span>
          </label>
          <div className="pause-menu__row">
            <span id="text-size-label">{t('pause.textSize')}</span>
            <div className="segmented" role="group" aria-labelledby="text-size-label">
              {TEXT_SCALES.map((scale) => (
                <button
                  key={scale}
                  type="button"
                  className="segmented__option"
                  aria-pressed={textScale === scale}
                  onClick={() => setTextScale(scale)}
                >
                  {t('pause.textSizeValue', { percent: Math.round(scale * PERCENT) })}
                </button>
              ))}
            </div>
          </div>
          <Switch label={t('pause.colorblind')} on={colorblind} onToggle={toggleColorblind} />
          <Switch label={t('pause.reducedMotion')} on={reducedMotion} onToggle={toggleReducedMotion} />
          <button type="button" className="pause-menu__secondary" onClick={onShowShortcuts}>
            <Keyboard size={ICON_SIZE} aria-hidden />
            {t('pause.shortcuts')}
            <Keycap label="?" />
          </button>
        </div>
      </section>
    </div>
  )
}
