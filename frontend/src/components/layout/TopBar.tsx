import { Map, BarChart2, Pin, MessageSquare, LayoutGrid } from 'lucide-react'
import { useFleetStore } from '../../store/fleetStore'
import { useUIStore } from '../../store/uiStore'

const NAV_TABS = [
  { id: 'dispatch' as const, icon: Map, label: 'Map' },
  { id: 'costs' as const, icon: BarChart2, label: 'Reports' },
]

export function TopBar() {
  const drivers = useFleetStore((s) => s.drivers)
  const dataSource = useFleetStore((s) => s.dataSource)
  const activePanel = useUIStore((s) => s.activePanel)
  const setActivePanel = useUIStore((s) => s.setActivePanel)
  const activeCount = drivers.filter((d) => d.status === 'driving').length

  return (
    <div className="h-14 bg-white border-b border-[#dadce0] flex items-stretch px-4 shrink-0 z-10">
      {/* Logo */}
      <div className="flex items-center gap-2.5 pr-6 mr-2">
        <div className="w-8 h-8 bg-[#1a73e8] rounded flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-black">S</span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] font-medium text-[#5f6368] uppercase tracking-widest">AI Fleet</span>
          <span className="text-sm font-bold text-[#202124] tracking-wide">SAURON</span>
        </div>
      </div>

      {/* Nav tabs */}
      <div className="flex items-stretch gap-1">
        {NAV_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activePanel === tab.id || (tab.id === 'dispatch' && activePanel === 'chat')
          return (
            <button
              key={tab.id}
              onClick={() => setActivePanel(tab.id === 'dispatch' ? 'dispatch' : 'costs')}
              className={`flex items-center gap-1.5 px-4 text-sm font-medium border-b-2 transition-colors relative ${
                isActive
                  ? 'text-[#1a73e8] border-[#1a73e8]'
                  : 'text-[#5f6368] border-transparent hover:text-[#202124] hover:bg-[#f1f3f4]'
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-1">
        {dataSource && (
          <span className={`mr-3 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            dataSource === 'mock' ? 'bg-blue-100 text-[#1a73e8]' : 'bg-green-100 text-green-700'
          }`}>
            {dataSource === 'mock' ? 'DEMO' : 'LIVE'}
          </span>
        )}
        <span className="mr-3 text-xs text-[#5f6368]">
          <span className="text-green-600 font-semibold">{activeCount}</span> active
        </span>
        {[Pin, MessageSquare, LayoutGrid].map((Icon, i) => (
          <button key={i} className="w-9 h-9 flex items-center justify-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4] transition-colors">
            <Icon size={18} />
          </button>
        ))}
        <div className="w-8 h-8 rounded-full bg-[#1a73e8] flex items-center justify-center text-white text-xs font-bold ml-1">
          HA
        </div>
      </div>
    </div>
  )
}
