import { create } from 'zustand'
import type {
  Driver,
  DriverRecommendation,
  InsightCard,
  CostChartEntry,
  SimulationResult,
  GeoJSONFeature,
  Consignment,
  RouteDeviation,
  TelemetryPosition,
  FleetAlert,
} from '../types'

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

interface FleetState {
  drivers: Driver[]
  consignments: Consignment[]
  selectedDriverId: string | null
  selectedConsignmentId: string | null
  selectedDispatchDate: string
  activeRoutes: Record<string, GeoJSONFeature>
  simulatedRoute: GeoJSONFeature | null
  simulationResult: SimulationResult | null
  lastUpdated: Date | null
  isLoading: boolean
  dataSource: 'navpro' | 'mock' | 'insforge' | null

  dispatchRecommendations: DriverRecommendation[]
  dispatchNote: string
  selectedMatchId: string | null
  isDispatching: boolean

  costChartData: CostChartEntry[]
  costInsights: InsightCard[]
  isLoadingCosts: boolean

  narratorText: string | null
  isSimulating: boolean
  isLoadingConsignments: boolean
  isSavingConsignment: boolean
  consignmentError: string | null

  deviations: RouteDeviation[]
  driverRoutes: Record<string, GeoJSONFeature>
  alerts: FleetAlert[]
  isLoadingAlerts: boolean

  setDrivers: (drivers: Driver[], source: 'navpro' | 'mock' | 'insforge') => void
  setConsignments: (consignments: Consignment[]) => void
  setSelectedDriver: (id: string | null) => void
  setSelectedConsignment: (id: string | null) => void
  setSelectedDispatchDate: (date: string) => void
  setSimulatedRoute: (route: GeoJSONFeature | null) => void
  setSimulationResult: (result: SimulationResult | null) => void
  setDispatchRecommendations: (recs: DriverRecommendation[], note: string) => void
  setSelectedMatch: (id: string) => void
  setCostData: (chartData: CostChartEntry[], insights: InsightCard[]) => void
  setNarratorText: (text: string | null) => void
  setIsDispatching: (v: boolean) => void
  setIsLoadingCosts: (v: boolean) => void
  setIsSimulating: (v: boolean) => void
  setIsLoadingConsignments: (v: boolean) => void
  setIsSavingConsignment: (v: boolean) => void
  setConsignmentError: (message: string | null) => void
  upsertConsignment: (consignment: Consignment) => void
  removeConsignment: (consignmentId: string) => void
  clearSimulation: () => void
  setDeviations: (devs: RouteDeviation[]) => void
  setDriverRoutes: (routes: Record<string, GeoJSONFeature>) => void
  patchPositions: (positions: Record<string, TelemetryPosition>) => void
  setAlerts: (alerts: FleetAlert[]) => void
  setIsLoadingAlerts: (v: boolean) => void
}

export const useFleetStore = create<FleetState>((set) => ({
  drivers: [],
  consignments: [],
  selectedDriverId: null,
  selectedConsignmentId: null,
  selectedDispatchDate: todayIsoDate(),
  activeRoutes: {},
  simulatedRoute: null,
  simulationResult: null,
  lastUpdated: null,
  isLoading: false,
  dataSource: null,

  dispatchRecommendations: [],
  dispatchNote: '',
  selectedMatchId: null,
  isDispatching: false,

  costChartData: [],
  costInsights: [],
  isLoadingCosts: false,

  narratorText: null,
  isSimulating: false,
  isLoadingConsignments: false,
  isSavingConsignment: false,
  consignmentError: null,

  deviations: [],
  driverRoutes: {},
  alerts: [],
  isLoadingAlerts: false,

  setDrivers: (drivers, source) =>
    set({ drivers, dataSource: source, lastUpdated: new Date(), isLoading: false }),
  setConsignments: (consignments) =>
    set({ consignments, isLoadingConsignments: false, consignmentError: null }),
  setSelectedDriver: (id) => set({ selectedDriverId: id }),
  setSelectedConsignment: (id) => set({ selectedConsignmentId: id }),
  setSelectedDispatchDate: (date) => set({ selectedDispatchDate: date }),
  setSimulatedRoute: (route) => set({ simulatedRoute: route }),
  setSimulationResult: (result) => set({ simulationResult: result }),
  setDispatchRecommendations: (recs, note) =>
    set({ dispatchRecommendations: recs, dispatchNote: note, isDispatching: false }),
  setSelectedMatch: (id) => set({ selectedMatchId: id }),
  setCostData: (chartData, insights) =>
    set({ costChartData: chartData, costInsights: insights, isLoadingCosts: false }),
  setNarratorText: (text) => set({ narratorText: text }),
  setIsDispatching: (v) => set({ isDispatching: v }),
  setIsLoadingCosts: (v) => set({ isLoadingCosts: v }),
  setIsSimulating: (v) => set({ isSimulating: v }),
  setIsLoadingConsignments: (v) => set({ isLoadingConsignments: v }),
  setIsSavingConsignment: (v) => set({ isSavingConsignment: v }),
  setConsignmentError: (message) => set({ consignmentError: message }),
  upsertConsignment: (consignment) =>
    set((state) => {
      const existing = state.consignments.find((item) => item.consignment_id === consignment.consignment_id)
      return {
        consignments: existing
          ? state.consignments.map((item) =>
              item.consignment_id === consignment.consignment_id ? consignment : item,
            )
          : [consignment, ...state.consignments],
      }
    }),
  removeConsignment: (consignmentId) =>
    set((state) => ({
      consignments: state.consignments.filter((item) => item.consignment_id !== consignmentId),
      selectedConsignmentId:
        state.selectedConsignmentId === consignmentId ? null : state.selectedConsignmentId,
    })),
  clearSimulation: () =>
    set({ simulatedRoute: null, simulationResult: null, narratorText: null }),

  setDeviations: (devs) => set({ deviations: devs }),
  setDriverRoutes: (routes) => set({ driverRoutes: routes }),
  setAlerts: (alerts) => set({ alerts, isLoadingAlerts: false }),
  setIsLoadingAlerts: (v) => set({ isLoadingAlerts: v }),
  patchPositions: (positions) =>
    set((state) => ({
      drivers: state.drivers.map((d) => {
        const pos = positions[d.driver_id]
        if (!pos) return d
        return {
          ...d,
          location: {
            ...d.location,
            lat: pos.lat,
            lng: pos.lng,
            speed_mph: pos.speed_mph,
            heading: pos.heading,
          },
        }
      }),
    })),
}))
