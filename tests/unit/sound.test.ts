import { beforeEach, describe, expect, test } from 'vitest'
import { connectSounds, type SoundPlayer } from '../../src/audio/connectSounds'
import { prototype } from '../../src/game/balance'
import { createClock } from '../../src/game/clock'
import { eventsBetween, type GameEvent } from '../../src/game/events'
import { createOrderQueue, type Order } from '../../src/game/orders'
import { orderSettings, useShiftStore } from '../../src/store/shiftStore'
import { useSoundStore } from '../../src/store/soundStore'

const URGENT = 40
const order = (status: Order['status'], extra: Partial<Order> = {}): Order => ({
  id: 'o1',
  number: 1,
  restaurantId: 'r1',
  customer: 0,
  createdAtSec: 0,
  readyAtSec: 15,
  deadlineAtSec: 150,
  status,
  ...extra,
})
const at = (nowSec: number, orders: Order[], finished = false) => ({ orders, nowSec, finished })

describe('eventos del turno', () => {
  test('pedido nuevo, despacho, entrega y cancelación', () => {
    expect(eventsBetween(at(0, []), at(1, [order('pending')]), URGENT)).toEqual(['newOrder'])
    expect(eventsBetween(at(1, [order('pending')]), at(1, [order('assigned', { riderId: 'k1' })]), URGENT)).toEqual([
      'dispatch',
    ])
    expect(eventsBetween(at(9, [order('pickedUp')]), at(10, [order('delivered')]), URGENT)).toEqual(['delivered'])
    expect(eventsBetween(at(9, [order('pending')]), at(10, [order('cancelled')]), URGENT)).toEqual(['cancelled'])
  })

  test('reasignar a otro repartidor también es un despacho', () => {
    const before = at(5, [order('assigned', { riderId: 'k1' })])
    expect(eventsBetween(before, at(5, [order('assigned', { riderId: 'k2' })]), URGENT)).toEqual(['dispatch'])
  })

  test('urgente y tarde suenan una sola vez, al cruzar el límite', () => {
    const open = [order('pending')]
    expect(eventsBetween(at(150 - URGENT - 1, open), at(150 - URGENT + 1, open), URGENT)).toEqual(['urgent'])
    expect(eventsBetween(at(120, open), at(121, open), URGENT)).toEqual([])
    expect(eventsBetween(at(149, open), at(151, open), URGENT)).toEqual(['late'])
    expect(eventsBetween(at(151, open), at(152, open), URGENT)).toEqual([])
  })

  test('fin del turno', () => {
    expect(eventsBetween(at(419, []), at(420, [], true), URGENT)).toEqual(['shiftEnd'])
  })
})

describe('sonidos conectados al turno', () => {
  let played: GameEvent[]
  let ambience: boolean[]
  const player: SoundPlayer = {
    play: (event) => played.push(event),
    setAmbience: (on) => ambience.push(on),
  }

  beforeEach(() => {
    played = []
    ambience = []
    useSoundStore.setState({ muted: false })
    useShiftStore.setState({
      clock: createClock(prototype.shift.durationSec),
      orderQueue: createOrderQueue(orderSettings),
    })
  })

  const connect = () =>
    connectSounds(useShiftStore, player, () => useSoundStore.getState().muted, prototype.orders.urgentBelowSec)

  test('suena el pedido nuevo y el ambiente sigue al reloj', () => {
    const stop = connect()
    useShiftStore.getState().tick(prototype.orders.spawnIntervalSec)
    expect(played).toEqual(['newOrder'])
    useShiftStore.getState().togglePause()
    expect(ambience).toEqual([true, false])
    stop()
  })

  test('en silencio no suena nada', () => {
    useSoundStore.getState().toggleMute()
    const stop = connect()
    useShiftStore.getState().tick(prototype.orders.spawnIntervalSec)
    expect(played).toEqual([])
    stop()
  })

  test('al cerrar el turno suena solo el cierre, aunque se cancelen pedidos', () => {
    const stop = connect()
    useShiftStore.getState().tick(prototype.orders.spawnIntervalSec)
    played = []
    useShiftStore.getState().tick(prototype.shift.durationSec)
    expect(played).toEqual(['shiftEnd'])
    stop()
  })

  test('"Jugar otra vez" no hace sonar nada', () => {
    useShiftStore.getState().tick(prototype.orders.spawnIntervalSec * 2)
    const stop = connect()
    useShiftStore.getState().restartShift()
    expect(played).toEqual([])
    stop()
  })
})

describe('ajustes de sonido', () => {
  test('el volumen queda entre 0 y 1 y moverlo quita el silencio', () => {
    useSoundStore.setState({ muted: true })
    useSoundStore.getState().setVolume(1.5)
    expect(useSoundStore.getState()).toMatchObject({ volume: 1, muted: false })
  })
})
