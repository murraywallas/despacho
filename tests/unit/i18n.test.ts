import { describe, expect, test } from 'vitest'
import es from '../../src/i18n/es.json'
import { t } from '../../src/i18n'

describe('t', () => {
  test('devuelve el texto en español de una clave', () => {
    expect(t('app.title')).toBe('Despacho')
  })

  test('ningún texto de la interfaz está vacío', () => {
    for (const [key, text] of Object.entries(es)) {
      expect(text.trim(), key).not.toBe('')
    }
  })
})
