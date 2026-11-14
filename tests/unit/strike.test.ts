import { describe, expect, test } from 'vitest'
import { eventKinds, fleetOf, levelIds, levels, neighborhoods, struckOf } from '../../src/game/balance'
import { chosenFleet, garageRules, isValidFleet } from '../../src/game/garage'
import { balanceFor, createLevelShift } from '../../src/game/levels'
import { struckVehicles, withoutStruck } from '../../src/game/shiftEvents'

const STRUCK_LEVEL = 'frederiksberg_lunch'

describe('huelga de un vehículo', () => {
  test('la huelga es un evento de flota que nombra el vehículo', () => {
    expect(eventKinds.strike.effectType).toBe('fleet')
    const events = [
      { event: 'strike', vehicle: 'bike' },
      { event: 'rain', vehicle: 'skateboard' },
    ]
    expect(struckVehicles(events, eventKinds)).toEqual(['bike'])
  })

  test('la flota se rearma con el primer vehículo del barrio que no está en huelga', () => {
    const area = ['bike', 'skateboard', 'rollers']
    expect(withoutStruck(['bike', 'bike', 'rollers'], ['bike'], area)).toEqual(['skateboard', 'skateboard', 'rollers'])
    expect(withoutStruck(['bike', 'rollers'], [], area)).toEqual(['bike', 'rollers'])
    expect(() => withoutStruck(['bike'], ['bike'], ['bike'])).toThrow()
  })

  test('con huelga de bici, nadie sale en bici', () => {
    expect(struckOf(levels[STRUCK_LEVEL])).toEqual(['bike'])
    expect(levels[STRUCK_LEVEL].fleet).toContain('bike')
    expect(fleetOf(balanceFor(STRUCK_LEVEL))).not.toContain('bike')
    const { riders } = createLevelShift(STRUCK_LEVEL).shift
    expect(riders.map((rider) => rider.vehicle)).not.toContain('bike')
    expect(riders).toHaveLength(levels[STRUCK_LEVEL].fleet.length)
  })

  test('con huelga de bici, el garage no deja elegirla', () => {
    const levelFleet = fleetOf(balanceFor(STRUCK_LEVEL))
    const area = neighborhoods[levels[STRUCK_LEVEL].neighborhood].vehicles
    const rules = garageRules(levelFleet, area, 10, struckOf(levels[STRUCK_LEVEL]))
    expect(rules.vehicles).not.toContain('bike')
    expect(isValidFleet(['bike'], rules)).toBe(false)
    // A fleet saved before the strike, with a bike, goes back to the suggested one.
    expect(chosenFleet(['bike', 'motorcycle'], levelFleet, rules)).not.toContain('bike')
  })

  test('el pilar 1 incluye un nivel con huelga', () => {
    expect(levelIds.filter((levelId) => struckOf(levels[levelId]).length > 0)).toContain(STRUCK_LEVEL)
  })
})
