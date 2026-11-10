import { useEffect } from 'react'
import { connectSounds } from '../audio/connectSounds'
import { createHowlerPlayer } from '../audio/howlerPlayer'
import { prototype } from '../game/balance'
import { useShiftStore } from '../store/shiftStore'
import { useSoundStore } from '../store/soundStore'

const GESTURES = ['pointerdown', 'keydown'] as const

/**
 * Plays the game's sounds. Browsers only let a page make sound after the player touches it, so the player is
 * created on the first click or key press; until then the game is silent.
 */
export function useSounds(): void {
  useEffect(() => {
    let disconnect: (() => void) | null = null
    let unwatchSettings: (() => void) | null = null

    const start = () => {
      GESTURES.forEach((gesture) => window.removeEventListener(gesture, start))
      const player = createHowlerPlayer()
      const apply = ({ muted, volume }: { muted: boolean; volume: number }) => {
        player.setMuted(muted)
        player.setVolume(volume)
      }
      apply(useSoundStore.getState())
      unwatchSettings = useSoundStore.subscribe(apply)
      disconnect = connectSounds(
        useShiftStore,
        player,
        () => useSoundStore.getState().muted,
        prototype.orders.urgentBelowSec,
      )
    }

    GESTURES.forEach((gesture) => window.addEventListener(gesture, start))
    return () => {
      GESTURES.forEach((gesture) => window.removeEventListener(gesture, start))
      disconnect?.()
      unwatchSettings?.()
    }
  }, [])
}
