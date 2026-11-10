import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_VOLUME } from '../audio/mix'
import { browserStorage } from './safeStorage'

interface SoundState {
  muted: boolean
  /** Master volume, 0–1. */
  volume: number
  toggleMute: () => void
  setVolume: (volume: number) => void
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
      storage: browserStorage,
      partialize: (state) => ({ muted: state.muted, volume: state.volume }),
    },
  ),
)
