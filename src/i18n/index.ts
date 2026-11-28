import en from './en.json'
import es from './es.json'

export type TextKey = keyof typeof es

/** The languages the game is played in. */
export type Language = 'en' | 'es'
export const LANGUAGES: readonly Language[] = ['en', 'es']

// Every language has every text (a missing key in en.json is a type error here).
const TEXTS: Readonly<Record<Language, Readonly<Record<TextKey, string>>>> = { en, es }

/** Number formats of each language: decimals ("4,5" / "4.5") and thousands ("1.250" / "1,250"). */
const LOCALES: Readonly<Record<Language, string>> = { en: 'en-US', es: 'es-AR' }

let current: Language = 'es'

/** The language texts come out in now. */
export function language(): Language {
  return current
}

/** Changes the language of every text from now on (and of the page, for screen readers). */
export function setLanguage(next: Language): void {
  current = next
  if (typeof document !== 'undefined') document.documentElement.lang = next
}

/** The locale for numbers in the current language, for toLocaleString and Intl. */
export function locale(): string {
  return LOCALES[current]
}

/** The language a browser asks for: Spanish when its first Spanish or English preference is Spanish, else English. */
export function detectLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0]
    if (base === 'es') return 'es'
    if (base === 'en') return 'en'
  }
  return 'en'
}

/**
 * Devuelve el texto visible para una clave, en el idioma actual. Todos los textos de la UI pasan por acá.
 * Los valores entre llaves se reemplazan: t('topbar.speedValue', { speed: 2 }) → "2x".
 */
export function t(key: TextKey, params?: Record<string, string | number>): string {
  const text: string = TEXTS[current][key]
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match))
}

/** True when there is a visible text for this key (for texts chosen at run time, like a restaurant's name). */
export function hasText(key: string): key is TextKey {
  return Object.hasOwn(es, key)
}

/** The texts of a language, for tests that compare both. */
export function textsOf(lang: Language): Readonly<Record<TextKey, string>> {
  return TEXTS[lang]
}
