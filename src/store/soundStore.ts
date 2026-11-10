import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { DEFAULT_VOLUME } from '../audio/mix'

interface SoundState {
  muted: boolean
  /** Master volume, 0–1. */
  volume: number
  toggleMute: () => void
  setVolume: (volume: number) => void
}

// localStorage can be missing or throw (private windows, blocked site data, tests): then nothing is remembered.
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return globalThis.localStorage?.getItem(name) ?? null
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      globalThis.localStorage?.setItem(name, value)
    } catch {
      // Not remembered this time.
    }
  },
  removeItem: (name) => {
    try {
      globalThis.localStorage?.removeItem(name)
    } catch {
      // Nothing to forget.
    }
  },
}

/** Sound settings, remembered between games in this browser. */
export const useSoundStore = create<SoundState>()(
  persist(
    (set) => ({
      muted: false,
      volume: DEFAULT_VOLUME,
      toggleMute: () => set((state) => ({ muted: !state.muted })),
      setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)), muted: false }),
    }),
    {
      name: 'despacho-sound',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ muted: state.muted, volume: state.volume }),
    },
  ),
)
