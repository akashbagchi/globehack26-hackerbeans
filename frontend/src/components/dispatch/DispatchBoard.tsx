import { AlertTriangle, CalendarDays, Clock3, Loader2, PackagePlus, RefreshCcw, Truck, Zap } from 'lucide-react'
import type { Consignment, ConsignmentStatus, OrchestrationResult } from '../../types'
import { DisclosureSection } from '../shared/DisclosureSection'

type BoardColumn = {
  id: string
  label: string
  statuses: ConsignmentStatus[]
  accent: string
  badge: string
}

const BOARD_COLUMNS: BoardColumn[] = [
  {
    id: 'unassigned',
    label: 'Unassigned',
    statuses: ['unassigned'],
    accent: 'border-l-[#1a73e8]',
    badge: 'bg-[#e8f0fe] text-[#1a73e8]',
  },
  {
    id: 'assigned',
    label: 'Assigned',
    statuses: ['assigned', 'dispatched'],
    accent: 'border-l-[#0f9d58]',
    badge: 'bg-green-50 text-green-700',
  },
  {
    id: 'in_transit',
    label: 'In Transit',
    statuses: ['in_transit'],
    accent: 'border-l-[#f29900]',
    badge: 'bg-amber-50 text-amber-700',
  },
  {
    id: 'exception',
    label: 'Exceptions',
    statuses: ['exception', 'delayed'],
    accent: 'border-l-[#d93025]',
    badge: 'bg-red-50 text-red-700',
  },
]

