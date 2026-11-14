import type { Restaurant } from '../game/cityMap'
import type { RadioItem } from '../game/radio'
import { t } from '../i18n'
import { restaurantName } from './restaurantName'

/** "#3" or "#3, #4". */
function numbers(item: RadioItem): string {
  return item.orderNumbers.map((number) => t('radio.number', { number })).join(', ')
}

/** One line of the radio, in words. */
export function radioText(item: RadioItem, restaurants: readonly Restaurant[], neighborhood?: string): string {
  const restaurant = restaurants.find((candidate) => candidate.id === item.restaurantId)
  const place = restaurant ? restaurantName(restaurant, neighborhood) : ''
  const many = item.orderNumbers.length > 1
  switch (item.kind) {
    case 'newOrder':
      return many ? t('radio.newOrders', { count: item.orderNumbers.length }) : t('radio.newOrder', { orders: numbers(item), place })
    case 'pickedUp':
      return t('radio.pickedUp', { rider: item.riderNumber ?? '?', orders: numbers(item), place })
    case 'delivered':
      if (item.mood === 'late') return t('radio.deliveredLate', { orders: numbers(item) })
      if (item.mood === 'cold') return t('radio.deliveredCold', { orders: numbers(item) })
      return t('radio.delivered', { orders: numbers(item) })
    case 'riderFree':
      return t('radio.riderFree', { rider: item.riderNumber ?? '?' })
    case 'late':
      return t('radio.late', { orders: numbers(item) })
    case 'cancelled':
      return t('radio.cancelled', { orders: numbers(item) })
  }
}
