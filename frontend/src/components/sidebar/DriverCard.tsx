import { AlertTriangle, Clock, MapPin } from 'lucide-react'
import { useFleetStore } from '../../store/fleetStore'
import type { Driver } from '../../types'
import { getVisionFeedAssignments } from '../../lib/visionFeeds'
import {
  getAvailabilitySummary,
  getHosSummary,
  SUMMARY_TONE_STYLES,
} from '../../lib/driverPresentation'

const STATUS_CONFIG = {
  driving: { label: 'Driving', color: 'text-green-700 bg-green-50 border border-green-200' },
  idle: { label: 'Idle', color: 'text-yellow-700 bg-yellow-50 border border-yellow-200' },
  off_duty: { label: 'Off Duty', color: 'text-[#5f6368] bg-[#f1f3f4] border border-[#dadce0]' },
  unavailable: { label: 'Unavailable', color: 'text-orange-700 bg-orange-50 border border-orange-200' },
  breakdown: { label: 'Breakdown', color: 'text-red-700 bg-red-50 border border-red-200' },
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
  const visionAlert = visionByDriver[driver.driver_id] ?? null
  const cfg = STATUS_CONFIG[driver.status] ?? STATUS_CONFIG.unavailable
  const initials = driver.name.split(' ').map((n) => n[0]).join('')
  const avatarBg = AVATAR_COLORS[index % AVATAR_COLORS.length]
  const readiness = driver.readiness ?? { state: 'unknown', score: 0, blocker_reasons: [] }
  const availability = getAvailabilitySummary(readiness, driver.current_load)
  const hosSummary = getHosSummary(driver.hos)

  const exceptionChip = visionAlert?.status && visionAlert.status !== 'clear'
    ? {
        label: `Vision ${visionAlert.status}`,
        className: visionAlert.status === 'critical'
          ? 'border border-red-200 bg-red-50 text-red-700'
          : 'border border-orange-200 bg-orange-50 text-orange-700',
      }
    : readiness.blocker_reasons.length > 0 || driver.status === 'breakdown'
      ? {
          label: readiness.blocker_reasons.length > 0
            ? `${readiness.blocker_reasons.length} blocker${readiness.blocker_reasons.length > 1 ? 's' : ''}`
            : 'Needs attention',
          className: 'border border-red-200 bg-red-50 text-red-700',
        }
      : null

  return (
    <div
      onClick={() => setSelectedDriver(isSelected ? null : driver.driver_id)}
      className={`px-4 py-3 border-b border-[#f1f3f4] cursor-pointer transition-colors ${
        isSelected ? 'bg-[#e8f0fe] border-l-2 border-l-[#1a73e8]' : 'hover:bg-[#f8f9fa]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 w-9 h-9 rounded-full ${avatarBg} flex items-center justify-center text-white text-xs font-semibold shrink-0`}>
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-[#202124]">{driver.name}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.color}`}>
              {cfg.label}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-3 text-xs text-[#5f6368]">
            <span className="flex min-w-0 items-center gap-1 truncate">
              <MapPin size={11} />
              <span className="truncate">{driver.location.city}, {driver.location.state}</span>
            </span>
            <span className="flex min-w-0 items-center gap-1 truncate">
              <Clock size={11} />
              <span className="truncate">{hosSummary.label}</span>
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold">
            <span className={`rounded-full px-2 py-1 ${SUMMARY_TONE_STYLES[availability.tone]}`}>
              {availability.label}
            </span>

            {exceptionChip && (
              <span className={`rounded-full px-2 py-1 ${exceptionChip.className}`}>
                {exceptionChip.label}
              </span>
            )}

            {feedUrl && visionAlert?.status === 'clear' && (
              <span className="rounded-full border border-[#d2e3fc] bg-[#eef4ff] px-2 py-1 text-[#1a73e8]">
                Vision monitoring
              </span>
            )}
          </div>

          {(readiness.blocker_reasons[0] && !exceptionChip?.label.includes('blocker')) && (
            <div className="mt-2 flex items-center gap-1 text-[11px] text-red-700">
              <AlertTriangle size={11} />
              <span className="truncate">{readiness.blocker_reasons[0]}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
