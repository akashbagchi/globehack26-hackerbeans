'use client'
import { useEffect, useRef, useState } from 'react'
import { MessageSquare, CheckCircle, XCircle, Zap } from 'lucide-react'
import { fetchRecentNotifications, triggerTestNotification } from '../../api/client'
import type { ReceiverNotification } from '../../types'

const FLEET_ID = 'fleet_demo'
const POLL_INTERVAL_MS = 8_000

// Demo-mode test payload — DRV004 Aaliyah Brooks, Atlanta → Miami
const DEMO_PAYLOAD = {
  driverId: 'DRV004',
  driverName: 'Aaliyah Brooks',
  reason: 'Major route deviation detected — 13.2 mi off planned corridor',
  etaDelta: 45,
  loadId: 'LOAD_DEMO_004',
  receiverPhone: process.env.NEXT_PUBLIC_DEMO_RECEIVER_PHONE ?? '',
  receiverName: process.env.NEXT_PUBLIC_DEMO_RECEIVER_NAME ?? 'Demo Receiver',
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export function ProactiveNotifyFeed() {
  const [notifications, setNotifications] = useState<ReceiverNotification[]>([])
  const [firing, setFiring] = useState(false)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const seenIds = useRef<Set<string>>(new Set())

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const rows = await fetchRecentNotifications(FLEET_ID)
        if (cancelled) return

        const incoming = new Set<string>()
        for (const n of rows) {
          if (!seenIds.current.has(n.receiver_notification_id)) {
            incoming.add(n.receiver_notification_id)
            seenIds.current.add(n.receiver_notification_id)
          }
        }

        setNotifications(rows)
        if (incoming.size > 0) {
          setNewIds(incoming)
          setTimeout(() => setNewIds(new Set()), 5_000)
        }
      } catch {
        // silent — feed is best-effort
      }
    }

    poll()
    const timer = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  async function handleFireTest() {
    if (!DEMO_PAYLOAD.receiverPhone) {
      alert('Set NEXT_PUBLIC_DEMO_RECEIVER_PHONE in frontend/.env to fire a test SMS.')
      return
    }
    setFiring(true)
    try {
      await triggerTestNotification(DEMO_PAYLOAD)
    } catch (e) {
      console.error('Test notify failed', e)
    } finally {
      setFiring(false)
    }
  }

  if (notifications.length === 0 && !isDemoMode) return null

  return (
    <div className="absolute bottom-4 right-4 w-80 z-20 flex flex-col gap-2 pointer-events-none">
      {isDemoMode && (
        <div className="pointer-events-auto">
          <button
            onClick={handleFireTest}
            disabled={firing}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#1a73e8] text-white text-xs font-medium shadow-lg hover:bg-[#1557b0] disabled:opacity-60 transition-colors"
          >
            <Zap size={13} />
            {firing ? 'Sending SMS…' : 'Fire Test SMS'}
          </button>
        </div>
      )}

      {notifications.length > 0 && (
        <div className="pointer-events-auto flex flex-col gap-1.5 max-h-72 overflow-y-auto">
          <div className="flex items-center gap-1.5 px-1">
            <MessageSquare size={12} className="text-[#1a73e8]" />
            <span className="text-[10px] font-semibold text-[#5f6368] uppercase tracking-wide">
              SAURON Notifications
            </span>
          </div>
          {notifications.map((n) => (
            <NotifyCard key={n.receiver_notification_id} notification={n} isNew={newIds.has(n.receiver_notification_id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function NotifyCard({ notification: n, isNew }: { notification: ReceiverNotification; isNew: boolean }) {
  const sent = n.delivery_status === 'sent'

  return (
    <div
      className={`rounded-lg border bg-white shadow-lg p-3 transition-all ${
        isNew ? 'ring-2 ring-[#1a73e8] ring-offset-1 animate-pulse-once' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-[11px] font-semibold text-[#202124] leading-snug">
          SAURON notified{' '}
          <span className="text-[#1a73e8]">
            {n.recipient}
          </span>{' '}
          at {formatTime(n.sent_at)}
        </p>
        {sent ? (
          <CheckCircle size={14} className="text-green-500 shrink-0 mt-0.5" />
        ) : (
          <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
        )}
      </div>

      {n.message_text && (
        <p className="text-[10px] text-[#5f6368] leading-relaxed line-clamp-2">
          "{n.message_text}"
        </p>
      )}

      <div className="flex items-center gap-1.5 mt-1.5">
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-green-100 text-green-700">
          SMS
        </span>
        <span
          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
            sent ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
          }`}
        >
          {n.delivery_status}
        </span>
      </div>
    </div>
  )
}
