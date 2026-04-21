import { useState, useRef, useEffect } from 'react'
import { METRICS } from './choropleth.js'
import { useApp } from './context/AppContext.jsx'
import './components/CRTOverlay/crt.css'

const METRIC_GRADIENTS = {
  unemployment: 'linear-gradient(to right, #1a9850, #a6d96a, #ffffbf, #fdae61, #d73027)',
  medianIncome: 'linear-gradient(to right, #d73027, #fdae61, #ffffbf, #a6d96a, #1a9850)',
  povertyRate:  'linear-gradient(to right, #ffffb2, #fecc5c, #fd8d3c, #e31a1c, #800026)',
  popChange:    'linear-gradient(to right, #d73027, #ffffbf, #1a9850)',
}

const US_CLIP =
  'polygon(5% 28%, 9% 18%, 16% 12%, 28% 9%, 45% 7%, 62% 7%, 79% 9%, 88% 7%, ' +
  '94% 14%, 94% 23%, 91% 33%, 88% 43%, 84% 53%, 78% 62%, 73% 78%, 70% 79%, ' +
  '67% 70%, 62% 73%, 56% 77%, 50% 78%, 46% 74%, 42% 78%, 36% 78%, ' +
  '28% 73%, 18% 66%, 10% 56%, 3% 44%)'

const OVERLAY_DEFS = [
  { key: 'earthquakes', label: 'Earthquakes',       countFn: d => d?.features?.length ?? 0 },
  { key: 'weather',     label: 'Weather Alerts',    countFn: d => d?.features?.length ?? 0 },
  { key: 'wildfires',   label: 'Wildfires',         countFn: d => d?.features?.length ?? 0 },
  { key: 'airQuality',  label: 'Air Quality',       countFn: d => d?.features?.length ?? 0 },
  { key: 'fema',        label: 'FEMA Declarations', countFn: d => d?.declarations?.length ?? 0 },
]

const CRT_VARIANTS = ['green', 'amber', 'nightvision', 'flir']

// ── Metric preview square ─────────────────────────────────
function MetricSquare({ metricKey, active, onClick }) {
  const cfg = METRICS[metricKey]
  return (
    <button className={`flyout-sq metric-sq ${active ? 'sq-active' : ''}`} onClick={onClick}>
      <div className="preview-wrap">
        <div className="preview-grad" style={{ background: METRIC_GRADIENTS[metricKey], clipPath: US_CLIP }} />
      </div>
      <span className="sq-label">{cfg.label}</span>
    </button>
  )
}

// ── Overlay square ────────────────────────────────────────
function OverlaySquare({ def, state, onToggle }) {
  const count = state.enabled && state.data ? def.countFn(state.data) : null
  return (
    <button className={`flyout-sq overlay-sq ${state.enabled ? 'sq-active' : ''}`} onClick={onToggle}>
      <span className="sq-main-label">{def.label}</span>
      {count !== null
        ? <span className="sq-count">{count.toLocaleString()}</span>
        : <span className="sq-off">{state.loading ? 'Loading' : 'Off'}</span>
      }
      {state.error && <span className="sq-error">Error</span>}
    </button>
  )
}

// ── Time window square ────────────────────────────────────
function TimeSquare({ label, hours, active, onClick }) {
  return (
    <button className={`flyout-sq time-sq ${active ? 'sq-active' : ''}`} onClick={onClick}>
      <span className="time-big">{label}</span>
      <span className="sq-label">window</span>
    </button>
  )
}

