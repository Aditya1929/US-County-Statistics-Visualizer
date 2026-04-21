import { useMemo } from 'react'
import { METRICS, getCountyTextColor } from './choropleth.js'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine,
} from 'recharts'
import NewsPanel from './components/NewsPanel/NewsPanel.jsx'

// Haversine distance in km between two lat/lng points
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function CountyDetail({ county, economicData, overlays, averages, onClose }) {
  if (!county) return null

  const record = economicData?.[county.fips] || {}
  const stFips = county.fips.slice(0, 2)
  const fema   = overlays?.fema?.data?.detailMap?.[county.fips] || []

  const nearbyAlerts = useMemo(() => {
    if (!overlays?.weather?.data?.features) return []
    // NWS FIPS6 = '0' + 5-digit county FIPS (e.g. '06019' → '006019')
    const fips6 = '0' + county.fips
    return overlays.weather.data.features
      .filter(f => {
        const codes = f.properties?.geocode?.FIPS6 || []
        if (codes.some(c => c === fips6 || c === county.fips)) return true
        // Fallback: zone UGC prefix matches state
        const ugc = f.properties?.geocode?.UGC || []
        return ugc.some(c => c.startsWith(record.stateAbbr || stFips))
      })
      .slice(0, 10)
  }, [overlays?.weather?.data, county.fips, stFips, record.stateAbbr])

  const earthquakes = useMemo(() => {
    if (!overlays?.earthquakes?.data?.features) return []
    const feats = overlays.earthquakes.data.features
    // Filter by proximity (300 km radius from click point) if coordinates available
    const filtered = (county.lat != null && county.lng != null)
      ? feats.filter(f => {
          const [eLng, eLat] = f.geometry?.coordinates || []
          if (eLat == null) return false
          return haversineKm(county.lat, county.lng, eLat, eLng) <= 300
        })
      : feats
    return filtered
      .filter(f => f.properties?.mag >= 2.5)
      .sort((a, b) => b.properties.mag - a.properties.mag)
      .slice(0, 8)
  }, [overlays?.earthquakes?.data, county.lat, county.lng])

  const countyName = record.name || county.name || ''
  const stateName  = record.stateName || ''

  return (
    <div className="cd-panel">
      {/* Header */}
      <div className="cd-header">
        <div className="cd-header-text">
          <div className="cd-name">{countyName}</div>
          <div className="cd-sub">
            FIPS {county.fips}
            {record.population ? `  ·  Pop. ${record.population.toLocaleString()}` : ''}
          </div>
        </div>
        <button className="cd-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="cd-body">

        {/* ── Panel 0: News / About ── */}
        <div className="info-panel">
          <div className="info-panel-title">County Intel</div>
          <div className="info-panel-body" style={{ padding: 0 }}>
            <NewsPanel
              countyName={countyName}
              stateName={stateName}
              fips={county.fips}
            />
          </div>
        </div>

        {/* ── Panel 1: Economic ── */}
        <div className="info-panel">
          <div className="info-panel-title">Economic</div>
          <div className="info-panel-body">
            {Object.entries(METRICS).map(([key, cfg]) => {
              const value = record[key]
              const nat   = averages?.[key]?.national
              const st    = averages?.[key]?.byState?.[stFips]
              const color = economicData ? getCountyTextColor(economicData, key, value) : '#fff'
              return (
                <div className="metric-row" key={key}>
                  <div className="metric-row-label">{cfg.label}</div>
                  <div className="metric-row-value" style={{ color }}>
                    {cfg.format(value)}
                  </div>
                  {nat != null && (
                    <>
                      <ComparisonBar value={value} national={nat} state={st} />
                      <div className="metric-row-comps">
                        {st != null && <span>State avg: {cfg.format(st)}</span>}
                        <span>US avg: {cfg.format(nat)}</span>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Panel 2: Hazards ── */}
        <div className="info-panel">
          <div className="info-panel-title">Hazards</div>
          <div className="info-panel-body">

            <div className="hazard-section-label">Weather Alerts</div>
            {!overlays?.weather?.enabled && <div className="cd-empty">Enable the Weather Alerts overlay to see data.</div>}
            {overlays?.weather?.enabled && !overlays?.weather?.data && <div className="cd-empty">Loading…</div>}
            {overlays?.weather?.enabled && overlays?.weather?.data && nearbyAlerts.length === 0 && (
              <div className="cd-empty">No active alerts near this county.</div>
            )}
            {nearbyAlerts.map((f, i) => (
              <div key={i} className={`alert-row sev-${(f.properties.severity || '').toLowerCase()}`}>
                <div className="alert-event">{f.properties.event}</div>
                <div className="alert-meta">
                  {f.properties.severity} · Expires {
                    f.properties.expires
                      ? new Date(f.properties.expires).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : 'unknown'
                  }
                </div>
                <div className="alert-area">{f.properties.areaDesc?.split(';')[0]}</div>
              </div>
            ))}

            <div className="hazard-section-label" style={{ marginTop: nearbyAlerts.length > 0 ? 14 : 8 }}>
              Seismic Activity (M ≥ 3.0, Active Window)
            </div>
            {!overlays?.earthquakes?.enabled && <div className="cd-empty">Enable the Earthquakes overlay to see data.</div>}
            {overlays?.earthquakes?.enabled && !overlays?.earthquakes?.data && <div className="cd-empty">Loading…</div>}
            {overlays?.earthquakes?.enabled && overlays?.earthquakes?.data && earthquakes.length === 0 && (
              <div className="cd-empty">No M ≥ 3.0 earthquakes in the current window.</div>
            )}
            {overlays?.earthquakes?.enabled && earthquakes.map((f, i) => (
              <div key={i} className="eq-row">
                <span className="eq-mag">M{f.properties.mag?.toFixed(1)}</span>
                <span className="eq-place">{f.properties.place}</span>
                <span className="eq-time">{new Date(f.properties.time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Panel 3: FEMA Declarations ── */}
        <div className="info-panel">
          <div className="info-panel-title">FEMA Declarations</div>
          <div className="info-panel-body">
            {!overlays?.fema?.enabled && <div className="cd-empty">Enable the FEMA Declarations overlay to see data.</div>}
            {overlays?.fema?.enabled && fema.length === 0 && <div className="cd-empty">No active disaster declarations for this county.</div>}
            {fema.map((d, i) => (
              <div key={i} className="fema-row">
                <div className="fema-type">{d.type}</div>
                <div className="fema-title-text">{d.title}</div>
                <div className="fema-date">{new Date(d.date).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

function ComparisonBar({ value, national, state }) {
  if (value == null || national == null) return null
  const data = [
    { name: 'County', value: parseFloat(value.toFixed(1)) },
    state != null ? { name: 'State', value: parseFloat(state.toFixed(1)) } : null,
    { name: 'US', value: parseFloat(national.toFixed(1)) },
  ].filter(Boolean)

  return (
    <ResponsiveContainer width="100%" height={44}>
      <BarChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          contentStyle={{ background: '#1a1a1a', border: '1px solid #333', fontSize: 10 }}
          itemStyle={{ color: '#fff' }}
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
        />
        <Bar dataKey="value" fill="#333" radius={[2, 2, 0, 0]} maxBarSize={24} />
        <ReferenceLine y={national} stroke="#555" strokeDasharray="3 2" />
      </BarChart>
    </ResponsiveContainer>
  )
}
