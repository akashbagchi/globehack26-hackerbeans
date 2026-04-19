import { useState } from 'react'
import { ArrowLeft, MapPin, Truck, Zap } from 'lucide-react'
import { useFleetStore } from '../../store/fleetStore'
import { fetchDispatchRecommendations } from '../../api/client'
import { DriverMatch } from '../dispatch/DriverMatch'
import { SimulateButton } from '../dispatch/SimulateButton'

const STATUS_CONFIG = {
  driving: { label: 'Driving', color: 'bg-green-100 text-green-700' },
  idle: { label: 'Idle', color: 'bg-yellow-100 text-yellow-700' },
  off_duty: { label: 'Off Duty', color: 'bg-gray-100 text-gray-500' },
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-500',
  'bg-orange-500', 'bg-pink-500', 'bg-teal-500', 'bg-red-500', 'bg-indigo-500',
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

  const [pickup, setPickup] = useState('')
  const [destination, setDestination] = useState('')
  const [cargo, setCargo] = useState('')
  const [weight, setWeight] = useState('')
  const [tab, setTab] = useState<'details' | 'dispatch'>('details')

  const driverIndex = drivers.findIndex((d) => d.driver_id === selectedDriverId)
  const driver = drivers[driverIndex]
  if (!driver) return null

  const cfg = STATUS_CONFIG[driver.status]
  const avatarBg = AVATAR_COLORS[driverIndex % AVATAR_COLORS.length]
  const initials = driver.name.split(' ').map((n) => n[0]).join('')

  async function handleDispatch(e: React.FormEvent) {
    e.preventDefault()
    if (!pickup || !destination || !cargo) return
    setIsDispatching(true)
    try {
      const result = await fetchDispatchRecommendations({ pickup, destination, cargo, weight_lbs: parseInt(weight) || 20000 })
      setDispatchRecommendations(result.recommendations, result.dispatch_note)
    } catch { setIsDispatching(false) }
  }

  const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-400 bg-white'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setSelectedDriver(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-gray-700 truncate flex-1">{driver.name}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
        </div>

        {/* Driver avatar + info */}
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${avatarBg} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
            {initials}
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-800">{driver.name}</div>
            <div className="text-xs text-gray-400 flex items-center gap-1">
              <Truck size={10} />
              {driver.vehicle.year} {driver.vehicle.make} {driver.vehicle.model} · {driver.truck_number}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 shrink-0">
        {(['details', 'dispatch'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-colors ${
              tab === t ? 'text-blue-600 border-b-2 border-blue-500 -mb-px' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'dispatch' ? 'Dispatch AI' : 'Details'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'details' && (
          <div className="p-4 space-y-4">
            {/* Location */}
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Location</div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <MapPin size={13} className="text-gray-400 shrink-0" />
                {driver.location.city}, {driver.location.state}
                {driver.status === 'driving' && (
                  <span className="text-xs text-gray-400">· {driver.location.speed_mph} mph</span>
                )}
              </div>
            </div>

            {/* HOS */}
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Hours of Service</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Drive', value: driver.hos.drive_remaining_hrs },
                  { label: 'Shift', value: driver.hos.shift_remaining_hrs },
                  { label: 'Cycle', value: driver.hos.cycle_remaining_hrs },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-[10px] text-gray-400">{label}</div>
                    <div className={`text-sm font-bold ${value < 2 ? 'text-red-500' : value < 4 ? 'text-yellow-500' : 'text-gray-700'}`}>
                      {value.toFixed(1)}h
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Vehicle */}
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Truck Settings</div>
              <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
                <div><span className="text-gray-400">Fuel</span><div className="font-medium text-gray-700">{driver.vehicle.fuel_level_pct}%</div></div>
                <div><span className="text-gray-400">MPG</span><div className="font-medium text-gray-700">{driver.vehicle.mpg_avg}</div></div>
                <div><span className="text-gray-400">$/mi</span><div className="font-medium text-gray-700">${driver.economics.cost_per_mile}</div></div>
              </div>
            </div>

            {/* Current load */}
            {driver.current_load && (
              <div>
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Active Load</div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-4 h-4 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-[9px] font-bold shrink-0">P</span>
                    <span className="text-gray-700">{driver.current_load.origin}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-4 h-4 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-[9px] font-bold shrink-0">D</span>
                    <span className="text-gray-700">{driver.current_load.destination}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 pl-6">
                    {driver.current_load.cargo} · {driver.current_load.weight_lbs.toLocaleString()} lbs
                  </div>
                </div>
              </div>
            )}

            {/* Economics */}
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Today's Performance</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-[10px] text-gray-400">Miles</div>
                  <div className="text-sm font-bold text-gray-700">{driver.economics.miles_today}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-[10px] text-gray-400">Revenue</div>
                  <div className="text-sm font-bold text-gray-700">${driver.economics.revenue_today.toFixed(0)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'dispatch' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <Zap size={12} className="text-amber-500 shrink-0" />
              Find the best driver for a new load using AI
            </div>

            <form onSubmit={handleDispatch} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Pickup</label>
                  <input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Chicago, IL" className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Destination</label>
                  <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Houston, TX" className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Cargo</label>
                  <input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Electronics" className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Weight (lbs)</label>
                  <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="20000" className={inputClass} />
                </div>
              </div>
              <button
                type="submit"
                disabled={isDispatching || !pickup || !destination || !cargo}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isDispatching ? (
                  <><span className="w-4 h-4 border-2 border-blue-300 border-t-white rounded-full animate-spin" />Finding drivers...</>
                ) : 'Find Best Driver'}
              </button>
            </form>

            {recommendations.length > 0 && (
              <div className="space-y-2">
                {dispatchNote && (
                  <p className="text-[11px] text-blue-600 italic border-l-2 border-blue-300 pl-2">{dispatchNote}</p>
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
