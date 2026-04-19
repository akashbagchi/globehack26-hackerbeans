import { Map, BarChart2, MessageSquare, Bell } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { TopBar } from './TopBar'
import { FleetMap } from '../map/FleetMap'
import { CostPanel } from '../costs/CostPanel'
import { ChatPanel } from '../chat/ChatPanel'
import { NarratorBanner } from '../narrator/NarratorBanner'
import { DispatchWorkspace } from '../dispatch/DispatchWorkspace'
import { AlertsPanel } from '../alerts/AlertsPanel'
import { useFleetStore } from '../../store/fleetStore'

const ICON_TABS = [
  { id: 'map' as const, icon: Map, label: 'Map' },
  { id: 'costs' as const, icon: BarChart2, label: 'Costs' },
  { id: 'chat' as const, icon: MessageSquare, label: 'Chat' },
  { id: 'alerts' as const, icon: Bell, label: 'Alerts' },
]

export function AppShell() {
  const activePanel = useUIStore((s) => s.activePanel)
  const setActivePanel = useUIStore((s) => s.setActivePanel)
  const alerts = useFleetStore((s) => s.alerts)

  const unresolvedCount = alerts.filter((a) => a.status === 'unresolved').length

  return (
    <div className="flex flex-col h-screen w-screen bg-white overflow-hidden">
      <TopBar />

      <div className="flex flex-1 min-h-0">
        {/* Icon strip */}
        <div className="w-14 shrink-0 bg-white border-r border-[#dadce0] flex flex-col items-center py-3 gap-0.5">
          {ICON_TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = (tab.id === 'map' && activePanel === 'dispatch') ||
              (tab.id === 'costs' && activePanel === 'costs') ||
              (tab.id === 'chat' && activePanel === 'chat') ||
              (tab.id === 'alerts' && activePanel === 'alerts')
            return (
              <button
                key={tab.id}
                onClick={() => setActivePanel(tab.id === 'map' ? 'dispatch' : tab.id as 'costs' | 'chat' | 'alerts')}
                title={tab.label}
                className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isActive ? 'text-[#1a73e8] bg-[#e8f0fe]' : 'text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]'
                }`}
              >
                <Icon size={18} />
                {tab.id === 'alerts' && unresolvedCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {unresolvedCount > 99 ? '99+' : unresolvedCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Left panel */}
        <div className="w-116 shrink-0 bg-white border-r border-[#dadce0] flex flex-col min-h-0">
          {activePanel === 'dispatch' && <DispatchWorkspace />}
          {activePanel === 'costs' && <CostPanel />}
          {activePanel === 'chat' && <ChatPanel />}
          {activePanel === 'alerts' && <AlertsPanel />}
        </div>

        {/* Map */}
        <div className="flex-1 min-w-0 relative">
          <FleetMap />
        </div>
      </div>

      <NarratorBanner />
    </div>
  )
}
