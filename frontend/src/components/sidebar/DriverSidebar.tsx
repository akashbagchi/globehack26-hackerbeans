import { useFleetStore } from '../../store/fleetStore'
import { DriverCard } from './DriverCard'

export function DriverSidebar() {
  const drivers = useFleetStore((s) => s.drivers)
  const dataSource = useFleetStore((s) => s.dataSource)
  const drivingCount = drivers.filter((d) => d.status === 'driving').length

  return (
    <div className="flex flex-col h-full bg-gray-950/95 border-r border-gray-800">
      <div className="px-4 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Fleet</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-medium">
              {drivingCount} active
            </span>
            {dataSource === 'mock' && (
              <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-medium">DEMO</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
        {drivers.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-600 text-sm">
            Loading fleet...
          </div>
        ) : (
          drivers.map((driver) => <DriverCard key={driver.driver_id} driver={driver} />)
        )}
      </div>
    </div>
  )
}
