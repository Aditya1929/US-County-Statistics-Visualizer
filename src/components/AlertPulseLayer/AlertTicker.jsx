/**
 * AlertTicker.jsx
 * Floating top-right list of recent alert pulses.
 * Each item shows colored dot, label, and time-ago.
 * Clicking a pulse calls onFlyTo(lng, lat) to center the map.
 */

import { useMemo } from 'react'

function timeAgo(ts) {
  const diff = Date.now() - ts.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

const TYPE_LABEL = { earthquake: 'EQ', weather: 'WX', fire: 'FIRE' }

export default function AlertTicker({ pulses, onFlyTo, hidden }) {
  const sorted = useMemo(() =>
    [...pulses].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 6)
  , [pulses])

  if (!sorted.length || hidden) return null

  return (
    <div className="alert-ticker">
      <div className="ticker-header">
        <span className="ticker-live">● LIVE</span>
        <span className="ticker-count">{pulses.length} active</span>
      </div>
      {sorted.map(pulse => (
        <div
          key={pulse.id}
          className="ticker-row"
          onClick={() => onFlyTo?.(pulse.lng, pulse.lat)}
          title="Click to zoom to location"
        >
          <span
            className="ticker-dot"
            style={{ background: `rgb(${pulse.color})` }}
          />
          <span className="ticker-type">{TYPE_LABEL[pulse.type] || pulse.type.toUpperCase()}</span>
          <span className="ticker-label">{pulse.label}</span>
          <span className="ticker-time">{timeAgo(pulse.timestamp)}</span>
        </div>
      ))}
    </div>
  )
}
