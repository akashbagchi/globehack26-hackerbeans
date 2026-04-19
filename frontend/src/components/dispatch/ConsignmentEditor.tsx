import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BellRing, Clock3, Plus, Save, Trash2 } from 'lucide-react'
import { fetchConsignmentNotifications } from '../../api/client'
import type {
  CargoClass,
  Consignment,
  ConsignmentContactPreference,
  ConsignmentPayload,
  ConsignmentStatus,
  NotificationChannel,
  ReceiverNotification,
} from '../../types'

const cargoClassOptions: CargoClass[] = ['general', 'hazmat', 'refrigerated', 'oversized', 'high_value']
const statusOptions: ConsignmentStatus[] = ['unassigned', 'assigned', 'dispatched', 'in_transit', 'exception']
const channelOptions: NotificationChannel[] = ['sms', 'email', 'phone', 'portal']

type FormState = {
  customer_reference: string
  shipper_name: string
  receiver_name: string
  origin: string
  destination: string
  cargo_description: string
  cargo_class: CargoClass
  weight_lbs: string
  status: ConsignmentStatus
  pickup_window_start_at: string
  pickup_window_end_at: string
  delivery_window_start_at: string
  delivery_window_end_at: string
  special_handling: string
  receiver_contact_preferences: ConsignmentContactPreference[]
}

