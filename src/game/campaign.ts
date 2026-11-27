/**
 * The whole game played by a bot, with the money: the starting cash and riders, hiring, taking out the fleet the
 * garage suggests, salaries, and replaying each level until it opens the next one. It measures the balance of the
 * route through the 9 levels (#71): stars, money, vehicles used and minutes of play. It doesn't appear in the
 * game. Pure.
 */
import { autoplay, type Bot } from './autoplay'
import { clock as clockBalance, economy, eventKinds, experience, fleetOf, levelIds, levels, neighborhoods, progression, shift as shiftBalance, vehicles } from './balance'
import { addShiftXp, salariesKr, xpOfRiders, type ExperienceRules } from './experience'
import { weatherAdvice } from './garage'
import { balanceFor, neighborhoodOf, withFleet } from './levels'
import { fleetCostKr, shiftMoney } from './money'
import { summarizeShift } from './results'
import { shiftSettingsFrom } from './shift'

const costOf = (vehicle: string) => vehicles[vehicle]?.costPerShiftKr ?? 0
const SECONDS_PER_MINUTE = 60

/** The fleet the garage suggests for a level (the level's, with the weather swap). */
export function suggestedFleetOf(levelId: string): string[] {
  const balance = balanceFor(levelId)
  const allowed = neighborhoods[levels[levelId].neighborhood]?.vehicles ?? fleetOf(balance)
  return weatherAdvice(fleetOf(balance), balance.events ?? [], eventKinds, vehicles, allowed)?.fleet.slice() ?? fleetOf(balance)
}

export interface LevelReport {
  readonly levelId: string
  /** Shifts played until it opened the next level (or the bot gave up). */
  readonly tries: number
  /** Average stars of each try, in order. */
  readonly stars: readonly number[]
  /** Cash after the last try. */
  readonly moneyKr: number
  /** Fleet of the last try. */
  readonly fleet: readonly string[]
  /** Real minutes of play of all the tries (the closing at its faster clock included). */
  readonly minutes: number
}

export interface CampaignReport {
  readonly finished: boolean
  readonly moneyKr: number
  readonly lowestKr: number
  /** The most money saved, counted in shifts of the level's whole fleet (vehicles only). */
  readonly mostShiftsSaved: number
  /** Shifts that went out with fewer riders than the level suggests, for lack of money. */
  readonly shortShifts: number
  /** The most a level's whole fleet cost for one shift (vehicles and salaries). */
  readonly fleetKr: number
  readonly tries: Readonly<Record<string, number>>
  readonly levels: readonly LevelReport[]
  /** Delivered orders by vehicle, over the whole game. */
  readonly deliveredBy: Readonly<Record<string, number>>
  /** Real minutes of play of the whole game, at normal speed. */
  readonly minutes: number
}

export interface CampaignOptions {
  readonly rules?: ExperienceRules
  readonly maxTries?: number
  /** The fleet the player takes out in each level (default: the one the garage suggests). */
  readonly fleetFor?: (levelId: string) => string[]
}

const DEFAULT_MAX_TRIES = 8

/** Share of each vehicle among the delivered orders (0.5 = half of them). */
export function vehicleShares(deliveredBy: Readonly<Record<string, number>>): Record<string, number> {
  const total = Object.values(deliveredBy).reduce((sum, count) => sum + count, 0)
  return Object.fromEntries(Object.entries(deliveredBy).map(([vehicle, count]) => [vehicle, total > 0 ? count / total : 0]))
}

/**
 * Plays the whole game: starts with the starting money and riders, hires when it can pay the next level's fleet,
 * takes out what it can pay, and replays each level until it opens the next one (or gives up after maxTries).
 */
export function playCampaign(botOf: (levelId: string) => Bot, options: CampaignOptions = {}): CampaignReport {
  const rules = options.rules ?? experience
  const maxTries = options.maxTries ?? DEFAULT_MAX_TRIES
  const fleetFor = options.fleetFor ?? suggestedFleetOf
  let moneyKr = economy.startingKr
  let hired = economy.startingRiders
  let xp: number[] = []
  let lowestKr = moneyKr
  let mostShiftsSaved = 0
  let shortShifts = 0
  let fleetKr = 0
  const tries: Record<string, number> = {}
  const reports: LevelReport[] = []
  const deliveredBy: Record<string, number> = {}
  const result = (finished: boolean): CampaignReport => ({
    finished,
    moneyKr,
    lowestKr,
    mostShiftsSaved,
    shortShifts,
    fleetKr,
    tries,
    levels: reports,
    deliveredBy,
    minutes: reports.reduce((sum, report) => sum + report.minutes, 0),
  })

  for (const levelId of levelIds) {
    const levelFleet = fleetFor(levelId)
    const costOfFleet = (fleet: readonly string[]) => fleetCostKr(fleet, costOf) + salariesKr(xp, fleet.length, rules)
    const stars: number[] = []
    let fleet: string[] = []
    let realSec = 0
    tries[levelId] = 0
    while (Math.max(0, ...stars) < progression.unlockAvgRating && tries[levelId] < maxTries) {
      while (hired < levelFleet.length && moneyKr >= economy.hireRiderKr + costOfFleet(levelFleet.slice(0, hired + 1))) {
        moneyKr -= economy.hireRiderKr
        hired++
      }
      fleet = levelFleet.slice(0, hired)
      while (fleet.length > 1 && costOfFleet(fleet) > moneyKr) fleet = fleet.slice(0, -1)
      if (fleet.length < levelFleet.length) shortShifts++
      fleetKr = Math.max(fleetKr, costOfFleet(levelFleet))
      const salaries = salariesKr(xp, fleet.length, rules)
      const balance = withFleet(balanceFor(levelId), fleet)
      const autoplayOptions = { reactionSec: 3, picksPerLook: 1, stepSec: 0.25, xp: xpOfRiders(xp, fleet.length) }
      const end = autoplay(balance, shiftSettingsFrom(balance), balance.seed, botOf(levelId), autoplayOptions, neighborhoodOf(levelId))
      const orders = end.orderQueue.orders
      moneyKr += shiftMoney(orders, fleet, costOf, balance.heat, balance.rating, economy, salaries).profitKr
      lowestKr = Math.min(lowestKr, moneyKr)
      mostShiftsSaved = Math.max(mostShiftsSaved, moneyKr / fleetCostKr(levelFleet, costOf))
      xp = addShiftXp(xpOfRiders(xp, hired), end.riders, orders, rules)
      tries[levelId]++
      stars.push(summarizeShift(orders, balance.heat, balance.rating, shiftBalance).average ?? 0)
      // The shift, then the closing (deliveries already on their way) at its faster clock.
      const { durationSec, elapsedSec } = end.clock
      realSec += durationSec + Math.max(0, elapsedSec - durationSec) / (clockBalance.closingSpeed ?? 1)
      for (const order of orders) {
        if (order.status !== 'delivered') continue
        const vehicle = end.riders.find((rider) => rider.id === order.riderId)?.vehicle
        if (vehicle) deliveredBy[vehicle] = (deliveredBy[vehicle] ?? 0) + 1
      }
    }
    reports.push({ levelId, tries: tries[levelId], stars, moneyKr, fleet, minutes: realSec / SECONDS_PER_MINUTE })
    if (Math.max(0, ...stars) < progression.unlockAvgRating) return result(false)
  }
  return result(true)
}
