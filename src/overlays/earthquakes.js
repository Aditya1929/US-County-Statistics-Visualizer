/**
 * earthquakes.js
 * USGS Earthquake API overlay — no API key required.
 *
 * Approach:
 *   - Fetch as GeoJSON from USGS; add as MapLibre GeoJSON source
 *   - Circle layer sized by magnitude using interpolate expression
 *   - CSS-keyframe pulsing via a second translucent circle layer
 *   - Magnitude >= 5.0 get an additional label
 */

const USGS_BASE = 'https://earthquake.usgs.gov/fdsnws/event/1/query'

export async function fetchEarthquakes(windowHours = 24, minMagnitude = 1.5) {
  const end = new Date()
  const start = new Date(end - windowHours * 3600 * 1000)
  const url =
    `${USGS_BASE}?format=geojson` +
    `&starttime=${start.toISOString()}` +
    `&endtime=${end.toISOString()}` +
    `&minmagnitude=${minMagnitude}` +
    `&minlatitude=18.0&maxlatitude=71.5&minlongitude=-180.0&maxlongitude=-65.0` +
    `&orderby=time`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`USGS ${res.status}`)
  return res.json()
}

export function addEarthquakeLayer(map, geojson) {
  if (map.getSource('earthquakes')) {
    map.getSource('earthquakes').setData(geojson)
    return
  }

  map.addSource('earthquakes', { type: 'geojson', data: geojson })

  // Outer pulse ring (animated via CSS opacity trick)
  map.addLayer({
    id: 'earthquakes-pulse',
    type: 'circle',
    source: 'earthquakes',
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['get', 'mag'],
        1.5, 8, 3, 14, 5, 22, 7, 36,
      ],
      'circle-color': '#ff6b35',
      'circle-opacity': 0.25,
      'circle-stroke-width': 0,
    },
  })

  // Inner filled circle
  map.addLayer({
    id: 'earthquakes-dot',
    type: 'circle',
    source: 'earthquakes',
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['get', 'mag'],
        1.5, 4, 3, 7, 5, 12, 7, 20,
      ],
      'circle-color': [
        'interpolate', ['linear'], ['get', 'mag'],
        1.5, '#ffe082',
        3, '#ff9800',
        5, '#f44336',
        7, '#9c27b0',
      ],
      'circle-opacity': 0.9,
      'circle-stroke-color': 'rgba(255,255,255,0.6)',
      'circle-stroke-width': 1,
    },
  })

  // Labels for M >= 5
  map.addLayer({
    id: 'earthquakes-label',
    type: 'symbol',
    source: 'earthquakes',
    filter: ['>=', ['get', 'mag'], 5],
    layout: {
      'text-field': ['concat', 'M', ['number-format', ['get', 'mag'], { 'min-fraction-digits': 1 }]],
      'text-size': 11,
      'text-offset': [0, -1.5],
      'text-anchor': 'bottom',
    },
    paint: {
      'text-color': '#fff',
      'text-halo-color': '#000',
      'text-halo-width': 1.5,
    },
  })
}

export function removeEarthquakeLayer(map) {
  for (const id of ['earthquakes-label', 'earthquakes-dot', 'earthquakes-pulse']) {
    if (map.getLayer(id)) map.removeLayer(id)
  }
  if (map.getSource('earthquakes')) map.removeSource('earthquakes')
}
