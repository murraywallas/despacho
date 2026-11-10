/**
 * Listens to the shift and tells a sound player what to do: a cue for each event, the background hum while the
 * clock runs. Knows nothing about Howler, so the tests can use a fake player.
 */
import { eventsBetween, type GameEvent, type ShiftMoment } from '../game/events'
import type { ShiftClock } from '../game/clock'
import type { Order } from '../game/orders'

export interface SoundPlayer {
  play: (event: GameEvent) => void
  setAmbience: (on: boolean) => void
}

/** The part of the shift state sounds care about. */
export interface SoundSource {
  readonly clock: ShiftClock
  readonly orderQueue: { readonly orders: readonly Order[] }
}

interface Store<T> {
  getState: () => T
  subscribe: (listener: (state: T, previous: T) => void) => () => void
}

function momentOf(state: SoundSource): ShiftMoment {
  return { orders: state.orderQueue.orders, nowSec: state.clock.elapsedSec, finished: state.clock.finished }
}

function isRunning(state: SoundSource): boolean {
  return !state.clock.paused && !state.clock.finished
}

/**
 * Starts listening. Muted: no cues are played (the hum is silenced by the player's master mute). A restart of the
 * shift is not an event. Returns the function that stops listening.
 */
export function connectSounds<T extends SoundSource>(
  store: Store<T>,
  player: SoundPlayer,
  isMuted: () => boolean,
  urgentBelowSec: number,
): () => void {
  let ambience = isRunning(store.getState())
  player.setAmbience(ambience)

  const unsubscribe = store.subscribe((state, previous) => {
    const running = isRunning(state)
    if (running !== ambience) {
      ambience = running
      player.setAmbience(running)
    }
    if (state.orderQueue === previous.orderQueue && state.clock.finished === previous.clock.finished) return
    // A new shift (Jugar otra vez) starts from an earlier second: nothing "happened".
    if (state.clock.elapsedSec < previous.clock.elapsedSec) return
    if (isMuted()) return
    const events = eventsBetween(momentOf(previous), momentOf(state), urgentBelowSec)
    // The end of the shift also cancels what was still open: only the closing jingle plays.
    for (const event of events.includes('shiftEnd') ? ['shiftEnd' as const] : events) player.play(event)
  })

  return () => {
    unsubscribe()
    player.setAmbience(false)
  }
}
