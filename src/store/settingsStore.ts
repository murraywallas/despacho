import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Language } from '../i18n'
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
  /** The language the player picked; null: the browser's. */
  language: Language | null
  setLanguage: (language: Language) => void
  setTextScale: (scale: number) => void
  toggleColorblind: () => void
  toggleReducedMotion: () => void
}

/** Settings of the pause menu (accessibility, language), remembered in this browser. */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      textScale: 1,
      colorblind: false,
      reducedMotion: false,
      language: null,
      setLanguage: (language) => set({ language }),
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
      partialize: ({ textScale, colorblind, reducedMotion, language }) => ({ textScale, colorblind, reducedMotion, language }),
    },
  ),
)
