'use client'
import { createClient } from '@insforge/sdk'
import type { Driver, DriverRecommendation, InsightCard, CostChartEntry, SimulationResult, ChatMessage } from '../types'

const insforge = createClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
})

export async function fetchDrivers(): Promise<{ drivers: Driver[]; source: string }> {
  const { data, error } = await insforge.database.from('drivers').select()
  if (error) throw new Error(String(error))
  return { drivers: (data ?? []) as Driver[], source: 'insforge' }
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

function buildFleetSummary(drivers: Driver[]): string {
  return drivers.map(d => {
    const loadInfo = d.current_load
      ? `en route ${d.current_load.origin}→${d.current_load.destination}`
      : 'no load'
    return `- ${d.name} (${d.driver_id}): ${d.status}, ${d.location.city} ${d.location.state}, ` +
      `HOS ${d.hos.drive_remaining_hrs}h remain, fuel ${d.vehicle.fuel_level_pct}%, ` +
      `$${d.economics.cost_per_mile}/mi, ${loadInfo}`
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
