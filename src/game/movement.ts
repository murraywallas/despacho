/**
 * Riders on the move along real streets: riding to each restaurant of the trip (one, or a few close together),
 * waiting until its kitchen has the trip's orders ready, then riding to each customer in turn and delivering.
 * Everything advances with seconds of play, so pause and fast speed come for free. Pure.
 */
import { networkFor, positionOf, type CityMap, type NodeId } from './cityMap'
import { laterPickups, pickupsOf } from './pickups'
import type { Order } from './orders'
import type { Rider, Trip } from './riders'
import { cumulativeMeters, findRoute, type StreetNetwork } from './routing'
import { parkingSecOf } from './parking'
import { advanceCharging, drain } from './battery'
import type { LonLat } from './streetGraph'

/** Meters per second of play of each vehicle, by vehicle id (its speed × game time per real second). */
export type Speeds = Readonly<Record<string, number>>

export interface MovementSettings {
  readonly metersPerSec: Speeds
  /** Full battery in meters, by vehicle id, for vehicles that have one. */
  readonly batteryM?: Readonly<Record<string, number>>
  /** Seconds of play a battery takes to recharge at the base. */
  readonly rechargeSec?: number
}

/** How fast a vehicle goes, in meters per second of play. */
export function speedOf(speeds: Speeds, vehicle: string): number {
  const speed = speeds[vehicle]
  if (speed === undefined) throw new Error(`No hay velocidad para el vehículo ${vehicle}.`)
  return speed
}

/** How fast this rider goes: the vehicle's speed with the rider's experience bonus. */
export function riderSpeed(speeds: Speeds, rider: Pick<Rider, 'vehicle' | 'speedBonus'>): number {
  return speedOf(speeds, rider.vehicle) * (1 + (rider.speedBonus ?? 0))
}

/** Tolerance for floating-point leftovers when a rider arrives exactly at the end of a step. */
const EPSILON = 1e-9

export function routeNodes(network: StreetNetwork, from: NodeId, to: NodeId): NodeId[] {
  const route = findRoute(network, from, to)
  if (!route) throw new Error(`No hay ruta de ${from} a ${to}.`)
  return [...route.nodes]
}

function leg(network: StreetNetwork, path: readonly NodeId[]): Pick<Trip, 'path' | 'pathMeters' | 'traveledM'> {
  return { path, pathMeters: cumulativeMeters(network, path), traveledM: 0 }
}

/** The rider's orders, in delivery order (the ones that are not in the list given are skipped). */
export function ordersOf(rider: Rider, orders: readonly Order[]): Order[] {
  return (rider.orderIds ?? []).flatMap((id) => orders.find((order) => order.id === id) ?? [])
}

/** Starts the first leg (to the first restaurant) of a rider who just got their orders. */
export function startTrip(map: CityMap, rider: Rider, orders: readonly Order[]): Rider {
  const [first] = pickupsOf(map, ordersOf(rider, orders))
  if (!first) return rider
  const network = networkFor(map, rider.vehicle)
  const restaurant = first.restaurant.node
  const trip = leg(network, routeNodes(network, rider.node, restaurant))
  return { ...rider, trip: { ...trip, kitchenLeftSec: 0, parkLeftSec: parkingSecOf(rider.vehicle) } }
}

/** Index of the last crossing passed along the leg. */
export function passedIndex(trip: Trip): number {
  let index = 0
  while (index + 1 < trip.path.length && trip.pathMeters[index + 1] <= trip.traveledM + EPSILON) index++
  return index
}

/** Where the rider is drawn: between two crossings while riding. */
export function riderDisplayPosition(map: CityMap, rider: Rider): LonLat {
  const trip = rider.trip
  if (!trip || (rider.status !== 'toRestaurant' && rider.status !== 'toCustomer')) return positionOf(map, rider.node)
  const index = passedIndex(trip)
  const from = positionOf(map, trip.path[index])
  if (index + 1 >= trip.path.length) return from
  const to = positionOf(map, trip.path[index + 1])
  const stretch = trip.pathMeters[index + 1] - trip.pathMeters[index]
  const fraction = stretch > 0 ? (trip.traveledM - trip.pathMeters[index]) / stretch : 0
  return [from[0] + (to[0] - from[0]) * fraction, from[1] + (to[1] - from[1]) * fraction]
}

/** True when the current leg still ends at the next customer (after a reorder or a cancellation it may not). */
function headsTo(trip: Trip, customer: NodeId): boolean {
  return trip.path[trip.path.length - 1] === customer
}

/**
 * The rest of the trip as legs of crossings: the leg the rider is on (from the last crossing passed), then the
 * planned ones, one per customer still to visit.
 */
