import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts'
import type { CostChartEntry } from '../../types'

interface CostChartProps {
  data: CostChartEntry[]
}

function getColor(index: number, total: number): string {
  const ratio = index / Math.max(total - 1, 1)
  const r = Math.round(34 + ratio * (239 - 34))
  const g = Math.round(197 - ratio * (197 - 68))
  const b = Math.round(94 - ratio * (94 - 68))
  return `rgb(${r},${g},${b})`
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CostChartEntry }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-xs shadow-xl">
      <div className="font-semibold text-gray-200 mb-1">{d.full_name}</div>
      <div className="text-amber-400">${d.cost_per_mile.toFixed(2)}/mi</div>
      <div className="text-gray-500">{d.miles_today} miles today</div>
    </div>
  )
}

export function CostChart({ data }: CostChartProps) {
  if (!data.length) return null
  const sorted = [...data].sort((a, b) => a.cost_per_mile - b.cost_per_mile)

  return (
    <div className="w-full h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={{ stroke: '#374151' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="cost_per_mile" radius={[4, 4, 0, 0]}>
            {sorted.map((_, i) => (
              <Cell key={i} fill={getColor(i, sorted.length)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
