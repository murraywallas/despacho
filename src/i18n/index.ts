import es from './es.json'

export type TextKey = keyof typeof es

/** Devuelve el texto visible para una clave. Todos los textos de la UI pasan por acá. */
export function t(key: TextKey): string {
  return es[key]
}
