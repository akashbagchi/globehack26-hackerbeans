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

const LERP_DURATION_MS = 4800

interface MarkerState {
  marker: mapboxgl.Marker
  fromLng: number
  fromLat: number
  toLng: number
  toLat: number
  startTime: number | null
  rafId: number | null
}

interface TruckMarkersProps {
  map: mapboxgl.Map
}

export function TruckMarkers({ map }: TruckMarkersProps) {
  const drivers = useFleetStore((s) => s.drivers)
  const selectedDriverId = useFleetStore((s) => s.selectedDriverId)
  const setSelectedDriver = useFleetStore((s) => s.setSelectedDriver)
  const visionByDriver = useFleetStore((s) => s.visionByDriver)

  const statesRef = useRef<Map<string, MarkerState>>(new Map())

  useEffect(() => {
    const activeIds = new Set(drivers.map((d) => d.driver_id))

    // Remove stale markers
    for (const [id, state] of statesRef.current) {
      if (!activeIds.has(id)) {
        if (state.rafId !== null) cancelAnimationFrame(state.rafId)
        state.marker.remove()
        statesRef.current.delete(id)
      }
    }

    for (const driver of drivers) {
      const isSelected = driver.driver_id === selectedDriverId
      const color = STATUS_COLOR[driver.status] ?? '#94a3b8'
      const vision = visionByDriver[driver.driver_id]
      const { lng, lat } = driver.location

      if (!statesRef.current.has(driver.driver_id)) {
        const el = createMarkerEl(driver, color, isSelected, vision?.attention_score ?? 0)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          setSelectedDriver(driver.driver_id === selectedDriverId ? null : driver.driver_id)
        })
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(map)
        statesRef.current.set(driver.driver_id, {
          marker,
          fromLng: lng, fromLat: lat,
          toLng: lng, toLat: lat,
          startTime: null, rafId: null,
        })
      } else {
        const state = statesRef.current.get(driver.driver_id)!

        // Only start a new lerp if the target position actually changed
        const posChanged = state.toLng !== lng || state.toLat !== lat
        if (posChanged) {
          if (state.rafId !== null) cancelAnimationFrame(state.rafId)
          const current = state.marker.getLngLat()
          state.fromLng = current.lng
          state.fromLat = current.lat
          state.toLng = lng
          state.toLat = lat
          state.startTime = null

          function tick(ts: number) {
            if (state.startTime === null) state.startTime = ts
            const t = Math.min((ts - state.startTime) / LERP_DURATION_MS, 1)
            const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
            state.marker.setLngLat([
              state.fromLng + (state.toLng - state.fromLng) * ease,
              state.fromLat + (state.toLat - state.fromLat) * ease,
            ])
            if (t < 1) state.rafId = requestAnimationFrame(tick)
            else state.rafId = null
          }
          state.rafId = requestAnimationFrame(tick)
        }

        updateMarkerEl(state.marker.getElement(), driver, color, isSelected, vision?.attention_score ?? 0)
      }
    }
  }, [drivers, selectedDriverId, visionByDriver])

  useEffect(() => {
    return () => {
      for (const state of statesRef.current.values()) {
        if (state.rafId !== null) cancelAnimationFrame(state.rafId)
        state.marker.remove()
      }
      statesRef.current.clear()
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
