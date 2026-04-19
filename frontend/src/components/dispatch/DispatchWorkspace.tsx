'use client'

import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, Truck } from 'lucide-react'
import {
  createConsignment,
  deleteConsignment,
  fetchDailyConsignments,
  orchestrateDailyDispatch,
  updateConsignment,
} from '../../api/client'
import { useFleetStore } from '../../store/fleetStore'
import { useUIStore } from '../../store/uiStore'
import type { ConsignmentPayload } from '../../types'
import { DispatchBoard } from './DispatchBoard'
import { ConsignmentEditor } from './ConsignmentEditor'
import { DriverSidebar } from '../sidebar/DriverSidebar'
import { DriverDetail } from '../sidebar/DriverDetail'

const FLEET_ID = 'fleet_demo'

export function DispatchWorkspace() {
  const dispatchMode = useUIStore((state) => state.dispatchMode)
  const setDispatchMode = useUIStore((state) => state.setDispatchMode)
  const drivers = useFleetStore((state) => state.drivers)
  const selectedDriverId = useFleetStore((state) => state.selectedDriverId)
  const consignments = useFleetStore((state) => state.consignments)
  const selectedConsignmentId = useFleetStore((state) => state.selectedConsignmentId)
  const selectedDispatchDate = useFleetStore((state) => state.selectedDispatchDate)
  const isLoadingConsignments = useFleetStore((state) => state.isLoadingConsignments)
  const isSavingConsignment = useFleetStore((state) => state.isSavingConsignment)
  const consignmentError = useFleetStore((state) => state.consignmentError)
  const setConsignments = useFleetStore((state) => state.setConsignments)
  const setSelectedConsignment = useFleetStore((state) => state.setSelectedConsignment)
  const setSelectedDispatchDate = useFleetStore((state) => state.setSelectedDispatchDate)
  const setIsLoadingConsignments = useFleetStore((state) => state.setIsLoadingConsignments)
  const setIsSavingConsignment = useFleetStore((state) => state.setIsSavingConsignment)
  const setConsignmentError = useFleetStore((state) => state.setConsignmentError)
  const orchestrationResult = useFleetStore((state) => state.orchestrationResult)
  const isOrchestrating = useFleetStore((state) => state.isOrchestrating)
  const setOrchestrationResult = useFleetStore((state) => state.setOrchestrationResult)
  const setIsOrchestrating = useFleetStore((state) => state.setIsOrchestrating)
  const upsertConsignment = useFleetStore((state) => state.upsertConsignment)
  const removeConsignment = useFleetStore((state) => state.removeConsignment)

  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (dispatchMode !== 'board') return

    let cancelled = false

    async function loadConsignments() {
      setIsLoadingConsignments(true)
      setConsignmentError(null)
      try {
        const response = await fetchDailyConsignments({
          fleetId: FLEET_ID,
          dispatchDate: selectedDispatchDate,
        })
        if (!cancelled) {
          setConsignments(response.data)
        }
      } catch (error) {
        if (!cancelled) {
          setConsignmentError(error instanceof Error ? error.message : 'Failed to load consignments')
          setIsLoadingConsignments(false)
        }
      }
    }

    loadConsignments()

    return () => {
      cancelled = true
    }
  }, [
    dispatchMode,
    refreshKey,
    selectedDispatchDate,
    setConsignments,
    setConsignmentError,
    setIsLoadingConsignments,
  ])

  const selectedConsignment = useMemo(
    () =>
      selectedConsignmentId
        ? consignments.find((item) => item.consignment_id === selectedConsignmentId) ?? null
        : null,
    [consignments, selectedConsignmentId],
  )

  async function handleSaveConsignment(payload: ConsignmentPayload | Partial<ConsignmentPayload>) {
    setIsSavingConsignment(true)
    setConsignmentError(null)
    try {
      if (selectedConsignment && selectedConsignmentId) {
        const response = await updateConsignment({
          fleetId: FLEET_ID,
          consignmentId: selectedConsignmentId,
          payload,
        })
        upsertConsignment(response.data)
        setSelectedConsignment(response.data.consignment_id)
      } else {
        const response = await createConsignment(payload as ConsignmentPayload)
        upsertConsignment(response.data)
        setSelectedConsignment(response.data.consignment_id)
      }
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setConsignmentError(error instanceof Error ? error.message : 'Unable to save consignment')
    } finally {
      setIsSavingConsignment(false)
    }
  }

  async function handleDeleteConsignment(consignmentId: string) {
    setIsSavingConsignment(true)
    setConsignmentError(null)
    try {
      await deleteConsignment({ fleetId: FLEET_ID, consignmentId })
      removeConsignment(consignmentId)
      setSelectedConsignment(null)
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setConsignmentError(error instanceof Error ? error.message : 'Unable to delete consignment')
    } finally {
      setIsSavingConsignment(false)
    }
  }

  async function handleOrchestrate() {
    setIsOrchestrating(true)
    setConsignmentError(null)
    try {
      const response = await orchestrateDailyDispatch({
        fleetId: FLEET_ID,
        dispatchDate: selectedDispatchDate,
        dispatcherId: 'DISP001',
      })
      setOrchestrationResult(response.data)
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setConsignmentError(error instanceof Error ? error.message : 'Auto-dispatch failed')
      setIsOrchestrating(false)
    }
  }

  const boardTabClass = (mode: 'board' | 'drivers') =>
    `flex-1 inline-flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
      dispatchMode === mode
        ? 'border-b-2 border-[#1a73e8] text-[#1a73e8]'
        : 'border-b-2 border-transparent text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124]'
    }`

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-[#dadce0] bg-white">
        <div className="flex">
          <button className={boardTabClass('board')} onClick={() => setDispatchMode('board')}>
            <ClipboardList size={15} />
            Dispatch Board
          </button>
          <button className={boardTabClass('drivers')} onClick={() => setDispatchMode('drivers')}>
            <Truck size={15} />
            Drivers
          </button>
        </div>

        {dispatchMode === 'board' && (
          <div className="flex items-center gap-3 px-4 py-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#5f6368]">
                Dispatch Date
              </label>
              <input
                type="date"
                className="rounded-xl border border-[#dadce0] bg-white px-3 py-2 text-sm text-[#202124] focus:outline-none focus:border-[#1a73e8]"
                value={selectedDispatchDate}
                onChange={(event) => setSelectedDispatchDate(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <div className="rounded-2xl bg-[#f8f9fa] px-3 py-2 text-xs text-[#5f6368]">
                {consignments.length} consignments loaded for {selectedDispatchDate}
              </div>
              {consignmentError && selectedConsignmentId === null && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {consignmentError}
                </div>
              )}
            </div>
          </div>
        )}

        {dispatchMode === 'drivers' && (
          <div className="px-4 py-2 text-xs text-[#5f6368]">
            {drivers.length} drivers available for match simulation and manual review
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {dispatchMode === 'board' ? (
          selectedConsignmentId === '__new__' || selectedConsignment ? (
            <ConsignmentEditor
              key={`${selectedConsignmentId ?? 'board'}-${selectedDispatchDate}-${refreshKey}`}
              consignment={selectedConsignment}
              dispatchDate={selectedDispatchDate}
              isSaving={isSavingConsignment}
              error={consignmentError}
              onBack={() => {
                setSelectedConsignment(null)
                setConsignmentError(null)
              }}
              onSave={handleSaveConsignment}
              onDelete={handleDeleteConsignment}
            />
          ) : (
            <DispatchBoard
              consignments={consignments}
              selectedDispatchDate={selectedDispatchDate}
              isLoading={isLoadingConsignments}
              error={consignmentError}
              orchestrationResult={orchestrationResult}
              isOrchestrating={isOrchestrating}
              onRefresh={() => setRefreshKey((current) => current + 1)}
              onCreate={() => {
                setSelectedConsignment('__new__')
                setConsignmentError(null)
              }}
              onSelect={(consignmentId) => {
                setSelectedConsignment(consignmentId)
                setConsignmentError(null)
              }}
              onOrchestrate={handleOrchestrate}
              onDismissOrchestration={() => setOrchestrationResult(null)}
            />
          )
        ) : selectedDriverId ? (
          <DriverDetail />
        ) : (
          <DriverSidebar />
        )}
      </div>
    </div>
  )
}
