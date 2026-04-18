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
      } catch {
        setIsLoadingCosts(false)
      }
    }
    if (!costChartData.length) load()
  }, [])

  async function refresh() {
    setIsLoadingCosts(true)
    try {
      const result = await fetchCostInsights()
      setCostData(result.chart_data, result.insights)
    } catch {
      setIsLoadingCosts(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800/60 shrink-0 flex items-center justify-between">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cost Intelligence</h2>
        <button
          onClick={refresh}
          disabled={isLoadingCosts}
          className="text-[10px] text-gray-600 hover:text-amber-400 transition-colors disabled:opacity-50"
        >
          {isLoadingCosts ? '...' : '↺ Refresh'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {isLoadingCosts && !costChartData.length ? (
          <div className="flex items-center justify-center h-40 gap-2 text-gray-600 text-sm">
            <span className="w-4 h-4 border-2 border-gray-700 border-t-amber-500 rounded-full animate-spin" />
            Analyzing fleet costs...
          </div>
        ) : (
          <>
            <div className="mb-4">
              <div className="text-[10px] text-gray-600 uppercase tracking-wide mb-2">Cost Per Mile by Driver</div>
              <CostChart data={costChartData} />
            </div>

            {costInsights.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">AI Insights</div>
                {costInsights.map((insight, i) => (
                  <InsightCard key={i} insight={insight} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
