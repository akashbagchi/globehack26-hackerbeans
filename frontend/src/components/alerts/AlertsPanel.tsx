'use client'
import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { RefreshCw, X, Clock, CreditCard, AlertTriangle, Truck, Navigation } from 'lucide-react'
import { useFleetStore } from '../../store/fleetStore'
import { fetchAlerts, dismissAlert, runReconciliation } from '../../api/client'
import type { FleetAlert } from '../../types'

const TYPE_CONFIG: Record<FleetAlert['alert_type'], { label: string; Icon: LucideIcon }> = {
  late_delivery:       { label: 'Late Delivery',       Icon: Clock },
  missed_checkin:      { label: 'Missed Check-In',     Icon: Navigation },
  hos_risk:            { label: 'HOS Risk',             Icon: Truck },
  unexpected_spend:    { label: 'Unexpected Spend',    Icon: CreditCard },
  suspicious_stoppage: { label: 'Route Deviation',     Icon: AlertTriangle },
}

const SEVERITY_STYLES: Record<FleetAlert['severity'], string> = {
  critical: 'border-red-200 bg-red-50',
  warning:  'border-orange-200 bg-orange-50',
  info:     'border-blue-200 bg-blue-50',
}

const SEVERITY_BADGE: Record<FleetAlert['severity'], string> = {
  critical: 'bg-red-100 text-red-700',
  warning:  'bg-orange-100 text-orange-700',
  info:     'bg-blue-100 text-blue-700',
}

const SEVERITY_ICON: Record<FleetAlert['severity'], string> = {
  critical: 'text-red-500',
  warning:  'text-orange-500',
  info:     'text-blue-500',
}

const ALERT_TYPE_ORDER: FleetAlert['alert_type'][] = [
  'hos_risk', 'missed_checkin', 'late_delivery', 'unexpected_spend', 'suspicious_stoppage',
]

export function AlertsPanel() {
  const alerts = useFleetStore((s) => s.alerts)
  const setAlerts = useFleetStore((s) => s.setAlerts)
  const isLoading = useFleetStore((s) => s.isLoadingAlerts)
  const setIsLoading = useFleetStore((s) => s.setIsLoadingAlerts)
  const [reconciling, setReconciling] = useState(false)
  const [lastRun, setLastRun] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | FleetAlert['alert_type']>('all')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setIsLoading(true)
    try {
      const data = await fetchAlerts()
      setAlerts(data)
    } catch (e) {
      console.error('Failed to load alerts:', e)
      setIsLoading(false)
    }
  }

  async function handleRerun() {
    setReconciling(true)
    try {
      await runReconciliation()
      setLastRun(new Date().toLocaleTimeString())
      await load()
    } catch (e) {
      console.error('Reconciliation failed:', e)
    } finally {
      setReconciling(false)
    }
  }

  async function handleDismiss(alertId: string) {
    await dismissAlert(alertId)
    setAlerts(alerts.map((a) => a.alert_id === alertId ? { ...a, status: 'dismissed' } : a))
  }

  const visible = alerts.filter((a) => a.status === 'unresolved')
  const filtered = filter === 'all' ? visible : visible.filter((a) => a.alert_type === filter)

  const sorted = [...filtered].sort((a, b) => {
    const sev = { critical: 0, warning: 1, info: 2 }
    if (sev[a.severity] !== sev[b.severity]) return sev[a.severity] - sev[b.severity]
    return ALERT_TYPE_ORDER.indexOf(a.alert_type) - ALERT_TYPE_ORDER.indexOf(b.alert_type)
  })

  const criticalCount = visible.filter((a) => a.severity === 'critical').length
  const warningCount  = visible.filter((a) => a.severity === 'warning').length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#dadce0] shrink-0">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-[#202124]">Reconciliation Alerts</p>
          <button
            onClick={handleRerun}
            disabled={reconciling}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#1a73e8] border border-[#1a73e8]/30 rounded hover:bg-[#e8f0fe] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={11} className={reconciling ? 'animate-spin' : ''} />
            {reconciling ? 'Running…' : 'Re-run'}
          </button>
        </div>

        {/* Summary chips */}
        <div className="flex gap-2 mb-3">
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
              {criticalCount} Critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">
              {warningCount} Warning
            </span>
          )}
          {visible.length === 0 && (
            <span className="text-xs text-[#5f6368]">No unresolved alerts</span>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-1">
          {(['all', ...ALERT_TYPE_ORDER] as const).map((type) => {
            const count = type === 'all' ? visible.length : visible.filter((a) => a.alert_type === type).length
            if (type !== 'all' && count === 0) return null
            return (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                  filter === type
                    ? 'bg-[#1a73e8] text-white'
                    : 'bg-[#f1f3f4] text-[#5f6368] hover:bg-[#e8eaed]'
                }`}
              >
                {type === 'all' ? 'All' : TYPE_CONFIG[type].label} {count > 0 && `(${count})`}
              </button>
            )
          })}
        </div>

        {lastRun && (
          <p className="text-[10px] text-[#5f6368] mt-1.5">Last reconciled at {lastRun}</p>
        )}
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-24 text-sm text-[#5f6368]">Loading…</div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-[#5f6368]">
            <AlertTriangle size={28} className="opacity-30" />
            <p className="text-sm font-medium">No alerts in this category</p>
          </div>
        ) : (
          <div className="divide-y divide-[#dadce0]">
            {sorted.map((alert) => {
              const { label, Icon } = TYPE_CONFIG[alert.alert_type]
              return (
                <div
                  key={alert.alert_id}
                  className={`px-4 py-3 border-l-4 ${SEVERITY_STYLES[alert.severity]}`}
                  style={{ borderLeftColor: alert.severity === 'critical' ? '#ef4444' : alert.severity === 'warning' ? '#f97316' : '#3b82f6' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <Icon size={14} className={`mt-0.5 shrink-0 ${SEVERITY_ICON[alert.severity]}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-[#202124] truncate">{alert.title}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${SEVERITY_BADGE[alert.severity]}`}>
                            {alert.severity}
                          </span>
                        </div>
                        <p className="text-xs text-[#5f6368] mt-0.5 leading-relaxed">{alert.detail}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-[#9aa0a6]">{label}</span>
                          {alert.driver_name && (
                            <span className="text-[10px] text-[#9aa0a6]">· {alert.driver_name}</span>
                          )}
                          <span className="text-[10px] text-[#9aa0a6]">
                            · {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDismiss(alert.alert_id)}
                      className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 text-[#9aa0a6] hover:text-[#5f6368] transition-colors"
                      title="Dismiss"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
