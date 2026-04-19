import { createClient } from 'npm:@insforge/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

type ProactiveNotifyInput = {
  driverId: string
  driverName?: string
  reason: string
  etaDelta: number
  receiverPhone: string
  receiverName?: string
  loadId: string
  consignmentId?: string
}

type NotifyResult = {
  sent: boolean
  messageSid: string | null
  sentAt: string
  messageText: string
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const input = await req.json() as ProactiveNotifyInput

    if (!input.receiverPhone || !input.reason) {
      return new Response(
        JSON.stringify({ error: 'receiverPhone and reason are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL')!,
      anonKey: Deno.env.get('ANON_KEY')!,
    })

    const sentAt = new Date().toISOString()
    const channel = Deno.env.get('TWILIO_CHANNEL') ?? 'sms'
    const messageText = await generateMessage(client, input)
    const { sent, messageSid } = await sendSms(input.receiverPhone, messageText)

    await persistNotification(client, input, messageText, sentAt, sent, messageSid, channel)

    return jsonResponse({ sent, messageSid, sentAt, messageText })
  } catch (error) {
    console.error('proactive-notify failed', error)
    return new Response(
      JSON.stringify({ error: 'Proactive notification failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
}

async function generateMessage(
  client: ReturnType<typeof createClient>,
  input: ProactiveNotifyInput,
): Promise<string> {
  const receiverName = input.receiverName ?? 'receiver'
  const driverName = input.driverName ?? `Driver ${input.driverId}`

  try {
    const result = await (client.ai.chat.completions as any).create({
      model: 'anthropic/claude-sonnet-4.5',
      maxTokens: 200,
      messages: [
        {
          role: 'system',
          content:
            'You are SAURON, an AI fleet management system. Write a single professional SMS notification to a freight receiver. ' +
            'Be concise (under 160 characters), factual, and apologetic in tone. Include the updated ETA impact. ' +
            'Return only the SMS text — no quotes, no JSON, no markdown.',
        },
        {
          role: 'user',
          content:
            `Driver: ${driverName}. Load ID: ${input.loadId}. Receiver: ${receiverName}. ` +
            `Reason for delay: ${input.reason}. ETA is now approximately ${input.etaDelta} minutes later than planned. ` +
            'Write the SMS notification.',
        },
      ],
    })

    const content = result?.choices?.[0]?.message?.content
    const text = typeof content === 'string' ? content.trim() : ''
    if (text) return text
  } catch (error) {
    console.warn('Claude message generation failed, using template', error)
  }

  return `SAURON: Delivery to ${receiverName} is running ~${input.etaDelta} min late. We'll keep you updated.`
}

async function sendSms(
  to: string,
  body: string,
): Promise<{ sent: boolean; messageSid: string | null }> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER')
  // Set TWILIO_CHANNEL=whatsapp to send via WhatsApp instead of SMS.
  // The from/to numbers will automatically be prefixed with "whatsapp:".
  const channel = Deno.env.get('TWILIO_CHANNEL') ?? 'sms'

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('Twilio credentials not configured — skipping SMS send')
    return { sent: false, messageSid: null }
  }

  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const from = channel === 'whatsapp' ? `whatsapp:${fromNumber}` : fromNumber
    const recipient = channel === 'whatsapp' ? `whatsapp:${to}` : to
    const params = new URLSearchParams({ From: from, To: recipient, Body: body })
    const auth = btoa(`${accountSid}:${authToken}`)

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })

    const responseData = await response.json()

    if (!response.ok) {
      console.error('Twilio error', response.status, responseData)
      return { sent: false, messageSid: null }
    }

    console.log('SMS sent', responseData.sid, 'status:', responseData.status)
    return { sent: true, messageSid: responseData.sid ?? null }
  } catch (error) {
    console.error('Twilio fetch failed', error)
    return { sent: false, messageSid: null }
  }
}

async function persistNotification(
  client: ReturnType<typeof createClient>,
  input: ProactiveNotifyInput,
  messageText: string,
  sentAt: string,
  sent: boolean,
  messageSid: string | null,
  channel: string,
): Promise<void> {
  const row = {
    receiver_notification_id: `RNT${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`,
    fleet_id: 'fleet_demo',
    consignment_id: input.consignmentId ?? input.loadId,
    assignment_id: null,
    notification_type: 'delay_alert',
    channel: channel === 'whatsapp' ? 'sms' : channel,
    recipient: input.receiverPhone,
    sent_at: sentAt,
    delivery_status: sent ? 'sent' : 'failed',
    message_template: 'proactive_notify',
    message_text: messageText,
    external_reference: messageSid,
    context: {
      trigger_type: 'proactive_notify',
      eta_delta_minutes: input.etaDelta,
      reason: input.reason,
      driver_id: input.driverId,
      driver_name: input.driverName ?? null,
      load_id: input.loadId,
    },
    eta_at: null,
    created_at: sentAt,
    updated_at: sentAt,
  }

  const { error } = await client.database.from('receiver_notifications').insert([row])
  if (error) console.warn('Failed to persist notification record', error)
}

function jsonResponse(data: NotifyResult): Response {
  return new Response(
    JSON.stringify({ data, source: 'insforge', timestamp: new Date().toISOString() }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
}
