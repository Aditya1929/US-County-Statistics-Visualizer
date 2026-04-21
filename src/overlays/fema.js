/**
 * fema.js
 * OpenFEMA active disaster declarations — no API key required.
 * Highlights affected counties with a glowing border treatment.
 */

const FEMA_URL =
  'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries' +
  '?$filter=disasterCloseoutDate eq null' + // active declarations only
  '&$select=fipsStateCode,fipsCountyCode,declarationTitle,incidentType,declarationDate,state' +
  '&$orderby=declarationDate desc' +
  '&$top=500'

export async function fetchFemaDeclarations() {
  const res = await fetch(FEMA_URL)
  if (!res.ok) throw new Error(`FEMA ${res.status}`)
  const data = await res.json()
  return data.DisasterDeclarationsSummaries || []
}

// Build a Set of affected FIPS codes and return a GeoJSON-compatible
// expression to highlight them on the counties layer
export function buildFemaSet(declarations) {
  const fipsSet = new Set()
  const detailMap = {}

  for (const d of declarations) {
    const fips =
      d.fipsStateCode.padStart(2, '0') + d.fipsCountyCode.padStart(3, '0')
    fipsSet.add(fips)
    if (!detailMap[fips]) detailMap[fips] = []
    detailMap[fips].push({
      title: d.declarationTitle,
      type: d.incidentType,
      date: d.declarationDate,
      state: d.state,
    })
  }

  return { fipsSet, detailMap }
}

// Add a layer that draws an orange border + badge on FEMA-declared counties
export function addFemaLayer(map, fipsSet) {
  removeFemaLayer(map)
  if (fipsSet.size === 0) return

  // Build a filter expression: ["in", ["get", "GEOID"], ["literal", [...fipsSet]]]
  const fipsArray = Array.from(fipsSet)

  if (!map.getLayer('counties-fill')) return // base layer not ready yet

  map.addLayer(
    {
      id: 'fema-outline',
      type: 'line',
      source: 'counties',
      filter: ['in', ['get', 'GEOID'], ['literal', fipsArray]],
      paint: {
        'line-color': '#ff9500',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.5, 8, 3],
        'line-opacity': 0.9,
      },
    },
    'counties-labels' // insert below labels
  )

  // Inner orange wash for declared counties
  map.addLayer(
    {
      id: 'fema-wash',
      type: 'fill',
      source: 'counties',
      filter: ['in', ['get', 'GEOID'], ['literal', fipsArray]],
      paint: {
        'fill-color': '#ff9500',
        'fill-opacity': 0.12,
      },
    },
    'fema-outline'
  )
}

export function removeFemaLayer(map) {
  for (const id of ['fema-outline', 'fema-wash']) {
    if (map.getLayer(id)) map.removeLayer(id)
  }
}