export function upcomingLegs(map: CityMap, rider: Rider, orders: readonly Order[]): NodeId[][] {
  const trip = rider.trip
  const stops = ordersOf(rider, orders)
  if (!trip || stops.length === 0) return []
  const network = networkFor(map, rider.vehicle)
  const legs: NodeId[][] = []
  let from: NodeId
  if (rider.status === 'toRestaurant' || rider.status === 'atKitchen') {
    // The leg to this restaurant, then one to each other restaurant still to visit.
    if (rider.status === 'toRestaurant') legs.push(trip.path.slice(passedIndex(trip)))
    from = trip.path[trip.path.length - 1]
    for (const pickup of laterPickups(map, stops, from)) {
      legs.push(routeNodes(network, from, pickup.restaurant.node))
      from = pickup.restaurant.node
    }
  } else {
    const current = headsTo(trip, stops[0].customer) ? trip.path.slice(passedIndex(trip)) : routeNodes(network, rider.node, stops[0].customer)
    legs.push(current)
    from = stops[0].customer
    stops.shift()
  }
  for (const stop of stops) {
    legs.push(routeNodes(network, from, stop.customer))
    from = stop.customer
  }
  return legs
}

/** What is left of the trip as points, from where the rider is now to the last customer. */
export function remainingRoute(map: CityMap, rider: Rider, orders: readonly Order[]): LonLat[] {
  const legs = upcomingLegs(map, rider, orders)
  if (legs.length === 0) return []
  const nodes = legs.flatMap((nodesOfLeg, index) => (index === 0 ? nodesOfLeg : nodesOfLeg.slice(1)))
  const points = nodes.map((node) => positionOf(map, node))
  if (rider.status === 'atKitchen') return points
  return [riderDisplayPosition(map, rider), ...points.slice(1)]
}

interface RiderStep {
  readonly rider: Rider
  /** Orders picked up in this step, with the second each one left its restaurant. */
  readonly pickedUp: readonly { readonly orderId: string; readonly atSec: number }[]
  /** Orders delivered in this step, with the second each one reached its customer. */
  readonly delivered: readonly { readonly orderId: string; readonly atSec: number }[]
}

/**
 * Moves one rider forward by dtSec seconds of play, starting at second startSec of the shift.
 * `orders` are the rider's orders, in delivery order.
 */
