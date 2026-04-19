import { useRef, useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useMapbox } from '../../hooks/useMapbox'
import { useFleetStore } from '../../store/fleetStore'
import { useUIStore } from '../../store/uiStore'
import { TruckMarkers } from './TruckMarker'
import { TruckModelLayer } from './TruckModelLayer'
import { RouteLayer } from './RouteLayer'
import { GhostRouteLayer } from './GhostRouteLayer'
import { DeviationLayer } from './DeviationLayer'
import { VisionOverlay } from '../vision/VisionOverlay'

export function FleetMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useMapbox(containerRef)
  const mapReady = useUIStore((s) => s.mapReady)
  const selectedDriverId = useFleetStore((s) => s.selectedDriverId)
  const drivers = useFleetStore((s) => s.drivers)
  const simulationResult = useFleetStore((s) => s.simulationResult)
  const [map, setMap] = useState<mapboxgl.Map | null>(null)
  const hasMapboxToken = Boolean(
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN,
  )

  useEffect(() => {
    if (mapReady && mapRef.current) {
      setMap(mapRef.current)
    }
  }, [mapReady, mapRef])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedDriverId) return
    const driver = drivers.find((d) => d.driver_id === selectedDriverId)
    if (!driver) return
    mapRef.current.flyTo({
      center: [driver.location.lng, driver.location.lat],
      zoom: 8,
      duration: 1200,
      pitch: 45,
    })
  }, [selectedDriverId, mapReady, drivers, mapRef])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !simulationResult) return
    const { pickup_coords, destination_coords } = simulationResult
    const bounds = new mapboxgl.LngLatBounds()
    bounds.extend([pickup_coords.lng, pickup_coords.lat])
    bounds.extend([destination_coords.lng, destination_coords.lat])
    mapRef.current.fitBounds(bounds, { padding: 80, duration: 1500, pitch: 40 })
  }, [simulationResult, mapReady, mapRef])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {!hasMapboxToken && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0b1020] px-6 text-center">
          <div className="max-w-md rounded-3xl border border-[#24324f] bg-[#11182b]/90 p-6 text-white shadow-2xl">
            <p className="text-lg font-semibold">Map unavailable</p>
            <p className="mt-2 text-sm text-[#b9c4dd]">
              Set `NEXT_PUBLIC_MAPBOX_TOKEN` or `VITE_MAPBOX_TOKEN` in `frontend/.env` and restart the frontend.
            </p>
          </div>
        </div>
      )}
      {mapReady && map && (
        <>
          <TruckModelLayer map={map} />
          <TruckMarkers map={map} />
          <RouteLayer map={map} />
          <GhostRouteLayer map={map} />
          <DeviationLayer map={map} />
          <VisionOverlay />
        </>
      )}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => mapRef.current?.flyTo({ center: [-98.5795, 39.8283], zoom: 4, pitch: 45 })}
          className="w-9 h-9 bg-gray-900/80 backdrop-blur border border-gray-700 rounded-lg text-gray-400 hover:text-amber-400 hover:border-amber-400/50 transition-colors flex items-center justify-center text-xs font-bold"
          title="Fit fleet"
        >
          ⊞
        </button>
        <button
          onClick={() => mapRef.current?.resetNorth()}
          className="w-9 h-9 bg-gray-900/80 backdrop-blur border border-gray-700 rounded-lg text-gray-400 hover:text-amber-400 hover:border-amber-400/50 transition-colors flex items-center justify-center text-xs"
          title="Reset north"
        >
          ↑
        </button>
      </div>
    </div>
  )
}
