import type { Restaurant } from '../game/cityMap'
import { hasText, t } from '../i18n'

/** "A · Pho Søndag": the map letter and the made-up name. Without a name in es.json, "Restaurante A". */
export function restaurantName(restaurant: Pick<Restaurant, 'id' | 'label'>): string {
  const key = `restaurants.${restaurant.id}`
  if (!hasText(key)) return t('orders.restaurant', { label: restaurant.label })
  return t('orders.restaurantNamed', { label: restaurant.label, name: t(key) })
}
