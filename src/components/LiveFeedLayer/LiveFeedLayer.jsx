/**
 * LiveFeedLayer.jsx
 *
 * Renders live scanner feed markers on the map as:
 *   1. A pulsing red dot at ground level (canvas)
 *   2. A glowing vertical pillar shooting up in screen-space (canvas)
 *   3. A floating DOM card at the top of the pillar (absolute positioned)
 *
 * Clicking a card opens LiveFeedModal with the Broadcastify audio stream.
 *
 * The pillar is drawn in screen-space (not world-space), so it always appears
 * vertical regardless of map pitch/bearing. The base tracks the real geographic
 * position via map.project().
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import LiveFeedModal from './LiveFeedModal.jsx'

const PILLAR_HEIGHT = 70      // px tall the pillar extends above the pulse dot
const PULSE_RADIUS  = 10      // max radius of the pulse ring
const PULSE_MS      = 1800    // one pulse cycle in ms

export default function LiveFeedLayer({ map, feeds }) {
  const canvasRef   = useRef(null)
  const rafRef      = useRef(null)
  const [cards, setCards]       = useState([])   // [{feed, x, y}] screen positions
  const [selected, setSelected] = useState(null) // feed open in modal

  // ── Sync canvas size to map container ──
  const syncCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !map) return
    const c = map.getContainer()
    canvas.width  = c.offsetWidth
    canvas.height = c.offsetHeight
    canvas.style.width  = c.offsetWidth  + 'px'
    canvas.style.height = c.offsetHeight + 'px'
  }, [map])

  // ── rAF draw loop ──
  useEffect(() => {
    if (!map || !feeds.length) {
      setCards([])
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    syncCanvas()

    const draw = () => {
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const now = Date.now()
      const newCards = []

      for (const feed of feeds) {
        if (feed.lat == null || feed.lng == null) continue
        const pt = map.project([feed.lng, feed.lat])
        const bx = Math.round(pt.x)
        const by = Math.round(pt.y)

        // Skip if off-screen (with margin for pillar + card)
        if (bx < -20 || bx > canvas.width + 20 || by < -100 || by > canvas.height + 20) continue

        // ── Pulse rings ──
        const phase = (now % PULSE_MS) / PULSE_MS
        for (let ring = 0; ring < 3; ring++) {
          const rPhase = (phase + ring / 3) % 1
          const r = rPhase * PULSE_RADIUS
          const alpha = (1 - rPhase) * 0.6
          ctx.beginPath()
          ctx.arc(bx, by, r, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(204, 34, 34, ${alpha})`
          ctx.lineWidth = 1.5
          ctx.stroke()
        }

        // ── Core dot ──
        ctx.beginPath()
        ctx.arc(bx, by, 4, 0, Math.PI * 2)
        ctx.fillStyle = '#cc2222'
        ctx.fill()

        // ── Pillar ──
        const pillarTop = by - PILLAR_HEIGHT
        const grad = ctx.createLinearGradient(bx, by, bx, pillarTop)
        grad.addColorStop(0, 'rgba(204, 34, 34, 0.8)')
        grad.addColorStop(0.5, 'rgba(204, 34, 34, 0.4)')
        grad.addColorStop(1, 'rgba(204, 34, 34, 0)')

        ctx.beginPath()
        ctx.moveTo(bx, by)
        ctx.lineTo(bx, pillarTop)
        ctx.strokeStyle = grad
        ctx.lineWidth = 2
        ctx.stroke()

        // ── Glow on pillar ──
        ctx.beginPath()
        ctx.moveTo(bx, by)
        ctx.lineTo(bx, pillarTop)
        ctx.strokeStyle = `rgba(255, 80, 80, ${0.15 + 0.08 * Math.sin(now / 400)})`
        ctx.lineWidth = 6
        ctx.stroke()

        // Card position = top of pillar
        newCards.push({ feed, x: bx, y: pillarTop })
      }

      setCards(newCards)
      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    const onResize = () => { syncCanvas() }
    map.on('resize', onResize)

    return () => {
      cancelAnimationFrame(rafRef.current)
      map.off('resize', onResize)
    }
  }, [map, feeds, syncCanvas])

  if (!map) return null

  return (
    <>
      {/* Canvas — pulses + pillars */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0, left: 0,
          pointerEvents: 'none',
          zIndex: 290,
        }}
      />

      {/* DOM cards — floating above pillar tops */}
      {cards.map(({ feed, x, y }) => (
        <div
          key={feed.feedId}
          className="lf-card"
          style={{ left: x, top: y }}
          onClick={() => setSelected(feed)}
        >
          <div className="lf-card-live">
            <div className="lf-card-dot" />
            <span className="lf-card-badge">CRIME</span>
            {feed.listeners > 0 && (
              <span className="lf-card-listeners">{feed.listeners.toLocaleString()} ♫</span>
            )}
          </div>
          <div className="lf-card-name">{feed.name}</div>
          {feed.state && <div className="lf-card-state">{feed.state} · Scanner</div>}
          <div className="lf-card-play">▶ TUNE IN</div>
        </div>
      ))}

      {/* Modal */}
      {selected && (
        <LiveFeedModal feed={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}