function toDateTimeLocal(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const pad = (segment: number) => `${segment}`.padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toIsoOrNull(value: string) {
  if (!value) return null
  return new Date(value).toISOString()
}

function formatNotificationTimestamp(value: string | null) {
  if (!value) return 'TBD'
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatNotificationLabel(notificationType: string) {
  return notificationType.replace(/_/g, ' ')
}

function createDefaultState(dispatchDate: string): FormState {
  return {
    customer_reference: '',
    shipper_name: '',
    receiver_name: '',
    origin: '',
    destination: '',
    cargo_description: '',
    cargo_class: 'general',
    weight_lbs: '',
    status: 'unassigned',
    pickup_window_start_at: `${dispatchDate}T08:00`,
    pickup_window_end_at: `${dispatchDate}T10:00`,
    delivery_window_start_at: `${dispatchDate}T16:00`,
    delivery_window_end_at: `${dispatchDate}T18:00`,
    special_handling: '',
    receiver_contact_preferences: [{ channel: 'sms', recipient: '', priority: 1, notes: '' }],
  }
}

function stateFromConsignment(consignment: Consignment | null, dispatchDate: string): FormState {
  if (!consignment) return createDefaultState(dispatchDate)
  return {
    customer_reference: consignment.customer_reference ?? '',
    shipper_name: consignment.shipper_name,
    receiver_name: consignment.receiver_name,
    origin: consignment.origin,
    destination: consignment.destination,
    cargo_description: consignment.cargo_description,
    cargo_class: consignment.cargo_class,
    weight_lbs: `${consignment.weight_lbs}`,
    status: consignment.status,
    pickup_window_start_at: toDateTimeLocal(consignment.pickup_window_start_at),
    pickup_window_end_at: toDateTimeLocal(consignment.pickup_window_end_at),
    delivery_window_start_at: toDateTimeLocal(consignment.delivery_window_start_at),
    delivery_window_end_at: toDateTimeLocal(consignment.delivery_window_end_at),
    special_handling: consignment.special_handling.join(', '),
    receiver_contact_preferences:
      consignment.receiver_contact_preferences.length > 0
        ? consignment.receiver_contact_preferences.map((item) => ({
            channel: item.channel,
            recipient: item.recipient,
            priority: item.priority,
            notes: item.notes ?? '',
          }))
        : [{ channel: 'sms', recipient: '', priority: 1, notes: '' }],
  }
}

interface ConsignmentEditorProps {
  consignment: Consignment | null
  dispatchDate: string
  isSaving: boolean
  error: string | null
  onBack: () => void
  onSave: (payload: ConsignmentPayload | Partial<ConsignmentPayload>) => Promise<void>
  onDelete: (consignmentId: string) => Promise<void>
}

export function ConsignmentEditor({
  consignment,
  dispatchDate,
  isSaving,
  error,
  onBack,
  onSave,
  onDelete,
}: ConsignmentEditorProps) {
  const [formState, setFormState] = useState<FormState>(() => stateFromConsignment(consignment, dispatchDate))
  const [notifications, setNotifications] = useState<ReceiverNotification[]>([])
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false)
  const [notificationError, setNotificationError] = useState<string | null>(null)

  const isEditing = Boolean(consignment)
  const title = isEditing ? consignment?.consignment_id : 'New Consignment'
  const parsedWeight = Number(formState.weight_lbs)

  const validationMessage = useMemo(() => {
    if (!formState.shipper_name.trim()) return 'Shipper is required.'
    if (!formState.receiver_name.trim()) return 'Receiver is required.'
    if (!formState.origin.trim()) return 'Origin is required.'
    if (!formState.destination.trim()) return 'Destination is required.'
    if (!formState.cargo_description.trim()) return 'Cargo description is required.'
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) return 'Weight must be greater than zero.'

    if (formState.pickup_window_start_at && formState.pickup_window_end_at) {
      const pickupStart = new Date(formState.pickup_window_start_at)
      const pickupEnd = new Date(formState.pickup_window_end_at)
      if (pickupEnd < pickupStart) return 'Pickup window end must be after pickup window start.'
    }

    if (formState.delivery_window_start_at && formState.delivery_window_end_at) {
      const deliveryStart = new Date(formState.delivery_window_start_at)
      const deliveryEnd = new Date(formState.delivery_window_end_at)
      if (deliveryEnd < deliveryStart) return 'Delivery window end must be after delivery window start.'
    }

    if (
      formState.pickup_window_end_at &&
      formState.delivery_window_start_at &&
      new Date(formState.delivery_window_start_at) < new Date(formState.pickup_window_end_at)
    ) {
      return 'Delivery window should not begin before the pickup window closes.'
    }

    const hasEmptyPreference = formState.receiver_contact_preferences.some((item) =>
      item.recipient.trim() === '' && (item.notes?.trim() || item.channel !== 'sms' || item.priority !== 1),
    )
    if (hasEmptyPreference) return 'Receiver contact preferences need a recipient before they can be saved.'

    return null
  }, [formState, parsedWeight])

  const savePayload = useMemo(() => {
    const specialHandling = formState.special_handling
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    const receiverContactPreferences = formState.receiver_contact_preferences
      .filter((item) => item.recipient.trim())
      .map((item) => ({
        ...item,
        recipient: item.recipient.trim(),
        notes: item.notes?.trim() ? item.notes.trim() : undefined,
      }))

    const payload: ConsignmentPayload = {
      fleet_id: consignment?.fleet_id ?? 'fleet_demo',
      customer_reference: formState.customer_reference.trim() || null,
      shipper_name: formState.shipper_name.trim(),
      receiver_name: formState.receiver_name.trim(),
      origin: formState.origin.trim(),
      destination: formState.destination.trim(),
      cargo_description: formState.cargo_description.trim(),
      cargo_class: formState.cargo_class,
      weight_lbs: parsedWeight,
      status: formState.status,
      pickup_window: formState.pickup_window_start_at && formState.pickup_window_end_at
        ? {
            start_at: toIsoOrNull(formState.pickup_window_start_at) ?? '',
            end_at: toIsoOrNull(formState.pickup_window_end_at) ?? '',
          }
        : null,
      delivery_window: formState.delivery_window_start_at && formState.delivery_window_end_at
        ? {
            start_at: toIsoOrNull(formState.delivery_window_start_at) ?? '',
            end_at: toIsoOrNull(formState.delivery_window_end_at) ?? '',
          }
        : null,
      special_handling: specialHandling,
      receiver_contact_preferences: receiverContactPreferences,
    }

    return payload
  }, [consignment, formState, parsedWeight])

  const canDelete = Boolean(consignment && !consignment.current_assignment_id)

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setFormState((current) => ({ ...current, [key]: value }))
  }

  useEffect(() => {
    if (!consignment?.consignment_id) {
      return
    }
    const activeConsignment = consignment

    let cancelled = false

    async function loadNotifications() {
      setIsLoadingNotifications(true)
      setNotificationError(null)
      try {
        const response = await fetchConsignmentNotifications({
          fleetId: activeConsignment.fleet_id,
          consignmentId: activeConsignment.consignment_id,
        })
        if (!cancelled) {
          setNotifications(response.data)
        }
      } catch (error) {
        if (!cancelled) {
          setNotificationError(
            error instanceof Error ? error.message : 'Unable to load receiver notification history',
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoadingNotifications(false)
        }
      }
    }

    loadNotifications()

    return () => {
      cancelled = true
    }
  }, [consignment?.consignment_id, consignment?.fleet_id])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (validationMessage) return
    await onSave(savePayload)
  }

  const inputClass =
    'w-full rounded-xl border border-[#dadce0] bg-white px-3 py-2 text-sm text-[#202124] placeholder-[#5f6368] focus:outline-none focus:border-[#1a73e8]'

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-[#dadce0] px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={onBack}
              className="rounded-full p-2 text-[#5f6368] transition-colors hover:bg-[#f1f3f4] hover:text-[#202124]"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[#202124]">{title}</div>
              <div className="text-xs text-[#5f6368]">
                {isEditing ? 'Manage shipment requirements and lifecycle' : 'Create a dispatch-ready consignment'}
              </div>
            </div>
          </div>
          {canDelete && consignment && (
            <button
              onClick={() => onDelete(consignment.consignment_id)}
              className="inline-flex items-center gap-2 rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
            >
              <Trash2 size={13} />
              Delete
            </button>
          )}
        </div>
        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        {!error && validationMessage && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {validationMessage}
          </div>
        )}
        {consignment?.current_assignment_id && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            This consignment has an active assignment, so deletion is disabled.
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#5f6368]">Customer Ref</label>
            <input
              className={inputClass}
              value={formState.customer_reference}
              onChange={(event) => updateField('customer_reference', event.target.value)}
              placeholder="LD-2048"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#5f6368]">Status</label>
            <select
              className={inputClass}
              value={formState.status}
              onChange={(event) => updateField('status', event.target.value as ConsignmentStatus)}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#5f6368]">Shipper</label>
            <input
              className={inputClass}
              value={formState.shipper_name}
              onChange={(event) => updateField('shipper_name', event.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#5f6368]">Receiver</label>
            <input
              className={inputClass}
              value={formState.receiver_name}
              onChange={(event) => updateField('receiver_name', event.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#5f6368]">Origin</label>
            <input className={inputClass} value={formState.origin} onChange={(event) => updateField('origin', event.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#5f6368]">Destination</label>
            <input className={inputClass} value={formState.destination} onChange={(event) => updateField('destination', event.target.value)} required />
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_140px_120px] gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#5f6368]">Cargo</label>
            <input
              className={inputClass}
              value={formState.cargo_description}
              onChange={(event) => updateField('cargo_description', event.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#5f6368]">Cargo Class</label>
            <select
              className={inputClass}
              value={formState.cargo_class}
              onChange={(event) => updateField('cargo_class', event.target.value as CargoClass)}
            >
              {cargoClassOptions.map((cargoClass) => (
                <option key={cargoClass} value={cargoClass}>
                  {cargoClass.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#5f6368]">Weight</label>
            <input
              className={inputClass}
              type="number"
              min="1"
              value={formState.weight_lbs}
              onChange={(event) => updateField('weight_lbs', event.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[#dadce0] bg-[#f8f9fa] p-3">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#5f6368]">Pickup Window</div>
            <div className="space-y-3">
              <input className={inputClass} type="datetime-local" value={formState.pickup_window_start_at} onChange={(event) => updateField('pickup_window_start_at', event.target.value)} />
              <input className={inputClass} type="datetime-local" value={formState.pickup_window_end_at} onChange={(event) => updateField('pickup_window_end_at', event.target.value)} />
            </div>
          </div>
          <div className="rounded-2xl border border-[#dadce0] bg-[#f8f9fa] p-3">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#5f6368]">Delivery Window</div>
            <div className="space-y-3">
              <input className={inputClass} type="datetime-local" value={formState.delivery_window_start_at} onChange={(event) => updateField('delivery_window_start_at', event.target.value)} />
              <input className={inputClass} type="datetime-local" value={formState.delivery_window_end_at} onChange={(event) => updateField('delivery_window_end_at', event.target.value)} />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#5f6368]">Special Handling</label>
          <input
            className={inputClass}
            value={formState.special_handling}
            onChange={(event) => updateField('special_handling', event.target.value)}
            placeholder="temperature_monitoring, white_glove"
          />
        </div>

        <div className="rounded-2xl border border-[#dadce0] bg-[#f8f9fa] p-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#5f6368]">Receiver Contact Preferences</div>
            <button
              type="button"
              onClick={() =>
                updateField('receiver_contact_preferences', [
                  ...formState.receiver_contact_preferences,
                  { channel: 'sms', recipient: '', priority: 1, notes: '' },
                ])
              }
              className="inline-flex items-center gap-1 rounded-full border border-[#dadce0] px-2.5 py-1 text-[11px] font-semibold text-[#1a73e8] hover:bg-white"
            >
              <Plus size={12} />
              Add
            </button>
          </div>
          <div className="space-y-3">
            {formState.receiver_contact_preferences.map((preference, index) => (
              <div key={`${index}-${preference.channel}`} className="rounded-xl border border-[#dadce0] bg-white p-3 space-y-3">
                <div className="grid grid-cols-[120px_minmax(0,1fr)_90px] gap-2">
                  <select
                    className={inputClass}
                    value={preference.channel}
                    onChange={(event) => {
                      const next = [...formState.receiver_contact_preferences]
                      next[index] = { ...preference, channel: event.target.value as NotificationChannel }
                      updateField('receiver_contact_preferences', next)
                    }}
                  >
                    {channelOptions.map((channel) => (
                      <option key={channel} value={channel}>
                        {channel}
                      </option>
                    ))}
                  </select>
                  <input
                    className={inputClass}
                    value={preference.recipient}
                    placeholder="dock@example.com"
                    onChange={(event) => {
                      const next = [...formState.receiver_contact_preferences]
                      next[index] = { ...preference, recipient: event.target.value }
                      updateField('receiver_contact_preferences', next)
                    }}
                  />
                  <input
                    className={inputClass}
                    type="number"
                    min="1"
                    max="5"
                    value={preference.priority}
                    onChange={(event) => {
                      const next = [...formState.receiver_contact_preferences]
                      next[index] = { ...preference, priority: Number(event.target.value) || 1 }
                      updateField('receiver_contact_preferences', next)
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className={inputClass}
                    value={preference.notes ?? ''}
                    placeholder="Leave at gate B"
                    onChange={(event) => {
                      const next = [...formState.receiver_contact_preferences]
                      next[index] = { ...preference, notes: event.target.value }
                      updateField('receiver_contact_preferences', next)
                    }}
                  />
                  {formState.receiver_contact_preferences.length > 1 && (
                    <button
                      type="button"
                      className="rounded-full p-2 text-[#5f6368] hover:bg-[#f1f3f4] hover:text-red-600"
                      onClick={() => {
                        const next = formState.receiver_contact_preferences.filter((_, itemIndex) => itemIndex !== index)
                        updateField('receiver_contact_preferences', next)
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {isEditing && (
          <div className="rounded-2xl border border-[#dadce0] bg-[#f8f9fa] p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#5f6368]">
                <BellRing size={13} />
                Receiver Notifications
              </div>
              <div className="text-[11px] text-[#5f6368]">
                {notifications.length} sent updates
              </div>
            </div>

            {isLoadingNotifications && (
              <div className="rounded-xl border border-[#dadce0] bg-white px-3 py-3 text-xs text-[#5f6368]">
                Loading notification history...
              </div>
            )}

            {!isLoadingNotifications && notificationError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-700">
                {notificationError}
              </div>
            )}

            {!isLoadingNotifications && !notificationError && notifications.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#dadce0] bg-white px-3 py-4 text-xs text-[#5f6368]">
                No receiver updates have been sent yet. Assignment, ETA, delay, and delivery changes will appear here automatically.
              </div>
            )}

            {!isLoadingNotifications && !notificationError && notifications.length > 0 && (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div
                    key={notification.receiver_notification_id}
                    className="rounded-xl border border-[#dadce0] bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-[#202124]">
                          {formatNotificationLabel(notification.notification_type)}
                        </div>
                        <div className="mt-1 text-xs text-[#5f6368]">
                          {notification.channel.toUpperCase()} to {notification.recipient}
                        </div>
                      </div>
                      <span className="rounded-full bg-[#e8f0fe] px-2 py-1 text-[11px] font-medium text-[#1a73e8]">
                        {notification.delivery_status}
                      </span>
                    </div>

                    {notification.message_text && (
                      <p className="mt-3 text-sm leading-6 text-[#202124]">{notification.message_text}</p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[#5f6368]">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={12} />
                        Sent {formatNotificationTimestamp(notification.sent_at)}
                      </span>
                      {notification.eta_at && (
                        <span>ETA {formatNotificationTimestamp(notification.eta_at)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </form>

      <div className="border-t border-[#dadce0] px-4 py-3 shrink-0">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving || Boolean(validationMessage)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a73e8] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1557b0] disabled:cursor-not-allowed disabled:bg-[#9bbcf4]"
        >
          <Save size={16} />
          {isSaving ? 'Saving Consignment...' : isEditing ? 'Save Changes' : 'Create Consignment'}
        </button>
      </div>
    </div>
  )
}