// ── Dock square ───────────────────────────────────────────
function DockSquare({ label, badge, children }) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef(null)
  const open_  = () => { clearTimeout(closeTimer.current); setOpen(true) }
  const close_ = () => { closeTimer.current = setTimeout(() => setOpen(false), 100) }
  useEffect(() => () => clearTimeout(closeTimer.current), [])

  return (
    <div className="dock-item" onMouseEnter={open_} onMouseLeave={close_}>
      <div className={`dock-sq ${open ? 'dock-sq-open' : ''}`}>
        <span className="dock-sq-label">{label}</span>
        {badge != null && <span className="dock-badge">{badge}</span>}
      </div>
      <div className={`flyout-row ${open ? 'flyout-row-open' : ''}`}>
        {children}
      </div>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────
export default function ControlPanel({
  metric, onMetricChange,
  overlays, onToggleOverlay,
  eqWindow, onEqWindowChange,
  isLoading,
  showScrubber, onToggleScrubber,
  showLiveFeeds, onToggleLiveFeeds,
}) {
  const { state, dispatch } = useApp()
  const activeOverlayCount = Object.values(overlays).filter(o => o.enabled).length

  return (
    <div className="cp-dock-root">
      <DockSquare label="Base Layer">
        {Object.keys(METRICS).map(key => (
          <MetricSquare key={key} metricKey={key} active={metric === key} onClick={() => onMetricChange(key)} />
        ))}
      </DockSquare>

      <DockSquare label="Overlays" badge={activeOverlayCount > 0 ? activeOverlayCount : null}>
        {OVERLAY_DEFS.map(def => (
          <OverlaySquare key={def.key} def={def} state={overlays[def.key]} onToggle={() => onToggleOverlay(def.key)} />
        ))}
      </DockSquare>

      <DockSquare label="EQ Window">
        {[{ h: 24, l: '24h' }, { h: 48, l: '48h' }, { h: 168, l: '7d' }].map(({ h, l }) => (
          <TimeSquare key={h} hours={h} label={l} active={eqWindow === h} onClick={() => onEqWindowChange(h)} />
        ))}
      </DockSquare>

      {/* ── Timeline scrubber toggle ── */}
      <div className="dock-item">
        <button
          className={`dock-sq-action ${showScrubber ? 'dock-sq-active-blue' : ''}`}
          onClick={onToggleScrubber}
          title="Toggle time scrubber (2010–2022)"
        >
          <span className="dock-sq-label">TIME</span>
          <span className="dock-sq-sub">2010–22</span>
        </button>
      </div>

      {/* ── Live crime scanner feeds toggle ── */}
      <div className="dock-item">
        <button
          className={`dock-sq-action ${showLiveFeeds ? 'dock-sq-active-red' : ''}`}
          onClick={onToggleLiveFeeds}
          title="Toggle live crime scanner feeds"
        >
          <span className="dock-sq-label" style={showLiveFeeds ? { color: '#cc2222' } : {}}>
            {showLiveFeeds ? '● CRIME' : 'CRIME'}
          </span>
          <span className="dock-sq-sub">{showLiveFeeds ? 'LIVE' : 'FEEDS'}</span>
        </button>
      </div>

      {/* ── CRT mode toggle with variant flyout ── */}
      <DockSquare label={state.crtMode ? 'CRT ON' : 'CRT'}>
        <button
          className={`flyout-sq ${state.crtMode ? 'sq-active' : ''}`}
          onClick={() => dispatch({ type: 'TOGGLE_CRT' })}
        >
          <span className="sq-main-label">{state.crtMode ? 'ON' : 'OFF'}</span>
          <span className="sq-label">Scanlines</span>
        </button>
        {CRT_VARIANTS.map(v => (
          <button
            key={v}
            className={`flyout-sq ${state.crtMode && state.crtVariant === v ? 'sq-active' : ''}`}
            onClick={() => { dispatch({ type: 'SET_CRT_VARIANT', variant: v }); if (!state.crtMode) dispatch({ type: 'TOGGLE_CRT' }) }}
          >
            <span className="sq-main-label">{v.toUpperCase()}</span>
            <span className="sq-label">color</span>
          </button>
        ))}
      </DockSquare>

      {isLoading && <div className="dock-loading-bar" />}
    </div>
  )
}
