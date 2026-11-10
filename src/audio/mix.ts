/**
 * The sound mix: which file plays for each event and how loud, relative to the master volume. Files live in
 * public/sounds (Kenney, CC0: see the README). These are audio levels, not game rules.
 */
import type { GameEvent } from '../game/events'

export interface SoundCue {
  /** Path under the site root. */
  readonly src: string
  /** 0–1, before the master volume. */
  readonly volume: number
}

export const CUES: Record<GameEvent, SoundCue> = {
  newOrder: { src: 'sounds/new-order.ogg', volume: 0.6 },
  dispatch: { src: 'sounds/dispatch.ogg', volume: 0.5 },
  delivered: { src: 'sounds/delivered.ogg', volume: 0.6 },
  urgent: { src: 'sounds/urgent.ogg', volume: 0.7 },
  late: { src: 'sounds/late.ogg', volume: 0.6 },
  cancelled: { src: 'sounds/cancelled.ogg', volume: 0.7 },
  shiftEnd: { src: 'sounds/shift-end.ogg', volume: 0.7 },
}

/** Master volume the first time the game opens. */
export const DEFAULT_VOLUME = 0.7

/** The background: a soft, low city hum made in the browser (no file). */
export const AMBIENCE = {
  /** Loudness of the hum, before the master volume. */
  level: 0.05,
  /** Filters the noise down to a rumble, in Hz. */
  lowpassHz: 420,
  /** Slow swell of the hum, in Hz (one breath every ~14 s) and depth (share of the level). */
  swellHz: 0.07,
  swellDepth: 0.35,
  /** Seconds of noise in the looping buffer. */
  loopSec: 4,
  /** Seconds to fade in and out. */
  fadeSec: 1.2,
} as const
