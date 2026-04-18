import { useFleetStore } from '../../store/fleetStore'

export function TopBar() {
  const drivers = useFleetStore((s) => s.drivers)
  const lastUpdated = useFleetStore((s) => s.lastUpdated)
  const dataSource = useFleetStore((s) => s.dataSource)

  const activeCount = drivers.filter((d) => d.status === 'driving').length
  const totalMiles = drivers.reduce((sum, d) => sum + d.economics.miles_today, 0)
  const avgCpm = drivers.length
    ? (drivers.reduce((s, d) => s + d.economics.cost_per_mile, 0) / drivers.length).toFixed(2)
    : '--'

  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--'

  return (
    <div className="h-12 bg-gray-950 border-b border-gray-800 flex items-center px-4 gap-6 shrink-0 z-10">
      <div className="flex items-center gap-2">
        <span className="text-lg font-black tracking-[0.15em] text-amber-400">SAURON</span>
        <span className="text-[9px] text-gray-600 uppercase tracking-widest hidden sm:block">Fleet Digital Twin</span>
      </div>

      <div className="flex items-center gap-4 ml-auto text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-gray-400"><span className="text-green-400 font-bold">{activeCount}</span> active</span>
        </div>
        <div className="text-gray-600 hidden md:block">
          <span className="text-gray-400 font-medium">{totalMiles.toLocaleString()}</span> mi today
        </div>
        <div className="text-gray-600 hidden md:block">
          avg <span className="text-amber-400 font-medium">${avgCpm}</span>/mi
        </div>
        <div className="text-gray-700 hidden lg:block">{timeStr}</div>
        {dataSource && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
            dataSource === 'mock' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
          }`}>
            {dataSource === 'mock' ? 'DEMO' : 'LIVE'}
          </span>
        )}
      </div>
    </div>
  )
}
