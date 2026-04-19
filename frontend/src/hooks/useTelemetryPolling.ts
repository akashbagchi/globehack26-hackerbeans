import { useEffect, useRef } from 'react'
import { fetchTelemetryRoutes, fetchTelemetryDeviations } from '../api/client'
import { useFleetStore } from '../store/fleetStore'
import type { GeoJSONFeature } from '../types'

const TICK_MS = 5000         // interpolate every 5 s
const SPEED_MULTIPLIER = 60  // 60× real-time

interface RouteRow {
  driver_id: string
  geojson: GeoJSONFeature
  total_miles: number
  speed_mph: number
  progress_start: number
  sim_started_at: string
  dev_start: number
  dev_end: number
  dev_offset_lat: number
  dev_offset_lng: number
}

function interpolate(
  coords: [number, number][],
  progress: number,
): { lat: number; lng: number; heading: number } {
  if (coords.length < 2) return { lat: coords[0]?.[1] ?? 0, lng: coords[0]?.[0] ?? 0, heading: 0 }
  const n = coords.length - 1
  const idx = Math.min(progress * n, n - 0.001)
  const i = Math.floor(idx)
  const t = idx - i
  const [aLng, aLat] = coords[i]
  const [bLng, bLat] = coords[Math.min(i + 1, n)]
  const lat = aLat + t * (bLat - aLat)
  const lng = aLng + t * (bLng - aLng)
  const heading = Math.round(Math.atan2(bLng - aLng, bLat - aLat) * (180 / Math.PI) + 360) % 360
  return { lat, lng, heading }
}

export function useTelemetryPolling() {
  const patchPositions = useFleetStore((s) => s.patchPositions)
  const setDeviations = useFleetStore((s) => s.setDeviations)
  const setDriverRoutes = useFleetStore((s) => s.setDriverRoutes)

  const routesRef = useRef<RouteRow[]>([])
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        // Fetch routes once — they include all sim params
        const rawRoutes = await (fetchTelemetryRoutes as any)({ raw: true })
        if (!mounted) return
        routesRef.current = rawRoutes

        // Push GeoJSON into store for RouteLayer
        const routeMap: Record<string, GeoJSONFeature> = {}
        for (const row of rawRoutes) routeMap[row.driver_id] = row.geojson
        setDriverRoutes(routeMap)

        // Fetch pre-seeded deviations
        const devs = await fetchTelemetryDeviations()
        if (mounted) setDeviations(devs)
      } catch (e) {
        console.error('Telemetry init failed:', e)
      }
    }

    init()

    tickRef.current = setInterval(() => {
      const rows = routesRef.current
      if (!rows.length) return

      const now = Date.now()
      const patches: Record<string, { lat: number; lng: number; speed_mph: number; heading: number; route_progress_pct: number; timestamp: string }> = {}

      for (const row of rows) {
        const coords = row.geojson.geometry.coordinates as [number, number][]
        const elapsedHrs = (now - new Date(row.sim_started_at).getTime()) / 3_600_000
        const milesTraveled = SPEED_MULTIPLIER * elapsedHrs * row.speed_mph
        let progress = Math.min(1.0, row.progress_start + milesTraveled / row.total_miles)
        // Loop
        if (progress >= 1.0) progress = progress % 1.0

        const inDev = progress >= row.dev_start && progress <= row.dev_end
        const { lat: baseLat, lng: baseLng, heading } = interpolate(coords, progress)
        const lat = inDev ? baseLat + row.dev_offset_lat : baseLat
        const lng = inDev ? baseLng + row.dev_offset_lng : baseLng

        patches[row.driver_id] = {
          lat: parseFloat(lat.toFixed(6)),
          lng: parseFloat(lng.toFixed(6)),
          speed_mph: row.speed_mph,
          heading,
          route_progress_pct: parseFloat((progress * 100).toFixed(1)),
          timestamp: new Date(now).toISOString(),
        }
      }

      patchPositions(patches)
    }, TICK_MS)

    return () => {
      mounted = false
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [patchPositions, setDeviations, setDriverRoutes])
}
