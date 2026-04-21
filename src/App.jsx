import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { AppProvider, useApp } from './context/AppContext.jsx'
import MapView from './MapView.jsx'
import ControlPanel from './ControlPanel.jsx'
import CountyDetail from './CountyDetail.jsx'
import HoverTooltip from './Tooltip.jsx'
import CRTOverlay from './components/CRTOverlay/CRTOverlay.jsx'
import TimeScrubber, { AVAILABLE_YEARS, BASE_YEAR } from './components/TimeScrubber/TimeScrubber.jsx'
import AlertPulseLayer from './components/AlertPulseLayer/AlertPulseLayer.jsx'
import AlertTicker from './components/AlertPulseLayer/AlertTicker.jsx'
import { useCountyGeometry } from './hooks/useCountyGeometry.js'
import { useOverlays } from './hooks/useOverlays.js'
import { useTemporalCensus } from './hooks/useTemporalCensus.js'
import { useAlertPulses } from './hooks/useAlertPulses.js'
import { useInterval } from './hooks/useInterval.js'
import { useLiveFeeds } from './hooks/useLiveFeeds.js'
import LiveFeedLayer from './components/LiveFeedLayer/LiveFeedLayer.jsx'
import './components/LiveFeedLayer/livefeed.css'
import { fetchAllEconomicData, computeAverages } from './dataService.js'

