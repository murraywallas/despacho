/**
 * Who ordered: a made-up name (common Danish first names and surnames, picked by the order itself, so the same
 * shift always has the same names) and the real address nearest to the customer's crossing. Only for show: it
 * doesn't change the shift. Pure.
 */
import names from '../../data/names.json'
import { nearestAddress, type Address, type AddressBookFile } from './addressBook'
import { positionOf, type CityMap } from './cityMap'
import type { Order } from './orders'

export interface Customer {
  readonly name: string
  readonly address?: Address
}

/** A number from a text, always the same for the same text (FNV-1a). Not the shift's random: names don't change it. */
function hashOf(text: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** The made-up name of an order's customer: "Mette Hansen". */
export function customerName(order: Pick<Order, 'id' | 'customer'>): string {
  const hash = hashOf(`${order.id}:${order.customer}`)
  const first = names.first[hash % names.first.length]
  const last = names.last[Math.floor(hash / names.first.length) % names.last.length]
  return `${first} ${last}`
}

/** Who ordered and where they live (the real address nearest to their crossing, if the area has addresses). */
export function customerOf(map: CityMap, order: Pick<Order, 'id' | 'customer'>, book: AddressBookFile | undefined): Customer {
  const address = book ? nearestAddress(book, positionOf(map, order.customer)) : undefined
  return address ? { name: customerName(order), address } : { name: customerName(order) }
}

/** "Jagtvej 34" */
export function addressLine(address: Address): string {
  return `${address.street} ${address.number}`
}
