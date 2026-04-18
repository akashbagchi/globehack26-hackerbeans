interface FuelGaugeProps {
  level: number
}

export function FuelGauge({ level }: FuelGaugeProps) {
  const color = level > 50 ? 'from-cyan-600 to-cyan-400' : level > 25 ? 'from-yellow-600 to-yellow-400' : 'from-red-700 to-red-500'

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wide">Fuel</span>
        <span className="text-[10px] text-gray-400">{level}%</span>
      </div>
      <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`}
          style={{ width: `${level}%` }}
        />
      </div>
    </div>
  )
}
