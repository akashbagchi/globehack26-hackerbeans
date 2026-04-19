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
  const size = isSelected ? 36 : 28
  const pulse = driver.status === 'driving'

  el.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    border-radius: 50%;
    background: ${color};
    border: ${isSelected ? '3px' : '2px'} solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.35)${isSelected ? `, 0 0 0 3px ${color}55` : ''};
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: ${pulse ? 'markerPulse 2s ease-in-out infinite' : 'none'};
    transition: width 0.15s, height 0.15s;
    transform: rotate(${driver.location.heading}deg);
  `

  el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
  </svg>`
}
