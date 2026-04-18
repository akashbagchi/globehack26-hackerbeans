import { useEffect } from 'react'
import { fetchCostInsights } from '../../api/client'
import { useFleetStore } from '../../store/fleetStore'
import { CostChart } from './CostChart'
import { InsightCard } from './InsightCard'

export function CostPanel() {
  const costChartData = useFleetStore((s) => s.costChartData)
  const costInsights = useFleetStore((s) => s.costInsights)
  const isLoadingCosts = useFleetStore((s) => s.isLoadingCosts)
  const setCostData = useFleetStore((s) => s.setCostData)
  const setIsLoadingCosts = useFleetStore((s) => s.setIsLoadingCosts)

  useEffect(() => {
    async function load() {
      setIsLoadingCosts(true)
      try {
        const result = await fetchCostInsights()
        setCostData(result.chart_data, result.insights)
      } catch { setIsLoadingCosts(false) }
    }
    if (!costChartData.length) load()
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-100 shrink-0 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Cost Intelligence</h2>
        <button
          onClick={async () => {
            setIsLoadingCosts(true)
            try { const r = await fetchCostInsights(); setCostData(r.chart_data, r.insights) }
            catch { setIsLoadingCosts(false) }
          }}
          disabled={isLoadingCosts}
          className="text-xs text-blue-500 hover:text-blue-600 disabled:opacity-50"
        >
          {isLoadingCosts ? '...' : '↺ Refresh'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoadingCosts && !costChartData.length ? (
          <div className="flex items-center justify-center h-40 gap-2 text-sm text-gray-400">
            <span className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
            Analyzing fleet costs...
          </div>
        ) : (
          <>
            <div className="mb-4">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Cost Per Mile by Driver</div>
              <CostChart data={costChartData} />
            </div>
            {costInsights.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">AI Insights</div>
                {costInsights.map((insight, i) => <InsightCard key={i} insight={insight} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
