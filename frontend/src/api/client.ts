'use client'
import { createClient } from '@insforge/sdk'
import type { Driver, DriverRecommendation, InsightCard, CostChartEntry, SimulationResult, ChatMessage, TelemetryPosition, RouteDeviation, GeoJSONFeature } from '../types'

export function getToken(): string | null {
  try {
    const raw = localStorage.getItem('sauron-auth')
    return raw ? JSON.parse(raw)?.state?.token ?? null : null
  } catch { return null }
}

const insforge = createClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
})

function normalizeDriver(raw: Partial<Driver> & Record<string, any>): Driver {
  const status = raw.status ?? 'unavailable'
  const currentLoad = raw.current_load ?? null

  return {
    ...raw,
    status,
    current_load: currentLoad,
    certifications: raw.certifications ?? [],
    endorsements: raw.endorsements ?? [],
    contract_constraints: {
      max_deadhead_miles: raw.contract_constraints?.max_deadhead_miles ?? 0,
      preferred_regions: raw.contract_constraints?.preferred_regions ?? [],
      excluded_cargo_types: raw.contract_constraints?.excluded_cargo_types ?? [],
    },
    availability_window: {
      available_from: raw.availability_window?.available_from ?? new Date().toISOString(),
      available_until: raw.availability_window?.available_until ?? new Date().toISOString(),
    },
    readiness: {
      state: raw.readiness?.state ?? (currentLoad ? 'assigned' : status === 'idle' ? 'ready' : 'unknown'),
      score: raw.readiness?.score ?? (currentLoad ? 60 : status === 'idle' ? 85 : 40),
      blocker_reasons: raw.readiness?.blocker_reasons ?? [],
      available_at: raw.readiness?.available_at ?? currentLoad?.eta ?? null,
    },
    vehicle: {
      ...raw.vehicle,
      capacity_lbs: raw.vehicle?.capacity_lbs ?? 0,
      cab_type: raw.vehicle?.cab_type ?? 'unknown',
      trailer_type: raw.vehicle?.trailer_type ?? 'unknown',
      trailer_length_ft: raw.vehicle?.trailer_length_ft ?? 0,
      refrigerated: raw.vehicle?.refrigerated ?? false,
      maintenance_ready: raw.vehicle?.maintenance_ready ?? true,
      hazmat_permitted: raw.vehicle?.hazmat_permitted ?? false,
    },
  } as Driver
}

export async function loginDispatcher(email: string, password: string) {
  const { data, error } = await insforge.functions.invoke('auth-login', {
    body: { email, password },
  })
  if (error) throw new Error('Invalid email or password')
  if (data?.error) throw new Error(data.error)
  return data
}

export async function fetchDrivers(): Promise<{ drivers: Driver[]; source: string }> {
  const { data, error } = await insforge.database.from('drivers').select()
  if (error) throw new Error(String(error))
  return { drivers: (data ?? []).map((driver) => normalizeDriver(driver as Record<string, any>)), source: 'insforge' }
}

export async function fetchDispatchRecommendations(payload: {
  pickup: string
  destination: string
  cargo: string
  weight_lbs: number
}): Promise<{ recommendations: DriverRecommendation[]; dispatch_note: string }> {
  const { data, error } = await insforge.functions.invoke('dispatch-recommend', { body: payload })
  if (error) throw new Error(String(error))
  return data.data
}

export async function fetchCostInsights(): Promise<{
  chart_data: CostChartEntry[]
  insights: InsightCard[]
}> {
  const { data, error } = await insforge.functions.invoke('cost-insights')
  if (error) throw new Error(String(error))
  return data.data
}

export async function fetchSimulation(payload: {
  driver_id: string
  pickup: string
  destination: string
}): Promise<SimulationResult> {
  const { data, error } = await insforge.functions.invoke('simulate-assignment', { body: payload })
  if (error) throw new Error(String(error))
  return data.data
}

export async function fetchTelemetryPositions(): Promise<Record<string, TelemetryPosition>> {
  const { data, error } = await insforge.database.from('telemetry_positions').select()
  if (error) throw new Error(String(error))
  const result: Record<string, TelemetryPosition> = {}
  for (const row of data ?? []) {
    result[row.driver_id as string] = row as unknown as TelemetryPosition
  }
  return result
}

export async function fetchTelemetryRoutes(opts?: { raw?: boolean }): Promise<any> {
  const { data, error } = await insforge.database.from('driver_routes').select()
  if (error) throw new Error(String(error))
  if (opts?.raw) return data ?? []
  const result: Record<string, GeoJSONFeature> = {}
  for (const row of data ?? []) {
    result[row.driver_id as string] = row.geojson as unknown as GeoJSONFeature
  }
  return result
}

export async function fetchTelemetryDeviations(): Promise<RouteDeviation[]> {
  const { data, error } = await insforge.database.from('route_deviations').select()
  if (error) throw new Error(String(error))
  return (data ?? []) as unknown as RouteDeviation[]
}

function buildFleetSummary(drivers: Driver[]): string {
  return drivers.map(d => {
    const loadInfo = d.current_load
      ? `en route ${d.current_load.origin}→${d.current_load.destination}`
      : 'no load'
    const certs = [...new Set([...(d.certifications ?? []), ...(d.endorsements ?? [])])].join(', ') || 'standard'
    return `- ${d.name} (${d.driver_id}): ${d.status}, ${d.location.city} ${d.location.state}, ` +
      `HOS ${d.hos.drive_remaining_hrs}h remain, fuel ${d.vehicle.fuel_level_pct}%, ` +
      `$${d.economics.cost_per_mile}/mi, readiness ${d.readiness?.state ?? 'unknown'} (${d.readiness?.score ?? 0}), ` +
      `capacity ${d.vehicle.capacity_lbs} lbs, certs [${certs}], ${loadInfo}`
  }).join('\n')
}

export function streamChat(
  messages: ChatMessage[],
  drivers: Driver[],
  onToken: (token: string) => void,
  onDone: () => void,
): () => void {
  const controller = new AbortController()
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL!
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!
  const timestamp = new Date().toUTCString()
  const fleetText = buildFleetSummary(drivers)

  const systemContent =
    'You are Sauron, the AI brain of a real-time fleet management system. ' +
    'You have full situational awareness of all drivers: location, HOS, fuel, current loads. ' +
    'Answer dispatcher questions with precision. Use markdown: **bold driver names**, ' +
    'bullet lists for rankings. Be concise — dispatchers are busy.'

  // Prepend fleet snapshot to first user message, matching original FastAPI behaviour
  const apiMessages = messages.map((m, i) => {
    if (i === 0 && m.role === 'user') {
      return {
        role: 'user' as const,
        content: `Live Fleet Snapshot (as of ${timestamp}):\n${fleetText}\n\n${m.content}`,
      }
    }
    return { role: m.role as 'user' | 'assistant', content: m.content }
  })

  fetch(`${baseUrl}/api/ai/chat/completion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4.5',
      stream: true,
      messages: [{ role: 'system', content: systemContent }, ...apiMessages],
    }),
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.body) { onDone(); return }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) { onDone(); break }
      for (const line of decoder.decode(value).split('\n')) {
        if (!line.startsWith('data: ')) continue
        try {
          const json = JSON.parse(line.slice(6))
          if (json.chunk) onToken(json.chunk)
          if (json.done) { onDone(); return }
        } catch { /* partial line */ }
      }
    }
  }).catch(() => { onDone() })

  return () => controller.abort()
}
