import { create } from 'zustand'
import type { Driver, DriverRecommendation, InsightCard, CostChartEntry, SimulationResult, GeoJSONFeature, RouteDeviation, TelemetryPosition, FleetAlert, VisionDriverAlert } from '../types'

interface FleetState {
  drivers: Driver[]
  selectedDriverId: string | null
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

  deviations: RouteDeviation[]
  driverRoutes: Record<string, GeoJSONFeature>
  alerts: FleetAlert[]
  isLoadingAlerts: boolean
  visionByDriver: Record<string, VisionDriverAlert>
  visionHistory: VisionDriverAlert[]
  lastVisionScanAt: string | null
  isVisionMonitoring: boolean

  setDrivers: (drivers: Driver[], source: 'navpro' | 'mock' | 'insforge') => void
  setSelectedDriver: (id: string | null) => void
  setSimulatedRoute: (route: GeoJSONFeature | null) => void
  setSimulationResult: (result: SimulationResult | null) => void
  setDispatchRecommendations: (recs: DriverRecommendation[], note: string) => void
  setSelectedMatch: (id: string) => void
  setCostData: (chartData: CostChartEntry[], insights: InsightCard[]) => void
  setNarratorText: (text: string | null) => void
  setIsDispatching: (v: boolean) => void
  setIsLoadingCosts: (v: boolean) => void
  setIsSimulating: (v: boolean) => void
  clearSimulation: () => void
  setDeviations: (devs: RouteDeviation[]) => void
  setDriverRoutes: (routes: Record<string, GeoJSONFeature>) => void
  patchPositions: (positions: Record<string, TelemetryPosition>) => void
  setAlerts: (alerts: FleetAlert[]) => void
  setIsLoadingAlerts: (v: boolean) => void
  setVisionResults: (alerts: VisionDriverAlert[]) => void
  setIsVisionMonitoring: (v: boolean) => void
}

export const useFleetStore = create<FleetState>((set) => ({
  drivers: [],
  selectedDriverId: null,
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

  deviations: [],
  driverRoutes: {},
  alerts: [],
  isLoadingAlerts: false,
  visionByDriver: {},
  visionHistory: [],
  lastVisionScanAt: null,
  isVisionMonitoring: false,

  setDrivers: (drivers, source) =>
    set({ drivers, dataSource: source, lastUpdated: new Date(), isLoading: false }),
  setSelectedDriver: (id) => set({ selectedDriverId: id }),
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
  clearSimulation: () =>
    set({ simulatedRoute: null, simulationResult: null, narratorText: null }),

  setDeviations: (devs) => set({ deviations: devs }),
  setDriverRoutes: (routes) => set({ driverRoutes: routes }),
  setAlerts: (alerts) => set({ alerts, isLoadingAlerts: false }),
  setIsLoadingAlerts: (v) => set({ isLoadingAlerts: v }),
  setVisionResults: (alerts) =>
    set((state) => {
      const nextByDriver = alerts.reduce<Record<string, VisionDriverAlert>>((acc, alert) => {
        acc[alert.driver_id] = alert
        return acc
      }, {})

      const history = [...alerts, ...state.visionHistory]
        .sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime())
        .filter((alert, index, arr) =>
          arr.findIndex((candidate) =>
            candidate.driver_id === alert.driver_id &&
            candidate.detected_at === alert.detected_at &&
            candidate.primary_issue === alert.primary_issue
          ) === index
        )
        .slice(0, 25)

      return {
        visionByDriver: nextByDriver,
        visionHistory: history,
        lastVisionScanAt: new Date().toISOString(),
        isVisionMonitoring: false,
      }
    }),
  setIsVisionMonitoring: (v) => set({ isVisionMonitoring: v }),
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
