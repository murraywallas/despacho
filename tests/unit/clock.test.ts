import { describe, expect, test } from 'vitest'
import { createClock, remainingSec, setSpeed, tick, togglePause } from '../../src/game/clock'

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
