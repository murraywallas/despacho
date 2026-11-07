/**
 * What the map shows, as plain data: markers for restaurants, waiting customers and riders, and the routes of the
 * trips in progress as GeoJSON. Pure, so it is tested without a browser.
 */
import type { Feature, FeatureCollection, LineString } from 'geojson'
import { positionOf, type CityMap } from '../game/cityMap'
import { restaurantOf } from '../game/dispatch'
import { passedIndex, remainingCrossings, riderDisplayPosition } from '../game/movement'
import type { Order } from '../game/orders'
import type { Rider } from '../game/riders'
import type { LonLat, StreetGraphFile } from '../game/streetGraph'

export type MarkerKind = 'restaurant' | 'customer' | 'rider'

export interface MapMarker {
  /** Stable across frames: "restaurant:r1", "customer:o3", "rider:k2". */
  readonly key: string
  readonly kind: MarkerKind
  readonly lngLat: LonLat
  /** Short text on the marker: restaurant letter, order number or rider number. */
  readonly label: string
  /** Restaurant and customer of the selected order. */
  readonly selected: boolean
}

export function buildMarkers(
  map: CityMap,
  orders: readonly Order[],
  riders: readonly Rider[],
  selectedOrderId: string | null,
): MapMarker[] {
  const selected = orders.find((order) => order.id === selectedOrderId)
  const selectedRestaurant = selected && restaurantOf(map, selected).id
  return [
    ...map.restaurants.map((restaurant) => ({
      key: `restaurant:${restaurant.id}`,
      kind: 'restaurant' as const,
      lngLat: positionOf(map, restaurant.node),
      label: restaurant.label,
      selected: restaurant.id === selectedRestaurant,
    })),
    ...orders
      .filter((order) => order.status !== 'delivered' && order.status !== 'cancelled')
      .map((order) => ({
        key: `customer:${order.id}`,
        kind: 'customer' as const,
        lngLat: positionOf(map, order.customer),
        label: String(order.number),
        selected: order.id === selectedOrderId,
      })),
    ...riders.map((rider) => ({
      key: `rider:${rider.id}`,
      kind: 'rider' as const,
      lngLat: riderDisplayPosition(map, rider),
      label: String(rider.number),
      selected: false,
    })),
  ]
}

/**
 * What is left of each trip in progress, one line per rider, from the last crossing the rider passed
 * (the rider's marker covers the bit between that crossing and the rider).
 */
export function routesGeoJson(map: CityMap, riders: readonly Rider[]): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = riders
    .filter((rider) => rider.trip)
    .map((rider) => ({
      type: 'Feature',
      properties: { rider: rider.number, leg: rider.status },
      geometry: { type: 'LineString', coordinates: remainingCrossings(rider).map((node) => [...positionOf(map, node)]) },
    }))
  return { type: 'FeatureCollection', features: features.filter((feature) => feature.geometry.coordinates.length > 1) }
}

/** Changes only when some route on the map changes: compare it to know when to redraw them. */
export function routesKey(riders: readonly Rider[]): string {
  return riders
    .map((rider) => (rider.trip ? `${rider.id}:${rider.status}:${rider.trip.path.length}:${passedIndex(rider.trip)}` : ''))
    .join('|')
}

/** The area's box as [[west, south], [east, north]], grown by `margin` of its size on each side. */
export function areaBounds(streets: StreetGraphFile, margin = 0): [[number, number], [number, number]] {
  const [south, west, north, east] = streets.bbox
  const padLon = (east - west) * margin
  const padLat = (north - south) * margin
  return [
    [west - padLon, south - padLat],
    [east + padLon, north + padLat],
  ]
}
