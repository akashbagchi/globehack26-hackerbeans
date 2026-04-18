import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { useFleetStore } from '../../store/fleetStore'
import type { Driver } from '../../types'

const STATUS_COLORS = {
  driving: '#f59e0b',
  idle: '#eab308',
  off_duty: '#6b7280',
}

function createTruckElement(driver: Driver, isSelected: boolean): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'truck-marker'
  el.style.cssText = `
    width: 40px;
    height: 40px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.3s ease;
    transform: rotate(${driver.location.heading}deg);
  `

  const color = STATUS_COLORS[driver.status]
  const glow = driver.status === 'driving' ? `drop-shadow(0 0 8px ${color})` : 'none'
  const pulse = driver.status === 'driving' ? 'truck-pulse' : ''

  el.innerHTML = `
    <div class="${pulse}" style="
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: ${isSelected ? 'rgba(245,158,11,0.2)' : 'rgba(0,0,0,0.5)'};
      border: 2px solid ${isSelected ? color : 'transparent'};
      filter: ${glow};
      transition: all 0.3s ease;
    ">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
      </svg>
    </div>
  `
  return el
}

interface TruckMarkersProps {
  map: mapboxgl.Map
}

export function TruckMarkers({ map }: TruckMarkersProps) {
  const drivers = useFleetStore((s) => s.drivers)
  const selectedDriverId = useFleetStore((s) => s.selectedDriverId)
  const setSelectedDriver = useFleetStore((s) => s.setSelectedDriver)
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({})

  useEffect(() => {
    const existing = new Set(Object.keys(markersRef.current))

    for (const driver of drivers) {
      const isSelected = driver.driver_id === selectedDriverId
      const el = createTruckElement(driver, isSelected)

      el.addEventListener('click', () => {
        setSelectedDriver(driver.driver_id === selectedDriverId ? null : driver.driver_id)
      })

      if (markersRef.current[driver.driver_id]) {
        markersRef.current[driver.driver_id].remove()
      }

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([driver.location.lng, driver.location.lat])
        .addTo(map)

      markersRef.current[driver.driver_id] = marker
      existing.delete(driver.driver_id)
    }

    for (const id of existing) {
      markersRef.current[id]?.remove()
      delete markersRef.current[id]
    }
  }, [drivers, selectedDriverId])

  useEffect(() => {
    return () => {
      Object.values(markersRef.current).forEach((m) => m.remove())
    }
  }, [])

  return null
}
