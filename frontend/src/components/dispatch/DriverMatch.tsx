import { useFleetStore } from '../../store/fleetStore'
import type { DriverRecommendation } from '../../types'

interface DriverMatchProps {
  rec: DriverRecommendation
}

const RANK_STYLES = [
  { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', label: '#1' },
  { bg: 'bg-gray-50 border-gray-200', badge: 'bg-gray-100 text-gray-600', label: '#2' },
  { bg: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-600', label: '#3' },
]

export function DriverMatch({ rec }: DriverMatchProps) {
  const selectedMatchId = useFleetStore((s) => s.selectedMatchId)
  const setSelectedMatch = useFleetStore((s) => s.setSelectedMatch)
  const isSelected = selectedMatchId === rec.driver_id
  const style = RANK_STYLES[rec.rank - 1] || RANK_STYLES[2]

  return (
    <div
      onClick={() => setSelectedMatch(rec.driver_id)}
      className={`p-3 rounded-xl border cursor-pointer transition-all ${
        isSelected ? 'border-blue-400 bg-blue-50' : `${style.bg} border hover:border-gray-300`
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}>{style.label}</span>
        <span className="text-sm font-semibold text-gray-800">{rec.driver_name}</span>
        <span className="ml-auto text-xs font-bold text-gray-400">{rec.score}/100</span>
      </div>
      <div className="grid grid-cols-3 gap-1 mb-2 text-center">
        <div className="bg-white rounded-lg p-1.5">
          <div className="text-[9px] text-gray-400">Distance</div>
          <div className="text-xs font-semibold text-gray-700">{rec.distance_to_pickup_miles.toFixed(0)}mi</div>
        </div>
        <div className="bg-white rounded-lg p-1.5">
          <div className="text-[9px] text-gray-400">HOS Left</div>
          <div className="text-xs font-semibold text-gray-700">{rec.hos_remaining_hrs.toFixed(1)}h</div>
        </div>
        <div className="bg-white rounded-lg p-1.5">
          <div className="text-[9px] text-gray-400">vs Avg</div>
          <div className={`text-xs font-bold ${rec.cost_delta_vs_avg <= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {rec.cost_delta_vs_avg > 0 ? '+' : ''}{rec.cost_delta_vs_avg.toFixed(2)}/mi
          </div>
        </div>
      </div>
      <p className="text-[11px] text-gray-500 italic">{rec.reasoning}</p>
    </div>
  )
}
