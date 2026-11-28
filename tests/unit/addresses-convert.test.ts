import { describe, expect, test } from 'vitest'
import { buildAddressBook, type AddressAnswer } from '../../scripts/streets/addresses.ts'

const BBOX: [number, number, number, number] = [55.68, 12.52, 55.71, 12.57]

describe('direcciones de OpenStreetMap', () => {
  test('guarda calle y número de cada dirección del área, una vez, ordenadas', () => {
    const answer: AddressAnswer = {
      osm3s: { timestamp_osm_base: '2026-11-28T13:00:00Z' },
      elements: [
        { type: 'node', id: 1, lat: 55.69, lon: 12.55, tags: { 'addr:street': 'Jagtvej', 'addr:housenumber': '34' } },
        { type: 'node', id: 2, lat: 55.691, lon: 12.551, tags: { 'addr:street': 'Jagtvej', 'addr:housenumber': '4' } },
        // Un edificio: se usa su centro.
        { type: 'way', id: 3, center: { lat: 55.7, lon: 12.56 }, tags: { 'addr:street': 'Blågårdsgade', 'addr:housenumber': '12B' } },
        // Repetida, sin número, o fuera del área: no entran.
        { type: 'node', id: 4, lat: 55.6901, lon: 12.5501, tags: { 'addr:street': 'Jagtvej', 'addr:housenumber': '34' } },
        { type: 'node', id: 5, lat: 55.69, lon: 12.55, tags: { 'addr:street': 'Jagtvej' } },
        { type: 'node', id: 6, lat: 55.5, lon: 12.55, tags: { 'addr:street': 'Lejlighed', 'addr:housenumber': '1' } },
      ],
    }
    const book = buildAddressBook(answer, BBOX)
    expect(book.attribution).toContain('OpenStreetMap')
    expect(book.osmTimestamp).toBe('2026-11-28T13:00:00Z')
    expect(book.streets).toEqual(['Blågårdsgade', 'Jagtvej'])
    expect(book.addresses).toEqual([
      [12.56, 55.7, 0, '12B'],
      [12.551, 55.691, 1, '4'],
      [12.55, 55.69, 1, '34'],
    ])
  })
})
