import { create } from 'zustand'
import { clock as clockBalance, clockSpeeds, prototype } from '../game/balance'
import type { CityMap } from '../game/cityMap'
import { setSpeed, togglePause, type ShiftClock } from '../game/clock'
import { reorderStops } from '../game/movement'
import { waitingAt, type Order, type OrderQueue, type OrderSettings } from '../game/orders'
import type { Random } from '../game/random'
import type { Rider } from '../game/riders'
import { advanceShift, capacityOf, dispatchOrders, movementAt, reassignAndStart, shiftSettingsFrom, streetConditionsAt } from '../game/shift'
import type { StreetGraphFile } from '../game/streetGraph'
import type { Speeds } from '../game/movement'
import type { ShiftEvent } from '../game/shiftEvents'
import { markSeen, updateFreeSince, type FreeSince } from '../game/attention'
import { balanceFor, createLevelShift } from '../game/levels'
import { callCustomer } from '../game/tools'

interface ShiftState {
  map: CityMap
  riders: readonly Rider[]
  clock: ShiftClock
  orderQueue: OrderQueue
  /** Advances the game by dtSec real seconds. */
  tick: (dtSec: number) => void
  togglePause: () => void
  /** Switches between normal speed and the fast speed from balance.json. */
  toggleSpeed: () => void
  /** Sets one of the clock speeds of balance.json (1x, 2x, 3x); any other value is ignored. */
  setSpeed: (speed: number) => void
  /** Pending order the player picked, waiting for a rider. */
  selectedOrderId: string | null
  /** More pending orders of the same restaurant added to the trip with Shift, in delivery order. */
  addedOrderIds: readonly string[]
  /** Free rider the player picked, waiting for an order. */
  selectedRiderId: string | null
  /**
   * The player picks an order (on the map, in the list). With a rider already picked, the order goes to that
   * rider; otherwise the order stays picked. Picking it again, or null, drops the selection.
   * With `add` (Shift + click), an order of the same restaurant joins the trip (or leaves it, if it was in).
   */
  selectOrder: (orderId: string | null, add?: boolean) => void
  /**
   * The player picks a rider (on the map, in the bar or with keys 1–9). With orders already picked, the rider
   * gets them (if their vehicle carries that many); otherwise a free rider stays picked. Works while paused too.
   */
  pickRider: (riderNumber: number) => void
  /**
   * With a rider picked, the player taps a restaurant: the rider goes for its most urgent waiting order. With
   * `fill` (Shift + tap), for as many of its orders as the vehicle carries. Returns false (and changes nothing)
   * when no rider is picked or nothing waits there.
   */
  sendRiderTo: (restaurantId: string, fill?: boolean) => boolean
  /** Changes the order of a busy rider's remaining stops (drag and drop in the rider card). */
  reorderStops: (riderNumber: number, orderIds: readonly string[]) => void
  /** Calls left this shift to extend a customer's deadline. */
  callsLeft: number
  /**
   * Calls the customer of the selected order to extend its deadline (key L). Returns false when there is no
   * order picked, no calls left, or the order is already delivered.
   */
  callCustomer: () => boolean
  /** Drops every selection (Esc). */
  clearSelection: () => void
  /**
   * A rider was dropped on an order, or an order on a rider: that rider gets the order (with the rest of the
   * trip, if the order was part of the orders picked with Shift). Same rules as picking both by hand.
   */
  dispatchByDrop: (orderId: string, riderNumber: number) => void
  /**
   * Arrow keys: picks the next (+1) or previous (−1) order waiting for a rider, in the order of the queue (the
   * most urgent first). It only picks; a number key then gives it to a rider.
   */
  selectNextOrder: (step: 1 | -1) => void
  /** "Jugar otra vez": starts the shift over (clock, orders, riders and stars). */
  restartShift: () => void
  /** Level being played (a row of the Niveles tab); null is the prototype shift of the Reglas tab. */
  levelId: string | null
  /** Fleet chosen in the garage for this shift; null is the level's suggested fleet. */
  fleet: readonly string[] | null
  /** Experience of each rider (by place) when the shift started. */
  xp: readonly number[]
  /** Riders who just went free, by id, with the second they did: the game points at them until used or seen. */
  freeSince: FreeSince
  /** Starts a level from the beginning, with its orders and clock, and the garage's fleet (or the suggested one). */
  startLevel: (levelId: string | null, fleet?: readonly string[], xp?: readonly number[]) => void
}

const NORMAL_SPEED = 1
// One shared empty list: a new [] every frame would make everything that watches the selection redo its work.
const NO_ORDERS: readonly string[] = []
const NOBODY_FREED: FreeSince = {}

const NOTHING_SELECTED = { selectedOrderId: null, addedOrderIds: NO_ORDERS, selectedRiderId: null }

/** The prototype's rules. Vehicle speeds are the same in every level, so the interface reads them from here. */
export const settings = shiftSettingsFrom(prototype)
export const orderSettings: OrderSettings = settings.orders

