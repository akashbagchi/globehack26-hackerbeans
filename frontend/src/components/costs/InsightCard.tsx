import { TrendingUp, AlertTriangle, Zap, DollarSign } from 'lucide-react'
import type { InsightCard as InsightCardType } from '../../types'

const ICONS = { trending_up: TrendingUp, alert_triangle: AlertTriangle, zap: Zap, dollar_sign: DollarSign }
const SEVERITY = {
  info: 'border-l-blue-400 bg-blue-50',
  warning: 'border-l-yellow-400 bg-yellow-50',
  critical: 'border-l-red-400 bg-red-50',
}

export function InsightCard({ insight }: { insight: InsightCardType }) {
  const Icon = ICONS[insight.icon as keyof typeof ICONS] || Zap
  const style = SEVERITY[insight.severity] || SEVERITY.info

  return (
    <div className={`p-3 rounded-xl border-l-4 border border-gray-100 ${style}`}>
      <div className="flex items-start gap-2.5">
        <Icon size={14} className="text-gray-500 mt-0.5 shrink-0" />
        <div>
          <div className="text-sm font-semibold text-gray-700 mb-0.5">{insight.title}</div>
          <div className="text-[11px] text-gray-500 leading-relaxed">{insight.detail}</div>
        </div>
      </div>
    </div>
  )
}
