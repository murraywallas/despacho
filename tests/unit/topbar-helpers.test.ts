import { beforeEach, describe, expect, test } from 'vitest'
import { clock as clockBalance, prototype } from '../../src/game/balance'
import { createClock } from '../../src/game/clock'
import { t } from '../../src/i18n'
import { useShiftStore } from '../../src/store/shiftStore'
import { formatClock } from '../../src/ui/formatClock'

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
