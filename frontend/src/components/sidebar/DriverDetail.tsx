import { useState } from 'react'
import { ArrowLeft, Camera, MapPin, Truck, Zap, AlertTriangle } from 'lucide-react'
import { useFleetStore } from '../../store/fleetStore'
import { fetchDispatchRecommendations } from '../../api/client'
import { DriverMatch } from '../dispatch/DriverMatch'
import { SimulateButton } from '../dispatch/SimulateButton'
import { DisclosureSection } from '../shared/DisclosureSection'
import { getVisionFeedAssignments } from '../../lib/visionFeeds'
import { VisionVideoPlayer } from '../vision/VisionVideoPlayer'
import {
  formatAvailabilityWindow,
  formatShortDateTime,
  getAvailabilitySummary,
  getHosSummary,
  humanizeLabel,
  SUMMARY_TONE_STYLES,
} from '../../lib/driverPresentation'

const STATUS_CONFIG = {
  driving: { label: 'Driving', color: 'text-green-700 bg-green-50 border border-green-200' },
  idle: { label: 'Idle', color: 'text-yellow-700 bg-yellow-50 border border-yellow-200' },
  off_duty: { label: 'Off Duty', color: 'text-[#5f6368] bg-[#f1f3f4] border border-[#dadce0]' },
  unavailable: { label: 'Unavailable', color: 'text-orange-700 bg-orange-50 border border-orange-200' },
  breakdown: { label: 'Breakdown', color: 'text-red-700 bg-red-50 border border-red-200' },
}

const READINESS_CONFIG: Record<string, string> = {
  ready: 'text-green-700 bg-green-50 border border-green-200',
  limited: 'text-yellow-700 bg-yellow-50 border border-yellow-200',
  at_risk: 'text-orange-700 bg-orange-50 border border-orange-200',
  assigned: 'text-blue-700 bg-blue-50 border border-blue-200',
  blocked: 'text-red-700 bg-red-50 border border-red-200',
}

const AVATAR_COLORS = [
  'bg-[#1a73e8]', 'bg-purple-500', 'bg-green-600',
  'bg-orange-500', 'bg-pink-500', 'bg-teal-600', 'bg-red-500', 'bg-indigo-500',
]

