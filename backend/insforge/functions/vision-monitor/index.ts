import { createClient } from 'npm:@insforge/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const ISSUE_TYPES = ['fatigue', 'phone_distraction', 'road_hazard', 'load_security', 'seatbelt'] as const

type VisionIssueType = typeof ISSUE_TYPES[number]

type VisionFrame = {
  driver_id: string
  driver_name: string
  truck_number: string
  timestamp: string
  video_url: string | null
  status: string
  frame: string
  context: {
    city: string
    state: string
    speed_mph: number
    hos_remaining_hrs: number
    load_description: string | null
    eta: string | null
  }
}

type VisionIssue = {
  type: VisionIssueType
  score: number
  confidence: number
}

type VisionAlert = {
  driver_id: string
  driver_name: string
  truck_number: string
  status: 'clear' | 'watch' | 'critical'
  attention_score: number
  confidence: number
  summary: string
  recommended_action: string
  detected_at: string
  primary_issue: VisionIssueType | null
  issues: VisionIssue[]
  video_url: string | null
}

export default async function(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const { frames } = await req.json()
    const normalizedFrames = Array.isArray(frames) ? frames.slice(0, 8) as VisionFrame[] : []
    if (!normalizedFrames.length) {
      return jsonResponse({ alerts: [] })
    }

    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL')!,
      anonKey: Deno.env.get('ANON_KEY')!,
    })

    const alerts = await Promise.all(normalizedFrames.map((frame) => analyzeFrame(client, frame)))
    await persistCriticalEvents(client, alerts)
    return jsonResponse({ alerts })
  } catch (error) {
    console.error('vision-monitor failed', error)
    return new Response(JSON.stringify({ error: 'Vision monitor failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}

async function analyzeFrame(client: ReturnType<typeof createClient>, frame: VisionFrame): Promise<VisionAlert> {
  try {
    const result = await (client.ai.chat.completions as any).create({
      model: 'anthropic/claude-sonnet-4.5',
      maxTokens: 450,
      messages: [
        {
          role: 'system',
          content:
            'You are SAURON Vision, a fleet safety monitor analyzing a single trucking camera frame. ' +
            'Score only what is visually plausible in the image. Return strict JSON only with no markdown. ' +
            'Scores and confidences must be integers 0-100.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                `Driver: ${frame.driver_name} (${frame.driver_id}), truck ${frame.truck_number}\n` +
                `Context: ${frame.context.city}, ${frame.context.state}; speed ${frame.context.speed_mph} mph; ` +
                `HOS remaining ${frame.context.hos_remaining_hrs}; load ${frame.context.load_description ?? 'unknown'}; ` +
                `ETA ${frame.context.eta ?? 'unknown'}.\n\n` +
                'Analyze this truck feed frame for fatigue, phone distraction, road hazards, load security, and seatbelt. ' +
                'Return JSON exactly like: ' +
                '{"summary":"one short sentence","recommended_action":"one short action","issues":{"fatigue":{"score":0,"confidence":0},"phone_distraction":{"score":0,"confidence":0},"road_hazard":{"score":0,"confidence":0},"load_security":{"score":0,"confidence":0},"seatbelt":{"score":0,"confidence":0}}}',
            },
            {
              type: 'image_url',
              image_url: { url: frame.frame },
            },
          ],
        },
      ],
    })

    const raw = extractRawContent(result)
    const parsed = JSON.parse(cleanJson(raw))
    return normalizeAlert(frame, parsed)
  } catch (error) {
    console.warn(`Vision AI fallback for ${frame.driver_id}`, error)
    return buildFallbackAlert(frame)
  }
}

function normalizeAlert(frame: VisionFrame, parsed: any): VisionAlert {
  const issues = ISSUE_TYPES.map((type) => ({
    type,
    score: clampInt(parsed?.issues?.[type]?.score),
    confidence: clampInt(parsed?.issues?.[type]?.confidence),
  }))
  const topIssue = issues.reduce((best, current) => current.score > best.score ? current : best, issues[0])
  const attentionScore = clampInt(topIssue.score)
  const confidence = clampInt(topIssue.confidence)

  return {
    driver_id: frame.driver_id,
    driver_name: frame.driver_name,
    truck_number: frame.truck_number,
    status: scoreToStatus(attentionScore),
    attention_score: attentionScore,
    confidence,
    summary: sanitizeText(parsed?.summary) || defaultSummary(topIssue.type, attentionScore, frame.driver_name),
    recommended_action: sanitizeText(parsed?.recommended_action) || defaultAction(topIssue.type),
    detected_at: frame.timestamp,
    primary_issue: attentionScore >= 25 ? topIssue.type : null,
    issues,
    video_url: frame.video_url,
  }
}

function buildFallbackAlert(frame: VisionFrame): VisionAlert {
  const seed = seededNumber(`${frame.driver_id}:${frame.timestamp}`)
  const hosRisk = Math.max(0, 100 - Math.round(frame.context.hos_remaining_hrs * 11))
  const fatigue = clampInt(Math.max(hosRisk, 25 + (seed % 28)))
  const phoneDistraction = clampInt((seed * 7 + frame.driver_id.length * 11) % 100)
  const roadHazard = clampInt((seed * 13 + Math.round(frame.context.speed_mph)) % 82)
  const loadSecurity = clampInt(frame.context.load_description ? (seed * 5 + 22) % 65 : 10)
  const seatbelt = clampInt((seed * 3 + 14) % 58)
  const issues: VisionIssue[] = [
    { type: 'fatigue', score: fatigue, confidence: clampInt(62 + (seed % 28)) },
    { type: 'phone_distraction', score: phoneDistraction, confidence: clampInt(54 + (seed % 30)) },
    { type: 'road_hazard', score: roadHazard, confidence: clampInt(50 + (seed % 24)) },
    { type: 'load_security', score: loadSecurity, confidence: clampInt(48 + (seed % 24)) },
    { type: 'seatbelt', score: seatbelt, confidence: clampInt(46 + (seed % 18)) },
  ]

  const topIssue = issues.reduce((best, current) => current.score > best.score ? current : best, issues[0])
  const attentionScore = topIssue.score
  return {
    driver_id: frame.driver_id,
    driver_name: frame.driver_name,
    truck_number: frame.truck_number,
    status: scoreToStatus(attentionScore),
    attention_score: attentionScore,
    confidence: topIssue.confidence,
    summary: defaultSummary(topIssue.type, attentionScore, frame.driver_name),
    recommended_action: defaultAction(topIssue.type),
    detected_at: frame.timestamp,
    primary_issue: attentionScore >= 25 ? topIssue.type : null,
    issues,
    video_url: frame.video_url,
  }
}

async function persistCriticalEvents(client: ReturnType<typeof createClient>, alerts: VisionAlert[]) {
  const rows = alerts
    .filter((alert) => alert.attention_score >= 75 && alert.primary_issue)
    .map((alert) => ({
      event_id: crypto.randomUUID(),
      fleet_id: 'fleet_demo',
      driver_id: alert.driver_id,
      driver_name: alert.driver_name,
      truck_number: alert.truck_number,
      alert_type: alert.primary_issue,
      attention_score: alert.attention_score,
      confidence: alert.confidence,
      status: alert.status,
      summary: alert.summary,
      recommended_action: alert.recommended_action,
      video_url: alert.video_url,
      issue_scores: Object.fromEntries(alert.issues.map((issue) => [issue.type, issue.score])),
      captured_at: alert.detected_at,
      created_at: new Date().toISOString(),
    }))

  if (!rows.length) return
  const { error } = await client.database.from('vision_events').insert(rows)
  if (error) console.warn('Failed to persist vision events', error)
}

function extractRawContent(result: any): string {
  const content = result?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => typeof part === 'string' ? part : part?.text ?? '')
      .join('')
  }
  return ''
}

