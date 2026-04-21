/**
 * useOverlays.js
 * Manages real-time overlay state and polling intervals.
 *
 * Each overlay has:
 *   - enabled: boolean (user toggle)
 *   - data: latest fetched payload
 *   - loading / error: fetch status
 *   - lastUpdated: Date
 *
 * Auto-refresh intervals:
 *   - Earthquakes: every 5 minutes
 *   - Weather alerts: every 5 minutes
 *   - Wildfires: every 30 minutes (satellite pass frequency)
 *   - Air quality: every 30 minutes
 *   - FEMA: every 60 minutes
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchEarthquakes } from '../overlays/earthquakes.js'
import { fetchWeatherAlerts } from '../overlays/weather.js'
import { fetchWildfires } from '../overlays/wildfires.js'
import { fetchAirQuality } from '../overlays/airquality.js'
import { fetchFemaDeclarations, buildFemaSet } from '../overlays/fema.js'

const REFRESH_INTERVALS = {
  earthquakes: 5 * 60 * 1000,
  weather: 5 * 60 * 1000,
  wildfires: 30 * 60 * 1000,
  airQuality: 30 * 60 * 1000,
  fema: 60 * 60 * 1000,
}

export function useOverlays(settings = {}) {
  const [overlays, setOverlays] = useState({
    earthquakes: { enabled: true, data: null, loading: false, error: null, lastUpdated: null },
    weather: { enabled: true, data: null, loading: false, error: null, lastUpdated: null },
    wildfires: { enabled: false, data: null, loading: false, error: null, lastUpdated: null },
    airQuality: { enabled: false, data: null, loading: false, error: null, lastUpdated: null },
    fema: { enabled: true, data: null, loading: false, error: null, lastUpdated: null, fipsSet: null },
  })

  const timers = useRef({})

  const patchOverlay = useCallback((key, patch) => {
    setOverlays((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }, [])

  const fetchOne = useCallback(async (key) => {
    patchOverlay(key, { loading: true, error: null })
    try {
      let data
      switch (key) {
        case 'earthquakes':
          data = await fetchEarthquakes(settings.earthquakeWindow || 24)
          break
        case 'weather':
          data = await fetchWeatherAlerts()
          break
        case 'wildfires':
          data = await fetchWildfires(settings.firmsKey || null)
          break
        case 'airQuality':
          data = await fetchAirQuality()
          break
        case 'fema': {
          const declarations = await fetchFemaDeclarations()
          const { fipsSet, detailMap } = buildFemaSet(declarations)
          data = { declarations, detailMap }
          patchOverlay(key, { data, fipsSet, loading: false, lastUpdated: new Date() })
          return
        }
      }
      patchOverlay(key, { data, loading: false, lastUpdated: new Date() })
    } catch (err) {
      patchOverlay(key, { loading: false, error: err.message })
    }
  }, [settings.earthquakeWindow, settings.firmsKey, patchOverlay])

  // On mount and when an overlay becomes enabled: fetch and schedule refresh
  useEffect(() => {
    for (const [key, state] of Object.entries(overlays)) {
      if (state.enabled && !state.data && !state.loading) {
        fetchOne(key)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Schedule periodic refreshes for enabled overlays
  useEffect(() => {
    for (const [key, state] of Object.entries(overlays)) {
      if (state.enabled) {
        if (!timers.current[key]) {
          timers.current[key] = setInterval(() => fetchOne(key), REFRESH_INTERVALS[key])
        }
      } else {
        clearInterval(timers.current[key])
        delete timers.current[key]
      }
    }
    return () => {
      for (const t of Object.values(timers.current)) clearInterval(t)
    }
  }, [overlays, fetchOne])

  const toggleOverlay = useCallback((key) => {
    setOverlays((prev) => {
      const next = { ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }
      // Trigger fetch if just enabled and no data
      if (next[key].enabled && !next[key].data) {
        setTimeout(() => fetchOne(key), 0)
      }
      return next
    })
  }, [fetchOne])

  const refreshOverlay = useCallback((key) => fetchOne(key), [fetchOne])

  return { overlays, toggleOverlay, refreshOverlay }
}
