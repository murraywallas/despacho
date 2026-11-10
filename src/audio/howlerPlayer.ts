/** The real sound player: Howler for the cues, Web Audio on Howler's context for the background hum. */
import { Howl, Howler } from 'howler'
import { GAME_EVENTS, type GameEvent } from '../game/events'
import { createAmbience, type Ambience } from './ambience'
import type { SoundPlayer } from './connectSounds'
import { CUES } from './mix'

export interface HowlerPlayer extends SoundPlayer {
  setMuted: (muted: boolean) => void
  setVolume: (volume: number) => void
}

export function createHowlerPlayer(): HowlerPlayer {
  const base = import.meta.env.BASE_URL
  const howls = new Map<GameEvent, Howl>(
    GAME_EVENTS.map((event) => [event, new Howl({ src: [base + CUES[event].src], volume: CUES[event].volume })]),
  )
  // Howler makes its context with the first Howl; without Web Audio (old browsers) there is just no hum.
  const ambience: Ambience | null =
    Howler.ctx && Howler.masterGain ? createAmbience(Howler.ctx, Howler.masterGain) : null

  return {
    play: (event) => {
      howls.get(event)?.play()
    },
    setAmbience: (on) => ambience?.setOn(on),
    setMuted: (muted) => {
      Howler.mute(muted)
    },
    setVolume: (volume) => {
      Howler.volume(volume)
    },
  }
}
