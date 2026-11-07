/**
 * What the map shows, as plain data: markers for restaurants, waiting customers and riders, and the routes of the
 * trips in progress as GeoJSON. Pure, so it is tested without a browser.
 */
import type { Feature, FeatureCollection, LineString } from 'geojson'
import { positionOf, type CityMap, type NodeId } from '../game/cityMap'
import { restaurantOf } from '../game/dispatch'
import { passedIndex, riderDisplayPosition } from '../game/movement'
import { waitingAt, type Order, type Urgency } from '../game/orders'
import type { Rider, RiderStatus } from '../game/riders'
import { findRoute } from '../game/routing'
import type { LonLat, StreetGraphFile } from '../game/streetGraph'

export type MarkerKind = 'restaurant' | 'customer' | 'rider'

export interface MapMarker {
  /** Stable across frames: "restaurant:r1", "customer:o3", "rider:k2". */
  readonly key: string
  readonly kind: MarkerKind
  readonly lngLat: LonLat
  /** What the marker stands for: restaurant, order or rider id. */
  readonly id: string
  /** Short text on the marker: restaurant letter, order number or rider number. */
  readonly label: string
  /** Restaurant and customer of the selected order, or the selected rider. */
  readonly selected: boolean
  /** Restaurants only: orders waiting for a rider there, and how urgent the most urgent one is. */
  readonly waiting?: { readonly count: number; readonly urgency: Urgency }
  /** Riders only: what they are doing and what they ride. */
  readonly rider?: { readonly status: RiderStatus; readonly vehicle: string }
}

const URGENCY_RANK: Record<Urgency, number> = { normal: 0, urgent: 1, late: 2 }

export interface MapSelection {
  readonly orderId: string | null
  readonly riderId: string | null
}

export function buildMarkers(
  map: CityMap,
  orders: readonly Order[],
  riders: readonly Rider[],
  selection: MapSelection,
  urgencyOf: (order: Order) => Urgency,
): MapMarker[] {
  const selected = orders.find((order) => order.id === selection.orderId)
  const selectedRestaurant = selected && restaurantOf(map, selected).id
  return [
    ...map.restaurants.map((restaurant) => {
      const waiting = waitingAt(orders, restaurant.id)
      const urgency = waiting
        .map(urgencyOf)
        .reduce<Urgency>((worst, next) => (URGENCY_RANK[next] > URGENCY_RANK[worst] ? next : worst), 'normal')
      return {
        key: `restaurant:${restaurant.id}`,
        kind: 'restaurant' as const,
        id: restaurant.id,
        lngLat: positionOf(map, restaurant.node),
        label: restaurant.label,
        selected: restaurant.id === selectedRestaurant,
        ...(waiting.length > 0 ? { waiting: { count: waiting.length, urgency } } : {}),
      }
    }),
    ...orders
      .filter((order) => order.status !== 'delivered' && order.status !== 'cancelled')
      .map((order) => ({
        key: `customer:${order.id}`,
        kind: 'customer' as const,
        id: order.id,
        lngLat: positionOf(map, order.customer),
        label: String(order.number),
        selected: order.id === selection.orderId,
      })),
    ...riders.map((rider) => ({
      key: `rider:${rider.id}`,
      kind: 'rider' as const,
      id: rider.id,
      lngLat: riderDisplayPosition(map, rider),
      label: String(rider.number),
      selected: rider.id === selection.riderId,
      rider: { status: rider.status, vehicle: rider.vehicle },
    })),
  ]
}

/**
 * Kinds of line on the map. toRestaurant: a rider riding to pick up. toCustomer: a rider carrying food.
 * planned: from the restaurant to the customer, before the food leaves. preview: how a free rider would get
 * to the selected order's restaurant.
 */
export type RouteLeg = 'toRestaurant' | 'toCustomer' | 'planned' | 'preview'

function routeLine(
  map: CityMap,
  nodes: readonly NodeId[],
  leg: RouteLeg,
  rider?: number,
): Feature<LineString, { leg: RouteLeg; rider?: number }>[] {
  if (nodes.length < 2) return []
  return [
    {
      type: 'Feature',
      properties: rider === undefined ? { leg } : { leg, rider },
      geometry: { type: 'LineString', coordinates: nodes.map((node) => [...positionOf(map, node)]) },
    },
  ]
}

/**
 * What is left of each trip in progress, a line per leg, from the last crossing the rider passed
 * (the rider's marker covers the bit between that crossing and the rider).
 */
export function routesGeoJson(map: CityMap, riders: readonly Rider[]): FeatureCollection<LineString> {
  const features = riders.flatMap((rider) => {
    const trip = rider.trip
    if (!trip) return []
    const ahead = trip.path.slice(passedIndex(trip))
    if (rider.status === 'toRestaurant') {
      return [...routeLine(map, ahead, 'toRestaurant', rider.number), ...routeLine(map, trip.toCustomer, 'planned', rider.number)]
    }
    if (rider.status === 'atKitchen') return routeLine(map, trip.toCustomer, 'planned', rider.number)
    return routeLine(map, ahead, 'toCustomer', rider.number)
  })
  return { type: 'FeatureCollection', features }
}

/** For the selected order: the way each free rider would ride to its restaurant, and then on to the customer. */
export function previewGeoJson(map: CityMap, riders: readonly Rider[], order: Order | undefined): FeatureCollection<LineString> {
  if (!order || order.status !== 'pending') return { type: 'FeatureCollection', features: [] }
  const restaurant = restaurantOf(map, order).node
  const nodesOf = (from: NodeId, to: NodeId) => findRoute(map.network, from, to)?.nodes ?? []
  return {
    type: 'FeatureCollection',
    features: [
      ...riders
        .filter((rider) => rider.status === 'idle')
        .flatMap((rider) => routeLine(map, nodesOf(rider.node, restaurant), 'preview', rider.number)),
      ...routeLine(map, nodesOf(restaurant, order.customer), 'planned'),
    ],
  }
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
