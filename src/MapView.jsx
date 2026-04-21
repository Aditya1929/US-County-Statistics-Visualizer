import { useEffect, useRef, useState } from 'react'
import { initMap, loadCountyLayer, updateChoropleth } from './mapEngine.js'
import { addEarthquakeLayer, removeEarthquakeLayer } from './overlays/earthquakes.js'
import { addWeatherLayer, removeWeatherLayer } from './overlays/weather.js'
import { addWildfireLayer, removeWildfireLayer } from './overlays/wildfires.js'
import { addAirQualityLayer, removeAirQualityLayer } from './overlays/airquality.js'
import { addFemaLayer, removeFemaLayer } from './overlays/fema.js'

export default function MapView({
  geojson, economicData, metric, overlays,
  onCountyClick, onCountyEnter, onCountyLeave,
  onMapReady,
}) {
  const containerRef   = useRef(null)
  const mapRef         = useRef(null)
  const hoveredFipsRef = useRef(null)
  const pendingFipsRef = useRef(null)
  const hoverTimerRef  = useRef(null)
  const [mapReady, setMapReady] = useState(false)

  // ── Init ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = initMap(containerRef.current)
    mapRef.current = map
    map.on('load', () => {
      setMapReady(true)
      onMapReady?.(map)
    })
    return () => { map.remove(); mapRef.current = null }
  }, []) // eslint-disable-line

  // ── Choropleth ────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !geojson || !economicData) return
    const map = mapRef.current
    const doLoad = () => loadCountyLayer(map, geojson, economicData, metric)
    if (map.isStyleLoaded()) doLoad(); else map.once('styledata', doLoad)
  }, [mapReady, geojson, economicData]) // eslint-disable-line

  useEffect(() => {
    if (!mapReady || !economicData || !mapRef.current) return
    updateChoropleth(mapRef.current, economicData, metric)
  }, [metric, mapReady, economicData])

  // ── Hover ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current

    const clearHighlight = () => {
      if (hoveredFipsRef.current) {
        map.setFeatureState({ source: 'counties', id: hoveredFipsRef.current }, { hover: false })
        hoveredFipsRef.current = null
      }
      if (map.getLayer('counties-hover-outline')) {
        map.setFilter('counties-hover-outline', ['==', ['get', 'GEOID'], ''])
      }
    }

    const onMouseMove = (e) => {
      map.getCanvas().style.cursor = 'pointer'
      if (!e.features?.length) return
      const feature = e.features[0]
      const fips = feature.properties.GEOID
      if (fips === pendingFipsRef.current) return
      clearTimeout(hoverTimerRef.current)
      pendingFipsRef.current = fips
      clearHighlight()
      onCountyLeave?.()
      const data = {
        fips,
        name:         feature.properties.NAME,
        unemployment: feature.properties.unemployment,
        medianIncome: feature.properties.medianIncome,
        povertyRate:  feature.properties.povertyRate,
        popChange:    feature.properties.popChange,
        population:   feature.properties.population,
        stateName:    feature.properties.stateName,
      }
      hoverTimerRef.current = setTimeout(() => {
        map.setFeatureState({ source: 'counties', id: fips }, { hover: true })
        if (map.getLayer('counties-hover-outline')) {
          map.setFilter('counties-hover-outline', ['==', ['get', 'GEOID'], fips])
        }
        hoveredFipsRef.current = fips
        onCountyEnter?.(data)
      }, 500)
    }

    const onMouseLeave = () => {
      clearTimeout(hoverTimerRef.current)
      pendingFipsRef.current = null
      clearHighlight()
      map.getCanvas().style.cursor = ''
      onCountyLeave?.()
    }

    const wire = () => {
      map.on('mousemove', 'counties-fill', onMouseMove)
      map.on('mouseleave', 'counties-fill', onMouseLeave)
    }
    if (map.getLayer('counties-fill')) wire(); else map.once('idle', wire)

    return () => {
      clearTimeout(hoverTimerRef.current)
      map.off('mousemove', 'counties-fill', onMouseMove)
      map.off('mouseleave', 'counties-fill', onMouseLeave)
    }
  }, [mapReady, onCountyEnter, onCountyLeave])

  // ── Click ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !onCountyClick) return
    const map = mapRef.current
    const onClick = (e) => {
      if (!e.features?.length) return
      const f = e.features[0]
      onCountyClick({ fips: f.properties.GEOID, name: f.properties.NAME, properties: f.properties, lng: e.lngLat.lng, lat: e.lngLat.lat })
    }
    const addClick = () => { if (map.getLayer('counties-fill')) map.on('click', 'counties-fill', onClick) }
    if (map.getLayer('counties-fill')) addClick(); else map.once('idle', addClick)
    return () => map.off('click', 'counties-fill', onClick)
  }, [mapReady, onCountyClick])

  // ── Overlays ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const sync = () => {
      const { earthquakes: eq, weather: wx, wildfires: fire, airQuality: aq, fema } = overlays
      if (eq.enabled && eq.data)        addEarthquakeLayer(map, eq.data);   else removeEarthquakeLayer(map)
      if (wx.enabled && wx.data)        addWeatherLayer(map, wx.data);       else removeWeatherLayer(map)
      if (fire.enabled && fire.data)    addWildfireLayer(map, fire.data);    else removeWildfireLayer(map)
      if (aq.enabled && aq.data)        addAirQualityLayer(map, aq.data);    else removeAirQualityLayer(map)
      if (fema.enabled && fema.fipsSet) addFemaLayer(map, fema.fipsSet);     else removeFemaLayer(map)
    }
    if (map.isStyleLoaded() && map.getLayer('counties-fill')) sync()
    else map.once('idle', sync)
  }, [mapReady, overlays])

  return <div ref={containerRef} className="map-container" />
}