export function advanceRider(
  map: CityMap,
  rider: Rider,
  orders: readonly Order[],
  dtSec: number,
  startSec: number,
  settings: MovementSettings,
): RiderStep {
  let current = rider
  let stops = [...orders]
  let left = dtSec
  let now = startSec
  const pickedUp: { orderId: string; atSec: number }[] = []
  // Orders already on board: picked up before this step, or in it.
  const onBoard = new Set(orders.filter((order) => order.status === 'pickedUp').map((order) => order.id))
  const toPick = () => pickupsOf(map, stops.filter((order) => !onBoard.has(order.id)))
  // Meters ridden in this step: they come off the battery.
  let movedM = 0
  const delivered: { orderId: string; atSec: number }[] = []
  const network = networkFor(map, rider.vehicle)
  const metersPerSec = riderSpeed(settings.metersPerSec, rider)
  const parkSec = parkingSecOf(rider.vehicle)
  const idle = (at: NodeId): Rider => ({ ...current, node: at, status: 'idle', orderIds: undefined, trip: undefined })
  // From a restaurant: on to the next one still to visit, or (with all the food on board) to the first customer.
  const leave = (from: NodeId): Rider => {
    const [next] = toPick()
    const to = next ? next.restaurant.node : stops[0].customer
    const trip = { ...leg(network, routeNodes(network, from, to)), kitchenLeftSec: 0, parkLeftSec: parkSec }
    return { ...current, node: from, status: next ? 'toRestaurant' : 'toCustomer', trip }
  }

  while (current.trip && left > EPSILON) {
    if (stops.length === 0) {
      current = idle(current.node)
      break
    }
    let trip: Trip = current.trip

    if (current.status === 'atKitchen') {
      if (left < trip.kitchenLeftSec) {
        current = { ...current, trip: { ...trip, kitchenLeftSec: trip.kitchenLeftSec - left } }
        left = 0
        break
      }
      left -= trip.kitchenLeftSec
      now += trip.kitchenLeftSec
      for (const order of toPick().find((pickup) => pickup.restaurant.node === current.node)?.orders ?? []) {
        onBoard.add(order.id)
        pickedUp.push({ orderId: order.id, atSec: now })
      }
      current = leave(current.node)
      continue
    }

    // The next stop changed (reordered or cancelled): head there from the last crossing passed.
    if (current.status === 'toCustomer' && !headsTo(trip, stops[0].customer)) {
      trip = { ...leg(network, routeNodes(network, current.node, stops[0].customer)), kitchenLeftSec: 0, parkLeftSec: parkSec }
      current = { ...current, trip }
    }

    const remainingM = trip.pathMeters[trip.pathMeters.length - 1] - trip.traveledM
    const timeToEnd = remainingM / metersPerSec
    if (left < timeToEnd - EPSILON) {
      movedM += left * metersPerSec
      const moved = { ...trip, traveledM: trip.traveledM + left * metersPerSec }
      current = { ...current, node: moved.path[passedIndex(moved)], trip: moved }
      left = 0
      break
    }

    // At the end of the leg: park first (motorbike, car), then the stop happens.
    movedM += remainingM
    trip = { ...trip, traveledM: trip.pathMeters[trip.pathMeters.length - 1] }
    const park = trip.parkLeftSec ?? 0
    const end = trip.path[trip.path.length - 1]
    if (left < timeToEnd + park - EPSILON) {
      const arrived = { ...trip, traveledM: trip.pathMeters[trip.pathMeters.length - 1], parkLeftSec: park - (left - timeToEnd) }
      current = { ...current, node: end, trip: arrived }
      left = 0
      break
    }
    left -= timeToEnd + park
    now += timeToEnd + park
    if (current.status === 'toRestaurant') {
      const here = toPick().find((pickup) => pickup.restaurant.node === end)
      // Nothing left to pick up here (the orders went to someone else): on to the next stop.
      if (!here) {
        current = leave(end)
        continue
      }
      const readyAtSec = here.readyAtSec
      current = {
        ...current,
        node: end,
        status: 'atKitchen',
        // Food already ready: kitchenLeftSec is 0 and the next pass of the loop picks it up right away.
        trip: { ...trip, ...leg(network, [end]), kitchenLeftSec: Math.max(0, readyAtSec - now), parkLeftSec: 0 },
      }
      continue
    }

    // Reached a customer: hand over that order and go on to the next one, if any.
    const [handed, ...rest] = stops
    delivered.push({ orderId: handed.id, atSec: now })
    stops = rest
    if (rest.length === 0) {
      current = idle(end)
      break
    }
    current = {
      ...current,
      node: end,
      orderIds: rest.map((order) => order.id),
      trip: { ...leg(network, routeNodes(network, end, rest[0].customer)), kitchenLeftSec: 0, parkLeftSec: parkSec },
    }
  }

  return { rider: drain(current, movedM), pickedUp, delivered }
}

/**
 * Moves every busy rider and updates their orders (picked up, delivered).
 * Returns the same arrays when nothing changed.
 */
export function advanceFleet(
  map: CityMap,
  riders: readonly Rider[],
  orders: readonly Order[],
  dtSec: number,
  startSec: number,
  settings: MovementSettings,
): { riders: readonly Rider[]; orders: readonly Order[] } {
  if (dtSec <= 0 || riders.every((rider) => !rider.trip && rider.status !== 'charging')) return { riders, orders }

  const orderUpdates = new Map<string, Partial<Order>>()
  const nextRiders = riders.map((rider) => {
    if (rider.status === 'toBase' || rider.status === 'charging') {
      const speed = riderSpeed(settings.metersPerSec, rider)
      return advanceCharging(rider, dtSec, speed, settings.rechargeSec ?? 0, settings.batteryM?.[rider.vehicle])
    }
    if (!rider.trip) return rider
    const tripOrders = ordersOf(rider, orders)
    const step = advanceRider(map, rider, tripOrders, dtSec, startSec, settings)
    for (const { orderId, atSec } of step.pickedUp) orderUpdates.set(orderId, { status: 'pickedUp', pickedUpAtSec: atSec })
    for (const { orderId, atSec } of step.delivered) {
      orderUpdates.set(orderId, { ...orderUpdates.get(orderId), status: 'delivered', deliveredAtSec: atSec })
    }
    return step.rider
  })

  const nextOrders =
    orderUpdates.size === 0
      ? orders
      : orders.map((order) => (orderUpdates.has(order.id) ? { ...order, ...orderUpdates.get(order.id) } : order))
  return { riders: nextRiders, orders: nextOrders }
}

/**
 * Puts the rider's remaining stops in a new order (a permutation of the ones they still have). The rider heads
 * to the new first stop on the next step. Returns the same rider when the order is not valid.
 */
export function reorderStops(rider: Rider, orderIds: readonly string[]): Rider {
  const current = rider.orderIds ?? []
  const same = orderIds.length === current.length && current.every((id) => orderIds.includes(id))
  if (!same || rider.status === 'idle') return rider
  // Before the pickup, any order; once on the way, too: the food is already on board.
  return { ...rider, orderIds: [...orderIds] }
}
