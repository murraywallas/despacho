import { afterEach, describe, expect, test } from 'vitest'
import { economy } from '../../src/game/balance'
import { cleanSave, migrateSave, newGame, SAVE_VERSION, type SavedGame } from '../../src/game/save'
import { browserStorage } from '../../src/store/safeStorage'
import { useProgressStore } from '../../src/store/progressStore'

const fresh = newGame(600, 3)
const played: SavedGame = {
  best: { lunch: 4.5, dinner: 3.2 },
  played: 7,
  guideDone: true,
  moneyKr: 1234,
  hired: 4,
  fleets: { dinner: ['bike', 'e_scooter'] },
}

/** A localStorage that lives in memory, for the browser storage tests. */
function memoryStorage(): Storage {
  const items = new Map<string, string>()
  return {
    get length() {
      return items.size
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  }
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage')
})

describe('guardado de la partida', () => {
  test('guardar y cargar devuelve la misma partida', () => {
    expect(cleanSave(JSON.parse(JSON.stringify(played)), fresh)).toEqual(played)
  })

  test('una partida nueva arranca con la plata y los repartidores de Reglas', () => {
    expect(newGame(economy.startingKr, economy.startingRiders)).toEqual({
      best: {},
      played: 0,
      guideDone: false,
      moneyKr: economy.startingKr,
      hired: economy.startingRiders,
      fleets: {},
    })
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(1)
  })

  test('un guardado de versión vieja (sin plata ni garage) se migra y conserva lo ganado', () => {
    const old = { best: { lunch: 4.8 }, played: 3, guideDone: true }
    expect(migrateSave(old, 0, fresh)).toEqual({ ...fresh, best: { lunch: 4.8 }, played: 3, guideDone: true })
  })

  test('un guardado roto no rompe el juego: lo raro se descarta y el resto se conserva', () => {
    expect(cleanSave('basura', fresh)).toEqual(fresh)
    expect(cleanSave(null, fresh)).toEqual(fresh)
    expect(cleanSave([1, 2], fresh)).toEqual(fresh)
    const odd = {
      best: { lunch: 'cinco', dinner: 4, friday: Number.NaN },
      played: -2,
      guideDone: 'sí',
      moneyKr: 'mucha',
      hired: 1,
      fleets: { lunch: 'bike', dinner: ['bike', 3], friday: ['e_scooter'] },
    }
    expect(cleanSave(odd, fresh)).toEqual({ ...fresh, best: { dinner: 4 }, fleets: { friday: ['e_scooter'] } })
  })

  test('un guardado que no es JSON válido cuenta como ninguno', () => {
    const storage = memoryStorage()
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
    storage.setItem('despacho-progress', '{"state": {"best": ')
    expect(browserStorage.getItem('despacho-progress')).toBeNull()
    storage.setItem('despacho-progress', JSON.stringify({ state: played, version: SAVE_VERSION }))
    expect(browserStorage.getItem('despacho-progress')).toEqual({ state: played, version: SAVE_VERSION })
  })

  test('sin localStorage (ventana privada) no se guarda nada, pero el juego sigue', () => {
    expect(browserStorage.getItem('despacho-progress')).toBeNull()
    expect(() => browserStorage.setItem('despacho-progress', { state: played, version: SAVE_VERSION })).not.toThrow()
  })

  test('"Empezar de cero" vuelve a una partida nueva', () => {
    const store = useProgressStore.getState()
    store.record('lunch', 4.5)
    store.earn(500)
    store.chooseFleet('lunch', ['bike'])
    useProgressStore.getState().restart()
    const after = useProgressStore.getState()
    expect(after.best).toEqual({})
    expect(after.played).toBe(0)
    expect(after.moneyKr).toBe(economy.startingKr)
    expect(after.hired).toBe(economy.startingRiders)
    expect(after.fleets).toEqual({})
  })
})
