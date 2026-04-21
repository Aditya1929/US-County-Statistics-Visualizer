/**
 * Tooltip.jsx
 * Position is updated via direct DOM ref on raw window.mousemove — zero React
 * overhead. React only re-renders when the county itself changes.
 */

import { forwardRef } from 'react'
import { METRICS } from './choropleth.js'

const HoverTooltip = forwardRef(function HoverTooltip({ county, metric }, ref) {
  const cfg = METRICS[metric]

  return (
    <div
      ref={ref}
      className="hover-tooltip"
      style={{ display: county ? 'block' : 'none' }}
      aria-hidden="true"
    >
      {county && (
        <>
          <div className="tt-name">{county.name}</div>
          <div className="tt-state">{county.stateName}</div>
          <div className="tt-metric">
            <span className="tt-label">{cfg?.label}</span>
            <span className="tt-value">{cfg?.format(county[metric]) ?? 'N/A'}</span>
          </div>
          {county.population && (
            <div className="tt-pop">Pop. {county.population.toLocaleString()}</div>
          )}
        </>
      )}
    </div>
  )
})

export default HoverTooltip
