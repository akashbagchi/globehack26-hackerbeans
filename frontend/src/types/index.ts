export interface LocationData {
  lat: number
  lng: number
  city: string
  state: string
  heading: number
  speed_mph: number
}

export interface HOSData {
  drive_remaining_hrs: number
  shift_remaining_hrs: number
  cycle_remaining_hrs: number
  last_rest_end: string
}

export interface VehicleData {
  vehicle_id: string
  make: string
  model: string
  year: number
  fuel_level_pct: number
  odometer_miles: number
  mpg_avg: number
  capacity_lbs: number
  cab_type: string
  trailer_type: string
  trailer_length_ft: number
  refrigerated: boolean
  maintenance_ready: boolean
  hazmat_permitted: boolean
}

export interface EconomicsData {
  cost_per_mile: number
  miles_today: number
  revenue_today: number
  idle_cost_today: number
}

export interface LoadData {
  load_id: string
  origin: string
  destination: string
  cargo: string
  weight_lbs: number
  eta: string
}

export interface ContractConstraintsData {
  max_deadhead_miles: number
  preferred_regions: string[]
  excluded_cargo_types: string[]
}

export interface AvailabilityWindowData {
  available_from: string
  available_until: string
}

export interface ReadinessData {
  state: string
  score: number
  blocker_reasons: string[]
  available_at?: string | null
}

export interface Driver {
  driver_id: string
  name: string
  truck_number: string
  status: 'driving' | 'idle' | 'off_duty' | 'unavailable' | 'breakdown'
  location: LocationData
  hos: HOSData
  vehicle: VehicleData
  economics: EconomicsData
  certifications: string[]
  endorsements: string[]
  contract_constraints: ContractConstraintsData
  availability_window: AvailabilityWindowData
  readiness: ReadinessData
  current_load: LoadData | null
}

export interface DriverRecommendation {
  rank: number
  driver_id: string
  driver_name: string
  score: number
  distance_to_pickup_miles: number
  hos_remaining_hrs: number
  cost_per_mile: number
  cost_delta_vs_avg: number
  reasoning: string
}

export interface InsightCard {
  icon: string
  title: string
  detail: string
  severity: 'info' | 'warning' | 'critical'
}

export interface CostChartEntry {
  name: string
  full_name: string
  driver_id: string
  cost_per_mile: number
  miles_today: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface SimulationResult {
  driver_id: string
  driver_name: string
  route: GeoJSONFeature
  pickup_coords: { lat: number; lng: number }
  destination_coords: { lat: number; lng: number }
  estimated_miles: number
  estimated_hours: number
  total_cost: number
  cost_per_mile: number
  narrator_text: string
  hos_remaining_after: number
}

export interface GeoJSONFeature {
  type: string
  geometry: {
    type: string
    coordinates: number[][]
  }
  properties: Record<string, unknown>
}

export interface TelemetryPosition {
  lat: number
  lng: number
  speed_mph: number
  heading: number
  route_progress_pct: number
  timestamp: string
}

export interface RouteDeviation {
  driver_id: string
  driver_name: string
  load_id: string
  detected_at: string
  severity: 'minor' | 'major'
  deviation_miles: number
  lat: number
  lng: number
  corridor: string
  resolved: boolean
}
