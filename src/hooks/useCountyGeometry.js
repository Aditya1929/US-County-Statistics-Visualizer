/**
 * useCountyGeometry.js
 * Loads US county boundary GeoJSON from the public CDN-hosted us-atlas TopoJSON.
 *
 * The us-atlas package publishes to unpkg/jsdelivr. We fetch the TopoJSON,
 * convert to GeoJSON using topojson-client, and memoize the result so the
 * 3.1MB download only happens once per session.
 */

import { useState, useEffect } from 'react'
import { feature } from 'topojson-client'

// CDN-hosted us-atlas TopoJSON — counties with FIPS properties
// 10m = 1:10,000,000 scale (good for national view, ~1.8MB gzipped)
const TOPO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'

let cachedGeoJSON = null

export function useCountyGeometry() {
  const [geojson, setGeojson] = useState(cachedGeoJSON)
  const [loading, setLoading] = useState(!cachedGeoJSON)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (cachedGeoJSON) return

    async function load() {
      try {
        const res = await fetch(TOPO_URL)
        if (!res.ok) throw new Error(`Failed to load county geometry: ${res.status}`)
        const topology = await res.json()

        // topojson-client converts the compact topology into a standard GeoJSON
        // FeatureCollection. The "counties" object includes FIPS codes as numeric IDs.
        const gj = feature(topology, topology.objects.counties)

        // Normalize: ensure each feature has GEOID as a zero-padded string
        gj.features = gj.features.map((f) => ({
          ...f,
          id: String(f.id).padStart(5, '0'),
          properties: {
            ...f.properties,
            GEOID: String(f.id).padStart(5, '0'),
            STATEFP: String(f.id).padStart(5, '0').slice(0, 2),
            COUNTYFP: String(f.id).padStart(5, '0').slice(2),
          },
        }))

        cachedGeoJSON = gj
        setGeojson(gj)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return { geojson, loading, error }
}