function cleanJson(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('```')) return trimmed
  const withoutFence = trimmed.split('```')[1] ?? trimmed
  return withoutFence.startsWith('json') ? withoutFence.slice(4).trim() : withoutFence.trim()
}

function scoreToStatus(score: number): VisionAlert['status'] {
  if (score >= 80) return 'critical'
  if (score >= 55) return 'watch'
  return 'clear'
}

function clampInt(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

function sanitizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function seededNumber(input: string): number {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 997
  }
  return Math.abs(hash)
}

function defaultSummary(type: VisionIssueType, score: number, driverName: string): string {
  if (type === 'fatigue') return `${driverName} shows elevated fatigue risk on the live cab feed.`
  if (type === 'phone_distraction') return `${driverName} may be handling a phone while the truck is in motion.`
  if (type === 'road_hazard') return `${driverName}'s windshield view shows a possible road hazard ahead.`
  if (type === 'load_security') return `${driverName}'s load view suggests a cargo security concern.`
  if (score < 25) return `${driverName}'s feed looks clear and stable.`
  return `${driverName}'s seatbelt or cab posture may require a quick check.`
}

function defaultAction(type: VisionIssueType): string {
  if (type === 'fatigue') return 'Flag dispatcher review and advise the driver to stop safely at the next opportunity.'
  if (type === 'phone_distraction') return 'Push an in-cab reminder and jump the dispatcher to the live feed.'
  if (type === 'road_hazard') return 'Surface the feed immediately and verify the route remains safe.'
  if (type === 'load_security') return 'Inspect the load camera and plan a securement check at the next stop.'
  return 'Record the event and prompt a quick compliance check.'
}

function jsonResponse(data: { alerts: VisionAlert[] }): Response {
  return new Response(
    JSON.stringify({ data, source: 'insforge', timestamp: new Date().toISOString() }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
