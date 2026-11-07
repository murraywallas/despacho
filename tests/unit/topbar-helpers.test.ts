import { beforeEach, describe, expect, test } from 'vitest'
import { clock as clockBalance, prototype } from '../../src/game/balance'
import { createClock } from '../../src/game/clock'
import { t } from '../../src/i18n'
import { useShiftStore } from '../../src/store/shiftStore'
import { formatClock, formatGameTime, gameMinutes, type GameTime } from '../../src/ui/formatClock'

describe('formatClock', () => {
  test.each([
    [300, '05:00'],
    [299.2, '05:00'],
    [61, '01:01'],
    [0.4, '00:01'],
    [0, '00:00'],
    [-3, '00:00'],
  ])('%s s → %s', (seconds, expected) => {
    expect(formatClock(seconds)).toBe(expected)
  })
})

const time: GameTime = { startHour: 18, gameSecondsPerRealSecond: 20 }

describe('hora del juego', () => {
  test.each([
    [0, '18:00'],
    [2.9, '18:00'],
    [3, '18:01'],
    [300, '19:40'],
  ])('%s s de turno → %s', (seconds, expected) => {
    expect(formatGameTime(seconds, time)).toBe(expected)
  })

  test('pasada la medianoche vuelve a 00', () => {
    expect(formatGameTime(18_000, { startHour: 23, gameSecondsPerRealSecond: 1 })).toBe('04:00')
  })

  test('minutos de juego, redondeando para arriba', () => {
    expect(gameMinutes(75, time)).toBe(25)
    expect(gameMinutes(74, time)).toBe(25)
    expect(gameMinutes(72, time)).toBe(24)
    expect(gameMinutes(0.5, time)).toBe(1)
    expect(gameMinutes(0, time)).toBe(0)
    expect(gameMinutes(-5, time)).toBe(0)
  })
})

describe('t con valores', () => {
  test('reemplaza los valores entre llaves', () => {
    expect(t('topbar.speedValue', { speed: 2 })).toBe('2x')
  })
})

describe('estado del turno', () => {
  beforeEach(() => {
    useShiftStore.setState({ clock: createClock(prototype.shift.durationSec) })
  })

  test('el turno dura lo que dice balance.json', () => {
    expect(useShiftStore.getState().clock.durationSec).toBe(prototype.shift.durationSec)
  })

  test('el botón de velocidad alterna entre normal y la velocidad rápida de balance.json', () => {
    const { toggleSpeed } = useShiftStore.getState()
    toggleSpeed()
    expect(useShiftStore.getState().clock.speed).toBe(clockBalance.fastSpeed)
    toggleSpeed()
    expect(useShiftStore.getState().clock.speed).toBe(1)
  })

  test('tick avanza el reloj y la pausa lo frena', () => {
    const { tick, togglePause } = useShiftStore.getState()
    tick(2)
    togglePause()
    tick(5)
    expect(useShiftStore.getState().clock.elapsedSec).toBe(2)
  })
})
