/**
 * The shift that plays itself behind the title screen: a real shift of a level, dispatched by the balance bot, on
 * the neighborhood's real streets. When it ends, the next one starts. Nobody plays it and nothing is saved. Pure.
 */
import { applyPick, batchingBot } from './autoplay'
import { clock as clockBalance, type PrototypeBalance } from './balance'
import { setSpeed } from './clock'
import { balanceFor, createAreaShift, neighborhoodOf } from './levels'
import type { Random } from './random'
import { advanceShift, settingsAt, shiftSettingsFrom, type ShiftSettings, type ShiftSnapshot } from './shift'

/** How often the bot looks at the shift, in seconds of play (like a person, not every frame). */
const LOOK_EVERY_SEC = 3

export interface Demo {
  readonly levelId: string
  readonly seed: number
  readonly shift: ShiftSnapshot
  readonly random: Random
  readonly balance: PrototypeBalance
  readonly settings: ShiftSettings
  /** Second of the shift when the bot looks again. */
  readonly nextLookSec: number
}

/** A fresh demo shift of a level, running at the fast clock so there is always something moving. */
export function createDemo(levelId: string, seed: number): Demo {
  const balance = balanceFor(levelId)
  const created = createAreaShift(balance, seed, neighborhoodOf(levelId))
  const shift = { ...created.shift, clock: setSpeed(created.shift.clock, clockBalance.fastSpeed) }
  return { levelId, seed, shift, random: created.random, balance, settings: shiftSettingsFrom(balance), nextLookSec: 0 }
}

/** Moves the demo dtSec real seconds forward: the bot dispatches, riders ride; a finished shift starts over. */
export function advanceDemo(demo: Demo, dtSec: number): Demo {
  if (demo.shift.clock.finished) return createDemo(demo.levelId, demo.seed + 1)
  let shift = demo.shift
  let nextLookSec = demo.nextLookSec
  if (shift.clock.elapsedSec >= nextLookSec) {
    nextLookSec = shift.clock.elapsedSec + LOOK_EVERY_SEC
    const pick = batchingBot(shift, settingsAt(demo.settings, shift.clock.elapsedSec))
    shift = (pick && applyPick(shift, pick, demo.settings)) ?? shift
  }
  shift = advanceShift(shift, dtSec, demo.random, demo.settings)
  return { ...demo, shift, nextLookSec }
}
