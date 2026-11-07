import es from './es.json'

export type TextKey = keyof typeof es

/**
 * Devuelve el texto visible para una clave. Todos los textos de la UI pasan por acá.
 * Los valores entre llaves se reemplazan: t('topbar.speedValue', { speed: 2 }) → "2x".
 */
export function t(key: TextKey, params?: Record<string, string | number>): string {
  const text: string = es[key]
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match))
}
