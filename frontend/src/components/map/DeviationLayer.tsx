import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { Map as MapboxMap } from 'mapbox-gl'
import { useFleetStore } from '../../store/fleetStore'

interface DeviationLayerProps {
  map: MapboxMap
}

export function DeviationLayer({ map }: DeviationLayerProps) {
  const deviations = useFleetStore((s) => s.deviations)
  const markersRef = useRef<mapboxgl.Marker[]>([])

  useEffect(() => {
    // Remove previous markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    const active = deviations.filter((d) => !d.resolved)
    active.forEach((dev) => {
      const el = document.createElement('div')
      el.className = 'deviation-marker'
      const isMajor = dev.severity === 'major'
      el.style.cssText = `
        width: 20px; height: 20px; border-radius: 50%;
        background: ${isMajor ? '#ef4444' : '#f97316'};
        border: 2px solid white;
        box-shadow: 0 0 0 3px ${isMajor ? 'rgba(239,68,68,0.4)' : 'rgba(249,115,22,0.4)'};
        cursor: pointer;
        animation: deviation-pulse 1.5s ease-in-out infinite;
      `

      const popup = new mapboxgl.Popup({ offset: 14, closeButton: false })
        .setHTML(`
          <div style="font-family:monospace;font-size:11px;color:#111;padding:6px 8px;line-height:1.6">
            <strong style="color:${isMajor ? '#dc2626' : '#ea580c'}">${isMajor ? '⚠ MAJOR' : '● MINOR'} DEVIATION</strong><br/>
            <b>${dev.driver_name}</b> · ${dev.load_id}<br/>
            ${dev.deviation_miles} mi off planned route<br/>
            <span style="color:#666">${new Date(dev.detected_at).toLocaleTimeString()}</span>
          </div>
        `)

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([dev.lng, dev.lat])
        .setPopup(popup)
        .addTo(map)

      markersRef.current.push(marker)
    })

    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
    }
  }, [deviations, map])

  return null
}
