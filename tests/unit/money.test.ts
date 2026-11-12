import { describe, expect, test } from 'vitest'
import { economy, vehicles } from '../../src/game/balance'
import { fleetCostKr, orderEarningsKr, shiftMoney, type MoneySettings } from '../../src/game/money'
import type { Order } from '../../src/game/orders'
import type { HeatSettings, RatingSettings } from '../../src/game/rating'
import { useProgressStore } from '../../src/store/progressStore'

// Fixed values, so the tests don't move when the balance sheet changes.
const heat: HeatSettings = { start: 100, lossPerSec: 1, coldBelow: 40 }
const rating: RatingSettings = { max: 5, latePenalty: 2, coldPenalty: 1, min: 1, cancelled: 1 }
const money: MoneySettings = { deliveryPayKr: 40, tipPerStarKr: 5 }
const costs: Record<string, number> = { bike: 150, skateboard: 80 }
const costOf = (vehicle: string) => costs[vehicle]

const base: Order = {
  id: 'o1',
  number: 1,
  restaurantId: 'r1',
  customer: 6,
  createdAtSec: 0,
  readyAtSec: 0,
  deadlineAtSec: 120,
  status: 'pending',
}
const perfect: Order = { ...base, status: 'delivered', readyAtSec: 100, deliveredAtSec: 110 } // 5 estrellas
const cold: Order = { ...base, status: 'delivered', readyAtSec: 40, deliveredAtSec: 110 } // fría: 4 estrellas
const late: Order = { ...base, status: 'delivered', readyAtSec: 115, deliveredAtSec: 125 }
const cancelled: Order = { ...base, status: 'cancelled', cancelledAtSec: 180 }

describe('dinero del turno', () => {
  test('una entrega a tiempo paga el monto base más la propina por estrella', () => {
    expect(orderEarningsKr(perfect, heat, rating, money)).toEqual({ payKr: 40, tipsKr: 25 })
    // La comida fría baja una estrella: baja la propina, no el pago.
    expect(orderEarningsKr(cold, heat, rating, money)).toEqual({ payKr: 40, tipsKr: 20 })
  })

  test('los pedidos tarde, cancelados o sin entregar no pagan', () => {
    for (const order of [late, cancelled, base]) {
      expect(orderEarningsKr(order, heat, rating, money)).toEqual({ payKr: 0, tipsKr: 0 })
    }
  })

  test('cada repartidor cuesta su vehículo por turno', () => {
    expect(fleetCostKr(['bike', 'skateboard', 'bike'], costOf)).toBe(380)
    expect(fleetCostKr([], costOf)).toBe(0)
  })

  test('ganancia = pagos + propinas − flota; puede ser negativa', () => {
    expect(shiftMoney([perfect, cold, late, cancelled], ['bike'], costOf, heat, rating, money)).toEqual({
      payKr: 80,
      tipsKr: 45,
      costKr: 150,
      profitKr: -25,
    })
    expect(shiftMoney([perfect, perfect, perfect], ['skateboard'], costOf, heat, rating, money).profitKr).toBe(115)
  })

  test('los números salen de la hoja: Reglas (Dinero) y Vehículos', () => {
    expect(economy.deliveryPayKr).toBeGreaterThan(0)
    expect(economy.tipPerStarKr).toBeGreaterThan(0)
    expect(economy.startingKr).toBeGreaterThan(0)
    for (const vehicle of Object.values(vehicles)) expect(vehicle.costPerShiftKr).toBeGreaterThan(0)
  })

  test('el dinero arranca con la plata inicial y se acumula entre turnos', () => {
    useProgressStore.setState({ moneyKr: economy.startingKr })
    const { earn } = useProgressStore.getState()
    earn(300)
    earn(-120)
    expect(useProgressStore.getState().moneyKr).toBe(economy.startingKr + 180)
  })
})
