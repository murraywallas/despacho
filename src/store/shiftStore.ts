import { create } from 'zustand'
import { clock as clockBalance, prototype } from '../game/balance'
import { createClock, setSpeed, tick, togglePause, type ShiftClock } from '../game/clock'

interface ShiftState {
  clock: ShiftClock
  /** Advances the game by dtSec real seconds. */
  tick: (dtSec: number) => void
  togglePause: () => void
  /** Switches between normal speed and the fast speed from balance.json. */
  toggleSpeed: () => void
}

const NORMAL_SPEED = 1

export const useShiftStore = create<ShiftState>()((set) => ({
  clock: createClock(prototype.shift.durationSec),
  tick: (dtSec) =>
    set((state) => {
      const next = tick(state.clock, dtSec)
      return next === state.clock ? state : { clock: next }
    }),
  togglePause: () => set((state) => ({ clock: togglePause(state.clock) })),
  toggleSpeed: () =>
    set((state) => {
      const speed = state.clock.speed === NORMAL_SPEED ? clockBalance.fastSpeed : NORMAL_SPEED
      return { clock: setSpeed(state.clock, speed) }
    }),
}))
