import { create } from 'zustand'
import { persist, type PersistStorage } from 'zustand/middleware'
import { economy, experience } from '../game/balance'
import { addShiftXp, train } from '../game/experience'
import type { Order } from '../game/orders'
import { hireRider } from '../game/garage'
import { recordResult } from '../game/levels'
import { cleanSave, migrateSave, newGame, SAVE_VERSION, type SavedGame } from '../game/save'
import { browserStorage } from './safeStorage'

interface ProgressState extends SavedGame {
  /** Adds a shift's profit (or loss) to the money. */
  earn: (profitKr: number) => void
  /** Hires one more rider for good, if the money is enough. */
  hire: () => void
  chooseFleet: (levelId: string, fleet: readonly string[]) => void
  /** Saves a finished shift; only a better result replaces the old one. */
  record: (levelId: string, average: number) => void
  finishGuide: () => void
  /** "Empezar de cero": forgets everything won and starts a new game. */
  restart: () => void
  /** Adds the experience each rider earned in a finished shift. */
  gainXp: (riders: readonly { readonly id: string; readonly number: number }[], orders: readonly Order[]) => void
  /** Pays a course for one rider (by place): up one level, if the money is enough. */
  train: (place: number) => void
}

/** A new game, with the money and riders of the Reglas tab. */
const fresh = (): SavedGame => newGame(economy.startingKr, economy.startingRiders)

/**
 * The player's game, saved by itself in this browser as one versioned save: stars of each level, shifts played,
 * money, riders hired and the fleet chosen for each level. An old save is migrated; a broken one starts a new game.
 */
export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      ...fresh(),
      earn: (profitKr) => set((state) => ({ moneyKr: state.moneyKr + profitKr })),
      hire: () =>
        set((state) => {
          const hired = hireRider(state.moneyKr, state.hired, economy.hireRiderKr)
          return hired ? { moneyKr: hired.moneyKr, hired: hired.hired } : state
        }),
      chooseFleet: (levelId, fleet) => set((state) => ({ fleets: { ...state.fleets, [levelId]: [...fleet] } })),
      finishGuide: () => set({ guideDone: true }),
      record: (levelId, average) =>
        set((state) => ({ best: recordResult(state.best, levelId, average), played: state.played + 1 })),
      restart: () => set(fresh()),
      gainXp: (riders, orders) => set((state) => ({ xp: addShiftXp(state.xp, riders, orders, experience) })),
      train: (place) =>
        set((state) => {
          const trained = train(state.xp, place, state.moneyKr, experience)
          return trained ? { xp: trained.xp, moneyKr: trained.moneyKr } : state
        }),
    }),
    {
      name: 'despacho-progress',
      version: SAVE_VERSION,
      storage: browserStorage as PersistStorage<SavedGame>,
      partialize: (state): SavedGame => ({
        best: state.best,
        played: state.played,
        guideDone: state.guideDone,
        moneyKr: state.moneyKr,
        hired: state.hired,
        fleets: state.fleets,
        xp: state.xp,
      }),
      migrate: (persisted, version) => migrateSave(persisted, version, fresh()),
      // Whatever comes from the browser is checked field by field before the game uses it.
      merge: (persisted, current) => ({ ...current, ...cleanSave(persisted, fresh()) }),
    },
  ),
)
