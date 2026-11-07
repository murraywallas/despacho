import { describe, expect, test } from 'vitest'
import { BalanceError, buildBalance, convertValue, type TableTab } from '../../scripts/balance/convert.ts'
import { parseCsv } from '../../scripts/balance/csv.ts'

const rulesCsv = [
  'Grupo,Regla,Clave,Valor,Unidad',
  ',,key,value,unit',
  'Prototipo,Tamaño,prototype.grid.size,10,cuadras',
  'Prototipo,Plazo,prototype.orders.deadlineSec,120,s',
  'Repartidores,Bonus,riders.speedBonusPerLevelPct,5%,por nivel',
  'Ajuste,Fácil,tuning.tooEasyAbove,4.8,estrellas',
  ',,,,',
].join('\r\n')

const vehiclesCsv = [
  'Vehículo,ID,Velocidad,Lluvia,Sale con nieve,Autonomía,Ventaja',
  ',id,speedKmh,rainSpeedPct,canRideInSnow,rangeKm,',
  'Bicicleta,bike,18,-10%,TRUE,,"Ciclovías, puentes solo-bici"',
  'Monopatín,e_scooter,20,−25%,FALSE,25,"Dice ""rápido"""',
].join('\n')

const neighborhoodsCsv = [
  'Orden,Barrio,ID,Vehículos',
  'order,,id,vehicles',
  '1,Nørrebro,norrebro,"bike, e_scooter"',
].join('\n')

function tables(overrides: Partial<Record<string, string>> = {}): TableTab[] {
  return [
    { key: 'vehicles', name: 'Vehículos', rows: parseCsv(overrides.vehicles ?? vehiclesCsv) },
    {
      key: 'neighborhoods',
      name: 'Barrios',
      rows: parseCsv(overrides.neighborhoods ?? neighborhoodsCsv),
      listColumns: ['vehicles'],
      references: { vehicles: 'vehicles' },
    },
  ]
}

function rules(csv = rulesCsv) {
  return { name: 'Reglas', rows: parseCsv(csv) }
}

function problemsOf(run: () => unknown): string[] {
  try {
    run()
  } catch (error) {
    if (error instanceof BalanceError) return error.problems
    throw error
  }
  throw new Error('Se esperaba un BalanceError')
}

describe('parseCsv', () => {
  test('respeta comillas, comas y saltos de línea dentro de una celda', () => {
    expect(parseCsv('a,"b, c","d ""e""\nf"\r\n1,2,3')).toEqual([
      ['a', 'b, c', 'd "e"\nf'],
      ['1', '2', '3'],
    ])
  })

  test('ignora el BOM inicial y el salto de línea final', () => {
    expect(parseCsv('﻿a,b\n')).toEqual([['a', 'b']])
  })

  test('falla si una comilla queda abierta', () => {
    expect(() => parseCsv('a,"b')).toThrow('comillas sin cerrar')
  })
})

describe('convertValue', () => {
  test.each([
    ['18', 18],
    ['4.8', 4.8],
    ['1,200', 1200],
    ['-10%', -0.1],
    ['−25%', -0.25],
    ['5%', 0.05],
    ['TRUE', true],
    ['FALSE', false],
    ['bike', 'bike'],
  ])('%s → %s', (raw, expected) => {
    expect(convertValue(raw)).toBe(expected)
  })

  test('una celda vacía no tiene valor', () => {
    expect(convertValue('  ')).toBeUndefined()
  })
})

describe('buildBalance', () => {
  test('arma las reglas anidadas y las tablas por ID', () => {
    const balance = buildBalance(rules(), tables())

    expect(balance.prototype).toEqual({ grid: { size: 10 }, orders: { deadlineSec: 120 } })
    expect(balance.riders).toEqual({ speedBonusPerLevelPct: 0.05 })
    expect(balance.tuning).toEqual({ tooEasyAbove: 4.8 })
    expect(balance.vehicles).toEqual({
      bike: { speedKmh: 18, rainSpeedPct: -0.1, canRideInSnow: true },
      e_scooter: { speedKmh: 20, rainSpeedPct: -0.25, canRideInSnow: false, rangeKm: 25 },
    })
    expect(balance.neighborhoods).toEqual({ norrebro: { order: 1, vehicles: ['bike', 'e_scooter'] } })
  })

  test('da el mismo resultado si se corre dos veces', () => {
    expect(JSON.stringify(buildBalance(rules(), tables()))).toBe(JSON.stringify(buildBalance(rules(), tables())))
  })

  test('falla si un ID se repite', () => {
    const csv = `${vehiclesCsv}\nOtra bici,bike,10,,,,`
    expect(problemsOf(() => buildBalance(rules(), tables({ vehicles: csv })))).toEqual([
      'Vehículos, fila 5: el ID "bike" está repetido.',
    ])
  })

  test('falla si una fila no tiene ID', () => {
    const csv = `${vehiclesCsv}\nSin id,,10,,,,`
    expect(problemsOf(() => buildBalance(rules(), tables({ vehicles: csv })))).toEqual([
      'Vehículos, fila 5: falta el ID.',
    ])
  })

  test('falla si un barrio nombra un vehículo que no existe', () => {
    const csv = 'Orden,Barrio,ID,Vehículos\norder,,id,vehicles\n1,Nørrebro,norrebro,"bike, car"'
    expect(problemsOf(() => buildBalance(rules(), tables({ neighborhoods: csv })))).toEqual([
      'Barrios, "norrebro": la columna "vehicles" nombra "car", que no existe en vehicles.',
    ])
  })

  test('falla si una clave de Reglas está repetida o choca con otra', () => {
    const csv = `${rulesCsv}\nX,X,prototype.grid.size,12,\nX,X,prototype.grid,3,`
    expect(problemsOf(() => buildBalance(rules(csv), tables()))).toEqual([
      'Reglas, fila 8: la clave "prototype.grid.size" está repetida.',
      'Reglas, fila 9: la clave "prototype.grid" choca con otras claves que empiezan igual.',
    ])
  })

  test('falla si una clave de Reglas choca con una pestaña', () => {
    const csv = `${rulesCsv}\nX,X,vehicles.max,3,`
    expect(problemsOf(() => buildBalance(rules(csv), tables()))).toEqual([
      'Reglas: las claves que empiezan con "vehicles." chocan con la pestaña Vehículos.',
    ])
  })

  test('falla si una pestaña no tiene la fila de claves esperada', () => {
    const csv = 'Vehículo,Velocidad\n,speedKmh\nBici,18'
    expect(problemsOf(() => buildBalance(rules(), tables({ vehicles: csv })))).toContain(
      'Vehículos: falta la columna con clave "id" en la fila 2.',
    )
  })
})
