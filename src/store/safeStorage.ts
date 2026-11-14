import type { PersistStorage, StorageValue } from 'zustand/middleware'

// localStorage can be missing or throw (private windows, blocked site data, tests): then nothing is remembered.
function read(name: string): string | null {
  try {
    return globalThis.localStorage?.getItem(name) ?? null
  } catch {
    return null
  }
}

function write(name: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(name, value)
  } catch {
    // Not remembered this time.
  }
}

function forget(name: string): void {
  try {
    globalThis.localStorage?.removeItem(name)
  } catch {
    // Nothing to forget.
  }
}

/**
 * Storage for zustand's persist middleware that never breaks the game: a missing storage remembers nothing, and a
 * saved value that is not valid JSON (edited by hand, cut in half) counts as no save at all.
 */
export const browserStorage: PersistStorage<unknown> = {
  getItem: (name) => {
    const text = read(name)
    if (text === null) return null
    try {
      const value: unknown = JSON.parse(text)
      return typeof value === 'object' && value !== null ? (value as StorageValue<unknown>) : null
    } catch {
      return null
    }
  },
  setItem: (name, value) => write(name, JSON.stringify(value)),
  removeItem: forget,
}
