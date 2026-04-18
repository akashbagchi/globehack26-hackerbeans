import { useFleetStore } from '../../store/fleetStore'
import { StatusBadge } from './StatusBadge'
import { HOSBar } from './HOSBar'
import { FuelGauge } from './FuelGauge'
import type { Driver } from '../../types'

interface DriverCardProps {
  driver: Driver
}

export function DriverCard({ driver }: DriverCardProps) {
  const selectedDriverId = useFleetStore((s) => s.selectedDriverId)
  const setSelectedDriver = useFleetStore((s) => s.setSelectedDriver)
  const isSelected = selectedDriverId === driver.driver_id

  const initials = driver.name.split(' ').map((n) => n[0]).join('')

  return (
    <div
      onClick={() => setSelectedDriver(isSelected ? null : driver.driver_id)}
      className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'bg-amber-400/10 border-amber-400/40 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
          : 'bg-gray-900/60 border-gray-700/50 hover:border-gray-600 hover:bg-gray-900/80'
      }`}
    >
      <div className="flex items-start gap-2.5 mb-2.5">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          isSelected ? 'bg-amber-400/20 text-amber-300' : 'bg-gray-700 text-gray-300'
        }`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className={`text-sm font-semibold truncate ${isSelected ? 'text-amber-300' : 'text-gray-200'}`}>
              {driver.name}
            </span>
            <StatusBadge status={driver.status} />
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            {driver.truck_number} · {driver.location.city}, {driver.location.state}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <HOSBar remaining={driver.hos.drive_remaining_hrs} />
        <FuelGauge level={driver.vehicle.fuel_level_pct} />
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[10px]">
        <span className="text-gray-500">${driver.economics.cost_per_mile}/mi</span>
        {driver.current_load ? (
          <span className="text-gray-500 truncate max-w-[120px]">
            → {driver.current_load.destination.split(',')[0]}
          </span>
        ) : (
          <span className="text-gray-600 italic">No active load</span>
        )}
      </div>
    </div>
  )
}
