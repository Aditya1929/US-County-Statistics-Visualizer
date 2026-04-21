/**
 * extrusionLayer.js
 * Swaps the flat 'counties-fill' layer with a MapLibre fill-extrusion layer
 * that encodes the current metric as building height (0–200,000m).
 */

import { quantile } from 'd3-array'
import { buildColorExpression } from '../../choropleth.js'

const MAX_HEIGHT = 200_000

function buildHeightExpression(economicData, metric) {
  const values = Object.values(economicData)
    .map(d => d[metric])
    .filter(v => v != null)
    .sort((a, b) => a - b)

  if (!values.length) return 1000

  const numClasses = 9
  const breaks = Array.from({ length: numClasses + 1 }, (_, i) =>
    quantile(values, i / numClasses)
  )

  const stops = []
  for (let i = 0; i <= numClasses; i++) {
    stops.push(breaks[i], (i / numClasses) * MAX_HEIGHT)
  }

  return [
    'case',
    ['!', ['to-boolean', ['get', metric]]],
    500,
    ['step', ['get', metric], 0, ...stops.slice(2)],
  ]
}

export function addExtrusionLayer(map, economicData, metric) {
  // Hide the flat fill layer
  if (map.getLayer('counties-fill')) {
    map.setLayoutProperty('counties-fill', 'visibility', 'none')
  }
  if (map.getLayer('counties-outline')) {
    map.setLayoutProperty('counties-outline', 'visibility', 'none')
  }

  const colorExpr  = buildColorExpression(economicData, metric)
  const heightExpr = buildHeightExpression(economicData, metric)

  if (map.getLayer('counties-extrusion')) {
    map.setPaintProperty('counties-extrusion', 'fill-extrusion-color', colorExpr)
    map.setPaintProperty('counties-extrusion', 'fill-extrusion-height', heightExpr)
    return
  }

  // Insert below labels so extrusions don't cover county names
  const labelLayerId = map.getLayer('counties-labels') ? 'counties-labels' : undefined

  map.addLayer({
    id: 'counties-extrusion',
    type: 'fill-extrusion',
    source: 'counties',
    paint: {
      'fill-extrusion-color':   colorExpr,
      'fill-extrusion-height':  heightExpr,
      'fill-extrusion-base':    0,
      'fill-extrusion-opacity': 0.82,
    },
  }, labelLayerId)

  // Warm ambient light for depth
  map.setLight({
    anchor: 'viewport',
    color: '#e8e0d0',
    intensity: 0.55,
    position: [1.2, 90, 75],
  })
}

export function removeExtrusionLayer(map) {
  if (map.getLayer('counties-extrusion')) {
    map.removeLayer('counties-extrusion')
  }
  // Restore the flat layers
  if (map.getLayer('counties-fill')) {
    map.setLayoutProperty('counties-fill', 'visibility', 'visible')
  }
  if (map.getLayer('counties-outline')) {
    map.setLayoutProperty('counties-outline', 'visibility', 'visible')
  }
  // Reset light
  map.setLight({ anchor: 'viewport', color: '#fff', intensity: 0, position: [1, 90, 80] })
}

export function updateExtrusionLayer(map, economicData, metric) {
  if (!map.getLayer('counties-extrusion')) return
  map.setPaintProperty('counties-extrusion', 'fill-extrusion-color', buildColorExpression(economicData, metric))
  map.setPaintProperty('counties-extrusion', 'fill-extrusion-height', buildHeightExpression(economicData, metric))
}
