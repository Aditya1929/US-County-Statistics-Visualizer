/**
 * useLiveFeeds.js
 *
 * Data sources:
 *  - Broadcastify API  → live police scanner audio streams near map view
 *    API key: VITE_BROADCASTIFY_API_KEY (free at broadcastify.com/developers)
 *    Without key: shows fallback markers on map; audio plays on Broadcastify site
 *
 *  - YouTube Data API v3 → live crime/scanner video streams
 *    API key: VITE_YOUTUBE_API_KEY (free at console.cloud.google.com)
 *    Without key: video section is hidden in the modal
 */
import { useState, useEffect, useRef, useCallback } from 'react'

export const BROADCASTIFY_KEY = import.meta.env.VITE_BROADCASTIFY_API_KEY || ''
export const YOUTUBE_KEY      = import.meta.env.VITE_YOUTUBE_API_KEY      || ''

// Fallback feed locations (no stream URLs — require API key for audio).
// These mark the approximate city centre so pins still appear on the map.
// feedPageUrl lets users listen via the Broadcastify web player without a key.
export const FALLBACK_FEEDS = [
  { feedId: 'la',  name: 'LAPD — Central Bureau',    lat: 34.0522, lng: -118.2437, state: 'CA' },
  { feedId: 'nyc', name: 'NYPD — City-Wide',          lat: 40.7128, lng: -74.0060,  state: 'NY' },
  { feedId: 'chi', name: 'Chicago PD — Zone 1-3',     lat: 41.8781, lng: -87.6298,  state: 'IL' },
  { feedId: 'hou', name: 'Houston PD',                lat: 29.7604, lng: -95.3698,  state: 'TX' },
  { feedId: 'phx', name: 'Phoenix PD / Fire',         lat: 33.4484, lng: -112.0740, state: 'AZ' },
  { feedId: 'mia', name: 'Miami-Dade PD',             lat: 25.7617, lng: -80.1918,  state: 'FL' },
  { feedId: 'sea', name: 'Seattle PD',                lat: 47.6062, lng: -122.3321, state: 'WA' },
  { feedId: 'den', name: 'Denver PD — District 1-6',  lat: 39.7392, lng: -104.9903, state: 'CO' },
  { feedId: 'atl', name: 'Atlanta PD — Zone 1',       lat: 33.7490, lng: -84.3880,  state: 'GA' },
  { feedId: 'dal', name: 'Dallas PD',                 lat: 32.7767, lng: -96.7970,  state: 'TX' },
  { feedId: 'sf',  name: 'San Francisco PD',          lat: 37.7749, lng: -122.4194, state: 'CA' },
  { feedId: 'lv',  name: 'Las Vegas Metro PD',        lat: 36.1699, lng: -115.1398, state: 'NV' },
]

/**
 * Fetch real feeds from Broadcastify API (requires key).
 * API response includes the correct streamUrl per feed.
 */
async function fetchBroadcastifyFeeds(bounds) {
  const { north, south, east, west } = bounds
  const lat = (north + south) / 2
  const lng = (east + west) / 2
  const url = `https://api.broadcastify.com/1.0/feed/?api_key=${BROADCASTIFY_KEY}&lat=${lat}&lng=${lng}&limit=20&feedFilter=1&type=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Broadcastify ${res.status}`)
  const data = await res.json()
  return (data?.Feed || []).map(f => ({
    feedId:    f.id,
    name:      f.descr || f.name,
    lat:       parseFloat(f.lat),
    lng:       parseFloat(f.lng),
    state:     f.st || '',
    listeners: parseInt(f.listeners) || 0,
    // API returns the actual CDN stream URL — do not guess this
    streamUrl: f.broadcastifyStreamUrl || f.streamUrl || null,
  }))
}

/**
 * Returns the correct stream URL for a feed.
 * Only reliable when the feed object came from the Broadcastify API (has streamUrl).
 */
export function getStreamUrl(feed) {
  return feed.streamUrl || null
}

/**
 * Returns the Broadcastify web listen page for a feed (works without API key).
 */
export function getFeedPageUrl(feedId) {
  // Only numeric IDs map to real pages; slug IDs are our fallback placeholders
  if (typeof feedId === 'number' || /^\d+$/.test(String(feedId))) {
    return `https://www.broadcastify.com/listen/feed/${feedId}`
  }
  return 'https://www.broadcastify.com/listen/'
}

export function useLiveFeeds(enabled, mapBounds) {
  const [feeds, setFeeds]     = useState([])
  const [loading, setLoading] = useState(false)
  const timerRef              = useRef(null)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      if (BROADCASTIFY_KEY && mapBounds) {
        const result = await fetchBroadcastifyFeeds(mapBounds)
        if (result.length > 0) { setFeeds(result); setLoading(false); return }
      }
    } catch { /* fall through to fallback */ }
    setFeeds(FALLBACK_FEEDS)
    setLoading(false)
  }, [enabled, mapBounds])

  useEffect(() => {
    if (!enabled) { setFeeds([]); return }
    load()
    timerRef.current = setInterval(load, 120_000)
    return () => clearInterval(timerRef.current)
  }, [enabled, load])

  return { feeds, loading, hasApiKey: !!BROADCASTIFY_KEY }
}
