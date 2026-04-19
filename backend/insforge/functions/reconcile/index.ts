import { createClient } from 'npm:@insforge/sdk'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const FLEET_ID = 'fleet_demo'
const CHECKIN_OVERDUE_HOURS = 4
const HOS_RISK_HOURS = 3.0
const HOS_CRITICAL_HOURS = 1.5
const SPEND_FLAG_THRESHOLD = 400
const UNPLANNED_CATEGORIES = new Set(['lodging', 'other'])

const DRIVER_NAMES: Record<string, string> = {
  DRV001: 'Marcus Webb',
  DRV002: 'Sofia Reyes',
  DRV003: 'Jake Thornton',
  DRV004: 'Aaliyah Brooks',
  DRV005: 'Dmitri Volkov',
  DRV006: 'Carmen Ibáñez',
  DRV007: 'Tyrese Coleman',
  DRV008: 'Priya Nair',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function hoursAgo(ts: string): number {
  return (Date.now() - new Date(ts).getTime()) / 3_600_000
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL')!,
    anonKey: Deno.env.get('ANON_KEY')!,
  })

  const alerts: Record<string, unknown>[] = []
  const now = new Date()

  // ── 1. Late delivery ───────────────────────────────────────────────────────
  const { data: consignments } = await client.database
    .from('consignments')
    .select()
    .eq('fleet_id', FLEET_ID)
    .in('status', ['in_transit', 'dispatched'])

  for (const c of consignments ?? []) {
    if (!c.promised_delivery_at) continue
    const promised = new Date(c.promised_delivery_at as string)
    if (promised >= now) continue
    const hoursLate = (now.getTime() - promised.getTime()) / 3_600_000
    const driverName = DRIVER_NAMES[c.assigned_driver_id as string] ?? c.assigned_driver_id
    alerts.push({
      alert_id: `ALT-LATE-${c.consignment_id}`,
      fleet_id: FLEET_ID,
      driver_id: c.assigned_driver_id,
      driver_name: driverName,
      assignment_id: c.current_assignment_id ?? null,
      consignment_id: c.consignment_id,
      alert_type: 'late_delivery',
      severity: hoursLate >= 8 ? 'critical' : 'warning',
      title: `Late Delivery — ${c.destination}`,
      detail: `${c.consignment_id} was due ${promised.toUTCString().slice(0, 22)}, now ${hoursLate.toFixed(1)}h overdue. Cargo: ${c.cargo_description}.`,
      source_ref: c.consignment_id as string,
      status: 'unresolved',
      updated_at: now.toISOString(),
    })
  }

  // ── 2. Missed check-in ────────────────────────────────────────────────────
  const { data: checkIns } = await client.database
    .from('check_in_events')
    .select()
    .eq('fleet_id', FLEET_ID)
    .order('checked_in_at', { ascending: false })

  const lastCheckin: Record<string, string> = {}
  for (const ci of checkIns ?? []) {
    const did = ci.driver_id as string
    if (!lastCheckin[did]) lastCheckin[did] = ci.checked_in_at as string
  }

  const { data: assignments } = await client.database
    .from('assignments')
    .select()
    .eq('fleet_id', FLEET_ID)
    .eq('status', 'active')

  for (const a of assignments ?? []) {
    const did = a.driver_id as string
    const last = lastCheckin[did]
    const hoursSince = last ? hoursAgo(last) : 999
    if (hoursSince < CHECKIN_OVERDUE_HOURS) continue
    const driverName = DRIVER_NAMES[did] ?? did
    const neverCheckedIn = !last
    alerts.push({
      alert_id: `ALT-CHKIN-${did}`,
      fleet_id: FLEET_ID,
      driver_id: did,
      driver_name: driverName,
      assignment_id: a.assignment_id as string,
      consignment_id: a.consignment_id as string,
      alert_type: 'missed_checkin',
      severity: neverCheckedIn || hoursSince >= 8 ? 'critical' : 'warning',
      title: `Missed Check-In — ${driverName}`,
      detail: neverCheckedIn
        ? `No check-in recorded for this assignment. Driver is in transit on ${a.consignment_id}.`
        : `Last check-in was ${hoursSince.toFixed(1)}h ago. Expected every ${CHECKIN_OVERDUE_HOURS}h during transit.`,
      source_ref: last ?? null,
      status: 'unresolved',
      updated_at: now.toISOString(),
    })
  }

  // ── 3. HOS risk ───────────────────────────────────────────────────────────
  const { data: drivers } = await client.database
    .from('drivers')
    .select()

  for (const d of drivers ?? []) {
    if (!['driving', 'off_duty'].includes(d.status as string)) continue
    const hos = d.hos as Record<string, number> | null
    if (!hos) continue
    const remaining = hos.drive_remaining_hrs ?? 99
    if (remaining > HOS_RISK_HOURS) continue
    const did = d.driver_id as string
    const driverName = DRIVER_NAMES[did] ?? did
    alerts.push({
      alert_id: `ALT-HOS-${did}`,
      fleet_id: FLEET_ID,
      driver_id: did,
      driver_name: driverName,
      assignment_id: null,
      consignment_id: null,
      alert_type: 'hos_risk',
      severity: remaining <= HOS_CRITICAL_HOURS ? 'critical' : 'warning',
      title: `HOS Risk — ${driverName}`,
      detail: `Only ${remaining.toFixed(1)}h drive time remaining. ELD threshold ${remaining <= HOS_CRITICAL_HOURS ? 'CRITICAL' : 'WARNING'}. Must rest before legal limit.`,
      source_ref: did,
      status: 'unresolved',
      updated_at: now.toISOString(),
    })
  }

  // ── 4. Unexpected card spend ──────────────────────────────────────────────
  const { data: txns } = await client.database
    .from('card_transactions')
    .select()
    .eq('fleet_id', FLEET_ID)
    .eq('flagged', true)

  for (const t of txns ?? []) {
    const did = t.driver_id as string
    const driverName = DRIVER_NAMES[did] ?? did
    const amount = t.amount_usd as number
    const cat = t.category as string
    const isBig = amount >= SPEND_FLAG_THRESHOLD
    const isUnplanned = UNPLANNED_CATEGORIES.has(cat)
    alerts.push({
      alert_id: `ALT-SPEND-${t.transaction_id}`,
      fleet_id: FLEET_ID,
      driver_id: did,
      driver_name: driverName,
      assignment_id: null,
      consignment_id: null,
      alert_type: 'unexpected_spend',
      severity: (isBig && isUnplanned) || amount >= 600 ? 'critical' : 'warning',
      title: `Unexpected Spend — ${driverName}`,
      detail: `$${amount.toFixed(2)} at "${t.merchant}" (${cat}). ${t.flag_reason ?? 'Flagged for review.'}`,
      source_ref: t.transaction_id as string,
      status: 'unresolved',
      updated_at: now.toISOString(),
    })
  }

  // ── 5. Suspicious stoppage (pre-seeded for route deviators) ───────────────
  const { data: deviations } = await client.database
    .from('route_deviations')
    .select()
    .eq('resolved', false)

  for (const dev of deviations ?? []) {
    if (dev.severity !== 'major') continue
    const did = dev.driver_id as string
    const driverName = DRIVER_NAMES[did] ?? did
    alerts.push({
      alert_id: `ALT-STOP-${did}`,
      fleet_id: FLEET_ID,
      driver_id: did,
      driver_name: driverName,
      assignment_id: null,
      consignment_id: null,
      alert_type: 'suspicious_stoppage',
      severity: 'warning',
      title: `Route Deviation — ${driverName}`,
      detail: `Truck is ${(dev.deviation_miles as number).toFixed(1)} mi off planned corridor. Possible unscheduled stop or detour. Verify with driver.`,
      source_ref: did,
      status: 'unresolved',
      updated_at: now.toISOString(),
    })
  }

  // ── Upsert all alerts ─────────────────────────────────────────────────────
  if (alerts.length > 0) {
    await client.database
      .from('fleet_alerts')
      .upsert(alerts as any, { onConflict: 'alert_id' })
  }

  // ── Write reconciliation_events for flagged spend ─────────────────────────
  const reconRows = (txns ?? [])
    .filter((t) => t.flagged)
    .map((t) => ({
      reconciliation_event_id: `REC-${t.transaction_id}`,
      fleet_id: FLEET_ID,
      consignment_id: 'CON001',
      event_date: t.occurred_at,
      status: 'pending',
      cost_delta_usd: t.amount_usd,
      revenue_delta_usd: 0,
      details: {
        merchant: t.merchant,
        category: t.category,
        flag_reason: t.flag_reason,
        driver_id: t.driver_id,
        transaction_id: t.transaction_id,
      },
      updated_at: now.toISOString(),
    }))

  // Assign correct consignment to DRV004 transactions
  const driverConsignmentMap: Record<string, string> = {
    DRV001: 'CON001', DRV002: 'CON002', DRV004: 'CON004',
    DRV006: 'CON006', DRV008: 'CON008',
  }
  for (const r of reconRows) {
    const txn = (txns ?? []).find((t) => `REC-${t.transaction_id}` === r.reconciliation_event_id)
    if (txn) r.consignment_id = driverConsignmentMap[txn.driver_id as string] ?? 'CON001'
  }

  if (reconRows.length > 0) {
    await client.database
      .from('reconciliation_events')
      .upsert(reconRows as any, { onConflict: 'reconciliation_event_id' })
  }

  return json({
    ok: true,
    alerts_generated: alerts.length,
    reconciliation_events: reconRows.length,
    breakdown: {
      late_delivery: alerts.filter((a) => a.alert_type === 'late_delivery').length,
      missed_checkin: alerts.filter((a) => a.alert_type === 'missed_checkin').length,
      hos_risk: alerts.filter((a) => a.alert_type === 'hos_risk').length,
      unexpected_spend: alerts.filter((a) => a.alert_type === 'unexpected_spend').length,
      suspicious_stoppage: alerts.filter((a) => a.alert_type === 'suspicious_stoppage').length,
    },
  })
}
