import { MapPin, Clock } from 'lucide-react'
import { useFleetStore } from '../../store/fleetStore'
import type { Driver } from '../../types'
import { getVisionFeedAssignments } from '../../lib/visionFeeds'

const STATUS_CONFIG = {
  driving: { label: 'Driving', color: 'text-green-700 bg-green-50 border border-green-200', dot: 'bg-green-500' },
  idle: { label: 'Idle', color: 'text-yellow-700 bg-yellow-50 border border-yellow-200', dot: 'bg-yellow-500' },
  off_duty: { label: 'Off Duty', color: 'text-[#5f6368] bg-[#f1f3f4] border border-[#dadce0]', dot: 'bg-gray-400' },
  unavailable: { label: 'Unavailable', color: 'text-orange-700 bg-orange-50 border border-orange-200', dot: 'bg-orange-500' },
  breakdown: { label: 'Breakdown', color: 'text-red-700 bg-red-50 border border-red-200', dot: 'bg-red-500' },
}

const READINESS_CONFIG: Record<string, string> = {
  ready: 'text-green-700 bg-green-50',
  limited: 'text-yellow-700 bg-yellow-50',
  at_risk: 'text-orange-700 bg-orange-50',
  assigned: 'text-blue-700 bg-blue-50',
  blocked: 'text-red-700 bg-red-50',
}

const AVATAR_COLORS = [
  'bg-[#1a73e8]', 'bg-purple-500', 'bg-green-600',
  'bg-orange-500', 'bg-pink-500', 'bg-teal-600', 'bg-red-500', 'bg-indigo-500',
]

interface DriverCardProps {
  driver: Driver
  index?: number
}

export function DriverCard({ driver, index = 0 }: DriverCardProps) {
  const selectedDriverId = useFleetStore((s) => s.selectedDriverId)
  const setSelectedDriver = useFleetStore((s) => s.setSelectedDriver)
  const drivers = useFleetStore((s) => s.drivers)
  const visionByDriver = useFleetStore((s) => s.visionByDriver)
  const isSelected = selectedDriverId === driver.driver_id
  const feedUrl = getVisionFeedAssignments(drivers)[driver.driver_id]
  const attention = visionByDriver[driver.driver_id]?.attention_score ?? 0
  const cfg = STATUS_CONFIG[driver.status] ?? STATUS_CONFIG.unavailable
  const initials = driver.name.split(' ').map((n) => n[0]).join('')
  const avatarBg = AVATAR_COLORS[index % AVATAR_COLORS.length]
  const readiness = driver.readiness ?? { state: 'unknown', score: 0, blocker_reasons: [] }
  const trailerType = driver.vehicle?.trailer_type?.replace('_', ' ') ?? 'unknown'
  const capacity = driver.vehicle?.capacity_lbs ?? 0

  return (
    <div
      onClick={() => setSelectedDriver(isSelected ? null : driver.driver_id)}
      className={`px-4 py-3 border-b border-[#f1f3f4] cursor-pointer transition-colors ${
        isSelected ? 'bg-[#e8f0fe] border-l-2 border-l-[#1a73e8]' : 'hover:bg-[#f8f9fa]'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full ${avatarBg} flex items-center justify-center text-white text-xs font-semibold shrink-0`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-[#202124] truncate">{driver.name}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {feedUrl && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${attention >= 80 ? 'bg-red-100 text-red-700' : attention >= 55 ? 'bg-orange-100 text-orange-700' : 'bg-[#e8f0fe] text-[#1a73e8]'}`}>
                  Vision {attention || 'live'}
                </span>
              )}
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                {cfg.label}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-[#5f6368]">
            <span className="flex items-center gap-1">
              <MapPin size={11} />
              {driver.location.city}, {driver.location.state}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {driver.hos.drive_remaining_hrs.toFixed(1)}h HOS
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2 text-[10px]">
            <span className={`px-2 py-0.5 rounded-full font-semibold ${READINESS_CONFIG[readiness.state] ?? 'text-gray-700 bg-gray-100'}`}>
              {readiness.state.replace('_', ' ')} · {readiness.score}
            </span>
            <span className="text-[#5f6368] truncate">
              {trailerType} · {capacity.toLocaleString()} lbs
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
