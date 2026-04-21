/**
 * Legend.jsx
 * Color scale legend for the active choropleth metric.
 * Positioned bottom-left, outside the map attribution area.
 */

import { METRICS, getLegendStops } from './choropleth.js'

export default function Legend({ metric, economicData }) {
  const cfg = METRICS[metric]
  const stops = economicData ? getLegendStops(economicData, metric, 7) : []

  return (
    <div className="legend">
      <div className="legend-title">{cfg?.label}</div>
      <div className="legend-subtitle">{cfg?.description}</div>
      <div className="legend-scale">
        <div
          className="legend-gradient"
          style={{
            background: stops.length
              ? `linear-gradient(to right, ${stops.map((s) => s.color).join(', ')})`
              : '#555',
          }}
        />
        <div className="legend-labels">
          {stops.length > 0 && (
            <>
              <span>{cfg.higherIsBad ? 'Low' : 'High'}</span>
              <span>{cfg.higherIsBad ? 'High' : 'Low'}</span>
            </>
          )}
        </div>
        {stops.length > 0 && (
          <div className="legend-ticks">
            <span>{stops[0].label}</span>
            <span>{stops[Math.floor(stops.length / 2)].label}</span>
            <span>{stops[stops.length - 1].label}</span>
          </div>
        )}
      </div>
      <div className="legend-nodata">
        <span className="nodata-swatch" /> No data
      </div>
    </div>
  )
}
