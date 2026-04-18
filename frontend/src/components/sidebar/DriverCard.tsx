import { MapPin, Clock } from 'lucide-react'
import { useFleetStore } from '../../store/fleetStore'
import type { Driver } from '../../types'

const STATUS_CONFIG = {
  driving: { label: 'Driving', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  idle: { label: 'Idle', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  off_duty: { label: 'Off Duty', color: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-500',
  'bg-orange-500', 'bg-pink-500', 'bg-teal-500', 'bg-red-500', 'bg-indigo-500',
]

interface DriverCardProps {
  driver: Driver
  index?: number
}

export function DriverCard({ driver, index = 0 }: DriverCardProps) {
  const selectedDriverId = useFleetStore((s) => s.selectedDriverId)
  const setSelectedDriver = useFleetStore((s) => s.setSelectedDriver)
  const isSelected = selectedDriverId === driver.driver_id
  const cfg = STATUS_CONFIG[driver.status]
  const initials = driver.name.split(' ').map((n) => n[0]).join('')
  const avatarBg = AVATAR_COLORS[index % AVATAR_COLORS.length]

  return (
    <div
      onClick={() => setSelectedDriver(isSelected ? null : driver.driver_id)}
      className={`px-4 py-3 border-b border-gray-50 cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full ${avatarBg} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-800 truncate">{driver.name}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${cfg.color}`}>
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-400">
            <span className="flex items-center gap-1">
              <MapPin size={10} />
              {driver.location.city}, {driver.location.state}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {driver.hos.drive_remaining_hrs.toFixed(1)}h HOS
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
