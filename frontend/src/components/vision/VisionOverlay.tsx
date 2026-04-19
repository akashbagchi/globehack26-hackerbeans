'use client'

import { AlertTriangle, Camera, Eye, ShieldAlert } from 'lucide-react'
import { getVisionFeedAssignments } from '../../lib/visionFeeds'
import { useFleetStore } from '../../store/fleetStore'
import type { VisionDriverAlert } from '../../types'
import { VisionVideoPlayer } from './VisionVideoPlayer'

const STATUS_STYLES: Record<VisionDriverAlert['status'], string> = {
  clear: 'border-emerald-200 bg-white/92 text-emerald-800',
  watch: 'border-orange-200 bg-orange-50/95 text-orange-800',
  critical: 'border-red-300 bg-red-50/95 text-red-900',
}

export function VisionOverlay() {
  const drivers = useFleetStore((s) => s.drivers)
  const visionByDriver = useFleetStore((s) => s.visionByDriver)
  const setSelectedDriver = useFleetStore((s) => s.setSelectedDriver)
  const assignments = getVisionFeedAssignments(drivers)
  const alerts = Object.values(visionByDriver).sort((a, b) => b.attention_score - a.attention_score)
  const priorityFeed = alerts[0] ?? null
  const criticalAlert = alerts.find((alert) => alert.status === 'critical') ?? null

  if (!priorityFeed && !criticalAlert) return null

  return (
    <>
      {criticalAlert && (
        <button
          onClick={() => setSelectedDriver(criticalAlert.driver_id)}
          className="absolute left-4 top-4 z-20 flex max-w-md items-start gap-3 rounded-2xl border border-red-300 bg-red-50/95 px-4 py-3 text-left shadow-[0_8px_24px_rgba(220,38,38,0.12)] backdrop-blur"
        >
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-red-600" />
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-red-600">Critical Vision Alert</div>
            <div className="mt-1 text-sm font-semibold text-[#202124]">
              {criticalAlert.driver_name} ({criticalAlert.truck_number})
            </div>
            <p className="mt-1 text-sm leading-relaxed text-[#5f6368]">{criticalAlert.summary}</p>
            <div className="mt-2 text-xs font-medium text-red-700">
              Attention {criticalAlert.attention_score} · Confidence {criticalAlert.confidence}%
            </div>
          </div>
        </button>
      )}

      {priorityFeed && (
        <button
          onClick={() => setSelectedDriver(priorityFeed.driver_id)}
          className="absolute right-4 top-4 z-20 flex w-[320px] flex-col overflow-hidden rounded-2xl border border-[#dadce0] bg-white/96 text-left shadow-[0_16px_50px_rgba(15,23,42,0.18)] backdrop-blur"
        >
          <div className="flex items-center justify-between border-b border-[#eceff1] px-4 py-3">
            <div className="flex items-center gap-2">
              <Eye size={16} className="text-[#1a73e8]" />
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5f6368]">Live Vision Feed</div>
                <div className="text-sm font-semibold text-[#202124]">{priorityFeed.driver_name}</div>
              </div>
            </div>
            <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${STATUS_STYLES[priorityFeed.status]}`}>
              {priorityFeed.status}
            </span>
          </div>

          {priorityFeed.video_url && (
            <VisionVideoPlayer
              src={assignments[priorityFeed.driver_id] ?? priorityFeed.video_url}
              className="aspect-video w-full"
            />
          )}

          <div className="space-y-2 px-4 py-3">
            <div className="flex items-center justify-between text-xs text-[#5f6368]">
              <span className="inline-flex items-center gap-1"><Camera size={12} /> Auto-prioritized feed</span>
              <span>Attention {priorityFeed.attention_score}</span>
            </div>
            <p className="text-sm text-[#202124]">{priorityFeed.summary}</p>
            <div className="flex items-center justify-between text-xs text-[#5f6368]">
              <span>{priorityFeed.primary_issue ? formatIssue(priorityFeed.primary_issue) : 'No active issue'}</span>
              <span>{priorityFeed.confidence}% confidence</span>
            </div>
          </div>
        </button>
      )}

      {alerts.length > 1 && (
        <div className="absolute bottom-4 left-4 z-20">
          <div className="flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50/90 px-3 py-1.5 text-xs font-medium text-orange-700 backdrop-blur shadow-sm">
            <AlertTriangle size={12} />
            {alerts.length - 1} more driver{alerts.length - 1 > 1 ? 's' : ''} flagged
          </div>
        </div>
      )}
    </>
  )
}

function formatIssue(issue: VisionDriverAlert['primary_issue']) {
  return issue ? issue.replace(/_/g, ' ') : 'No issue'
}
