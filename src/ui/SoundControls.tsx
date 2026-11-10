import { ChevronDown, Volume2, VolumeX } from 'lucide-react'
import { useState } from 'react'
import { t } from '../i18n'
import { useSoundStore } from '../store/soundStore'
import { Keycap } from './Keycap'
import './operatorTools.css'

const PERCENT = 100

/**
 * Mute (key M) in the top bar; the volume opens in a small panel under it, so it doesn't take space all shift.
 * Both are remembered between games. The full sound settings move to the pause menu (#76).
 */
export function SoundControls() {
  const muted = useSoundStore((state) => state.muted)
  const volume = useSoundStore((state) => state.volume)
  const toggleMute = useSoundStore((state) => state.toggleMute)
  const setVolume = useSoundStore((state) => state.setVolume)
  const [open, setOpen] = useState(false)
  const shown = muted ? 0 : Math.round(volume * PERCENT)

  return (
    <div
      className="sound-controls"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
      }}
    >
      <button
        type="button"
        className="sound-controls__mute"
        onClick={toggleMute}
        aria-pressed={muted}
        aria-label={t('sound.mute')}
        aria-keyshortcuts="M"
        title={muted ? t('sound.unmuteTitle') : t('sound.muteTitle')}
        data-testid="sound-mute"
      >
        {muted ? <VolumeX size={18} aria-hidden /> : <Volume2 size={18} aria-hidden />}
        <Keycap label="M" />
      </button>
      <button
        type="button"
        className="sound-controls__more"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="volume-panel"
        aria-label={t('sound.openVolume')}
      >
        <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div className="sound-controls__panel floating-panel" id="volume-panel">
          <input
            type="range"
            className="sound-controls__volume"
            min={0}
            max={PERCENT}
            step={5}
            value={shown}
            onChange={(event) => setVolume(Number(event.target.value) / PERCENT)}
            aria-label={t('sound.volume')}
            aria-valuetext={t('sound.volumeValue', { percent: shown })}
          />
          <span className="sound-controls__percent">{t('sound.volumeValue', { percent: shown })}</span>
        </div>
      )}
    </div>
  )
}
