import axios from 'axios'
import type { Driver, DriverRecommendation, InsightCard, CostChartEntry, SimulationResult, ChatMessage } from '../types'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  timeout: 30000,
})

export async function fetchDrivers(): Promise<{ drivers: Driver[]; source: string }> {
  const res = await api.get('/fleet/drivers')
  return { drivers: res.data.data, source: res.data.source }
}

export async function fetchDispatchRecommendations(payload: {
  pickup: string
  destination: string
  cargo: string
  weight_lbs: number
}): Promise<{ recommendations: DriverRecommendation[]; dispatch_note: string }> {
  const res = await api.post('/dispatch/recommend', payload)
  return res.data.data
}

export async function fetchCostInsights(): Promise<{
  chart_data: CostChartEntry[]
  insights: InsightCard[]
}> {
  const res = await api.get('/dispatch/cost-insights')
  return res.data.data
}

export async function fetchSimulation(payload: {
  driver_id: string
  pickup: string
  destination: string
}): Promise<SimulationResult> {
  const res = await api.post('/simulate/assignment', payload)
  return res.data.data
}

export function streamChat(messages: ChatMessage[], onToken: (token: string) => void): () => void {
  const controller = new AbortController()
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  fetch(`${baseUrl}/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.body) return
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const token = line.slice(6)
          if (token !== '[DONE]') onToken(token)
        }
      }
    }
  }).catch(() => {})

  return () => controller.abort()
}
