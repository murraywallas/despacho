/**
 * MapLibre, ready to use: its worker (the part that decodes map tiles in the background) is a separate file
 * that the bundler has to copy and point to.
 */
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

setWorkerUrl(workerUrl)

export { AttributionControl, Map as MapLibreMap, Marker, NavigationControl } from 'maplibre-gl'
export type { GeoJSONSource } from 'maplibre-gl'
