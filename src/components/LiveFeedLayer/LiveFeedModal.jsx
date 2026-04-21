import { useEffect, useRef, useState } from 'react'
import { getStreamUrl, getFeedPageUrl, YOUTUBE_KEY } from '../../hooks/useLiveFeeds.js'

const WAVEFORM_BARS = 20

async function findLiveVideo(feed) {
  if (!YOUTUBE_KEY) return null
  const city = feed.name.split('—')[0].split('-')[0].trim()
  const q = encodeURIComponent(`${city} police scanner live`)
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&eventType=live&q=${q}&key=${YOUTUBE_KEY}&maxResults=1&relevanceLanguage=en&regionCode=US`
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.items?.[0]?.id?.videoId || null
  } catch { return null }
}

export default function LiveFeedModal({ feed, onClose }) {
  const audioRef   = useRef(null)
  const [videoId, setVideoId]         = useState(null)
  const [videoLoading, setVideoLoading] = useState(!!YOUTUBE_KEY)

  useEffect(() => {
    if (!feed) return
    setVideoId(null)
    setVideoLoading(!!YOUTUBE_KEY)
    if (YOUTUBE_KEY) findLiveVideo(feed).then(id => { setVideoId(id); setVideoLoading(false) })
  }, [feed?.feedId])

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  if (!feed) return null

  const streamUrl = getStreamUrl(feed)
  const pageUrl   = getFeedPageUrl(feed.feedId)
  const hasStream = !!streamUrl

  return (
    <div className="lf-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="lf-modal">

        {/* Header */}
        <div className="lf-modal-header">
          <div>
            <div className="lf-modal-title">{feed.name}</div>
            <div className="lf-modal-meta">
              {[
                feed.state,
                feed.listeners > 0 && `${feed.listeners.toLocaleString()} listening`,
              ].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button className="lf-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="lf-modal-live-badge">
          <div className="lf-modal-live-dot" />
          <span className="lf-modal-live-text">LIVE · CRIME SCANNER</span>
        </div>

        {/* Video (YouTube API key required) */}
        {YOUTUBE_KEY && (
          <div className="lf-video-section">
            {videoLoading && <div className="lf-video-searching"><span className="lf-video-search-text">Searching for live video…</span></div>}
            {!videoLoading && videoId && (
              <iframe
                className="lf-video-frame"
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&rel=0&modestbranding=1`}
                allow="autoplay; encrypted-media"
                allowFullScreen
                title="Live crime feed"
              />
            )}
            {!videoLoading && !videoId && <div className="lf-video-none">No live video found for this area.</div>}
          </div>
        )}

        {/* Audio */}
        <div className="lf-audio-section">
          <div className="lf-waveform">
            {Array.from({ length: WAVEFORM_BARS }, (_, i) => (
              <div key={i} className="lf-waveform-bar" style={{ animationDelay: `${(i * 60) % 600}ms` }} />
            ))}
          </div>

          {hasStream ? (
            <audio
              ref={audioRef}
              controls
              autoPlay
              preload="none"
              className="lf-audio-player"
              src={streamUrl}
            />
          ) : (
            <div className="lf-no-stream">
              <p>Add <code>VITE_BROADCASTIFY_API_KEY</code> to <code>.env</code> for direct audio playback.</p>
              <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="lf-listen-btn">
                ▶ LISTEN ON BROADCASTIFY
              </a>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
