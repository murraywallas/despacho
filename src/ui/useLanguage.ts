import { detectLanguage, setLanguage, type Language } from '../i18n'
import { useSettingsStore } from '../store/settingsStore'

/** The browser's preferred languages (none outside a browser). */
function browserLanguages(): readonly string[] {
  return typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language])
}

/**
 * The language the game is shown in: the one the player picked, or the browser's. Every text follows it: calling
 * this hook at the root sets it before anything renders.
 */
export function useLanguage(): Language {
  const picked = useSettingsStore((state) => state.language)
  const shown = picked ?? detectLanguage(browserLanguages())
  setLanguage(shown)
  return shown
}
