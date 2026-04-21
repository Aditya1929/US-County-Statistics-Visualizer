/**
 * airquality.js
 * Open-Meteo Air Quality API — no API key required.
 *
 * Approach: sample a grid of lat/lon points across the US,
 * fetch AQI + PM2.5 for each, then render as circle markers
 * color-coded by AQI category. At zoom >= 5 we show values as labels.
 *
 * Note: The Open-Meteo API is point-based, not a raster layer.
 * For a production build you'd use an AQI tile server (e.g., AirNow API tiles).
 * This implementation samples a coarse grid for the free tier.
 */

const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality'

// AQI breakpoints (US EPA standard)
const AQI_COLORS = [
  { max: 50, color: '#00e400', label: 'Good', bg: 'rgba(0,228,64,0.25)' },
  { max: 100, color: '#ffff00', label: 'Moderate', bg: 'rgba(255,255,0,0.25)' },
  { max: 150, color: '#ff7e00', label: 'Unhealthy for Sensitive', bg: 'rgba(255,126,0,0.25)' },
  { max: 200, color: '#ff0000', label: 'Unhealthy', bg: 'rgba(255,0,0,0.3)' },
  { max: 300, color: '#8f3f97', label: 'Very Unhealthy', bg: 'rgba(143,63,151,0.3)' },
  { max: Infinity, color: '#7e0023', label: 'Hazardous', bg: 'rgba(126,0,35,0.4)' },
]

export function getAqiColor(aqi) {
  return AQI_COLORS.find((b) => aqi <= b.max) || AQI_COLORS[AQI_COLORS.length - 1]
}

// Coarse grid of sampling points across the contiguous US + AK + HI
const SAMPLE_GRID = generateGrid()

function generateGrid() {
  const points = []
  // Contiguous US: lat 24–49, lon -124 to -67, step ~3 degrees
  for (let lat = 25; lat <= 49; lat += 3) {
    for (let lon = -124; lon <= -67; lon += 3) {
      points.push([lat, lon])
    }
  }
  // Alaska cluster
  points.push([64, -153], [61, -149], [58, -136])
  // Hawaii cluster
  points.push([20.5, -157], [21.3, -158])
  return points
}

export async function fetchAirQuality() {
  // Batch all points into parallel requests (Open-Meteo is fast)
  const results = await Promise.allSettled(
    SAMPLE_GRID.map(async ([lat, lon]) => {
      const url =
        `${AIR_QUALITY_URL}?latitude=${lat}&longitude=${lon}` +
        `&hourly=us_aqi,pm2_5,pm10&timezone=auto&forecast_days=1`
      const res = await fetch(url)
      if (!res.ok) return null
      const data = await res.json()
      // Get current hour's reading
      const now = new Date()
      const hourIdx = now.getHours()
      const aqi = data.hourly?.us_aqi?.[hourIdx] ?? data.hourly?.us_aqi?.[0]
      const pm25 = data.hourly?.pm2_5?.[hourIdx] ?? data.hourly?.pm2_5?.[0]
      if (aqi == null) return null
      return { lat, lon, aqi, pm25 }
    })
  )

  const features = results
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map(({ value }) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [value.lon, value.lat] },
      properties: { aqi: value.aqi, pm25: value.pm25 },
    }))

  return { type: 'FeatureCollection', features }
}

export function addAirQualityLayer(map, geojson) {
  removeAirQualityLayer(map)

  if (geojson.features.length === 0) return

  map.addSource('air-quality', { type: 'geojson', data: geojson })

  map.addLayer({
    id: 'aq-circles',
    type: 'circle',
    source: 'air-quality',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 12, 8, 24],
      'circle-color': [
        'step', ['get', 'aqi'],
        '#00e400',  // Good
        51, '#ffff00',
        101, '#ff7e00',
        151, '#ff0000',
        201, '#8f3f97',
        301, '#7e0023',
      ],
      'circle-opacity': 0.55,
      'circle-stroke-color': 'rgba(255,255,255,0.3)',
      'circle-stroke-width': 1,
    },
  })

  map.addLayer({
    id: 'aq-labels',
    type: 'symbol',
    source: 'air-quality',
    minzoom: 5,
    layout: {
      'text-field': ['get', 'aqi'],
      'text-size': 10,
    },
    paint: {
      'text-color': '#fff',
      'text-halo-color': '#000',
      'text-halo-width': 1,
    },
  })
}

export function removeAirQualityLayer(map) {
  for (const id of ['aq-labels', 'aq-circles']) {
    if (map.getLayer(id)) map.removeLayer(id)
  }
  if (map.getSource('air-quality')) map.removeSource('air-quality')
}
