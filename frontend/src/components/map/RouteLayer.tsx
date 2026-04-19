import { useEffect } from 'react'
import type { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl'
import { useFleetStore } from '../../store/fleetStore'

interface RouteLayerProps {
  map: MapboxMap
}

export function RouteLayer({ map }: RouteLayerProps) {
  const drivers = useFleetStore((s) => s.drivers)
  const selectedDriverId = useFleetStore((s) => s.selectedDriverId)

  useEffect(() => {
    if (!selectedDriverId) {
      removeAllRouteLayers(map)
      return
    }

    const driver = drivers.find((d) => d.driver_id === selectedDriverId)
    if (!driver?.current_load) {
      removeAllRouteLayers(map)
      return
    }

    removeAllRouteLayers(map)

    const coords: [number, number][] = [
      [driver.location.lng, driver.location.lat],
      [driver.location.lng + (Math.random() - 0.5) * 4, driver.location.lat + (Math.random() - 0.5) * 2],
      [driver.location.lng + (Math.random() - 0.5) * 8, driver.location.lat + (Math.random() - 0.5) * 4],
    ]

    const sourceId = 'active-route'
    const glowId = 'active-route-glow'
    const coreId = 'active-route-core'

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: {},
        },
      })
    } else {
      ;(map.getSource(sourceId) as GeoJSONSource).setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {},
      })
    }

    if (!map.getLayer(glowId)) {
      map.addLayer({
        id: glowId,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#f59e0b', 'line-width': 10, 'line-opacity': 0.15, 'line-blur': 4 },
      })
    }
    if (!map.getLayer(coreId)) {
      map.addLayer({
        id: coreId,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#f59e0b', 'line-width': 3, 'line-opacity': 0.9 },
      })
    }
  }, [selectedDriverId, drivers])

  return null
}

function removeAllRouteLayers(map: MapboxMap) {
  for (const id of ['active-route-glow', 'active-route-core']) {
    if (map.getLayer(id)) map.removeLayer(id)
  }
  if (map.getSource('active-route')) map.removeSource('active-route')
}
