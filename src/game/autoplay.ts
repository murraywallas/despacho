/**
 * Bots that play a whole shift on their own. They don't appear in the game: they measure the balance
 * (is there pressure? does dispatching well pay off?). Pure.
 */
import type { PrototypeBalance } from './balance'
import { networkFor } from './cityMap'
import { capacityOf, rankRiders, restaurantOf, travelTimeSec } from './dispatch'
import { riderSpeed } from './movement'
import { parkingSecOf } from './parking'
import { batteryShare, hasBatteryFor, isLowBattery, sendToCharge, tripMeters } from './battery'
import { createAreaShift } from './levels'
import { DEFAULT_NEIGHBORHOOD } from './neighborhoods'
import { advanceShift, dispatchOrders, settingsAt, type ShiftSettings, type ShiftSnapshot } from './shift'

export interface BotPick {
  readonly orderId: string
  readonly riderId: string
  /** Other orders of the same restaurant the rider takes on the same trip. */
  readonly withOrderIds?: readonly string[]
}

/** Picks the next order and rider, or undefined to wait. */
/** Sending a free rider back to base to recharge the battery. */
export interface BotRecharge {
  readonly rechargeRiderId: string
}

export type Bot = (shift: ShiftSnapshot, settings: ShiftSettings) => BotPick | BotRecharge | undefined

/**
 * A free rider who should recharge: the battery ran low, or it doesn't last any of the orders waiting. A careful
 * player sends them to recharge instead of leaving them idle.
 */
function lowBatteryRider(shift: ShiftSnapshot, settings: ShiftSettings): BotRecharge | undefined {
  const lowShare = settings.lowBatteryShare ?? 0
  const waiting = pendingOrders(shift)
  const rider = shift.riders.find((candidate) => {
    if (candidate.status !== 'idle' || candidate.batteryM === undefined) return false
    if (isLowBattery(candidate, batteryShare(candidate, settings.movement.batteryM?.[candidate.vehicle]), lowShare)) return true
    return waiting.length > 0 && waiting.every((order) => !hasBatteryFor(candidate, tripMeters(shift.map, candidate, [order])))
  })
  return rider ? { rechargeRiderId: rider.id } : undefined
}

function pendingOrders(shift: ShiftSnapshot) {
  return shift.orderQueue.orders.filter((order) => order.status === 'pending')
}

/** Dispatching without thinking: the oldest order goes to the first free rider on the list. */
export const firstComeBot: Bot = (shift) => {
  const order = pendingOrders(shift)[0]
  const rider = shift.riders.find((candidate) => candidate.status === 'idle')
  return order && rider ? { orderId: order.id, riderId: rider.id } : undefined
}

/**
 * Careful dispatching: the order a free rider reaches soonest, leaving for last the orders that can no longer
 * arrive on time.
 */
export const triageBot: Bot = (shift, settings) => {
  const recharge = lowBatteryRider(shift, settings)
  if (recharge) return recharge
  const now = shift.clock.elapsedSec
  const speeds = settings.movement.metersPerSec
  let best: { pick: BotPick; savable: boolean; etaSec: number } | undefined

  for (const order of pendingOrders(shift)) {
    const closest = rankRiders(shift.map, shift.riders, order, speeds)[0]
    // Nobody free can take this one (busy, or no battery for it): look at the next order.
    if (!closest) continue
    const vehicle = closest.rider.vehicle
    const restaurant = restaurantOf(shift.map, order).node
    const ride = travelTimeSec(networkFor(shift.map, vehicle), restaurant, order.customer, riderSpeed(speeds, closest.rider))
    const pickUpAtSec = Math.max(now + closest.etaSec, order.readyAtSec)
    const arrivesAtSec = pickUpAtSec + ride + parkingSecOf(vehicle)
    const savable = arrivesAtSec <= order.deadlineAtSec
    const better =
      !best || (savable && !best.savable) || (savable === best.savable && closest.etaSec < best.etaSec)
    if (better) best = { pick: { orderId: order.id, riderId: closest.rider.id }, savable, etaSec: closest.etaSec }
  }
  return best?.pick
}

/**
 * Careful dispatching that also batches: like triageBot, but when the rider carries more than one order, it takes
 * the other most urgent orders waiting at the same restaurant on the same trip.
 */
export const batchingBot: Bot = (shift, settings) => {
  const pick = triageBot(shift, settings)
  if (!pick || 'rechargeRiderId' in pick) return pick
  const rider = shift.riders.find((candidate) => candidate.id === pick.riderId)
  const order = shift.orderQueue.orders.find((candidate) => candidate.id === pick.orderId)
  if (!rider || !order) return pick
  const room = capacityOf(rider.vehicle) - 1
  if (room <= 0) return pick
  const others = pendingOrders(shift)
    .filter((candidate) => candidate.id !== order.id && candidate.restaurantId === order.restaurantId)
    .sort((x, y) => x.deadlineAtSec - y.deadlineAtSec)
    .slice(0, room)
    // Only what the battery lasts, if the vehicle has one.
    .filter((_, index, list) => hasBatteryFor(rider, tripMeters(shift.map, rider, [order, ...list.slice(0, index + 1)])))
  return others.length > 0 ? { ...pick, withOrderIds: others.map((other) => other.id) } : pick
}

export interface AutoplayOptions {
  /** Seconds of play between two looks at the screen (a player doesn't react instantly). */
  readonly reactionSec: number
  /** Orders dispatched per look. A person picks one order and one rider at a time; a machine, all at once. */
  readonly picksPerLook: number
  /** Size of each simulation step, in seconds of play. */
  readonly stepSec: number
  /** Experience of each rider (by place), for riders who already learned the job. */
  readonly xp?: readonly number[]
}

/** Plays a whole shift at normal speed with the given bot, on a neighborhood's streets, and returns how it ended. */
export function autoplay(
  balance: PrototypeBalance,
  settings: ShiftSettings,
  seed: number,
  bot: Bot,
  options: AutoplayOptions,
  neighborhood: string = DEFAULT_NEIGHBORHOOD,
): ShiftSnapshot {
  const created = createAreaShift(balance, seed, neighborhood, options.xp)
  let shift = created.shift
  let nextLookSec = 0

  while (!shift.clock.finished) {
    if (shift.clock.elapsedSec >= nextLookSec) {
      nextLookSec = shift.clock.elapsedSec + options.reactionSec
      for (let picks = 0; picks < options.picksPerLook; picks++) {
        const pick = bot(shift, settingsAt(settings, shift.clock.elapsedSec))
        if (!pick) break
        if ('rechargeRiderId' in pick) {
          const rechargeSec = settings.movement.rechargeSec ?? 0
          shift = {
            ...shift,
            riders: shift.riders.map((rider) => (rider.id === pick.rechargeRiderId ? sendToCharge(shift.map, rider, rechargeSec) : rider)),
          }
          continue
        }
        const orderIds = [pick.orderId, ...(pick.withOrderIds ?? [])]
        const result = dispatchOrders(shift.map, shift.orderQueue, shift.riders, orderIds, pick.riderId)
        if (!result) break
        shift = { ...shift, ...result }
      }
    }
    shift = advanceShift(shift, options.stepSec, created.random, settings)
  }
  return shift
}