// The rules of the level being played (orders, deadlines): they change with startLevel.
let levelSettings = settings

/** Vehicle speeds at this second of the level being played, with its events (rain slows them down). */
export function speedsAt(nowSec: number): Speeds {
  return movementAt(levelSettings, nowSec).metersPerSec
}

/** Streets closed right now in the level being played (marathon), if any. */
export function closedStretchesAt(nowSec: number, streets: StreetGraphFile): ReadonlySet<string> | undefined {
  return streetConditionsAt(levelSettings, nowSec, streets)?.closed
}

/** Events of the level being played (rain…), with when each one starts and ends. */
export function levelEvents(): readonly ShiftEvent[] {
  return levelSettings.events
}

/** Every order picked for the next trip: the first one and the ones added with Shift. */
export function selectedOrderIds(state: Pick<ShiftState, 'selectedOrderId' | 'addedOrderIds'>): string[] {
  return state.selectedOrderId ? [state.selectedOrderId, ...state.addedOrderIds] : []
}

// The random stream of the current shift (orders keep drawing from it as they appear).
let random: Random

type ShiftData = Pick<
  ShiftState,
  | 'map'
  | 'riders'
  | 'clock'
  | 'orderQueue'
  | 'selectedOrderId'
  | 'addedOrderIds'
  | 'selectedRiderId'
  | 'callsLeft'
  | 'levelId'
  | 'fleet'
  | 'xp'
  | 'freeSince'
>

/** A fresh shift of a level: clock at the start, no orders, riders at their starting spots. */
function newShift(levelId: string | null, fleet: readonly string[] | null = null, xp: readonly number[] = []): ShiftData {
  const balance = balanceFor(levelId)
  levelSettings = shiftSettingsFrom(balance)
  const fresh = createLevelShift(levelId, fleet ?? undefined, xp)
  random = fresh.random
  return { ...fresh.shift, ...NOTHING_SELECTED, callsLeft: balance.tools.callsPerShift, levelId, fleet, xp, freeSince: NOBODY_FREED }
}

