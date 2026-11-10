import { createJSONStorage, type StateStorage } from 'zustand/middleware'

// localStorage can be missing or throw (private windows, blocked site data, tests): then nothing is remembered.
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return globalThis.localStorage?.getItem(name) ?? null
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      globalThis.localStorage?.setItem(name, value)
    } catch {
      // Not remembered this time.
    }
  },
  removeItem: (name) => {
    try {
      globalThis.localStorage?.removeItem(name)
    } catch {
      // Nothing to forget.
    }
  },
}

/** Storage for zustand's persist middleware that never breaks the game. */
export const browserStorage = createJSONStorage(() => safeStorage)
