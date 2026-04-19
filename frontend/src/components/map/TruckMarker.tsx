import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { useFleetStore } from '../../store/fleetStore'
import type { Driver } from '../../types'

const STATUS_COLOR: Record<string, string> = {
  driving: '#10b981',
  idle: '#f59e0b',
  off_duty: '#94a3b8',
}

interface TruckMarkersProps {
  map: mapboxgl.Map
}

export function TruckMarkers({ map }: TruckMarkersProps) {
  const drivers = useFleetStore((s) => s.drivers)
  const selectedDriverId = useFleetStore((s) => s.selectedDriverId)
  const setSelectedDriver = useFleetStore((s) => s.setSelectedDriver)

  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())

  useEffect(() => {
    const activeIds = new Set(drivers.map((d) => d.driver_id))

    // Remove stale markers
    for (const [id, marker] of markersRef.current) {
      if (!activeIds.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    }

    for (const driver of drivers) {
      const isSelected = driver.driver_id === selectedDriverId
      const color = STATUS_COLOR[driver.status] ?? '#94a3b8'

      if (!markersRef.current.has(driver.driver_id)) {
        const el = createMarkerEl(driver, color, isSelected)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          setSelectedDriver(driver.driver_id === selectedDriverId ? null : driver.driver_id)
        })
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([driver.location.lng, driver.location.lat])
          .addTo(map)
        markersRef.current.set(driver.driver_id, marker)
      } else {
        const marker = markersRef.current.get(driver.driver_id)!
        marker.setLngLat([driver.location.lng, driver.location.lat])
        updateMarkerEl(marker.getElement(), driver, color, isSelected)
      }
    }
  }, [drivers, selectedDriverId])

  useEffect(() => {
    return () => {
      for (const marker of markersRef.current.values()) marker.remove()
      markersRef.current.clear()
    }
  }, [])

  return null
}

function createMarkerEl(driver: Driver, color: string, isSelected: boolean): HTMLDivElement {
  const el = document.createElement('div')
  applyStyles(el, driver, color, isSelected)
  return el
}

function updateMarkerEl(el: HTMLElement, driver: Driver, color: string, isSelected: boolean) {
  applyStyles(el as HTMLDivElement, driver, color, isSelected)
}

function applyStyles(el: HTMLDivElement, driver: Driver, color: string, isSelected: boolean) {
  const size = isSelected ? 16 : 10
  const pulse = driver.status === 'driving'

  // Set individual properties — never cssText — so we don't clobber the
  // `transform: translate(...)` that Mapbox injects on this same element.
  el.style.width = `${size}px`
  el.style.height = `${size}px`
  el.style.borderRadius = '50%'
  el.style.background = color
  el.style.border = `${isSelected ? '2.5px' : '1.5px'} solid white`
  el.style.boxShadow = isSelected
    ? `0 0 0 2px ${color}66, 0 1px 4px rgba(0,0,0,0.4)`
    : '0 1px 3px rgba(0,0,0,0.35)'
  el.style.cursor = 'pointer'
  el.style.animation = pulse ? 'markerPulse 2s ease-in-out infinite' : 'none'
  el.style.transition = 'width 0.15s, height 0.15s, box-shadow 0.15s'
  // Dot only — no inner content needed
  while (el.firstChild) el.removeChild(el.firstChild)
}
