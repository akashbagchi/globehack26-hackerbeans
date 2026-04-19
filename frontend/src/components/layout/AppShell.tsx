import { Map, BarChart2, MessageSquare } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { TopBar } from './TopBar'
import { FleetMap } from '../map/FleetMap'
import { CostPanel } from '../costs/CostPanel'
import { ChatPanel } from '../chat/ChatPanel'
import { NarratorBanner } from '../narrator/NarratorBanner'
import { DispatchWorkspace } from '../dispatch/DispatchWorkspace'

const ICON_TABS = [
  { id: 'map' as const, icon: Map, label: 'Map' },
  { id: 'costs' as const, icon: BarChart2, label: 'Costs' },
  { id: 'chat' as const, icon: MessageSquare, label: 'Chat' },
]

export function AppShell() {
  const activePanel = useUIStore((s) => s.activePanel)
  const setActivePanel = useUIStore((s) => s.setActivePanel)

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
              (tab.id === 'chat' && activePanel === 'chat')
            return (
              <button
                key={tab.id}
                onClick={() => setActivePanel(tab.id === 'map' ? 'dispatch' : tab.id as 'costs' | 'chat')}
                title={tab.label}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isActive ? 'text-[#1a73e8] bg-[#e8f0fe]' : 'text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]'
                }`}
              >
                <Icon size={18} />
              </button>
            )
          })}
        </div>

        {/* Left panel */}
        <div className="w-116 shrink-0 bg-white border-r border-[#dadce0] flex flex-col min-h-0">
          {activePanel === 'dispatch' && <DispatchWorkspace />}
          {activePanel === 'costs' && <CostPanel />}
          {activePanel === 'chat' && <ChatPanel />}
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