function AppInner() {
  const { state: appState } = useApp()

  const [metric, setMetric]                 = useState('unemployment')
  const [selectedCounty, setSelectedCounty] = useState(null)
  const [hoveredCounty, setHoveredCounty]   = useState(null)
  const [economicData, setEconomicData]     = useState(null)
  const [ecoLoading, setEcoLoading]         = useState(true)
  const [eqWindow, setEqWindow]             = useState(24)
  const [mapInstance, setMapInstance]       = useState(null)
  const [showScrubber, setShowScrubber]     = useState(false)
  const [temporalYear, setTemporalYear]     = useState(null)
  const [isPlaying, setIsPlaying]           = useState(false)
  const [playbackSpeed, setPlaybackSpeed]   = useState(1)
  const [showLiveFeeds, setShowLiveFeeds]   = useState(false)
  const [mapBounds, setMapBounds]           = useState(null)

  const tooltipRef = useRef(null)

  const { geojson, loading: geoLoading }           = useCountyGeometry()
  const { overlays, toggleOverlay, refreshOverlay } = useOverlays({ earthquakeWindow: eqWindow })
  const { data: temporalData, loading: temporalLoading } = useTemporalCensus(temporalYear)
  const { feeds: liveFeeds }                         = useLiveFeeds(showLiveFeeds, mapBounds)
  const pulses                                       = useAlertPulses(overlays)

  const displayData = useMemo(() => {
    if (temporalYear && temporalData) return temporalData
    return economicData
  }, [temporalYear, temporalData, economicData])

  // Track map bounds for geo-aware feed fetching
  useEffect(() => {
    if (!mapInstance) return
    const update = () => {
      const b = mapInstance.getBounds()
      setMapBounds({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() })
    }
    update()
    mapInstance.on('moveend', update)
    return () => mapInstance.off('moveend', update)
  }, [mapInstance])

  useEffect(() => {
    fetchAllEconomicData()
      .then(d => { setEconomicData(d); setEcoLoading(false) })
      .catch(() => setEcoLoading(false))
  }, [])

  useEffect(() => {
    const move = (e) => {
      const el = tooltipRef.current
      if (!el) return
      el.style.left = `${Math.min(e.clientX + 16, window.innerWidth - 230)}px`
      el.style.top  = `${Math.min(e.clientY - 10, window.innerHeight - 130)}px`
    }
    window.addEventListener('mousemove', move, { passive: true })
    return () => window.removeEventListener('mousemove', move)
  }, [])

  const averages = useMemo(() => {
    if (!economicData) return {}
    return Object.fromEntries(
      ['unemployment', 'medianIncome', 'povertyRate', 'popChange'].map(m => [
        m, computeAverages(economicData, m),
      ])
    )
  }, [economicData])

  const activeYear = temporalYear || BASE_YEAR

  useInterval(() => {
    const idx = AVAILABLE_YEARS.indexOf(activeYear)
    if (idx >= AVAILABLE_YEARS.length - 1) { setIsPlaying(false); return }
    const nextYear = AVAILABLE_YEARS[idx + 1]
    setTemporalYear(nextYear === BASE_YEAR ? null : nextYear)
  }, isPlaying ? Math.round(1000 / playbackSpeed) : null)

  const handleYearChange = (year) => {
    setTemporalYear(year === BASE_YEAR ? null : year)
    setIsPlaying(false)
  }

  const handleCountyEnter = useCallback(c => setHoveredCounty(c), [])
  const handleCountyLeave = useCallback(() => setHoveredCounty(null), [])
  const handleCountyClick = useCallback(c => setSelectedCounty(c), [])
  const handleFlyTo       = useCallback((lng, lat) => {
    mapInstance?.flyTo({ center: [lng, lat], zoom: 7, duration: 1200 })
  }, [mapInstance])

  const isLoading = geoLoading || ecoLoading

  const appClass = [
    'app',
    appState.crtMode ? 'crt-active' : '',
    appState.crtMode ? `crt-${appState.crtVariant}` : '',
    showScrubber ? 'scrubber-open' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={appClass}>
      <MapView
        geojson={geojson}
        economicData={displayData}
        metric={metric}
        overlays={overlays}
        onMapReady={setMapInstance}
        onCountyClick={handleCountyClick}
        onCountyEnter={handleCountyEnter}
        onCountyLeave={handleCountyLeave}
      />

      {mapInstance && <AlertPulseLayer map={mapInstance} pulses={pulses} />}
      {mapInstance && showLiveFeeds && <LiveFeedLayer map={mapInstance} feeds={liveFeeds} />}

      <ControlPanel
        metric={metric}
        onMetricChange={setMetric}
        overlays={overlays}
        onToggleOverlay={toggleOverlay}
        onRefreshOverlay={refreshOverlay}
        eqWindow={eqWindow}
        onEqWindowChange={setEqWindow}
        isLoading={isLoading || temporalLoading}
        showScrubber={showScrubber}
        onToggleScrubber={() => setShowScrubber(s => !s)}
        showLiveFeeds={showLiveFeeds}
        onToggleLiveFeeds={() => setShowLiveFeeds(v => !v)}
      />

      <CRTOverlay />
      <AlertTicker pulses={pulses} onFlyTo={handleFlyTo} hidden={!!selectedCounty} />
      <HoverTooltip ref={tooltipRef} county={hoveredCounty} metric={metric} />

      {selectedCounty && (
        <CountyDetail
          county={selectedCounty}
          economicData={economicData}
          overlays={overlays}
          averages={averages}
          onClose={() => setSelectedCounty(null)}
        />
      )}

      {showScrubber && (
        <TimeScrubber
          activeYear={activeYear}
          onYearChange={handleYearChange}
          isPlaying={isPlaying}
          onPlayPause={() => setIsPlaying(p => !p)}
          speed={playbackSpeed}
          onSpeedChange={setPlaybackSpeed}
          loadingYear={temporalLoading ? temporalYear : null}
          onClose={() => { setShowScrubber(false); setIsPlaying(false) }}
        />
      )}

      {temporalYear && (
        <div className="temporal-banner">HISTORICAL · {temporalYear} · ACS 5-YEAR</div>
      )}

      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-spinner" />
            <div className="loading-text">
              {geoLoading ? 'Loading county boundaries' : 'Loading economic data'}
            </div>
            <div className="loading-sub">3,143 counties · Census ACS · Real-time overlays</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
