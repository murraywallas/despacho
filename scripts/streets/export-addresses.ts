/**
 * npm run addresses: downloads the real addresses (street and house number) of each game area from OpenStreetMap
 * (Overpass API) and writes data/streets/<area>.addresses.json. The street graph is not touched, so the game's
 * routes and balance stay the same. npm run addresses -- vesterbro: only that area.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { buildAddressBook, type AddressAnswer } from './addresses.ts'

interface AreaConfig {
  id: string
  name: string
  /** [south, west, north, east] */
  bbox: [number, number, number, number]
  output: string
}

interface StreetsConfig {
  overpassUrl: string
  userAgent: string
  areas: AreaConfig[]
}

const configUrl = new URL('./config.json', import.meta.url)

function overpassQuery(bbox: AreaConfig['bbox']): string {
  const box = bbox.join(',')
  return `[out:json][timeout:120];(node["addr:street"]["addr:housenumber"](${box});way["addr:street"]["addr:housenumber"](${box}););out center tags;`
}

async function download(config: StreetsConfig, area: AreaConfig): Promise<AddressAnswer> {
  let response: Response
  try {
    response = await fetch(config.overpassUrl, {
      method: 'POST',
      headers: { 'User-Agent': config.userAgent, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: overpassQuery(area.bbox) }),
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`No se pudieron bajar las direcciones de ${area.name}: no hay conexión con OpenStreetMap (${reason}).`)
  }
  if (!response.ok) {
    throw new Error(`OpenStreetMap respondió ${response.status} para ${area.name}. Si es 429 o 504, probá en unos minutos.`)
  }
  return (await response.json()) as AddressAnswer
}

async function main(): Promise<void> {
  const config = JSON.parse(await readFile(configUrl, 'utf8')) as StreetsConfig
  const wanted = process.argv.slice(2)
  for (const area of config.areas.filter((candidate) => wanted.length === 0 || wanted.includes(candidate.id))) {
    const book = buildAddressBook(await download(config, area), area.bbox)
    const output = area.output.replace(/\.json$/, '.addresses.json')
    const content = [
      '{',
      `  "attribution": ${JSON.stringify(book.attribution)},`,
      `  "osmTimestamp": ${JSON.stringify(book.osmTimestamp)},`,
      `  "streets": ${JSON.stringify(book.streets)},`,
      `  "addresses": [\n${book.addresses.map((address) => `    ${JSON.stringify(address)}`).join(',\n')}\n  ]`,
      '}',
      '',
    ].join('\n')
    await writeFile(new URL(`../../${output}`, import.meta.url), content)
    const sizeKb = Math.round(Buffer.byteLength(content) / 1024)
    console.log(`${output}: ${book.addresses.length} direcciones en ${book.streets.length} calles, ${sizeKb} KB.`)
  }
}

main().catch((error: unknown) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