export function DriverDetail() {
  const selectedDriverId = useFleetStore((s) => s.selectedDriverId)
  const setSelectedDriver = useFleetStore((s) => s.setSelectedDriver)
  const drivers = useFleetStore((s) => s.drivers)
  const recommendations = useFleetStore((s) => s.dispatchRecommendations)
  const dispatchNote = useFleetStore((s) => s.dispatchNote)
  const selectedMatchId = useFleetStore((s) => s.selectedMatchId)
  const isDispatching = useFleetStore((s) => s.isDispatching)
  const setIsDispatching = useFleetStore((s) => s.setIsDispatching)
  const setDispatchRecommendations = useFleetStore((s) => s.setDispatchRecommendations)
  const visionByDriver = useFleetStore((s) => s.visionByDriver)

  const [pickup, setPickup] = useState('')
  const [destination, setDestination] = useState('')
  const [cargo, setCargo] = useState('')
  const [weight, setWeight] = useState('')
  const [tab, setTab] = useState<'details' | 'dispatch'>('details')

  const driverIndex = drivers.findIndex((d) => d.driver_id === selectedDriverId)
  const driver = drivers[driverIndex]
  if (!driver) return null

  const cfg = STATUS_CONFIG[driver.status] ?? STATUS_CONFIG.unavailable
  const visionFeedUrl = getVisionFeedAssignments(drivers)[driver.driver_id] ?? null
  const visionAlert = visionByDriver[driver.driver_id] ?? null
  const avatarBg = AVATAR_COLORS[driverIndex % AVATAR_COLORS.length]
  const initials = driver.name.split(' ').map((n) => n[0]).join('')
  const readiness = driver.readiness ?? { state: 'unknown', score: 0, blocker_reasons: [], available_at: null }
  const availabilityWindow = driver.availability_window ?? {
    available_from: new Date().toISOString(),
    available_until: new Date().toISOString(),
  }
  const contractConstraints = driver.contract_constraints ?? {
    max_deadhead_miles: 0,
    preferred_regions: [],
    excluded_cargo_types: [],
  }
  const vehicle = {
    ...driver.vehicle,
    capacity_lbs: driver.vehicle?.capacity_lbs ?? 0,
    trailer_type: driver.vehicle?.trailer_type ?? 'unknown',
    cab_type: driver.vehicle?.cab_type ?? 'unknown',
    refrigerated: driver.vehicle?.refrigerated ?? false,
    hazmat_permitted: driver.vehicle?.hazmat_permitted ?? false,
    maintenance_ready: driver.vehicle?.maintenance_ready ?? true,
  }
  const readinessStyle = READINESS_CONFIG[readiness.state] ?? 'text-gray-700 bg-gray-50 border border-gray-200'
  const certifications = [...new Set([...(driver.certifications ?? []), ...(driver.endorsements ?? [])])]
  const availability = getAvailabilitySummary(readiness, driver.current_load)
  const hosSummary = getHosSummary(driver.hos)
  const assignmentSummary = driver.current_load ? 'Active load in progress' : 'Unassigned'
  const visionStatus = visionAlert?.status ?? (visionFeedUrl ? 'clear' : null)
  const visionBadgeClass = visionStatus === 'critical'
    ? 'bg-red-100 text-red-700'
    : visionStatus === 'watch'
      ? 'bg-orange-100 text-orange-700'
      : 'bg-emerald-100 text-emerald-700'
  const sectionKey = `${driver.driver_id}-${tab}`

  const operationalAlerts = [
    ...(visionAlert && visionAlert.status !== 'clear'
      ? [{
          tone: visionAlert.status === 'critical'
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-orange-200 bg-orange-50 text-orange-700',
          text: visionAlert.summary,
        }]
      : []),
    ...(readiness.blocker_reasons.length > 0
      ? [{
          tone: 'border-red-200 bg-red-50 text-red-700',
          text: `${readiness.blocker_reasons.length} blocker${readiness.blocker_reasons.length > 1 ? 's' : ''} affecting availability`,
        }]
      : []),
    ...(driver.status === 'breakdown'
      ? [{
          tone: 'border-red-200 bg-red-50 text-red-700',
          text: 'Driver needs immediate operational attention before assignment.',
        }]
      : []),
  ]

  async function handleDispatch(e: React.FormEvent) {
    e.preventDefault()
    if (!pickup || !destination || !cargo) return
    setIsDispatching(true)
    try {
      const result = await fetchDispatchRecommendations({ pickup, destination, cargo, weight_lbs: parseInt(weight) || 20000 })
      setDispatchRecommendations(result.recommendations, result.dispatch_note)
    } catch { setIsDispatching(false) }
  }

  const inputClass = 'w-full border border-[#dadce0] rounded px-3 py-2 text-sm text-[#202124] placeholder-[#5f6368] focus:outline-none focus:border-[#1a73e8] bg-white'
  const summaryCardClass = 'rounded-2xl border border-[#dadce0] bg-white px-3 py-3'

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[#dadce0] shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setSelectedDriver(null)} className="text-[#5f6368] hover:text-[#202124] transition-colors">
            <ArrowLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-[#202124] truncate flex-1">{driver.name}</span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${avatarBg} flex items-center justify-center text-white text-sm font-semibold shrink-0`}>
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[#202124]">{driver.name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#5f6368]">
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} />
                {driver.location.city}, {driver.location.state}
              </span>
              <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${SUMMARY_TONE_STYLES[availability.tone]}`}>
                {availability.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex border-b border-[#dadce0] shrink-0">
        {(['details', 'dispatch'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === t ? 'text-[#1a73e8] border-b-2 border-[#1a73e8]' : 'text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]'
            }`}
          >
            {t === 'dispatch' ? 'Dispatch AI' : 'Details'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'details' && (
          <div className="p-4 space-y-4 bg-[#f8f9fa]">
            {operationalAlerts.length > 0 && (
              <div className="space-y-2">
                {operationalAlerts.map((alert) => (
                  <div key={alert.text} className={`flex items-start gap-2 rounded-2xl border px-3 py-2 text-xs ${alert.tone}`}>
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <span>{alert.text}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className={summaryCardClass}>
                <div className="text-[11px] font-medium uppercase tracking-wide text-[#5f6368]">Location</div>
                <div className="mt-1 text-sm font-semibold text-[#202124]">{driver.location.city}, {driver.location.state}</div>
                <div className="mt-1 text-xs text-[#5f6368]">
                  {driver.status === 'driving' ? `${driver.location.speed_mph} mph in motion` : 'Stationary'}
                </div>
              </div>

              <div className={summaryCardClass}>
                <div className="text-[11px] font-medium uppercase tracking-wide text-[#5f6368]">Availability</div>
                <div className="mt-1 text-sm font-semibold text-[#202124]">{availability.label}</div>
                <div className="mt-1 text-xs text-[#5f6368]">Window {formatAvailabilityWindow(availabilityWindow)}</div>
              </div>

              <div className={summaryCardClass}>
                <div className="text-[11px] font-medium uppercase tracking-wide text-[#5f6368]">HOS</div>
                <div className="mt-1 text-sm font-semibold text-[#202124]">{hosSummary.label}</div>
                <div className="mt-1 text-xs text-[#5f6368]">Shift {driver.hos.shift_remaining_hrs.toFixed(1)}h · Cycle {driver.hos.cycle_remaining_hrs.toFixed(1)}h</div>
              </div>

              <div className={summaryCardClass}>
                <div className="text-[11px] font-medium uppercase tracking-wide text-[#5f6368]">Assignment</div>
                <div className="mt-1 text-sm font-semibold text-[#202124]">{assignmentSummary}</div>
                <div className="mt-1 text-xs text-[#5f6368]">
                  {driver.current_load ? `${driver.current_load.load_id} · ${driver.current_load.origin} to ${driver.current_load.destination}` : 'Ready for manual review or auto-assignment'}
                </div>
              </div>
            </div>

            <DisclosureSection
              key={`${sectionKey}-readiness`}
              title="Operational readiness"
              summary={`${humanizeLabel(readiness.state)} · ${availability.label}`}
              badge={<span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${readinessStyle}`}>{humanizeLabel(readiness.state)}</span>}
              resetKey={`${sectionKey}-readiness`}
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${SUMMARY_TONE_STYLES[availability.tone]}`}>
                    {availability.label}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${readinessStyle}`}>
                    Score {readiness.score}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                  <div className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-3">
                    <div className="text-[#5f6368]">Available window</div>
                    <div className="mt-1 font-medium text-[#202124]">{formatAvailabilityWindow(availabilityWindow)}</div>
                  </div>
                  <div className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-3">
                    <div className="text-[#5f6368]">Next available</div>
                    <div className="mt-1 font-medium text-[#202124]">{formatShortDateTime(readiness.available_at) ?? 'Now'}</div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[#5f6368]">HOS detail</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Drive', value: driver.hos.drive_remaining_hrs },
                      { label: 'Shift', value: driver.hos.shift_remaining_hrs },
                      { label: 'Cycle', value: driver.hos.cycle_remaining_hrs },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-2 text-center">
                        <div className="text-[10px] text-[#5f6368]">{label}</div>
                        <div className={`text-sm font-semibold ${value < 2 ? 'text-red-500' : value < 4 ? 'text-yellow-600' : 'text-[#202124]'}`}>
                          {value.toFixed(1)}h
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {readiness.blocker_reasons.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[#5f6368]">Blockers</div>
                    <div className="space-y-2">
                      {readiness.blocker_reasons.map((reason) => (
                        <div key={reason} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                          {reason}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </DisclosureSection>

            <DisclosureSection
              key={`${sectionKey}-equipment`}
              title="Equipment"
              summary="Truck, trailer, capacity, fuel, and maintenance"
              badge={<Truck size={14} className="text-[#5f6368]" />}
              resetKey={`${sectionKey}-equipment`}
            >
              <div className="space-y-3 text-xs">
                <div className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-3">
                  <div className="text-[#5f6368]">Assigned truck</div>
                  <div className="mt-1 font-medium text-[#202124]">
                    {driver.truck_number} · {driver.vehicle.year} {driver.vehicle.make} {driver.vehicle.model}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <InfoCell label="Fuel" value={`${vehicle.fuel_level_pct}%`} />
                  <InfoCell label="MPG" value={String(vehicle.mpg_avg)} />
                  <InfoCell label="Capacity" value={`${vehicle.capacity_lbs.toLocaleString()} lbs`} />
                  <InfoCell label="Cost / mi" value={`$${driver.economics.cost_per_mile}`} />
                  <InfoCell label="Trailer" value={humanizeLabel(vehicle.trailer_type)} />
                  <InfoCell label="Cab" value={humanizeLabel(vehicle.cab_type)} />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Pill tone={vehicle.refrigerated ? 'info' : 'neutral'} label={vehicle.refrigerated ? 'Reefer ready' : 'Dry equipment'} />
                  <Pill tone={vehicle.hazmat_permitted ? 'info' : 'neutral'} label={vehicle.hazmat_permitted ? 'Hazmat permitted' : 'No hazmat'} />
                  <Pill tone={vehicle.maintenance_ready ? 'positive' : 'critical'} label={vehicle.maintenance_ready ? 'Maintenance ready' : 'Maintenance hold'} />
                </div>
              </div>
            </DisclosureSection>

            <DisclosureSection
              key={`${sectionKey}-constraints`}
              title="Constraints"
              summary="Qualifications, deadhead limits, and lane preferences"
              resetKey={`${sectionKey}-constraints`}
            >
              <div className="space-y-3 text-xs">
                <div className="flex flex-wrap gap-2">
                  {certifications.length > 0 ? certifications.map((cert) => (
                    <span key={cert} className="rounded-full bg-[#e8f0fe] px-2 py-1 text-[#1a73e8]">
                      {humanizeLabel(cert)}
                    </span>
                  )) : (
                    <span className="text-[#5f6368]">No certifications or endorsements listed</span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <InfoCell label="Max deadhead" value={`${contractConstraints.max_deadhead_miles} mi`} />
                  <InfoCell label="Preferred regions" value={contractConstraints.preferred_regions.join(', ') || 'Not set'} />
                </div>

                {contractConstraints.excluded_cargo_types.length > 0 && (
                  <div className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-3">
                    <div className="text-[#5f6368]">Excluded cargo</div>
                    <div className="mt-1 font-medium text-[#202124]">
                      {contractConstraints.excluded_cargo_types.map(humanizeLabel).join(', ')}
                    </div>
                  </div>
                )}
              </div>
            </DisclosureSection>

            <DisclosureSection
              key={`${sectionKey}-load`}
              title="Current load"
              summary={driver.current_load ? 'Open route, cargo, and ETA' : 'No active load assigned'}
              resetKey={`${sectionKey}-load`}
            >
              {driver.current_load ? (
                <div className="space-y-3 text-xs">
                  <div className="rounded-xl border border-[#c5d8fb] bg-[#e8f0fe] p-3">
                    <div className="font-medium text-[#202124]">{driver.current_load.load_id}</div>
                    <div className="mt-1 text-[#5f6368]">{driver.current_load.origin} to {driver.current_load.destination}</div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <InfoCell label="Cargo" value={driver.current_load.cargo} />
                    <InfoCell label="Weight" value={`${driver.current_load.weight_lbs.toLocaleString()} lbs`} />
                    <InfoCell label="ETA" value={formatShortDateTime(driver.current_load.eta) ?? 'Unknown'} />
                    <InfoCell label="Assignment" value="In progress" />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[#5f6368]">No active load assigned right now.</div>
              )}
            </DisclosureSection>

            <DisclosureSection
              key={`${sectionKey}-performance`}
              title="Performance"
              summary="Daily miles, revenue, and fleet economics"
              resetKey={`${sectionKey}-performance`}
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
                <InfoCell label="Miles today" value={String(driver.economics.miles_today)} />
                <InfoCell label="Revenue today" value={`$${driver.economics.revenue_today.toFixed(0)}`} />
                <InfoCell label="Cost per mile" value={`$${driver.economics.cost_per_mile}`} />
              </div>
            </DisclosureSection>

            {(visionFeedUrl || visionAlert) && (
              <DisclosureSection
                key={`${sectionKey}-vision`}
                title="AI / monitoring"
                summary={visionAlert?.summary ?? 'SAURON is monitoring this truck in the background.'}
                badge={visionStatus ? <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${visionBadgeClass}`}>{visionStatus}</span> : undefined}
                defaultOpen={visionAlert?.status === 'watch' || visionAlert?.status === 'critical'}
                resetKey={`${sectionKey}-vision`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3 rounded-xl border border-[#dadce0] bg-[#f8f9fa] px-3 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#5f6368]">
                        <Camera size={12} />
                        SAURON vision
                      </div>
                      <p className="mt-1 text-[#202124]">
                        {visionAlert?.summary ?? 'Monitoring active with no current issues flagged.'}
                      </p>
                      {visionAlert?.recommended_action && (
                        <p className="mt-2 text-xs text-[#5f6368]">Recommended action: {visionAlert.recommended_action}</p>
                      )}
                    </div>
                    {visionAlert?.primary_issue && (
                      <div className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase text-[#202124] border border-[#dadce0]">
                        {humanizeLabel(visionAlert.primary_issue)}
                      </div>
                    )}
                  </div>

                  {visionFeedUrl && (
                    <div className="overflow-hidden rounded-2xl border border-[#dadce0] bg-[#0f172a]">
                      <VisionVideoPlayer src={visionFeedUrl} className="aspect-video w-full" controls />
                    </div>
                  )}
                </div>
              </DisclosureSection>
            )}
          </div>
        )}

        {tab === 'dispatch' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs text-[#5f6368] bg-[#e8f0fe] border border-[#c5d8fb] rounded px-3 py-2">
              <Zap size={12} className="text-[#1a73e8] shrink-0" />
              Find the best driver for a new load using AI
            </div>

            <form onSubmit={handleDispatch} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-[#5f6368] mb-1">Pickup</label>
                  <input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Chicago, IL" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5f6368] mb-1">Destination</label>
                  <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Houston, TX" className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-[#5f6368] mb-1">Cargo</label>
                  <input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Electronics" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5f6368] mb-1">Weight (lbs)</label>
                  <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="20000" className={inputClass} />
                </div>
              </div>
              <button
                type="submit"
                disabled={isDispatching || !pickup || !destination || !cargo}
                className="w-full py-2 bg-[#1a73e8] hover:bg-[#1557b0] disabled:bg-[#f1f3f4] disabled:text-[#5f6368] text-white font-medium text-sm rounded transition-colors flex items-center justify-center gap-2"
              >
                {isDispatching ? (
                  <><span className="w-4 h-4 border-2 border-blue-300 border-t-white rounded-full animate-spin" />Finding drivers...</>
                ) : 'Find Best Driver'}
              </button>
            </form>

            {recommendations.length > 0 && (
              <div className="space-y-2">
                {dispatchNote && (
                  <p className="text-[11px] text-[#1a73e8] italic border-l-2 border-[#1a73e8] pl-2">{dispatchNote}</p>
                )}
                {recommendations.map((rec) => <DriverMatch key={rec.driver_id} rec={rec} />)}
                {selectedMatchId && <SimulateButton pickup={pickup} destination={destination} />}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-3">
      <div className="text-[#5f6368]">{label}</div>
      <div className="mt-1 font-medium text-[#202124]">{value}</div>
    </div>
  )
}

function Pill({ label, tone }: { label: string; tone: keyof typeof SUMMARY_TONE_STYLES }) {
  return (
    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${SUMMARY_TONE_STYLES[tone]}`}>
      {label}
    </span>
  )
}
