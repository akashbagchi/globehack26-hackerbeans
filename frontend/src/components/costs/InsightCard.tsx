import { TrendingUp, AlertTriangle, Zap, DollarSign } from 'lucide-react'
import type { InsightCard as InsightCardType } from '../../types'

const ICONS = {
  trending_up: TrendingUp,
  alert_triangle: AlertTriangle,
  zap: Zap,
  dollar_sign: DollarSign,
}

const SEVERITY_STYLES = {
  info: 'border-l-blue-500/50 bg-blue-500/5',
  warning: 'border-l-yellow-500/50 bg-yellow-500/5',
  critical: 'border-l-red-500/50 bg-red-500/5',
}

interface InsightCardProps {
  insight: InsightCardType
}

export function InsightCard({ insight }: InsightCardProps) {
  const Icon = ICONS[insight.icon as keyof typeof ICONS] || Zap
  const style = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info

  return (
    <div className={`p-3 rounded-xl border-l-4 ${style} border border-gray-800/60 backdrop-blur`}>
      <div className="flex items-start gap-2.5">
        <Icon size={16} className="text-amber-400 mt-0.5 shrink-0" />
        <div>
          <div className="text-sm font-semibold text-gray-200 mb-0.5">{insight.title}</div>
          <div className="text-[11px] text-gray-500 leading-relaxed">{insight.detail}</div>
        </div>
      </div>
    </div>
  )
}
