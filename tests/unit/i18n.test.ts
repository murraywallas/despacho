import { afterEach, describe, expect, test } from 'vitest'
import { detectLanguage, setLanguage, t, textsOf } from '../../src/i18n'
import { formatRating } from '../../src/ui/formatRating'
import { formatKr } from '../../src/ui/formatKr'

const params = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()

describe('los textos en los dos idiomas', () => {
  afterEach(() => setLanguage('es'))

  test('inglés y español tienen las mismas claves y los mismos {parámetros}', () => {
    const es = textsOf('es')
    const en = textsOf('en')
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort())
    for (const key of Object.keys(es) as (keyof typeof es)[]) expect(params(en[key]), key).toEqual(params(es[key]))
  })

  test('ningún texto de la interfaz está vacío, en ningún idioma', () => {
    for (const language of ['es', 'en'] as const) {
      for (const [key, text] of Object.entries(textsOf(language))) expect(text.trim(), `${language} ${key}`).not.toBe('')
    }
  })

  test('ninguna frase en inglés quedó en español', () => {
    const es = textsOf('es')
    const en = textsOf('en')
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      // Los nombres propios (restaurantes, barrios, calles) y los formatos pueden ser iguales; las frases, no.
      if (es[key].split(' ').length > 3) expect(en[key], key).not.toBe(es[key])
    }
  })

  test('t() responde en el idioma elegido', () => {
    setLanguage('en')
    expect(t('orders.number', { number: 4 })).toBe('Order #4')
    setLanguage('es')
    expect(t('orders.number', { number: 4 })).toBe('Pedido #4')
  })

  test('las estrellas y la plata con el formato de cada idioma', () => {
    setLanguage('es')
    expect(formatRating(4.25)).toBe('4,3')
    expect(formatKr(1296)).toBe('1.296 kr')
    setLanguage('en')
    expect(formatRating(4.25)).toBe('4.3')
    expect(formatKr(1296)).toBe('1,296 kr')
  })
})

describe('el idioma del navegador', () => {
  test('español si el navegador lo pide primero; si no, inglés', () => {
    expect(detectLanguage(['es-AR', 'en-US'])).toBe('es')
    expect(detectLanguage(['en-GB', 'es'])).toBe('en')
    expect(detectLanguage(['da-DK', 'es-ES'])).toBe('es')
    expect(detectLanguage(['da-DK', 'de'])).toBe('en')
    expect(detectLanguage([])).toBe('en')
  })
})
