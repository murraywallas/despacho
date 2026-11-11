import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { browserStorage } from './safeStorage'

/** Text sizes the player can pick, as a share of the normal size (100 %, 115 %, 130 %). */
export const TEXT_SCALES = [1, 1.15, 1.3] as const
export type TextScale = (typeof TEXT_SCALES)[number]

interface SettingsState {
  textScale: TextScale
  /** Urgency colors that people with color blindness tell apart (blue, orange, magenta). */
  colorblind: boolean
  /** Fades only, even when the system doesn't ask for reduced motion. */
  reducedMotion: boolean
  setTextScale: (scale: number) => void
  toggleColorblind: () => void
  toggleReducedMotion: () => void
}

/** Accessibility settings of the pause menu, remembered in this browser. */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      textScale: 1,
      colorblind: false,
      reducedMotion: false,
      setTextScale: (scale) => {
        const known = TEXT_SCALES.find((option) => option === scale)
        if (known !== undefined) set({ textScale: known })
      },
      toggleColorblind: () => set((state) => ({ colorblind: !state.colorblind })),
      toggleReducedMotion: () => set((state) => ({ reducedMotion: !state.reducedMotion })),
    }),
    {
      name: 'despacho-settings',
      storage: browserStorage,
      partialize: ({ textScale, colorblind, reducedMotion }) => ({ textScale, colorblind, reducedMotion }),
    },
  ),
)
