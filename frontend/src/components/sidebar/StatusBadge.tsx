interface StatusBadgeProps {
  status: 'driving' | 'idle' | 'off_duty'
}

const CONFIG = {
  driving: { label: 'DRIVING', bg: 'bg-green-500/20', text: 'text-green-400', dot: 'bg-green-400', pulse: true },
  idle: { label: 'IDLE', bg: 'bg-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-400', pulse: false },
  off_duty: { label: 'OFF DUTY', bg: 'bg-gray-600/30', text: 'text-gray-400', dot: 'bg-gray-500', pulse: false },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const c = CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${c.pulse ? 'animate-pulse' : ''}`} />
      {c.label}
    </span>
  )
}
