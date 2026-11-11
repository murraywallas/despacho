import { Volume2, VolumeX } from 'lucide-react'
import { t } from '../i18n'
import { useSoundStore } from '../store/soundStore'
import { Keycap } from './Keycap'
import './operatorTools.css'

/** Mute (key M) in the top bar. The volume and the rest of the sound settings live in the pause menu. */
export function SoundControls() {
  const muted = useSoundStore((state) => state.muted)
  const toggleMute = useSoundStore((state) => state.toggleMute)

  return (
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
  )
}