function formatWindow(start: string | null, end: string | null) {
  if (!start || !end) return 'No window set'
  const startDate = new Date(start)
  const endDate = new Date(end)
  return `${startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

function formatSpecialHandling(items: string[]) {
  if (!items.length) return 'Standard handling'
  return items.join(', ').replace(/_/g, ' ')
}

interface DispatchBoardProps {
  consignments: Consignment[]
  selectedDispatchDate: string
  isLoading: boolean
  error: string | null
  orchestrationResult: OrchestrationResult | null
  isOrchestrating: boolean
  onRefresh: () => void
  onCreate: () => void
  onSelect: (consignmentId: string) => void
  onOrchestrate: () => void
  onDismissOrchestration: () => void
}

export function DispatchBoard({
  consignments,
  selectedDispatchDate,
  isLoading,
  error,
  orchestrationResult,
  isOrchestrating,
  onRefresh,
  onCreate,
  onSelect,
  onOrchestrate,
  onDismissOrchestration,
}: DispatchBoardProps) {
  const hasAnyConsignments = consignments.length > 0
  const needsReviewPlans = orchestrationResult?.plans.filter((p) => p.decision === 'needs_review') ?? []

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa]">
      <div className="px-4 py-3 border-b border-[#dadce0] bg-white shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#202124]">Daily Dispatch Board</p>
            <p className="text-xs text-[#5f6368] flex items-center gap-1">
              <CalendarDays size={12} />
              {new Date(`${selectedDispatchDate}T12:00:00`).toLocaleDateString([], {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="w-9 h-9 rounded-full border border-[#dadce0] text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors flex items-center justify-center"
              title="Refresh board"
            >
              <RefreshCcw size={15} />
            </button>
            <button
              onClick={onOrchestrate}
              disabled={isOrchestrating || consignments.filter((c) => c.status === 'unassigned').length === 0}
              className="inline-flex items-center gap-2 rounded-full bg-[#0f9d58] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#0b8043] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Auto-assign unassigned consignments to best-fit drivers"
            >
              {isOrchestrating ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              Auto-Dispatch
            </button>
            <button
              onClick={onCreate}
              className="inline-flex items-center gap-2 rounded-full bg-[#1a73e8] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#1557b0] transition-colors"
            >
              <PackagePlus size={14} />
              New Consignment
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {BOARD_COLUMNS.map((column) => {
            const count = consignments.filter((item) => column.statuses.includes(item.status)).length
            return (
              <div key={column.id} className="rounded-xl border border-[#dadce0] bg-white px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-[#5f6368]">{column.label}</div>
                <div className="text-lg font-semibold text-[#202124]">{count}</div>
              </div>
            )
          })}
        </div>
      </div>

      {orchestrationResult && (
        <div className="mx-4 mt-3 rounded-2xl border border-[#c7d6ef] bg-[#e8f0fe] px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#202124]">
              Auto-Dispatch Complete
            </p>
            <button
              onClick={onDismissOrchestration}
              className="text-xs text-[#5f6368] hover:text-[#202124] transition-colors"
            >
              Dismiss
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 font-medium text-green-700">
              {orchestrationResult.auto_assigned} assigned
            </span>
            {orchestrationResult.needs_review > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-700">
                {orchestrationResult.needs_review} needs review
              </span>
            )}
            {orchestrationResult.no_match > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 font-medium text-red-700">
                {orchestrationResult.no_match} no match
              </span>
            )}
            <span className="text-[#5f6368]">
              {orchestrationResult.total_consignments} consignments processed
            </span>
          </div>

          {needsReviewPlans.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#5f6368]">Pending Review</p>
              {needsReviewPlans.map((plan) => (
                <div key={plan.consignment_id} className="rounded-xl border border-amber-200 bg-white px-3 py-3">
                  <button
                    onClick={() => onSelect(plan.consignment_id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[#202124]">{plan.consignment_id}</span>
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 text-[11px] font-medium">
                        Score {plan.score}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#5f6368]">{plan.consignment_summary}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#5f6368]">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#f8f9fa] px-2 py-1">
                        Proposed: {plan.assigned_driver_id ?? 'No driver'}
                      </span>
                      {plan.skip_reasons.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-red-700">
                          {plan.skip_reasons.length} risk factor{plan.skip_reasons.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </button>

                  <div className="mt-3">
                    <DisclosureSection
                      title="AI reasoning"
                      summary="Review why this assignment was held for dispatcher approval"
                      resetKey={`plan-${plan.consignment_id}`}
                    >
                      <div className="space-y-3 text-xs text-[#5f6368]">
                        <p>{plan.reasoning}</p>
                        {plan.skip_reasons.length > 0 && (
                          <div>
                            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#5f6368]">Captured risks</div>
                            <div className="flex flex-wrap gap-2">
                              {plan.skip_reasons.map((reason) => (
                                <span key={reason} className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-red-700">
                                  {reason}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </DisclosureSection>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading && (
          <div className="rounded-2xl border border-[#dadce0] bg-white px-4 py-6 text-sm text-[#5f6368]">
            Loading consignments for the day...
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!isLoading && !error && !hasAnyConsignments && (
          <div className="rounded-[28px] border border-dashed border-[#c7d6ef] bg-white px-6 py-10 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f0fe] text-[#1a73e8]">
              <PackagePlus size={24} />
            </div>
            <h3 className="mt-4 text-base font-semibold text-[#202124]">No consignments scheduled</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm text-[#5f6368]">
              This dispatch day has no loads yet. Create a consignment to seed the board and make the auto-dispatch queue usable.
            </p>
            <button
              onClick={onCreate}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#1a73e8] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1557b0]"
            >
              <PackagePlus size={14} />
              Create First Consignment
            </button>
          </div>
        )}

        {!isLoading && !error && hasAnyConsignments && BOARD_COLUMNS.map((column) => {
          const items = consignments.filter((item) => column.statuses.includes(item.status))
          return (
            <section key={column.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${column.badge}`}>
                    {column.label}
                  </span>
                  <span className="text-xs text-[#5f6368]">{items.length} loads</span>
                </div>
              </div>

              {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#dadce0] bg-white px-4 py-4 text-xs text-[#5f6368]">
                  No consignments in this lane for the selected day.
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((consignment) => (
                    <div
                      key={consignment.consignment_id}
                      className={`rounded-2xl border border-[#dadce0] bg-white shadow-sm ${column.accent} border-l-4`}
                    >
                      <button
                        onClick={() => onSelect(consignment.consignment_id)}
                        className="w-full p-4 text-left transition-colors hover:bg-[#fafcff]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-[#202124]">{consignment.consignment_id}</div>
                            <div className="text-xs text-[#5f6368]">
                              {consignment.shipper_name} to {consignment.receiver_name}
                            </div>
                          </div>
                          {column.id === 'exception' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700">
                              <AlertTriangle size={11} />
                              Needs review
                            </span>
                          )}
                        </div>

                        <div className="mt-3 rounded-xl bg-[#f8f9fa] px-3 py-3">
                          <div className="font-medium text-[#202124]">{consignment.origin}</div>
                          <div className="text-xs text-[#5f6368]">{consignment.destination}</div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[#5f6368]">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 size={12} />
                            Pickup {formatWindow(consignment.pickup_window_start_at, consignment.pickup_window_end_at)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Truck size={12} />
                            {consignment.assigned_driver_id ? `Driver ${consignment.assigned_driver_id}` : 'No driver assigned'}
                          </span>
                        </div>
                      </button>

                      <div className="px-4 pb-4">
                        <DisclosureSection
                          title="Load details"
                          summary="Cargo, weight, handling, and delivery windows"
                          resetKey={`load-${consignment.consignment_id}`}
                        >
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                            <InfoCell label="Cargo description" value={consignment.cargo_description} />
                            <InfoCell label="Cargo class" value={consignment.cargo_class.replace(/_/g, ' ')} />
                            <InfoCell label="Weight" value={`${consignment.weight_lbs.toLocaleString()} lbs`} />
                            <InfoCell
                              label="Delivery window"
                              value={formatWindow(consignment.delivery_window_start_at, consignment.delivery_window_end_at)}
                            />
                          </div>
                          <div className="mt-3 rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-3 text-xs">
                            <div className="text-[#5f6368]">Handling</div>
                            <div className="mt-1 font-medium text-[#202124]">{formatSpecialHandling(consignment.special_handling)}</div>
                          </div>
                        </DisclosureSection>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-3">
      <div className="text-[#5f6368]">{label}</div>
      <div className="mt-1 font-medium text-[#202124]">{value}</div>
    </div>
  )
}
