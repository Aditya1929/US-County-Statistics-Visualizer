/**
 * AlertPulseLayer.jsx
 * Canvas overlay that draws expanding sonar-ping rings for each active alert pulse.
 * Sized to CSS pixels so map.project([lng,lat]) coordinates align correctly.
 * Works in both flat (pitch=0) and 3D (pitch>0) map modes.
 */

import { useRef, useEffect } from 'react'

const RING_DURATION = 2500
const RING_STAGGER  = 600
const RINGS_PER_PULSE = 3

export default function AlertPulseLayer({ map, pulses }) {
  const canvasRef = useRef(null)
  const ringsRef  = useRef([])    // live ring state
  const pulsesRef = useRef(pulses)
  const animRef   = useRef(null)

  useEffect(() => { pulsesRef.current = pulses }, [pulses])

  // Sync canvas size to MapLibre container
  useEffect(() => {
    if (!map) return
    const sync = () => {
      const container = map.getContainer()
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width  = container.offsetWidth
      canvas.height = container.offsetHeight
    }
    sync()
    map.on('resize', sync)
    window.addEventListener('resize', sync)
    return () => { map.off('resize', sync); window.removeEventListener('resize', sync) }
  }, [map])

  // Spawn rings when pulses change
  useEffect(() => {
    const now = Date.now()
    const activePulseIds = new Set(pulses.map(p => p.id))

    // Remove rings for expired pulses
    ringsRef.current = ringsRef.current.filter(r => activePulseIds.has(r.pulseId))

    // Add rings for new pulses
    for (const pulse of pulses) {
      const alreadyHasRings = ringsRef.current.some(r => r.pulseId === pulse.id)
      if (alreadyHasRings) continue
      for (let i = 0; i < RINGS_PER_PULSE; i++) {
        ringsRef.current.push({ pulseId: pulse.id, pulse, startTime: now + i * RING_STAGGER })
      }
    }
  }, [pulses])

  // Animation loop
  useEffect(() => {
    if (!map) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    function draw() {
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      const now = Date.now()
      const surviving = []

      // Respawn check: if any active pulse has no rings, add new ones
      const pulsesWithRings = new Set(ringsRef.current.map(r => r.pulseId))
      for (const pulse of pulsesRef.current) {
        if (!pulsesWithRings.has(pulse.id)) {
          for (let i = 0; i < RINGS_PER_PULSE; i++) {
            ringsRef.current.push({ pulseId: pulse.id, pulse, startTime: now + i * RING_STAGGER })
          }
        }
      }

      for (const ring of ringsRef.current) {
        const elapsed = now - ring.startTime
        if (elapsed < 0) { surviving.push(ring); continue }

        // Check if corresponding pulse is still active
        const pulseStillActive = pulsesRef.current.some(p => p.id === ring.pulseId)
        if (elapsed > RING_DURATION) {
          // Respawn only if pulse is active
          if (pulseStillActive) {
            surviving.push({ ...ring, startTime: now + (RINGS_PER_PULSE - 1) * RING_STAGGER })
          }
          continue
        }

        surviving.push(ring)
        const t = elapsed / RING_DURATION

        let pt
        try { pt = map.project([ring.pulse.lng, ring.pulse.lat]) }
        catch { continue }

        if (pt.x < -100 || pt.x > w + 100 || pt.y < -100 || pt.y > h + 100) continue

        const maxR  = 18 + ring.pulse.severity * 10
        const r     = t * maxR
        const alpha = (1 - t) * 0.75

        ctx.beginPath()
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${ring.pulse.color}, ${alpha})`
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Core dot — pulsing opacity
      const corePulses = new Set()
      for (const ring of ringsRef.current) {
        if (!corePulses.has(ring.pulseId)) {
          corePulses.add(ring.pulseId)
          let pt
          try { pt = map.project([ring.pulse.lng, ring.pulse.lat]) }
          catch { continue }
          const coreAlpha = Math.sin(now / 450) * 0.4 + 0.6
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${ring.pulse.color}, ${coreAlpha})`
          ctx.fill()
        }
      }

      ringsRef.current = surviving
      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(animRef.current) }
  }, [map]) // eslint-disable-line

  if (!map) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  )
}
