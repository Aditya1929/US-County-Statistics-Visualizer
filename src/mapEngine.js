/**
 * mapEngine.js
 * Core MapLibre GL JS setup and county choropleth rendering.
 *
 * Architecture:
 *   - One GeoJSON source for all 3,143 county polygons
 *   - Data-driven fill-color expression: MapLibre compiles this to a GPU shader,
 *     so all 3,143 polygons render in a single draw call.
 *   - A separate "counties-hover" layer that highlights on mouse-over.
 */

import maplibregl from 'maplibre-gl'
import { buildColorExpression } from './choropleth.js'

// Public domain basemap tiles (no API key needed)
const BASEMAP_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'background',
      type: 'raster',
      source: 'carto-dark',
    },
  ],
}

export function initMap(container) {
  const map = new maplibregl.Map({
    container,
    style: BASEMAP_STYLE,
    center: [-98.5, 39.5],
    zoom: 4,
    minZoom: 3,
    maxZoom: 14,
    maxBounds: [[-180, 15], [-50, 72]],
  })

  map.addControl(new maplibregl.NavigationControl(), 'top-right')
  map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-right')

  return map
}

export async function loadCountyLayer(map, geojson, economicData, metric) {
  // Join economic data onto the GeoJSON features by FIPS code
  const featureCollection = joinDataToFeatures(geojson, economicData, metric)

  if (map.getSource('counties')) {
    map.getSource('counties').setData(featureCollection)
  } else {
    map.addSource('counties', {
      type: 'geojson',
      data: featureCollection,
      // Promotecontainer ID so MapLibre can do feature-level hit detection
      promoteId: 'GEOID',
    })
  }

  const colorExpression = buildColorExpression(economicData, metric)

  if (!map.getLayer('counties-fill')) {
    map.addLayer({
      id: 'counties-fill',
      type: 'fill',
      source: 'counties',
      paint: {
        'fill-color': colorExpression,
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.9,
          0.72,
        ],
      },
    })

    // County border lines
    map.addLayer({
      id: 'counties-outline',
      type: 'line',
      source: 'counties',
      paint: {
        'line-color': 'rgba(255,255,255,0.15)',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.3, 8, 0.8, 12, 1.5],
      },
    })

    // Highlighted county on hover (thicker border)
    map.addLayer({
      id: 'counties-hover-outline',
      type: 'line',
      source: 'counties',
      paint: {
        'line-color': 'rgba(255,255,255,0.9)',
        'line-width': 2,
      },
      filter: ['==', ['id'], ''],
    })

    // County name labels (only visible at zoom >= 6)
    map.addLayer({
      id: 'counties-labels',
      type: 'symbol',
      source: 'counties',
      minzoom: 6,
      layout: {
        'text-field': ['get', 'NAME'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 9, 10, 12],
        'text-font': ['Open Sans Regular'],
        'text-max-width': 8,
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': 'rgba(255,255,255,0.85)',
        'text-halo-color': 'rgba(0,0,0,0.6)',
        'text-halo-width': 1,
      },
    })
  } else {
    // Metric switched: just update the color expression
    map.setPaintProperty('counties-fill', 'fill-color', colorExpression)
  }
}

export function updateChoropleth(map, economicData, metric) {
  if (!map.getLayer('counties-fill')) return
  const colorExpression = buildColorExpression(economicData, metric)
  map.setPaintProperty('counties-fill', 'fill-color', colorExpression)
}

function joinDataToFeatures(geojson, economicData, metric) {
  return {
    ...geojson,
    features: geojson.features.map((f) => {
      const fips = f.properties.GEOID || f.properties.STATEFP + f.properties.COUNTYFP
      const record = economicData[fips]
      return {
        ...f,
        id: fips,
        properties: {
          ...f.properties,
          GEOID: fips,
          metricValue: record ? record[metric] : null,
          unemployment: record?.unemployment ?? null,
          medianIncome: record?.medianIncome ?? null,
          povertyRate: record?.povertyRate ?? null,
          popChange: record?.popChange ?? null,
          population: record?.population ?? null,
          stateName: record?.stateName ?? '',
        },
      }
    }),
  }
}
