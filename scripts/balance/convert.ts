/**
 * Turns the rows of the balance spreadsheet into the content of data/balance.json.
 * Pure: no network or files, so it can be tested with sample CSV.
 *
 * Every tab has the same layout:
 *   row 1: Spanish column names (ignored)
 *   row 2: keys used by the code (columns without a key are notes and are skipped)
 *   row 3+: one item per row
 */

export type Scalar = string | number | boolean
export type Value = Scalar | string[]
export type JsonObject = { [key: string]: JsonValue }
export type JsonValue = Value | JsonObject

export interface RulesTab {
  name: string
  rows: string[][]
}

export interface TableTab {
  /** Key of the table in balance.json, e.g. "vehicles". */
  key: string
  /** Tab name in the spreadsheet, used in error messages. */
  name: string
  rows: string[][]
  /** Columns whose cells are comma-separated lists of ids. */
  listColumns?: string[]
  /** Columns that must only name ids of another table: column → table key. */
  references?: Record<string, string>
}

export class BalanceError extends Error {
  readonly problems: string[]

  constructor(problems: string[]) {
    super(`La planilla de balance tiene ${problems.length} problema(s):\n- ${problems.join('\n- ')}`)
    this.name = 'BalanceError'
    this.problems = problems
  }
}

const NUMBER = /^[-+]?(\d+(\.\d+)?|\.\d+)$/
const NUMBER_WITH_THOUSANDS = /^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/

function toNumber(text: string): number | undefined {
  if (NUMBER.test(text)) return Number(text)
  if (NUMBER_WITH_THOUSANDS.test(text)) return Number(text.replaceAll(',', ''))
  return undefined
}

/** Converts one cell. Returns undefined for an empty cell, which is then left out of the JSON. */
export function convertValue(raw: string): Scalar | undefined {
  const text = raw.trim().replaceAll('−', '-')
  if (text === '') return undefined

  const upper = text.toUpperCase()
  if (upper === 'TRUE' || upper === 'VERDADERO') return true
  if (upper === 'FALSE' || upper === 'FALSO') return false

  if (text.endsWith('%')) {
    const percent = toNumber(text.slice(0, -1).trim())
    if (percent !== undefined) return Math.round((percent / 100) * 1e12) / 1e12
  }

  return toNumber(text) ?? text
}

function convertList(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')
}

function isEmptyRow(row: string[]): boolean {
  return row.every((cell) => cell.trim() === '')
}

/** Reads the key row and returns the column index of each key, reporting repeated keys. */
function readKeys(tab: string, rows: string[][], problems: string[]): Map<string, number> {
  const keys = new Map<string, number>()
  const keyRow = rows[1] ?? []
  keyRow.forEach((cell, index) => {
    const key = cell.trim()
    if (key === '') return
    if (keys.has(key)) problems.push(`${tab}: la clave "${key}" está repetida en la fila 2.`)
    else keys.set(key, index)
  })
  return keys
}

function isObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseTable(tab: TableTab, problems: string[]): JsonObject {
  const keys = readKeys(tab.name, tab.rows, problems)
  const result: JsonObject = {}
  const idColumn = keys.get('id')
  if (idColumn === undefined) {
    problems.push(`${tab.name}: falta la columna con clave "id" en la fila 2.`)
    return result
  }

  tab.rows.slice(2).forEach((row, index) => {
    const rowNumber = index + 3
    if (isEmptyRow(row)) return
    const id = (row[idColumn] ?? '').trim()
    if (id === '') {
      problems.push(`${tab.name}, fila ${rowNumber}: falta el ID.`)
      return
    }
    if (id in result) {
      problems.push(`${tab.name}, fila ${rowNumber}: el ID "${id}" está repetido.`)
      return
    }

    const item: JsonObject = {}
    for (const [key, column] of keys) {
      if (key === 'id') continue
      const raw = row[column] ?? ''
      if (tab.listColumns?.includes(key)) {
        const list = convertList(raw)
        if (list.length > 0) item[key] = list
        continue
      }
      const value = convertValue(raw)
      if (value !== undefined) item[key] = value
    }
    result[id] = item
  })
  return result
}

function setPath(target: JsonObject, path: string, value: Scalar, where: string, problems: string[]): void {
  const parts = path.split('.')
  if (parts.some((part) => part === '')) {
    problems.push(`${where}: la clave "${path}" tiene un punto de más.`)
    return
  }

  let node = target
  for (const [index, part] of parts.slice(0, -1).entries()) {
    const existing = node[part]
    if (existing === undefined) {
      const child: JsonObject = {}
      node[part] = child
      node = child
    } else if (isObject(existing)) {
      node = existing
    } else {
      const prefix = parts.slice(0, index + 1).join('.')
      problems.push(`${where}: la clave "${path}" choca con "${prefix}", que ya tiene un valor.`)
      return
    }
  }

  const leaf = parts[parts.length - 1]
  if (node[leaf] !== undefined) {
    const kind = isObject(node[leaf]) ? 'choca con otras claves que empiezan igual' : 'está repetida'
    problems.push(`${where}: la clave "${path}" ${kind}.`)
    return
  }
  node[leaf] = value
}

export function parseRules(tab: RulesTab, problems: string[]): JsonObject {
  const keys = readKeys(tab.name, tab.rows, problems)
  const keyColumn = keys.get('key')
  const valueColumn = keys.get('value')
  const result: JsonObject = {}
  if (keyColumn === undefined || valueColumn === undefined) {
    problems.push(`${tab.name}: faltan las columnas con clave "key" y "value" en la fila 2.`)
    return result
  }

  tab.rows.slice(2).forEach((row, index) => {
    if (isEmptyRow(row)) return
    const where = `${tab.name}, fila ${index + 3}`
    const key = (row[keyColumn] ?? '').trim()
    if (key === '') {
      problems.push(`${where}: falta la clave.`)
      return
    }
    const value = convertValue(row[valueColumn] ?? '')
    if (value !== undefined) setPath(result, key, value, where, problems)
  })
  return result
}

function checkReferences(tab: TableTab, tables: JsonObject, problems: string[]): void {
  const items = tables[tab.key]
  if (!isObject(items) || !tab.references) return
  for (const [column, targetKey] of Object.entries(tab.references)) {
    const target = tables[targetKey]
    const validIds = isObject(target) ? new Set(Object.keys(target)) : new Set<string>()
    for (const [id, item] of Object.entries(items)) {
      if (!isObject(item)) continue
      const value = item[column]
      const named = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
      for (const ref of named) {
        if (!validIds.has(ref)) {
          problems.push(`${tab.name}, "${id}": la columna "${column}" nombra "${ref}", que no existe en ${targetKey}.`)
        }
      }
    }
  }
}

/** Builds the whole balance.json. Throws BalanceError with every problem found. */
export function buildBalance(rules: RulesTab, tables: TableTab[]): JsonObject {
  const problems: string[] = []
  const balance = parseRules(rules, problems)

  const parsed: JsonObject = {}
  for (const tab of tables) parsed[tab.key] = parseTable(tab, problems)
  for (const tab of tables) checkReferences(tab, parsed, problems)

  for (const tab of tables) {
    if (tab.key in balance) {
      problems.push(`${rules.name}: las claves que empiezan con "${tab.key}." chocan con la pestaña ${tab.name}.`)
    } else {
      balance[tab.key] = parsed[tab.key]
    }
  }

  if (problems.length > 0) throw new BalanceError(problems)
  return balance
}
