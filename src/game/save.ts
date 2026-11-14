/**
 * The saved game: everything the player has won, in one versioned piece. Old saves are migrated, and anything odd
 * in a save (a broken value, a wrong type) is dropped and replaced by the start of the game, so a bad save never
 * breaks the game. Pure: the browser storage lives in src/store.
 */
import type { Progress } from './levels'

/** Version of the save format. Raise it when the shape changes, and add the step to migrateSave. */
export const SAVE_VERSION = 2

export interface SavedGame {
  /** Best average stars of each level finished. */
  readonly best: Progress
  /** Shifts finished, of any level. */
  readonly played: number
  /** The guided first shift was done or skipped. */
  readonly guideDone: boolean
  /** Money saved between shifts, in kr. */
  readonly moneyKr: number
  /** Riders hired. */
  readonly hired: number
  /** Fleet last chosen in the garage for each level. */
  readonly fleets: Readonly<Record<string, readonly string[]>>
  /** Experience of each rider hired, by place (rider 1 is place 0). */
  readonly xp: readonly number[]
}

/** What a new game starts with (money and riders from the Reglas tab). */
export function newGame(startingKr: number, startingRiders: number): SavedGame {
  return { best: {}, played: 0, guideDone: false, moneyKr: startingKr, hired: startingRiders, fleets: {}, xp: [] }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function cleanBest(value: unknown): Progress {
  if (!isRecord(value)) return {}
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => isNumber(entry[1])))
}

function cleanFleets(value: unknown): Record<string, string[]> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string[]] =>
        Array.isArray(entry[1]) && entry[1].length > 0 && entry[1].every((vehicle) => typeof vehicle === 'string'),
    ),
  )
}

/**
 * A save as the game can use it: each field kept when it has the right type, the new game's value otherwise.
 * Anything that isn't a save at all gives a new game.
 */
export function cleanSave(raw: unknown, fresh: SavedGame): SavedGame {
  if (!isRecord(raw)) return fresh
  return {
    best: cleanBest(raw.best),
    played: isNumber(raw.played) && raw.played >= 0 ? Math.floor(raw.played) : fresh.played,
    guideDone: typeof raw.guideDone === 'boolean' ? raw.guideDone : fresh.guideDone,
    moneyKr: isNumber(raw.moneyKr) ? raw.moneyKr : fresh.moneyKr,
    hired: isNumber(raw.hired) && raw.hired >= fresh.hired ? Math.floor(raw.hired) : fresh.hired,
    fleets: cleanFleets(raw.fleets),
    xp: Array.isArray(raw.xp) ? raw.xp.map((points) => (isNumber(points) && points > 0 ? points : 0)) : [],
  }
}

/**
 * Brings a save of an older version up to SAVE_VERSION.
 * - 0 → 1: saves from before money and the garage (#62, #63) had only stars, shifts played and the guide; they
 *   start with the money and riders of a new game, keeping everything they had won.
 * - 1 → 2: experience (#64) arrives; riders hired before it start with none.
 */
export function migrateSave(raw: unknown, version: number, fresh: SavedGame): SavedGame {
  let save: unknown = raw
  if (version < 1 && isRecord(save)) {
    save = { ...save, moneyKr: save.moneyKr ?? fresh.moneyKr, hired: save.hired ?? fresh.hired, fleets: save.fleets ?? {} }
  }
  if (version < 2 && isRecord(save)) save = { ...save, xp: [] }
  return cleanSave(save, fresh)
}
