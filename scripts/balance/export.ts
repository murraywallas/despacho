/**
 * npm run balance: downloads the balance spreadsheet and writes data/balance.json.
 * The spreadsheet is shared as "anyone with the link can view", so no API key is needed.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { BalanceError, buildBalance, type TableTab } from './convert.ts'
import { parseCsv } from './csv.ts'

interface TabConfig {
  name: string
  gid: number
}

interface TableConfig extends TabConfig {
  key: string
  listColumns?: string[]
  references?: Record<string, string>
}

interface ExportConfig {
  spreadsheetId: string
  output: string
  rules: TabConfig
  tables: TableConfig[]
}

const configUrl = new URL('./config.json', import.meta.url)

function sheetUrl(spreadsheetId: string, gid: number): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`
}

async function downloadTab(spreadsheetId: string, tab: TabConfig): Promise<string[][]> {
  let response: Response
  try {
    response = await fetch(sheetUrl(spreadsheetId, tab.gid), { redirect: 'follow' })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`No se pudo bajar la pestaña ${tab.name}: no hay conexión con Google (${reason}).`)
  }
  const type = response.headers.get('content-type') ?? ''
  if (!response.ok || !type.includes('text/csv')) {
    throw new Error(
      `No se pudo bajar la pestaña ${tab.name} como CSV (respuesta ${response.status}, ${type || 'sin tipo'}). ` +
        'Revisá que la planilla esté compartida como "Cualquier persona con el enlace: Lector" ' +
        'y que el spreadsheetId y el gid de scripts/balance/config.json sean los correctos.',
    )
  }
  return parseCsv(await response.text())
}

async function main(): Promise<void> {
  const config = JSON.parse(await readFile(configUrl, 'utf8')) as ExportConfig

  const [rulesRows, ...tableRows] = await Promise.all([
    downloadTab(config.spreadsheetId, config.rules),
    ...config.tables.map((tab) => downloadTab(config.spreadsheetId, tab)),
  ])

  const tables: TableTab[] = config.tables.map((tab, index) => ({
    key: tab.key,
    name: tab.name,
    rows: tableRows[index],
    listColumns: tab.listColumns,
    references: tab.references,
  }))
  const balance = buildBalance({ name: config.rules.name, rows: rulesRows }, tables)

  const outputUrl = new URL(`../../${config.output}`, import.meta.url)
  const content = `${JSON.stringify(balance, null, 2)}\n`
  const previous = await readFile(outputUrl, 'utf8').catch(() => '')
  if (previous === content) {
    console.log(`${config.output} ya estaba al día.`)
    return
  }
  await mkdir(new URL('.', outputUrl), { recursive: true })
  await writeFile(outputUrl, content)
  const counts = tables.map((tab) => `${Object.keys(balance[tab.key] as object).length} ${tab.key}`)
  console.log(`${config.output} actualizado: ${counts.join(', ')}.`)
}

main().catch((error: unknown) => {
  if (error instanceof BalanceError) console.error(error.message)
  else console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
