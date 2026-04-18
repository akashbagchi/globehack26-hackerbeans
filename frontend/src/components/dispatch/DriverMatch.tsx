import { useFleetStore } from '../../store/fleetStore'
import type { DriverRecommendation } from '../../types'

interface DriverMatchProps {
  rec: DriverRecommendation
}

const RANK_BADGES = [
  { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40', label: '#1' },
  { bg: 'bg-gray-500/20', text: 'text-gray-300', border: 'border-gray-500/40', label: '#2' },
  { bg: 'bg-orange-900/20', text: 'text-orange-500', border: 'border-orange-800/40', label: '#3' },
]

export function DriverMatch({ rec }: DriverMatchProps) {
  const selectedMatchId = useFleetStore((s) => s.selectedMatchId)
  const setSelectedMatch = useFleetStore((s) => s.setSelectedMatch)
  const isSelected = selectedMatchId === rec.driver_id
  const badge = RANK_BADGES[rec.rank - 1] || RANK_BADGES[2]

  return (
    <div
      onClick={() => setSelectedMatch(rec.driver_id)}
      className={`p-3 rounded-xl border cursor-pointer transition-all ${
        isSelected
          ? 'bg-indigo-500/10 border-indigo-400/40'
          : 'bg-gray-800/40 border-gray-700/50 hover:border-gray-600'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
          {badge.label}
        </span>
        <span className="text-sm font-semibold text-gray-200">{rec.driver_name}</span>
        <span className="ml-auto text-xs font-bold bg-gray-900 px-1.5 py-0.5 rounded text-gray-400">
          {rec.score}/100
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2 text-center">
        <div>
          <div className="text-[10px] text-gray-600 mb-0.5">Distance</div>
          <div className="text-xs text-gray-300">{rec.distance_to_pickup_miles.toFixed(0)}mi</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-600 mb-0.5">HOS Left</div>
          <div className="text-xs text-gray-300">{rec.hos_remaining_hrs.toFixed(1)}h</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-600 mb-0.5">Cost Delta</div>
          <div className={`text-xs font-bold ${rec.cost_delta_vs_avg <= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {rec.cost_delta_vs_avg > 0 ? '+' : ''}{rec.cost_delta_vs_avg.toFixed(2)}/mi
          </div>
        </div>
      </div>

      <p className="text-[11px] text-gray-500 italic leading-relaxed">{rec.reasoning}</p>
    </div>
  )
}
