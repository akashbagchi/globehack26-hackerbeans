import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { useFleetStore } from '../../store/fleetStore'

interface GhostRouteLayerProps {
  map: mapboxgl.Map
}

const GHOST_SOURCE = 'ghost-route'
const GHOST_GLOW = 'ghost-route-glow'
const GHOST_CORE = 'ghost-route-core'

export function GhostRouteLayer({ map }: GhostRouteLayerProps) {
  const simulatedRoute = useFleetStore((s) => s.simulatedRoute)

  useEffect(() => {
    if (!simulatedRoute) {
      removeGhostLayers(map)
      return
    }

    if (!map.getSource(GHOST_SOURCE)) {
      map.addSource(GHOST_SOURCE, { type: 'geojson', data: simulatedRoute as GeoJSON.Feature })
    } else {
      ;(map.getSource(GHOST_SOURCE) as mapboxgl.GeoJSONSource).setData(simulatedRoute as GeoJSON.Feature)
    }

    if (!map.getLayer(GHOST_GLOW)) {
      map.addLayer({
        id: GHOST_GLOW,
        type: 'line',
        source: GHOST_SOURCE,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#818cf8', 'line-width': 8, 'line-opacity': 0.15, 'line-blur': 4 },
      })
    }
    if (!map.getLayer(GHOST_CORE)) {
      map.addLayer({
        id: GHOST_CORE,
        type: 'line',
        source: GHOST_SOURCE,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#818cf8',
          'line-width': 3,
          'line-opacity': 0.75,
          'line-dasharray': [3, 4],
        },
      })
    }
  }, [simulatedRoute])

  return null
}

function removeGhostLayers(map: mapboxgl.Map) {
  for (const id of [GHOST_GLOW, GHOST_CORE]) {
    if (map.getLayer(id)) map.removeLayer(id)
  }
  if (map.getSource(GHOST_SOURCE)) map.removeSource(GHOST_SOURCE)
}
