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
      <div className="px-5 py-4 border-b border-[#dadce0] shrink-0 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#202124]">Cost Intelligence Report</h2>
        <button
          onClick={async () => {
            setIsLoadingCosts(true)
            try { const r = await fetchCostInsights(); setCostData(r.chart_data, r.insights) }
            catch { setIsLoadingCosts(false) }
          }}
          disabled={isLoadingCosts}
          className="text-xs text-[#1a73e8] hover:text-[#1557b0] disabled:opacity-50 flex items-center gap-1"
        >
          <span className={isLoadingCosts ? 'animate-spin' : ''}>↺</span>
          {isLoadingCosts ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {isLoadingCosts && !costChartData.length ? (
          <div className="flex items-center justify-center h-40 gap-2 text-sm text-[#5f6368]">
            <span className="w-4 h-4 border-2 border-[#dadce0] border-t-[#1a73e8] rounded-full animate-spin" />
            Analyzing fleet costs...
          </div>
        ) : (
          <>
            <div className="mb-5">
              <div className="text-xs font-medium text-[#5f6368] uppercase tracking-wide mb-3">Cost Per Mile by Driver</div>
              <CostChart data={costChartData} />
            </div>
            {costInsights.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-[#5f6368] uppercase tracking-wide mb-2">AI Insights</div>
                {costInsights.map((insight, i) => <InsightCard key={i} insight={insight} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
