import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useFleetStore } from '../../store/fleetStore'
import { useUIStore } from '../../store/uiStore'

export function NarratorBanner() {
  const narratorText = useFleetStore((s) => s.narratorText)
  const simulationResult = useFleetStore((s) => s.simulationResult)
  const showNarrator = useUIStore((s) => s.showNarrator)
  const setShowNarrator = useUIStore((s) => s.setShowNarrator)

  useEffect(() => {
    if (!showNarrator) return
    const t = setTimeout(() => setShowNarrator(false), 10000)
    return () => clearTimeout(t)
  }, [showNarrator])

  if (!showNarrator || !narratorText) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[680px] max-w-[90vw] animate-slide-up">
      <div className="bg-gray-950/95 backdrop-blur border border-indigo-500/40 rounded-2xl p-4 shadow-[0_0_30px_rgba(129,140,248,0.2)]">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0">
            ⟳
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">
              Simulation Result
              {simulationResult && (
                <span className="ml-2 text-gray-500 normal-case">
                  · {simulationResult.estimated_miles.toFixed(0)} mi · {simulationResult.estimated_hours.toFixed(1)}h · ${simulationResult.total_cost.toFixed(0)}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-200 leading-relaxed">{narratorText}</p>
          </div>
          <button
            onClick={() => setShowNarrator(false)}
            className="text-gray-600 hover:text-gray-400 transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
