import { describe, expect, test } from 'vitest'
import names from '../../data/names.json'
import { nearestAddress, type AddressBookFile } from '../../src/game/addressBook'
import { addressLine, customerName, customerOf } from '../../src/game/customers'
import { ADDRESSES } from '../../src/game/neighborhoods'
import { lonLatAt, nodeAt, smallCity } from './smallCity'

// Two doors: one on crossing (1, 1), the other on (3, 3).
const book: AddressBookFile = {
  attribution: '© OpenStreetMap contributors',
  osmTimestamp: '',
  streets: ['Jagtvej', 'Nørrebrogade'],
  addresses: [
    [...lonLatAt(1, 1), 0, '34'],
    [...lonLatAt(3, 3), 1, '12B'],
  ],
}
const map = smallCity()

describe('quién pidió y dónde vive', () => {
  test('la dirección es la real más cercana a la esquina del cliente', () => {
    expect(nearestAddress(book, lonLatAt(1.2, 1))).toEqual({ street: 'Jagtvej', number: '34' })
    expect(nearestAddress(book, lonLatAt(2.9, 3.1))).toEqual({ street: 'Nørrebrogade', number: '12B' })
    expect(nearestAddress({ ...book, addresses: [] }, lonLatAt(0, 0))).toBeUndefined()
    expect(addressLine({ street: 'Jagtvej', number: '34' })).toBe('Jagtvej 34')
  })

  test('el nombre sale de la lista, y el mismo pedido tiene siempre el mismo nombre', () => {
    const order = { id: 'o4', customer: nodeAt(1, 1) }
    const name = customerName(order)
    const [first, last] = name.split(' ')
    expect(names.first).toContain(first)
    expect(names.last).toContain(last)
    expect(customerName({ ...order })).toBe(name)
    // Pedidos distintos, en general, nombres distintos.
    const many = new Set(Array.from({ length: 30 }, (_, index) => customerName({ id: `o${index}`, customer: index })))
    expect(many.size).toBeGreaterThan(20)
  })

  test('el cliente junta nombre y dirección; sin direcciones en el barrio, solo el nombre', () => {
    const order = { id: 'o1', customer: nodeAt(3, 3) }
    expect(customerOf(map, order, book)).toEqual({ name: customerName(order), address: { street: 'Nørrebrogade', number: '12B' } })
    expect(customerOf(map, order, undefined)).toEqual({ name: customerName(order) })
  })

  test('los tres barrios tienen sus direcciones reales de OpenStreetMap', () => {
    for (const area of ['norrebro', 'vesterbro', 'frederiksberg']) {
      const areaBook = ADDRESSES[area]
      expect(areaBook.attribution).toContain('OpenStreetMap')
      expect(areaBook.addresses.length).toBeGreaterThan(1000)
      for (const [, , street] of areaBook.addresses.slice(0, 50)) expect(areaBook.streets[street]).toBeTruthy()
    }
  })
})
