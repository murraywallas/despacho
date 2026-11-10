import { Volume2, VolumeX } from 'lucide-react'
import { t } from '../i18n'
import { useSoundStore } from '../store/soundStore'
import './operatorTools.css'

const PERCENT = 100

/** Mute (key M) and master volume, remembered between games. */
export function SoundControls() {
  const muted = useSoundStore((state) => state.muted)
  const volume = useSoundStore((state) => state.volume)
  const toggleMute = useSoundStore((state) => state.toggleMute)
  const setVolume = useSoundStore((state) => state.setVolume)
  const shown = muted ? 0 : Math.round(volume * PERCENT)

  return (
    <div className="sound-controls">
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
      </button>
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
    </div>
  )
}
