'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, Phone, Route, Wrench } from 'lucide-react'
import {
  applyInterventionReroute,
  fetchInterventionActions,
  fetchInterventions,
  logInterventionOutreach,
  updateRoadsideAssistance,
} from '../../api/client'
import { useFleetStore } from '../../store/fleetStore'
import type { ShipmentIntervention, ShipmentInterventionAction } from '../../types'

const FLEET_ID = 'fleet_demo'
const DISPATCHER_ID = 'DISP001'

const CATEGORY_LABEL: Record<ShipmentIntervention['category'], string> = {
  route_deviation: 'Route Deviation',
  traffic_delay: 'Traffic Delay',
  weather: 'Weather',
  incident: 'Incident',
  construction: 'Construction',
  hos_risk: 'HOS Risk',
  breakdown: 'Breakdown',
}

const CATEGORY_ICON = {
  route_deviation: Route,
  traffic_delay: Route,
  weather: AlertTriangle,
  incident: AlertTriangle,
  construction: Route,
  hos_risk: AlertTriangle,
  breakdown: Wrench,
} as const

export function InterventionQueue() {
  const upsertConsignment = useFleetStore((state) => state.upsertConsignment)
  const [interventions, setInterventions] = useState<ShipmentIntervention[]>([])
  const [actionsById, setActionsById] = useState<Record<string, ShipmentInterventionAction[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingForId, setSavingForId] = useState<string | null>(null)
  const [openOutreachId, setOpenOutreachId] = useState<string | null>(null)
  const [openRerouteId, setOpenRerouteId] = useState<string | null>(null)
  const [outreachStatus, setOutreachStatus] = useState('reached_driver')
  const [outreachReason, setOutreachReason] = useState('')
  const [outreachNotes, setOutreachNotes] = useState('')
  const [rerouteReason, setRerouteReason] = useState('')
  const [rerouteEta, setRerouteEta] = useState('')
  const [rerouteStatus, setRerouteStatus] = useState<'delayed' | 'in_transit' | 'exception'>('delayed')
  const [openRoadsideId, setOpenRoadsideId] = useState<string | null>(null)
  const [roadsideStatus, setRoadsideStatus] = useState('provider_dispatched')
  const [roadsideProvider, setRoadsideProvider] = useState('')
  const [roadsideReference, setRoadsideReference] = useState('')
  const [roadsideNotes, setRoadsideNotes] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetchInterventions({ fleetId: FLEET_ID })
      setInterventions(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load interventions')
    } finally {
      setLoading(false)
    }
  }

  async function loadActions(shipmentInterventionId: string) {
    const response = await fetchInterventionActions({
      fleetId: FLEET_ID,
      shipmentInterventionId,
    })
    setActionsById((current) => ({ ...current, [shipmentInterventionId]: response.data }))
  }

  async function handleOutreach(intervention: ShipmentIntervention) {
    setSavingForId(intervention.shipment_intervention_id)
    setError(null)
    try {
      await logInterventionOutreach({
        fleetId: FLEET_ID,
        shipmentInterventionId: intervention.shipment_intervention_id,
        payload: {
          dispatcher_id: DISPATCHER_ID,
          contact_channel: 'phone',
          contact_status: outreachStatus,
          reason: outreachReason,
          notes: outreachNotes || null,
          intervention_status: 'open',
        },
      })
      setOpenOutreachId(null)
      setOutreachReason('')
      setOutreachNotes('')
      await Promise.all([load(), loadActions(intervention.shipment_intervention_id)])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save outreach')
    } finally {
      setSavingForId(null)
    }
  }

  async function handleReroute(intervention: ShipmentIntervention) {
    setSavingForId(intervention.shipment_intervention_id)
    setError(null)
    try {
      const response = await applyInterventionReroute({
        fleetId: FLEET_ID,
        shipmentInterventionId: intervention.shipment_intervention_id,
        payload: {
          dispatcher_id: DISPATCHER_ID,
          reason: rerouteReason,
          updated_eta_at: rerouteEta ? new Date(rerouteEta).toISOString() : undefined,
          status: rerouteStatus,
          route_plan_status: 'active',
          mark_intervention_resolved: true,
        },
      })
      upsertConsignment(response.data.consignment)
      setOpenRerouteId(null)
      setRerouteReason('')
      setRerouteEta('')
      setRerouteStatus('delayed')
      await Promise.all([load(), loadActions(intervention.shipment_intervention_id)])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply reroute')
    } finally {
      setSavingForId(null)
    }
  }

  async function handleRoadside(intervention: ShipmentIntervention) {
    setSavingForId(intervention.shipment_intervention_id)
    setError(null)
    try {
      await updateRoadsideAssistance({
        fleetId: FLEET_ID,
        shipmentInterventionId: intervention.shipment_intervention_id,
        payload: {
          dispatcher_id: DISPATCHER_ID,
          assistance_status: roadsideStatus,
          provider_name: roadsideProvider || undefined,
          external_reference: roadsideReference || undefined,
          notes: roadsideNotes || null,
          mark_intervention_resolved: roadsideStatus === 'completed',
          mark_incident_resolved: roadsideStatus === 'completed',
        },
      })
      setOpenRoadsideId(null)
      setRoadsideProvider('')
      setRoadsideReference('')
      setRoadsideNotes('')
      await Promise.all([load(), loadActions(intervention.shipment_intervention_id)])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update roadside assistance')
    } finally {
      setSavingForId(null)
    }
  }

  const visible = interventions.filter((item) => item.status !== 'resolved')

  return (
    <div className="border-b border-[#dadce0] bg-[#fcfcfd]">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#202124]">Intervention Queue</p>
            <p className="text-xs text-[#5f6368]">Dispatcher CTAs for shipments already in motion.</p>
          </div>
          <button
            onClick={load}
            className="rounded-full border border-[#dadce0] px-3 py-1.5 text-xs text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center px-4 py-10 text-sm text-[#5f6368]">
            Loading interventions...
          </div>
        ) : visible.length === 0 ? (
          <div className="px-4 pb-4 text-xs text-[#5f6368]">No active intervention workflows.</div>
        ) : (
          visible.map((intervention) => {
            const Icon = CATEGORY_ICON[intervention.category]
            const actions = actionsById[intervention.shipment_intervention_id] ?? []
            return (
              <div key={intervention.shipment_intervention_id} className="border-t border-[#eceff3] px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 rounded-full bg-[#e8f0fe] p-2 text-[#1a73e8]">
                      <Icon size={14} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#202124]">{intervention.summary}</span>
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                          {intervention.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#5f6368]">
                        {CATEGORY_LABEL[intervention.category]} • {intervention.consignment_id ?? intervention.assignment_id ?? intervention.driver_id}
                      </p>
                      {intervention.dispatcher_cta?.label && (
                        <p className="mt-1 text-xs text-[#202124]">{intervention.dispatcher_cta.label}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={async () => {
                      const next = openOutreachId === intervention.shipment_intervention_id ? null : intervention.shipment_intervention_id
                      setOpenOutreachId(next)
                      if (next) await loadActions(next)
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-[#dadce0] px-3 py-1.5 text-xs font-medium text-[#202124] hover:bg-white"
                  >
                    <Phone size={12} />
                    Log outreach
                  </button>
                  {intervention.recommended_route_action?.action && (
                    <button
                      onClick={async () => {
                        const next = openRerouteId === intervention.shipment_intervention_id ? null : intervention.shipment_intervention_id
                        setOpenRerouteId(next)
                        if (next) await loadActions(next)
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-[#1a73e8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1557b0]"
                    >
                      <Route size={12} />
                      Apply reroute
                    </button>
                  )}
                  {intervention.category === 'breakdown' && (
                    <button
                      onClick={async () => {
                        const next = openRoadsideId === intervention.shipment_intervention_id ? null : intervention.shipment_intervention_id
                        setOpenRoadsideId(next)
                        if (next) await loadActions(next)
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-[#202124] px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
                    >
                      <Wrench size={12} />
                      Roadside assistance
                    </button>
                  )}
                </div>

                {openOutreachId === intervention.shipment_intervention_id && (
                  <div className="mt-3 rounded-2xl border border-[#dadce0] bg-white p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={outreachStatus}
                        onChange={(event) => setOutreachStatus(event.target.value)}
                        className="rounded-xl border border-[#dadce0] px-3 py-2 text-sm"
                      >
                        <option value="reached_driver">Reached driver</option>
                        <option value="left_voicemail">Left voicemail</option>
                        <option value="no_answer">No answer</option>
                        <option value="awaiting_response">Awaiting response</option>
                      </select>
                      <input
                        value={outreachReason}
                        onChange={(event) => setOutreachReason(event.target.value)}
                        placeholder="Reason or call outcome"
                        className="rounded-xl border border-[#dadce0] px-3 py-2 text-sm"
                      />
                    </div>
                    <textarea
                      value={outreachNotes}
                      onChange={(event) => setOutreachNotes(event.target.value)}
                      placeholder="Notes for the intervention log"
                      className="mt-2 min-h-20 w-full rounded-xl border border-[#dadce0] px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => handleOutreach(intervention)}
                      disabled={!outreachReason || savingForId === intervention.shipment_intervention_id}
                      className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#0f9d58] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {savingForId === intervention.shipment_intervention_id ? <Loader2 size={12} className="animate-spin" /> : <Phone size={12} />}
                      Save outreach
                    </button>
                  </div>
                )}

                {openRerouteId === intervention.shipment_intervention_id && (
                  <div className="mt-3 rounded-2xl border border-[#dadce0] bg-white p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="datetime-local"
                        value={rerouteEta}
                        onChange={(event) => setRerouteEta(event.target.value)}
                        className="rounded-xl border border-[#dadce0] px-3 py-2 text-sm"
                      />
                      <select
                        value={rerouteStatus}
                        onChange={(event) => setRerouteStatus(event.target.value as 'delayed' | 'in_transit' | 'exception')}
                        className="rounded-xl border border-[#dadce0] px-3 py-2 text-sm"
                      >
                        <option value="delayed">Delayed</option>
                        <option value="in_transit">In transit</option>
                        <option value="exception">Exception</option>
                      </select>
                    </div>
                    <input
                      value={rerouteReason}
                      onChange={(event) => setRerouteReason(event.target.value)}
                      placeholder="Why the route is changing"
                      className="mt-2 w-full rounded-xl border border-[#dadce0] px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => handleReroute(intervention)}
                      disabled={!rerouteReason || savingForId === intervention.shipment_intervention_id}
                      className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#1a73e8] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {savingForId === intervention.shipment_intervention_id ? <Loader2 size={12} className="animate-spin" /> : <Route size={12} />}
                      Confirm reroute
                    </button>
                  </div>
                )}

                {openRoadsideId === intervention.shipment_intervention_id && (
                  <div className="mt-3 rounded-2xl border border-[#dadce0] bg-white p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={roadsideStatus}
                        onChange={(event) => setRoadsideStatus(event.target.value)}
                        className="rounded-xl border border-[#dadce0] px-3 py-2 text-sm"
                      >
                        <option value="provider_dispatched">Provider dispatched</option>
                        <option value="driver_safe">Driver safe</option>
                        <option value="repair_in_progress">Repair in progress</option>
                        <option value="tow_required">Tow required</option>
                        <option value="completed">Completed</option>
                      </select>
                      <input
                        value={roadsideProvider}
                        onChange={(event) => setRoadsideProvider(event.target.value)}
                        placeholder="Provider name"
                        className="rounded-xl border border-[#dadce0] px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input
                        value={roadsideReference}
                        onChange={(event) => setRoadsideReference(event.target.value)}
                        placeholder="Dispatch or case reference"
                        className="rounded-xl border border-[#dadce0] px-3 py-2 text-sm"
                      />
                      <input
                        value={roadsideNotes}
                        onChange={(event) => setRoadsideNotes(event.target.value)}
                        placeholder="Notes"
                        className="rounded-xl border border-[#dadce0] px-3 py-2 text-sm"
                      />
                    </div>
                    <button
                      onClick={() => handleRoadside(intervention)}
                      disabled={!roadsideStatus || savingForId === intervention.shipment_intervention_id}
                      className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#202124] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {savingForId === intervention.shipment_intervention_id ? <Loader2 size={12} className="animate-spin" /> : <Wrench size={12} />}
                      Save roadside update
                    </button>
                  </div>
                )}

                {actions.length > 0 && (
                  <div className="mt-3 rounded-2xl bg-[#f8f9fa] px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">Recent history</p>
                    <div className="mt-2 space-y-2">
                      {actions.slice(0, 3).map((action) => (
                        <div key={action.shipment_intervention_action_id} className="text-xs text-[#5f6368]">
                          <span className="font-medium text-[#202124]">{action.action_type.replace('_', ' ')}</span>
                          {' • '}
                          {action.action_status}
                          {action.action_reason ? ` • ${action.action_reason}` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
