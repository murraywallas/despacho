import { describe, expect, test } from 'vitest'
import { createClock, remainingSec, setSpeed, tick, togglePause } from '../../src/game/clock'
import { clock as clockBalance, clockSpeeds } from '../../src/game/balance'
import { useShiftStore } from '../../src/store/shiftStore'

describe('reloj del turno', () => {
  test('avanza con tick(dt)', () => {
    const clock = tick(createClock(300), 1.5)
    expect(clock.elapsedSec).toBe(1.5)
    expect(remainingSec(clock)).toBe(298.5)
  })

  test('no avanza en pausa', () => {
    const paused = togglePause(createClock(300))
    expect(tick(paused, 10).elapsedSec).toBe(0)
  })

  test('reanuda después de la pausa', () => {
    const resumed = togglePause(togglePause(createClock(300)))
    expect(tick(resumed, 2).elapsedSec).toBe(2)
  })

  test('a velocidad 2 avanza el doble', () => {
    const fast = setSpeed(createClock(300), 2)
    expect(tick(fast, 3).elapsedSec).toBe(6)
  })

  test('no baja de 0 y marca el turno como terminado', () => {
    const clock = tick(createClock(300), 400)
    expect(remainingSec(clock)).toBe(0)
    expect(clock.finished).toBe(true)
  })

  test('después de terminar no avanza ni se pausa', () => {
    const finished = tick(createClock(10), 10)
    expect(tick(finished, 5)).toBe(finished)
    expect(togglePause(finished).paused).toBe(false)
  })

  test('ignora pasos de tiempo negativos o nulos', () => {
    const clock = createClock(300)
    expect(tick(clock, 0)).toBe(clock)
    expect(tick(clock, -1)).toBe(clock)
  })
})

describe('velocidades del reloj desde la planilla', () => {
  test('la lista de velocidades siempre incluye 1x, sin repetidos y de menor a mayor', () => {
    expect(clockSpeeds({ speeds: '3, 2, 2' })).toEqual([1, 2, 3])
    expect(clockSpeeds({ speeds: 'rápido, 0, -1' })).toEqual([1])
    expect(clockSpeeds(clockBalance)).toContain(clockBalance.fastSpeed)
  })

  test('el estado solo acepta velocidades de la planilla', () => {
    useShiftStore.getState().startLevel(null)
    const fastest = Math.max(...clockSpeeds(clockBalance))
    useShiftStore.getState().setSpeed(fastest)
    expect(useShiftStore.getState().clock.speed).toBe(fastest)
    useShiftStore.getState().setSpeed(fastest + 7)
    expect(useShiftStore.getState().clock.speed).toBe(fastest)
    useShiftStore.getState().setSpeed(1)
  })
})
