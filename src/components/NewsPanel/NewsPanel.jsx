/**
 * NewsPanel.jsx
 * Shows Wikipedia county summary + recent RSS headlines for the selected county.
 * Uses Wikipedia REST API (no key) and rss2json (no key, ~10 req/10min limit).
 */

import { useState, useEffect } from 'react'

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  const m = Math.floor(diff / 60000)
  return m > 0 ? `${m}m ago` : 'just now'
}

async function fetchWiki(countyName, stateName) {
  // Try "County Name, State" then just "County Name"
  const titles = [
    `${countyName}, ${stateName}`,
    countyName,
  ]
  for (const title of titles) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`
      const res = await fetch(url)
      if (!res.ok) continue
      const data = await res.json()
      if (data.type === 'disambiguation') continue
      return data
    } catch { continue }
  }
  return null
}

async function fetchNews(countyName, stateName) {
  // Build the Google News RSS URL first, then encode it once for rss2json
  const query = `"${countyName}" ${stateName}`
  const googleRss = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
  try {
    const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(googleRss)}&count=6`)
    if (!res.ok) return []
    const data = await res.json()
    return data.items || []
  } catch {
    return []
  }
}

export default function NewsPanel({ countyName, stateName, fips }) {
  const [tab, setTab]       = useState('wiki')
  const [wiki, setWiki]     = useState(null)
  const [news, setNews]     = useState([])
  const [wikiLoading, setWikiLoading] = useState(false)
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsLoaded, setNewsLoaded]   = useState(false)

  // Fetch Wikipedia summary when county changes
  useEffect(() => {
    if (!countyName || !stateName) return
    setWiki(null)
    setWikiLoading(true)
    fetchWiki(countyName, stateName)
      .then(d => { setWiki(d); setWikiLoading(false) })
      .catch(() => setWikiLoading(false))
  }, [countyName, stateName])

  // Fetch news lazily when tab switches to 'news'
  useEffect(() => {
    if (tab !== 'news' || newsLoaded || !countyName) return
    setNewsLoading(true)
    fetchNews(countyName, stateName)
      .then(items => { setNews(items); setNewsLoading(false); setNewsLoaded(true) })
      .catch(() => { setNewsLoading(false); setNewsLoaded(true) })
  }, [tab, countyName, stateName, newsLoaded])

  // Reset on county change
  useEffect(() => {
    setNews([])
    setNewsLoaded(false)
    setTab('wiki')
  }, [fips])

  const cleanName = (countyName || '').replace(/ County$/, '').replace(/ Parish$/, '')

  return (
    <div className="news-panel">
      {/* Tab bar */}
      <div className="news-tabs">
        <button className={`news-tab ${tab === 'wiki' ? 'active' : ''}`} onClick={() => setTab('wiki')}>
          ABOUT
        </button>
        <button className={`news-tab ${tab === 'news' ? 'active' : ''}`} onClick={() => setTab('news')}>
          NEWS
        </button>
      </div>

      {/* Wikipedia tab */}
      {tab === 'wiki' && (
        <div className="news-content">
          {wikiLoading && <div className="news-skeleton"><div className="skel-line"/><div className="skel-line short"/><div className="skel-line"/></div>}
          {!wikiLoading && !wiki && (
            <div className="news-empty">No Wikipedia article found for {cleanName}.</div>
          )}
          {wiki && (
            <>
              {wiki.thumbnail?.source && (
                <img
                  src={wiki.thumbnail.source}
                  alt={wiki.title}
                  className="wiki-thumb"
                  onError={e => { e.target.style.display = 'none' }}
                />
              )}
              <p className="wiki-extract">{wiki.extract}</p>
              <a
                href={wiki.content_urls?.desktop?.page}
                target="_blank"
                rel="noopener noreferrer"
                className="wiki-link"
              >
                Read on Wikipedia →
              </a>
            </>
          )}
        </div>
      )}

      {/* News tab */}
      {tab === 'news' && (
        <div className="news-content">
          {newsLoading && <div className="news-skeleton"><div className="skel-line"/><div className="skel-line short"/><div className="skel-line"/></div>}
          {!newsLoading && news.length === 0 && (
            <div className="news-empty">No recent headlines found for {cleanName}.</div>
          )}
          {news.map((item, i) => (
            <a
              key={i}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="news-item"
            >
              <div className="news-item-title">{item.title}</div>
              <div className="news-item-meta">
                <span className="news-item-source">{item.author || (() => { try { return new URL(item.link).hostname.replace('www.', '') } catch { return 'news' } })()}</span>
                <span className="news-item-time">{timeAgo(item.pubDate)}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