export const useShiftStore = create<ShiftState>()((set, get) => ({
  ...newShift(null),
  restartShift: () => set((state) => newShift(state.levelId, state.fleet, state.xp)),
  startLevel: (levelId, fleet, xp) => set(newShift(levelId, fleet ?? null, xp ?? [])),
  tick: (dtSec) =>
    set((state) => {
      const next = advanceShift(state, dtSec, random, levelSettings)
      if (next === state) return state
      const statusOf = (id: string) => next.orderQueue.orders.find((order) => order.id === id)?.status
      const stillPending = (id: string) => statusOf(id) === 'pending'
      const rider = next.riders.find((candidate) => candidate.id === state.selectedRiderId)
      // An order picked on its way (to reassign it or call its customer) stays picked until it is delivered.
      const firstStatus = state.selectedOrderId ? statusOf(state.selectedOrderId) : undefined
      const firstOpen = firstStatus === 'pending' || firstStatus === 'assigned' || firstStatus === 'pickedUp'
      const firstLeft = firstStatus === 'pending'
      return {
        clock: next.clock,
        riders: next.riders,
        freeSince: updateFreeSince(state.freeSince, state.riders, next.riders, next.clock.elapsedSec),
        orderQueue: next.orderQueue,
        selectedOrderId: firstOpen ? state.selectedOrderId : null,
        addedOrderIds: keepIfSame(state.addedOrderIds, firstLeft ? state.addedOrderIds.filter(stillPending) : NO_ORDERS),
        selectedRiderId: rider?.status === 'idle' ? state.selectedRiderId : null,
      }
    }),
  togglePause: () => set((state) => ({ clock: togglePause(state.clock) })),
  toggleSpeed: () =>
    set((state) => {
      const speed = state.clock.speed === NORMAL_SPEED ? clockBalance.fastSpeed : NORMAL_SPEED
      return { clock: setSpeed(state.clock, speed) }
    }),
  setSpeed: (speed) =>
    set((state) => {
      if (!clockSpeeds(clockBalance).includes(speed) || state.clock.finished) return state
      return { clock: setSpeed(state.clock, speed) }
    }),
  selectOrder: (orderId, add = false) =>
    set((state) => {
      if (orderId === null) return NOTHING_SELECTED
      const order = state.orderQueue.orders.find((candidate) => candidate.id === orderId)
      if (add && state.selectedOrderId && orderId !== state.selectedOrderId) {
        if (state.addedOrderIds.includes(orderId)) return { addedOrderIds: state.addedOrderIds.filter((id) => id !== orderId) }
        const first = state.orderQueue.orders.find((candidate) => candidate.id === state.selectedOrderId)
        if (order?.status !== 'pending' || order.restaurantId !== first?.restaurantId) return state
        return { addedOrderIds: [...state.addedOrderIds, orderId] }
      }
      if (orderId === state.selectedOrderId) return { selectedOrderId: null, addedOrderIds: NO_ORDERS }
      if (!order || state.clock.finished) return state
      if (order.status === 'assigned' && state.selectedRiderId) {
        // Rider first, then an order already going with someone else: it is reassigned to the rider.
        const result = reassignAndStart(state.map, state.orderQueue, state.riders, orderId, state.selectedRiderId, prototype.tools.reassignPenaltySec, state.clock.elapsedSec)
        return result ? { ...result, ...NOTHING_SELECTED } : state
      }
      if (order.status === 'assigned' || order.status === 'pickedUp') return { selectedOrderId: orderId, addedOrderIds: NO_ORDERS, selectedRiderId: null }
      if (order.status !== 'pending') return state
      if (state.selectedRiderId) {
        const result = dispatchOrders(state.map, state.orderQueue, state.riders, [orderId], state.selectedRiderId)
        return result ? { ...result, ...NOTHING_SELECTED } : state
      }
      return { selectedOrderId: orderId, addedOrderIds: NO_ORDERS }
    }),
  pickRider: (riderNumber) =>
    set((state) => {
      const rider = state.riders.find((candidate) => candidate.number === riderNumber)
      if (!rider || state.clock.finished) return state
      const picked = selectedOrderIds(state)
      const first = state.orderQueue.orders.find((order) => order.id === picked[0])
      if (first?.status === 'assigned') {
        const result = reassignAndStart(state.map, state.orderQueue, state.riders, first.id, rider.id, prototype.tools.reassignPenaltySec, state.clock.elapsedSec)
        return result ? { ...result, ...NOTHING_SELECTED } : state
      }
      // The food is already on its way: that order can only get a call to its customer.
      if (first?.status === 'pickedUp') return state
      if (picked.length > 0) {
        const result = dispatchOrders(state.map, state.orderQueue, state.riders, picked, rider.id)
        return result ? { ...result, ...NOTHING_SELECTED } : state
      }
      if (rider.status !== 'idle') return state
      // Picking a rider who just went free counts as having seen them.
      return { selectedRiderId: rider.id === state.selectedRiderId ? null : rider.id, freeSince: markSeen(state.freeSince, rider.id) }
    }),
  sendRiderTo: (restaurantId, fill = false) => {
    const state = get()
    const rider = state.riders.find((candidate) => candidate.id === state.selectedRiderId)
    const waiting = waitingAt(state.orderQueue.orders, restaurantId)
    if (!rider || waiting.length === 0 || state.clock.finished) return false
    const take = fill ? waiting.slice(0, capacityOf(rider.vehicle)) : waiting.slice(0, 1)
    const result = dispatchOrders(state.map, state.orderQueue, state.riders, take.map((order) => order.id), rider.id)
    if (!result) return false
    set({ ...result, ...NOTHING_SELECTED })
    return true
  },
  reorderStops: (riderNumber, orderIds) =>
    set((state) => ({
      riders: state.riders.map((rider) => (rider.number === riderNumber ? reorderStops(rider, orderIds) : rider)),
    })),
  callCustomer: () => {
    const state = get()
    if (!state.selectedOrderId || state.callsLeft <= 0 || state.clock.finished) return false
    const orders = callCustomer(state.orderQueue.orders, state.selectedOrderId, prototype.tools.callExtendSec)
    if (orders === state.orderQueue.orders) return false
    set({ orderQueue: { ...state.orderQueue, orders }, callsLeft: state.callsLeft - 1 })
    return true
  },
  clearSelection: () => set(NOTHING_SELECTED),
  dispatchByDrop: (orderId, riderNumber) => {
    const state = get()
    if (!selectedOrderIds(state).includes(orderId)) {
      set(NOTHING_SELECTED)
      get().selectOrder(orderId)
    } else if (state.selectedRiderId) {
      set({ selectedRiderId: null })
    }
    get().pickRider(riderNumber)
  },
  selectNextOrder: (step) =>
    set((state) => {
      const queue = waitingQueue(state.orderQueue.orders)
      if (queue.length === 0) return state
      const at = queue.findIndex((order) => order.id === state.selectedOrderId)
      const next = at < 0 ? (step > 0 ? 0 : queue.length - 1) : (at + step + queue.length) % queue.length
      return { ...NOTHING_SELECTED, selectedOrderId: queue[next].id }
    }),
}))

/** Orders waiting for a rider, as the queue shows them: the closest deadline first. */
export function waitingQueue(orders: readonly Order[]): Order[] {
  return orders.filter((order) => order.status === 'pending').sort((a, b) => a.deadlineAtSec - b.deadlineAtSec)
}

/** The previous list when nothing changed, so watchers don't redo work for an equal list. */
function keepIfSame(previous: readonly string[], next: readonly string[]): readonly string[] {
  return previous.length === next.length && previous.every((id, index) => id === next[index]) ? previous : next
}
