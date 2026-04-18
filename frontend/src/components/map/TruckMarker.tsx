import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { useFleetStore } from '../../store/fleetStore'
import type { Driver } from '../../types'

const STATUS_COLORS: Record<string, string> = {
  driving: '#10b981',
  idle: '#f59e0b',
  off_duty: '#94a3b8',
}

function createMarkerEl(driver: Driver, isSelected: boolean): HTMLDivElement {
  const color = STATUS_COLORS[driver.status]
  const initials = driver.name.split(' ').map((n) => n[0]).join('')

  const el = document.createElement('div')
  el.style.cssText = `
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: ${isSelected ? color : 'white'};
    border: 3px solid ${color};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    color: ${isSelected ? 'white' : color};
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transition: all 0.2s ease;
    font-family: system-ui, sans-serif;
    ${driver.status === 'driving' ? 'animation: markerPulse 2s ease-in-out infinite;' : ''}
  `
  el.textContent = initials
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
      const el = createMarkerEl(driver, isSelected)
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        setSelectedDriver(driver.driver_id === selectedDriverId ? null : driver.driver_id)
      })

      markersRef.current[driver.driver_id]?.remove()

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

  useEffect(() => () => { Object.values(markersRef.current).forEach((m) => m.remove()) }, [])

  return null
}
