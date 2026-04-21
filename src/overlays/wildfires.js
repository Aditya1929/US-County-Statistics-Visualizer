/**
 * wildfires.js
 * NASA FIRMS (Fire Information for Resource Management System) — requires
 * a free NASA Earthdata account to obtain a MAP_KEY.
 *
 * Until the user sets their FIRMS key in the UI settings, we show a
 * placeholder that fetches the public "recent 24h" CSV endpoint.
 *
 * Fire hotspots are rendered as heat-cluster at low zoom, individual
 * markers at higher zoom.
 */

// NASA FIRMS MAP_KEY
const FIRMS_KEY = '2eb2a0db7a7c80a1c3706730c7a199d7'

// Public fallback (no key, limited data)
const FIRMS_PUBLIC =
  'https://firms.modaps.eosdis.nasa.gov/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_USA_contiguous_and_Hawaii_24h.csv'

// Keyed endpoint — returns last 1 day of VIIRS detections for the full USA
function firmsUrl(mapKey) {
  return `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/VIIRS_SNPP_NRT/USA/1`
}

export async function fetchWildfires(mapKey = FIRMS_KEY) {
  try {
    const url = mapKey ? firmsUrl(mapKey) : FIRMS_PUBLIC
    const res = await fetch(url)
    if (!res.ok) throw new Error(`FIRMS ${res.status}`)
    const csv = await res.text()
    return csvToGeoJSON(csv)
  } catch (err) {
    console.warn('FIRMS wildfire fetch failed:', err.message)
    return { type: 'FeatureCollection', features: [] }
  }
}

function csvToGeoJSON(csv) {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return { type: 'FeatureCollection', features: [] }

  const headers = lines[0].split(',').map((h) => h.trim())
  const latIdx = headers.indexOf('latitude')
  const lonIdx = headers.indexOf('longitude')
  const frkIdx = headers.indexOf('frp') // Fire Radiative Power (MW)
  const brightIdx = headers.indexOf('bright_ti4') || headers.indexOf('brightness')
  const dateIdx = headers.indexOf('acq_date')

  const features = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const lat = parseFloat(cols[latIdx])
    const lon = parseFloat(cols[lonIdx])
    if (isNaN(lat) || isNaN(lon)) continue
    const frp = frkIdx >= 0 ? parseFloat(cols[frkIdx]) || 0 : 0
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        frp,
        brightness: brightIdx >= 0 ? parseFloat(cols[brightIdx]) : null,
        date: dateIdx >= 0 ? cols[dateIdx] : null,
      },
    })
  }

  return { type: 'FeatureCollection', features }
}

export function addWildfireLayer(map, geojson) {
  removeWildfireLayer(map)

  if (geojson.features.length === 0) return

  map.addSource('wildfires', { type: 'geojson', data: geojson, cluster: true, clusterRadius: 40 })

  // Clusters
  map.addLayer({
    id: 'fire-clusters',
    type: 'circle',
    source: 'wildfires',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step', ['get', 'point_count'],
        '#ff8c00', 10,
        '#ff4500', 50,
        '#cc0000',
      ],
      'circle-radius': [
        'step', ['get', 'point_count'],
        14, 10, 20, 50, 28,
      ],
      'circle-opacity': 0.85,
    },
  })

  map.addLayer({
    id: 'fire-cluster-count',
    type: 'symbol',
    source: 'wildfires',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-size': 11,
    },
    paint: { 'text-color': '#fff' },
  })

  // Individual fire hotspots
  map.addLayer({
    id: 'fire-points',
    type: 'circle',
    source: 'wildfires',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['get', 'frp'],
        0, 5, 50, 9, 200, 14, 1000, 20,
      ],
      'circle-color': '#ff4500',
      'circle-opacity': 0.85,
      'circle-stroke-color': '#ffcc00',
      'circle-stroke-width': 1,
    },
  })
}

export function removeWildfireLayer(map) {
  for (const id of ['fire-points', 'fire-cluster-count', 'fire-clusters']) {
    if (map.getLayer(id)) map.removeLayer(id)
  }
  if (map.getSource('wildfires')) map.removeSource('wildfires')
}
