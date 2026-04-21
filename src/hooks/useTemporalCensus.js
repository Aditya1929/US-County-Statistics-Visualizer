/**
 * useTemporalCensus.js
 * Fetches ACS 5-year census data for a given year (2010–2022).
 * Caches in sessionStorage with 24-hour TTL.
 * Pass null to disable fetching.
 */

import { useState, useEffect } from 'react'

const VARS = 'NAME,B23025_005E,B23025_003E,B19013_001E,B17001_002E,B17001_001E,B01003_001E'
const CACHE_PREFIX = 'poa_temporal_'
const TTL = 24 * 60 * 60 * 1000

const safe = (v, denom = null) => {
  const n = parseInt(v)
  if (isNaN(n) || n < -99999) return null
  if (denom !== null) {
    const d = parseInt(denom)
    if (isNaN(d) || d <= 0) return null
    return (n / d) * 100
  }
  return n
}

function getCached(year) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + year)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    return Date.now() - ts > TTL ? null : data
  } catch { return null }
}

function setCache(year, data) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + year, JSON.stringify({ data, ts: Date.now() }))
  } catch {}
}

async function fetchYear(year) {
  const cached = getCached(year)
  if (cached) return cached

  const url = `https://api.census.gov/data/${year}/acs/acs5?get=${VARS}&for=county:*&in=state:*`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Census ${year}: ${res.status}`)
  const rows = await res.json()

  const result = {}
  for (let i = 1; i < rows.length; i++) {
    const [name, unemployed, laborForce, income, poverty, povBase, pop, state, county] = rows[i]
    const fips = state.padStart(2, '0') + county.padStart(3, '0')
    const inc = safe(income)
    result[fips] = {
      fips,
      name,
      unemployment: safe(unemployed, laborForce),
      medianIncome:  inc != null && inc > 0 ? inc : null,
      povertyRate:   safe(poverty, povBase),
      population:    safe(pop),
      popChange:     null, // requires two fetches; omitted in temporal mode
    }
  }
  setCache(year, result)
  return result
}

export function useTemporalCensus(year) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (year == null) { setData(null); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchYear(year)
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [year])

  return { data, loading, error }
}
