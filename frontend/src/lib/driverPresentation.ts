import type {
  AvailabilityWindowData,
  HOSData,
  LoadData,
  ReadinessData,
} from '../types'

export type SummaryTone = 'positive' | 'warning' | 'critical' | 'info' | 'neutral'

export const SUMMARY_TONE_STYLES: Record<SummaryTone, string> = {
  positive: 'border border-green-200 bg-green-50 text-green-700',
  warning: 'border border-amber-200 bg-amber-50 text-amber-700',
  critical: 'border border-red-200 bg-red-50 text-red-700',
  info: 'border border-blue-200 bg-blue-50 text-blue-700',
  neutral: 'border border-[#dadce0] bg-[#f8f9fa] text-[#5f6368]',
}

export function humanizeLabel(value: string) {
  return value.replace(/_/g, ' ')
}

export function formatShortTime(value?: string | null) {
  if (!value) return null
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function formatShortDateTime(value?: string | null) {
  if (!value) return null
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatAvailabilityWindow(window: AvailabilityWindowData) {
  const start = formatShortTime(window.available_from)
  const end = formatShortTime(window.available_until)
  if (!start || !end) return 'No window set'
  return `${start} - ${end}`
}

export function getAvailabilitySummary(readiness: ReadinessData, currentLoad: LoadData | null) {
  const availableAt = formatShortTime(readiness.available_at)

  switch (readiness.state) {
    case 'ready':
      return { label: 'Available now', tone: 'positive' as const }
    case 'assigned':
      return { label: availableAt ? `Available at ${availableAt}` : 'On active load', tone: 'info' as const }
    case 'limited':
      return { label: availableAt ? `Limited until ${availableAt}` : 'Limited availability', tone: 'warning' as const }
    case 'at_risk':
      return { label: availableAt ? `At risk until ${availableAt}` : 'At risk', tone: 'warning' as const }
    case 'blocked':
      return { label: availableAt ? `Available at ${availableAt}` : 'Blocked', tone: 'critical' as const }
    default:
      if (currentLoad) {
        return { label: availableAt ? `Available at ${availableAt}` : 'On active load', tone: 'info' as const }
      }
      if (availableAt) {
        return { label: `Available at ${availableAt}`, tone: 'neutral' as const }
      }
      return { label: 'Awaiting status', tone: 'neutral' as const }
  }
}

export function getHosSummary(hos: HOSData) {
  const driveTime = hos.drive_remaining_hrs

  if (driveTime < 2) {
    return { label: `Critical HOS · ${driveTime.toFixed(1)}h left`, tone: 'critical' as const }
  }
  if (driveTime < 4) {
    return { label: `Tight HOS · ${driveTime.toFixed(1)}h left`, tone: 'warning' as const }
  }
  return { label: `Healthy HOS · ${driveTime.toFixed(1)}h left`, tone: 'positive' as const }
}
