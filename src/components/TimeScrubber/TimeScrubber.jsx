import { useRef, useState, useCallback } from 'react'
import './TimeScrubber.css'

const AVAILABLE_YEARS = [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022]
const BASE_YEAR = 2022

export { AVAILABLE_YEARS, BASE_YEAR }

export default function TimeScrubber({
  activeYear,
  onYearChange,
  isPlaying,
  onPlayPause,
  speed,
  onSpeedChange,
  loadingYear,
  onClose,
}) {
  const trackRef   = useRef(null)
  const [dragging, setDragging] = useState(false)

  const yearFromX = useCallback((clientX) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return activeYear
    const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const idx = Math.round(t * (AVAILABLE_YEARS.length - 1))
    return AVAILABLE_YEARS[idx]
  }, [activeYear])

  const handleTrackClick = (e) => {
    if (dragging) return
    onYearChange(yearFromX(e.clientX))
  }

  const handleMouseDown = (e) => {
    e.preventDefault()
    setDragging(true)
    const onMove = (ev) => onYearChange(yearFromX(ev.clientX))
    const onUp   = () => { setDragging(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const thumbPct = ((AVAILABLE_YEARS.indexOf(activeYear)) / (AVAILABLE_YEARS.length - 1)) * 100

  const isLive = activeYear === BASE_YEAR

  return (
    <div className="time-scrubber">
      {/* Play / Pause */}
      <button className="ts-play-btn" onClick={onPlayPause} title={isPlaying ? 'Pause' : 'Play'}>
        {isPlaying ? '■' : '▶'}
      </button>

      {/* Active year */}
      <div className="ts-year-display">{activeYear}</div>

      {/* Track */}
      <div
        ref={trackRef}
        className="ts-track-wrap"
        onClick={handleTrackClick}
        onMouseDown={handleMouseDown}
      >
        <div className="ts-track">
          <div className="ts-track-fill" style={{ width: `${thumbPct}%` }} />
          <div className="ts-thumb" style={{ left: `${thumbPct}%` }} />
        </div>

        {/* Year labels — show every other year to avoid crowding */}
        <div className="ts-labels">
          {AVAILABLE_YEARS.map((year, i) => {
            const show = i === 0 || i === AVAILABLE_YEARS.length - 1 || i % 2 === 0
            if (!show) return null
            const pct = (i / (AVAILABLE_YEARS.length - 1)) * 100
            return (
              <span
                key={year}
                className={`ts-label ${year === activeYear ? 'active' : ''} ${year === loadingYear ? 'loading' : ''}`}
                style={{ position: 'absolute', left: `${pct}%` }}
              >
                {year === loadingYear ? '…' : year}
              </span>
            )
          })}
        </div>
      </div>

      {/* Speed */}
      <div className="ts-speed">
        {[0.5, 1, 2].map(s => (
          <button
            key={s}
            className={`ts-speed-btn ${speed === s ? 'active' : ''}`}
            onClick={() => onSpeedChange(s)}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Live / temporal badge */}
      <span className={`ts-temporal-badge ${isLive ? 'live' : ''}`}>
        {isLive ? '● LIVE' : 'HIST'}
      </span>

      {/* Close */}
      <button className="ts-close-btn" onClick={onClose} title="Close timeline">×</button>
    </div>
  )
}
