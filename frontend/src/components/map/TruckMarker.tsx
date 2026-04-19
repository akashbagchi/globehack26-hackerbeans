import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { useFleetStore } from '../../store/fleetStore'
import type { Driver } from '../../types'

const STATUS_COLOR: Record<string, string> = {
  driving: '#10b981',
  idle: '#f59e0b',
  off_duty: '#94a3b8',
  unavailable: '#f97316',
  breakdown: '#ef4444',
}

interface TruckMarkersProps {
  map: mapboxgl.Map
}

export function TruckMarkers({ map }: TruckMarkersProps) {
  const drivers = useFleetStore((s) => s.drivers)
  const selectedDriverId = useFleetStore((s) => s.selectedDriverId)
  const setSelectedDriver = useFleetStore((s) => s.setSelectedDriver)
  const visionByDriver = useFleetStore((s) => s.visionByDriver)

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
      const vision = visionByDriver[driver.driver_id]

      if (!markersRef.current.has(driver.driver_id)) {
        const el = createMarkerEl(driver, color, isSelected, vision?.attention_score ?? 0)
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
        updateMarkerEl(marker.getElement(), driver, color, isSelected, vision?.attention_score ?? 0)
      }
    }
  }, [drivers, selectedDriverId, visionByDriver])

  useEffect(() => {
    return () => {
      for (const marker of markersRef.current.values()) marker.remove()
      markersRef.current.clear()
    }
  }, [])

  return null
}

function createMarkerEl(driver: Driver, color: string, isSelected: boolean, attentionScore: number): HTMLDivElement {
  const el = document.createElement('div')
  applyStyles(el, driver, color, isSelected, attentionScore)
  return el
}

function updateMarkerEl(el: HTMLElement, driver: Driver, color: string, isSelected: boolean, attentionScore: number) {
  applyStyles(el as HTMLDivElement, driver, color, isSelected, attentionScore)
}

function applyStyles(el: HTMLDivElement, driver: Driver, color: string, isSelected: boolean, attentionScore: number) {
  const riskHalo = attentionScore >= 80 ? 'rgba(239, 68, 68, 0.55)' : attentionScore >= 55 ? 'rgba(249, 115, 22, 0.45)' : attentionScore >= 25 ? 'rgba(251, 191, 36, 0.35)' : null
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
    ? `0 0 0 2px ${color}66${riskHalo ? `, 0 0 0 10px ${riskHalo}` : ''}, 0 1px 4px rgba(0,0,0,0.4)`
    : `${riskHalo ? `0 0 0 8px ${riskHalo}, ` : ''}0 1px 3px rgba(0,0,0,0.35)`
  el.style.cursor = 'pointer'
  el.style.animation = riskHalo ? 'markerPulse 1.3s ease-in-out infinite' : pulse ? 'markerPulse 2s ease-in-out infinite' : 'none'
  el.style.transition = 'width 0.15s, height 0.15s, box-shadow 0.15s'
  // Dot only — no inner content needed
  while (el.firstChild) el.removeChild(el.firstChild)
}
