/**
 * GeofenceMap.jsx — Map centered on the gym with allowed radius circle.
 * Shows the employee's live GPS when available (like the reference "Start" screen).
 */

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icons under Vite bundling
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

export default function GeofenceMap({ gym, userLocation, insideGeofence }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const userMarkerRef = useRef(null)
  const circleRef = useRef(null)

  // Create map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !gym) return

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([gym.latitude, gym.longitude], 16)

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map)

    // Gym pin
    L.marker([gym.latitude, gym.longitude]).addTo(map)

    // Allowed radius
    circleRef.current = L.circle([gym.latitude, gym.longitude], {
      radius: gym.radius_meters,
      color: '#22c55e',
      fillColor: '#22c55e',
      fillOpacity: 0.18,
      weight: 2,
    }).addTo(map)

    mapRef.current = map

    // Invalidate size after layout (mobile card)
    setTimeout(() => map.invalidateSize(), 100)

    return () => {
      map.remove()
      mapRef.current = null
      userMarkerRef.current = null
      circleRef.current = null
    }
  }, [gym])

  // Update user marker + circle color when location / inside status changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !gym) return

    if (circleRef.current) {
      circleRef.current.setStyle({
        color: insideGeofence ? '#22c55e' : '#f59e0b',
        fillColor: insideGeofence ? '#22c55e' : '#f59e0b',
      })
    }

    if (!userLocation) return

    const latlng = [userLocation.lat, userLocation.long]

    if (!userMarkerRef.current) {
      const avatar = L.divIcon({
        className: 'user-map-marker',
        html: `<div class="user-map-dot ${insideGeofence ? 'is-inside' : 'is-outside'}"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })
      userMarkerRef.current = L.marker(latlng, { icon: avatar }).addTo(map)
    } else {
      userMarkerRef.current.setLatLng(latlng)
      const el = userMarkerRef.current.getElement()
      if (el) {
        const dot = el.querySelector('.user-map-dot')
        if (dot) {
          dot.classList.toggle('is-inside', !!insideGeofence)
          dot.classList.toggle('is-outside', !insideGeofence)
        }
      }
    }

    // Keep both gym + user in view
    const bounds = L.latLngBounds([
      [gym.latitude, gym.longitude],
      latlng,
    ])
    map.fitBounds(bounds.pad(0.4), { maxZoom: 17 })
  }, [userLocation, insideGeofence, gym])

  if (!gym) {
    return <div className="map-shell map-shell--loading">Loading map…</div>
  }

  return (
    <div className="map-shell">
      <div ref={containerRef} className="map-canvas" />
      <div className="map-chip">
        {insideGeofence
          ? 'Inside clock-in zone'
          : userLocation
            ? 'Outside zone — move closer'
            : 'Finding your location…'}
      </div>
    </div>
  )
}
