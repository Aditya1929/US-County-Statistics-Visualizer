/**
 * dataService.js — single ACS 5-year request for all county economic data.
 *
 * Previous approach used three separate APIs (SAIPE timeseries, PEP, BLS)
 * that have unreliable variable names. This version uses ACS 5-year which
 * is stable, CORS-accessible from the browser, and covers all four metrics.
 *
 * Variables:
 *   B23025_005E  — Unemployed (civilian labor force)
 *   B23025_003E  — Civilian labor force (total)
 *   B19013_001E  — Median household income
 *   B17001_002E  — Below poverty level
 *   B17001_001E  — Total population for poverty determination
 *   B01003_001E  — Total population
 */

const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const CACHE_VER    = 'poa_v4_'  // bump version to bust stale cache from prior builds

const ACS_VARS = 'NAME,B23025_005E,B23025_003E,B19013_001E,B17001_002E,B17001_001E,B01003_001E'
const ACS_2022 = `https://api.census.gov/data/2022/acs/acs5?get=${ACS_VARS}&for=county:*&in=state:*`
const ACS_2021 = `https://api.census.gov/data/2021/acs/acs5?get=B01003_001E&for=county:*&in=state:*`

// Census uses large negative codes for suppressed/unavailable data
const safe = (v, denom = null) => {
  const n = parseInt(v)
  if (isNaN(n) || n < -99999) return null
  if (denom !== null) {
    const d = parseInt(denom)
    if (isNaN(d) || d <= 0 || d < -99999) return null
    return (n / d) * 100
  }
  return n
}

export async function fetchAllEconomicData() {
  const cacheKey = CACHE_VER + 'merged'
  const cached = getFromCache(cacheKey)
  if (cached) return cached

  // Fetch current-year data and prior-year population in parallel
  const [rows2022, rows2021] = await Promise.all([
    fetchRows(ACS_2022),
    fetchRows(ACS_2021),
  ])

  // Build prior-year pop lookup keyed by FIPS
  const pop2021 = {}
  // rows2021[0] = ['B01003_001E', 'state', 'county']
  for (let i = 1; i < rows2021.length; i++) {
    const [pop, state, county] = rows2021[i]
    const fips = state.padStart(2, '0') + county.padStart(3, '0')
    pop2021[fips] = safe(pop)
  }

  // rows2022[0] = ['NAME','B23025_005E','B23025_003E','B19013_001E','B17001_002E','B17001_001E','B01003_001E','state','county']
  const result = {}
  for (let i = 1; i < rows2022.length; i++) {
    const [name, unemployed, laborForce, income, poverty, povBase, pop, state, county] = rows2022[i]
    const fips = state.padStart(2, '0') + county.padStart(3, '0')
    const pop22 = safe(pop)
    const pop21 = pop2021[fips]

    result[fips] = {
      fips,
      name,
      stateName: STATE_NAMES[state.padStart(2, '0')] || '',
      unemployment: safe(unemployed, laborForce),
      medianIncome: safe(income) != null && safe(income) > 0 ? safe(income) : null,
      povertyRate:  safe(poverty, povBase),
      population:   pop22,
      popChange:    pop22 != null && pop21 != null && pop21 > 0
        ? ((pop22 - pop21) / pop21) * 100
        : null,
    }
  }

  setToCache(cacheKey, result)
  return result
}

async function fetchRows(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Census API ${res.status}: ${url}`)
  return res.json()
}

export function computeAverages(economicData, metric) {
  const vals = []
  const byState = {}

  for (const [fips, record] of Object.entries(economicData)) {
    const v = record[metric]
    if (v == null) continue
    vals.push(v)
    const st = fips.slice(0, 2)
    if (!byState[st]) byState[st] = []
    byState[st].push(v)
  }

  const mean = (arr) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null

  return {
    national: mean(vals),
    byState:  Object.fromEntries(Object.entries(byState).map(([st, a]) => [st, mean(a)])),
  }
}

// ── Cache ─────────────────────────────────────────────────
function getFromCache(key) {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    return Date.now() - ts > CACHE_TTL_MS ? null : data
  } catch { return null }
}

function setToCache(key, data) {
  try { sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })) } catch {}
}

const STATE_NAMES = {
  '01':'Alabama','02':'Alaska','04':'Arizona','05':'Arkansas','06':'California',
  '08':'Colorado','09':'Connecticut','10':'Delaware','11':'District of Columbia',
  '12':'Florida','13':'Georgia','15':'Hawaii','16':'Idaho','17':'Illinois',
  '18':'Indiana','19':'Iowa','20':'Kansas','21':'Kentucky','22':'Louisiana',
  '23':'Maine','24':'Maryland','25':'Massachusetts','26':'Michigan','27':'Minnesota',
  '28':'Mississippi','29':'Missouri','30':'Montana','31':'Nebraska','32':'Nevada',
  '33':'New Hampshire','34':'New Jersey','35':'New Mexico','36':'New York',
  '37':'North Carolina','38':'North Dakota','39':'Ohio','40':'Oklahoma','41':'Oregon',
  '42':'Pennsylvania','44':'Rhode Island','45':'South Carolina','46':'South Dakota',
  '47':'Tennessee','48':'Texas','49':'Utah','50':'Vermont','51':'Virginia',
  '53':'Washington','54':'West Virginia','55':'Wisconsin','56':'Wyoming','72':'Puerto Rico',
}
