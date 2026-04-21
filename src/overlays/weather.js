/**
 * weather.js
 * NWS (National Weather Service) active alerts overlay — no API key required.
 *
 * NWS returns alert polygons natively in GeoJSON, color-coded by severity.
 * We overlay them as semi-transparent filled polygons with a stroke, layered
 * above the county choropleth but below labels.
 */

const NWS_ALERTS_URL = 'https://api.weather.gov/alerts/active?status=actual&message_type=alert&region_type=land'

// Severity → fill color mapping following NWS color conventions
const SEVERITY_COLORS = {
  Extreme: { fill: 'rgba(255, 0, 0, 0.35)', stroke: '#ff0000', label: 'Extreme' },
  Severe: { fill: 'rgba(255, 140, 0, 0.35)', stroke: '#ff8c00', label: 'Severe' },
  Moderate: { fill: 'rgba(255, 255, 0, 0.25)', stroke: '#ffff00', label: 'Moderate' },
  Minor: { fill: 'rgba(0, 200, 255, 0.2)', stroke: '#00c8ff', label: 'Minor' },
  Unknown: { fill: 'rgba(150, 150, 150, 0.2)', stroke: '#aaaaaa', label: 'Unknown' },
}

export async function fetchWeatherAlerts() {
  const res = await fetch(NWS_ALERTS_URL)
  if (!res.ok) throw new Error(`NWS ${res.status}`)
  const data = await res.json()
  return data
}

// Build separate GeoJSON collections per severity so we can style each differently
function splitBySeverity(alertsGeoJSON) {
  const bySeverity = {}

  for (const feature of alertsGeoJSON.features) {
    if (!feature.geometry) continue // some alerts reference zones, not polygons
    const severity = feature.properties?.severity || 'Unknown'
    if (!bySeverity[severity]) bySeverity[severity] = []
    bySeverity[severity].push(feature)
  }

  return Object.entries(bySeverity).map(([severity, features]) => ({
    severity,
    geojson: { type: 'FeatureCollection', features },
    colors: SEVERITY_COLORS[severity] || SEVERITY_COLORS.Unknown,
  }))
}

export function addWeatherLayer(map, alertsGeoJSON) {
  removeWeatherLayer(map)

  const groups = splitBySeverity(alertsGeoJSON)

  // Add all alerts in one source with severity encoded as a property
  const merged = {
    type: 'FeatureCollection',
    features: alertsGeoJSON.features.filter((f) => f.geometry),
  }

  if (merged.features.length === 0) return

  map.addSource('weather-alerts', { type: 'geojson', data: merged })

  map.addLayer({
    id: 'weather-fill',
    type: 'fill',
    source: 'weather-alerts',
    paint: {
      'fill-color': [
        'match', ['get', 'severity'],
        'Extreme', 'rgba(255, 0, 0, 0.35)',
        'Severe', 'rgba(255, 140, 0, 0.35)',
        'Moderate', 'rgba(255, 255, 0, 0.25)',
        'Minor', 'rgba(0, 200, 255, 0.2)',
        'rgba(150, 150, 150, 0.2)',
      ],
      'fill-opacity': 1,
    },
  })

  map.addLayer({
    id: 'weather-outline',
    type: 'line',
    source: 'weather-alerts',
    paint: {
      'line-color': [
        'match', ['get', 'severity'],
        'Extreme', '#ff0000',
        'Severe', '#ff8c00',
        'Moderate', '#e5e500',
        'Minor', '#00c8ff',
        '#aaaaaa',
      ],
      'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1, 10, 2],
      'line-dasharray': [2, 1],
    },
  })
}

export function removeWeatherLayer(map) {
  for (const id of ['weather-outline', 'weather-fill']) {
    if (map.getLayer(id)) map.removeLayer(id)
  }
  if (map.getSource('weather-alerts')) map.removeSource('weather-alerts')
}

export function getAlertSummary(alertsGeoJSON) {
  const counts = {}
  for (const f of alertsGeoJSON.features) {
    const sev = f.properties?.severity || 'Unknown'
    counts[sev] = (counts[sev] || 0) + 1
  }
  return counts
}
