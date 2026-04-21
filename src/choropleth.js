import { quantile, extent } from 'd3-array'
import { interpolateRdYlGn, interpolateYlOrRd, interpolateRdBu } from 'd3-scale-chromatic'

export const METRICS = {
  unemployment: {
    label: 'Unemployment Rate',
    unit: '%',
    description: 'ACS 5-year estimates',
    higherIsBad: true,
    // (1-t) inverts RdYlGn so low unemployment (t→0) = green, high (t→1) = red
    colorScheme: (t) => interpolateRdYlGn(1 - t),
    format: (v) => v != null ? `${v.toFixed(1)}%` : 'N/A',
  },
  medianIncome: {
    label: 'Median Household Income',
    unit: '$',
    description: 'ACS 5-year estimates',
    higherIsBad: false,
    // t=0 (low income) → red, t=1 (high income) → green
    colorScheme: (t) => interpolateRdYlGn(t),
    format: (v) => v != null ? `$${v.toLocaleString()}` : 'N/A',
  },
  povertyRate: {
    label: 'Poverty Rate',
    unit: '%',
    description: 'ACS 5-year estimates',
    higherIsBad: true,
    colorScheme: interpolateYlOrRd,
    format: (v) => v != null ? `${v.toFixed(1)}%` : 'N/A',
  },
  popChange: {
    label: 'Population Change',
    unit: '%',
    description: 'ACS 2021→2022',
    higherIsBad: false,
    // t=0 (decline) → red, t=1 (growth) → green
    colorScheme: (t) => interpolateRdYlGn(t),
    format: (v) => v != null ? `${v > 0 ? '+' : ''}${v.toFixed(2)}%` : 'N/A',
  },
}

// MapLibre GPU paint expression — compiled to a GLSL shader, renders 3,143
// polygons in a single draw call.
// Uses ['get', metric] directly (e.g. 'medianIncome') so switching metrics
// doesn't require re-uploading the GeoJSON source.
export function buildColorExpression(economicData, metric) {
  const config = METRICS[metric]
  if (!config) return '#555'

  const values = Object.values(economicData)
    .map((d) => d[metric])
    .filter((v) => v != null)
    .sort((a, b) => a - b)

  if (!values.length) return '#555'

  const numClasses = 9
  const breaks = Array.from({ length: numClasses + 1 }, (_, i) =>
    quantile(values, i / numClasses)
  )

  const stops = []
  for (let i = 0; i <= numClasses; i++) {
    const t = i / numClasses
    // Direction is encoded in each metric's colorScheme — use t directly
    stops.push(breaks[i], rgbToHex(config.colorScheme(t)))
  }

  return [
    'case',
    ['!', ['to-boolean', ['get', metric]]],
    '#2a2a2a',
    [
      'step',
      ['get', metric],
      rgbToHex(config.colorScheme(0)),
      ...stops.slice(2),
    ],
  ]
}

// Returns a text-safe color (readable on #111 dark bg) that corresponds
// to the county's position on the choropleth scale.
// badness=0 → best (green), badness=1 → worst (red)
export function getCountyTextColor(economicData, metric, value) {
  if (value == null) return '#888'
  const config = METRICS[metric]
  const values = Object.values(economicData)
    .map((d) => d[metric])
    .filter((v) => v != null)
    .sort((a, b) => a - b)
  if (!values.length) return '#fff'

  const pos = values.filter((v) => v <= value).length / values.length
  const badness = config.higherIsBad ? pos : 1 - pos

  // Text colors on dark bg: green (good) → white (neutral) → red (bad)
  if (badness < 0.25) return '#4aa84a'   // dark-green, bright enough to read
  if (badness < 0.45) return '#88bb88'   // muted green
  if (badness < 0.55) return '#cccccc'   // neutral
  if (badness < 0.75) return '#bb8866'   // muted amber
  return '#cc4444'                        // red
}

export function getLegendStops(economicData, metric, numStops = 7) {
  const config = METRICS[metric]
  if (!config) return []
  const values = Object.values(economicData)
    .map((d) => d[metric]).filter((v) => v != null).sort((a, b) => a - b)
  if (!values.length) return []
  return Array.from({ length: numStops }, (_, i) => {
    const t = i / (numStops - 1)
    return { value: quantile(values, t), color: rgbToHex(config.colorScheme(t)), label: config.format(quantile(values, t)) }
  })
}

function rgbToHex(s) {
  if (s.startsWith('#')) return s
  const m = s.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (!m) return '#888'
  return '#' + [m[1], m[2], m[3]].map((x) => parseInt(x).toString(16).padStart(2, '0')).join('')
}
