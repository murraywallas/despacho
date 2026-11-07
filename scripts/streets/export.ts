/**
 * npm run streets: downloads the streets of each game area from OpenStreetMap (Overpass API)
 * and writes the game's street graph (data/streets/<area>.json). No API key needed.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { buildStreetGraph, type OverpassAnswer, type StreetGraphFile } from './convert.ts'

interface AreaConfig {
  id: string
  name: string
  /** [south, west, north, east] */
  bbox: StreetGraphFile['bbox']
  output: string
}

interface StreetsConfig {
  overpassUrl: string
  userAgent: string
  areas: AreaConfig[]
}

const configUrl = new URL('./config.json', import.meta.url)

function overpassQuery(bbox: StreetGraphFile['bbox']): string {
  return `[out:json][timeout:120];way["highway"](${bbox.join(',')});(._;>;);out body;`
}

async function download(config: StreetsConfig, area: AreaConfig): Promise<OverpassAnswer> {
  let response: Response
  try {
    response = await fetch(config.overpassUrl, {
      method: 'POST',
      headers: { 'User-Agent': config.userAgent, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: overpassQuery(area.bbox) }),
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`No se pudo bajar ${area.name}: no hay conexión con OpenStreetMap (${reason}).`)
  }
  if (!response.ok) {
    throw new Error(
      `OpenStreetMap respondió ${response.status} para ${area.name}. Si es 429 o 504, el servidor está ocupado: probá en unos minutos.`,
    )
  }
  return (await response.json()) as OverpassAnswer
}

/** One node or edge per line: readable diffs without the size of fully indented JSON. */
function serialize(graph: StreetGraphFile): string {
  const list = (items: unknown[]) => `[\n${items.map((item) => `    ${JSON.stringify(item)}`).join(',\n')}\n  ]`
  return [
    '{',
    `  "attribution": ${JSON.stringify(graph.attribution)},`,
    `  "osmTimestamp": ${JSON.stringify(graph.osmTimestamp)},`,
    `  "bbox": ${JSON.stringify(graph.bbox)},`,
    `  "kinds": ${JSON.stringify(graph.kinds)},`,
    `  "nodes": ${list(graph.nodes)},`,
    `  "edges": ${list(graph.edges)}`,
    '}',
    '',
  ].join('\n')
}

async function main(): Promise<void> {
  const config = JSON.parse(await readFile(configUrl, 'utf8')) as StreetsConfig
  for (const area of config.areas) {
    const graph = buildStreetGraph(await download(config, area), area.bbox)
    const outputUrl = new URL(`../../${area.output}`, import.meta.url)
    await mkdir(new URL('.', outputUrl), { recursive: true })
    const content = serialize(graph)
    await writeFile(outputUrl, content)
    const sizeKb = Math.round(Buffer.byteLength(content) / 1024)
    console.log(`${area.output}: ${graph.nodes.length} cruces, ${graph.edges.length} tramos, ${sizeKb} KB.`)
  }
}

main().catch((error: unknown) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
