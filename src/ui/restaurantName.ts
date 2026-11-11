import type { Restaurant } from '../game/cityMap'
import { DEFAULT_NEIGHBORHOOD } from '../game/neighborhoods'
import { hasText, t } from '../i18n'

/**
 * "A · Pho Søndag": the map letter and the made-up name the restaurant has in that neighborhood.
 * Without a name in es.json, "Restaurante A".
 */
export function restaurantName(
  restaurant: Pick<Restaurant, 'id' | 'label'>,
  neighborhood: string = DEFAULT_NEIGHBORHOOD,
): string {
  const key = `restaurants.${neighborhood}.${restaurant.id}`
  if (!hasText(key)) return t('orders.restaurant', { label: restaurant.label })
  return t('orders.restaurantNamed', { label: restaurant.label, name: t(key) })
}
