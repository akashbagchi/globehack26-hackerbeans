const MAX_DRIVE_HRS = 11

interface HOSBarProps {
  remaining: number
}

export function HOSBar({ remaining }: HOSBarProps) {
  const pct = Math.min(100, (remaining / MAX_DRIVE_HRS) * 100)
  const color = remaining > 4 ? 'bg-green-500' : remaining > 2 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wide">HOS</span>
        <span className={`text-[10px] font-medium ${remaining > 4 ? 'text-green-400' : remaining > 2 ? 'text-yellow-400' : 'text-red-400'}`}>
          {remaining.toFixed(1)}h
        </span>
      </div>
      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
