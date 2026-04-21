/**
 * useAlertPulses.js
 * Monitors overlay data and emits animated pulse events for significant new alerts.
 * First-load behavior: only pulses for truly fresh/significant events.
 * Subsequent polls: pulses for any newly-arrived events.
 */

import { useState, useEffect, useRef } from 'react'

const EQ_PULSE_DURATION  = 2 * 60 * 60 * 1000  // 2 hours
const WX_PULSE_DURATION  = 30 * 60 * 1000       // 30 minutes

export const PULSE_COLORS = {
  earthquake: '251,191,36',   // amber
  weather:    '147,197,253',  // sky blue
  fire:       '249,115,22',   // orange
}

function centroid(geometry) {
  let coords
  if (geometry.type === 'Polygon') coords = geometry.coordinates[0]
  else if (geometry.type === 'MultiPolygon') coords = geometry.coordinates[0]?.[0]
  if (!coords?.length) return null
  const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length
  return [lng, lat]
}

function inUS(lat, lng) {
  return lat >= 18 && lat <= 72 && lng >= -180 && lng <= -65
}

export function useAlertPulses(overlays) {
  const [pulses, setPulses] = useState([])
  const seenEq = useRef(new Set())
  const seenWx = useRef(new Set())
  const firstEq = useRef(true)
  const firstWx = useRef(true)

  // ── Earthquakes ───────────────────────────────────────────
  useEffect(() => {
    const features = overlays?.earthquakes?.data?.features
    if (!features) return

    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
    const newPulses = []
    const isFirst = firstEq.current
    if (isFirst) firstEq.current = false

    for (const f of features) {
      const id = f.id || `eq_${f.properties.time}_${f.properties.mag}`
      const [lng, lat] = f.geometry.coordinates

      if (!inUS(lat, lng)) { seenEq.current.add(id); continue }

      if (seenEq.current.has(id)) continue
      seenEq.current.add(id)

      const mag = f.properties.mag || 0
      // On first load, only pulse fresh M3.5+ quakes
      if (isFirst && (mag < 3.5 || f.properties.time < twoHoursAgo)) continue
      // On subsequent polls, pulse any M2.5+
      if (!isFirst && mag < 2.5) continue

      newPulses.push({
        id,
        lat, lng,
        type: 'earthquake',
        severity: Math.min(5, Math.ceil(mag / 1.5)),
        label: `M${mag.toFixed(1)} · ${(f.properties.place || '').split(' of ').pop()}`,
        timestamp: new Date(f.properties.time),
        expiresAt: new Date(Date.now() + EQ_PULSE_DURATION),
        color: PULSE_COLORS.earthquake,
      })
    }
    if (newPulses.length) setPulses(p => [...p, ...newPulses])
  }, [overlays?.earthquakes?.data]) // eslint-disable-line

  // ── Weather alerts ────────────────────────────────────────
  useEffect(() => {
    const features = overlays?.weather?.data?.features
    if (!features) return

    const oneHourAgo  = Date.now() - 60 * 60 * 1000
    const newPulses = []
    const isFirst = firstWx.current
    if (isFirst) firstWx.current = false

    for (const f of features) {
      const id = f.id || f.properties?.id
      if (!id) continue
      if (seenWx.current.has(id)) continue
      seenWx.current.add(id)

      const sev = f.properties?.severity || ''
      const sevScore = sev === 'Extreme' ? 5 : sev === 'Severe' ? 4 : sev === 'Moderate' ? 3 : 2

      // On first load, only pulse Extreme/Severe from last hour
      if (isFirst && (sevScore < 4 || new Date(f.properties?.sent) < oneHourAgo)) continue

      // Get centroid from polygon geometry
      let lat, lng
      if (f.geometry?.coordinates) {
        const pt = centroid(f.geometry)
        if (pt) { [lng, lat] = pt }
      }
      if (!lat || !lng || !inUS(lat, lng)) continue

      newPulses.push({
        id,
        lat, lng,
        type: 'weather',
        severity: sevScore,
        label: f.properties?.event || 'Weather Alert',
        timestamp: new Date(f.properties?.sent || Date.now()),
        expiresAt: new Date(Date.now() + WX_PULSE_DURATION),
        color: PULSE_COLORS.weather,
      })
    }
    if (newPulses.length) setPulses(p => [...p, ...newPulses])
  }, [overlays?.weather?.data]) // eslint-disable-line

  // Prune expired pulses every minute
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()
      setPulses(p => p.filter(pulse => pulse.expiresAt.getTime() > now))
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  return pulses
}
