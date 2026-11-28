import type { CityMap } from '../game/cityMap'
import { addressLine, customerOf, type Customer } from '../game/customers'
import { ADDRESSES } from '../game/neighborhoods'
import type { Order } from '../game/orders'

// Finding the nearest address goes through thousands of them: once per order is enough.
const known = new Map<string, Customer>()

/** Who ordered and where they live, remembered per order. */
export function customerFor(map: CityMap, order: Pick<Order, 'id' | 'customer'>, neighborhood: string): Customer {
  const key = `${neighborhood}:${order.id}:${order.customer}`
  let customer = known.get(key)
  if (!customer) {
    customer = customerOf(map, order, ADDRESSES[neighborhood])
    known.set(key, customer)
  }
  return customer
}

/** "Mette Hansen · Jagtvej 34" (just the name where the area has no addresses). */
export function customerLabel(customer: Customer): string {
  return customer.address ? `${customer.name} · ${addressLine(customer.address)}` : customer.name
}
