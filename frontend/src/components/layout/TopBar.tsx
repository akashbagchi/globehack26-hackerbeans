import { Map, BarChart2 } from 'lucide-react'
import { useFleetStore } from '../../store/fleetStore'
import { useUIStore } from '../../store/uiStore'

export function TopBar() {
  const drivers = useFleetStore((s) => s.drivers)
  const dataSource = useFleetStore((s) => s.dataSource)
  const activePanel = useUIStore((s) => s.activePanel)
  const setActivePanel = useUIStore((s) => s.setActivePanel)
  const activeCount = drivers.filter((d) => d.status === 'driving').length

  return (
    <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-6 shrink-0 z-10 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center">
          <span className="text-white text-xs font-black">S</span>
        </div>
        <span className="text-sm font-bold text-gray-800 tracking-wide">SAURON</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => setActivePanel('dispatch')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activePanel === 'dispatch'
              ? 'bg-blue-50 text-blue-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Map size={14} />
          Map
        </button>
        <button
          onClick={() => setActivePanel('costs')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activePanel === 'costs'
              ? 'bg-blue-50 text-blue-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <BarChart2 size={14} />
          Reports
        </button>
      </div>

      <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
        <span>
          <span className="text-green-600 font-semibold">{activeCount}</span> active drivers
        </span>
        {dataSource && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            dataSource === 'mock'
              ? 'bg-blue-100 text-blue-600'
              : 'bg-green-100 text-green-600'
          }`}>
            {dataSource === 'mock' ? 'DEMO MODE' : 'LIVE'}
          </span>
        )}
        <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs font-bold">
          D
        </div>
      </div>
    </div>
  )
}
