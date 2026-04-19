import { useEffect } from 'react'
import { X, Zap } from 'lucide-react'
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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[620px] max-w-[90vw] animate-slide-up">
      <div className="bg-white border border-[#dadce0] rounded-xl p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[#e8f0fe] flex items-center justify-center shrink-0">
            <Zap size={14} className="text-[#1a73e8]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold text-[#1a73e8] uppercase tracking-widest mb-1">
              Simulation Result
              {simulationResult && (
                <span className="ml-2 text-[#5f6368] normal-case font-normal">
                  · {simulationResult.estimated_miles.toFixed(0)} mi · {simulationResult.estimated_hours.toFixed(1)}h · ${simulationResult.total_cost.toFixed(0)}
                </span>
              )}
            </div>
            <p className="text-sm text-[#202124] leading-relaxed">{narratorText}</p>
          </div>
          <button onClick={() => setShowNarrator(false)} className="text-[#5f6368] hover:text-[#202124] shrink-0">
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
