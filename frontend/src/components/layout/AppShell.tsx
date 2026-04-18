import { useUIStore } from '../../store/uiStore'
import { TopBar } from './TopBar'
import { DriverSidebar } from '../sidebar/DriverSidebar'
import { FleetMap } from '../map/FleetMap'
import { DispatchPanel } from '../dispatch/DispatchPanel'
import { CostPanel } from '../costs/CostPanel'
import { ChatPanel } from '../chat/ChatPanel'
import { NarratorBanner } from '../narrator/NarratorBanner'

const TABS = [
  { id: 'dispatch' as const, label: 'Dispatch' },
  { id: 'costs' as const, label: 'Costs' },
  { id: 'chat' as const, label: 'Chat' },
]

export function AppShell() {
  const activePanel = useUIStore((s) => s.activePanel)
  const setActivePanel = useUIStore((s) => s.setActivePanel)

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-950 overflow-hidden">
      <TopBar />

      <div className="flex flex-1 min-h-0">
        <div className="w-72 shrink-0 min-h-0">
          <DriverSidebar />
        </div>

        <div className="flex-1 min-w-0 relative">
          <FleetMap />
        </div>

        <div className="w-96 shrink-0 flex flex-col bg-gray-950/95 border-l border-gray-800 min-h-0">
          <div className="flex border-b border-gray-800 shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActivePanel(tab.id)}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                  activePanel === tab.id
                    ? 'text-amber-400 border-b-2 border-amber-400 -mb-px'
                    : 'text-gray-600 hover:text-gray-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0">
            {activePanel === 'dispatch' && <DispatchPanel />}
            {activePanel === 'costs' && <CostPanel />}
            {activePanel === 'chat' && <ChatPanel />}
          </div>
        </div>
      </div>

      <NarratorBanner />
    </div>
  )
}
