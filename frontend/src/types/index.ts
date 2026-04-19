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

export type ConsignmentStatus =
  | 'unassigned'
  | 'assigned'
  | 'dispatched'
  | 'in_transit'
  | 'delayed'
  | 'delivered'
  | 'exception'

export type CargoClass =
  | 'general'
  | 'hazmat'
  | 'refrigerated'
  | 'oversized'
  | 'high_value'

export type NotificationChannel = 'email' | 'sms' | 'phone' | 'portal'

export interface ConsignmentContactPreference {
  channel: NotificationChannel
  recipient: string
  priority: number
  notes?: string | null
}

export interface ConsignmentTimeWindow {
  start_at: string
  end_at: string
}

export interface Consignment {
  consignment_id: string
  fleet_id: string
  customer_reference: string | null
  shipper_name: string
  receiver_name: string
  origin: string
  destination: string
  cargo_description: string
  cargo_class: CargoClass
  weight_lbs: number
  status: ConsignmentStatus
  requested_pickup_at: string | null
  promised_delivery_at: string | null
  assigned_driver_id: string | null
  assigned_truck_id: string | null
  current_assignment_id: string | null
  created_at: string
  updated_at: string
  pickup_window_start_at: string | null
  pickup_window_end_at: string | null
  delivery_window_start_at: string | null
  delivery_window_end_at: string | null
  special_handling: string[]
  receiver_contact_preferences: ConsignmentContactPreference[]
}

export interface ConsignmentPayload {
  fleet_id: string
  consignment_id?: string
  customer_reference?: string | null
  shipper_name: string
  receiver_name: string
  origin: string
  destination: string
  cargo_description: string
  cargo_class: CargoClass
  weight_lbs: number
  status?: ConsignmentStatus
  requested_pickup_at?: string | null
  promised_delivery_at?: string | null
  assigned_driver_id?: string | null
  assigned_truck_id?: string | null
  current_assignment_id?: string | null
  pickup_window?: ConsignmentTimeWindow | null
  delivery_window?: ConsignmentTimeWindow | null
  special_handling: string[]
  receiver_contact_preferences: ConsignmentContactPreference[]
}

export interface ReceiverNotification {
  receiver_notification_id: string
  fleet_id: string
  consignment_id: string
  assignment_id: string | null
  notification_type: string
  channel: NotificationChannel
  recipient: string
  sent_at: string
  delivery_status: string
  eta_at: string | null
  message_template: string | null
  message_text: string | null
  context: Record<string, unknown>
  external_reference: string | null
  created_at: string
  updated_at: string
}

export type ShipmentInterventionCategory =
  | 'route_deviation'
  | 'traffic_delay'
  | 'weather'
  | 'incident'
  | 'construction'
  | 'hos_risk'
  | 'breakdown'

export type ShipmentInterventionSeverity = 'low' | 'medium' | 'high' | 'critical'
export type ShipmentInterventionStatus = 'open' | 'action_required' | 'resolved'

export interface ShipmentIntervention {
  shipment_intervention_id: string
  fleet_id: string
  consignment_id: string | null
  assignment_id: string | null
  driver_id: string | null
  truck_id: string | null
  category: ShipmentInterventionCategory
  trigger_event_type: string
  summary: string
  severity: ShipmentInterventionSeverity
  status: ShipmentInterventionStatus
  dispatcher_cta: {
    primary_action?: string
    secondary_action?: string
    label?: string
  }
  recommended_route_action: {
    action?: string
    policy?: string
    recommended_eta?: string | null
    applied_at?: string | null
    applied_by?: string | null
    resolution?: string | null
  } | null
  roadside_incident_id: string | null
  latest_event_at: string
  details: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ShipmentInterventionAction {
  shipment_intervention_action_id: string
  shipment_intervention_id: string
  fleet_id: string
  dispatcher_id: string | null
  action_type: 'dispatcher_outreach' | 'reroute_applied' | 'roadside_assistance'
  action_status: string
  action_reason: string | null
  notes: string | null
  metadata: Record<string, unknown>
  occurred_at: string
  created_at: string
  updated_at: string
}

export type OrchestrationDecision = 'auto_assigned' | 'needs_review' | 'no_match'

export interface AssignmentPlan {
  consignment_id: string
  consignment_summary: string
  assigned_driver_id: string | null
  assigned_truck_id: string | null
  score: number
  reasoning: string
  decision: OrchestrationDecision
  skip_reasons: string[]
}

export interface OrchestrationResult {
  fleet_id: string
  dispatch_date: string
  total_consignments: number
  auto_assigned: number
  needs_review: number
  no_match: number
  plans: AssignmentPlan[]
  drivers_used: string[]
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

export interface FleetAlert {
  alert_id: string
  fleet_id: string
  driver_id: string
  driver_name: string
  assignment_id: string | null
  consignment_id: string | null
  alert_type: 'late_delivery' | 'missed_checkin' | 'hos_risk' | 'unexpected_spend' | 'suspicious_stoppage'
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
  source_ref: string | null
  status: 'unresolved' | 'resolved' | 'dismissed'
  created_at: string
  resolved_at: string | null
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

export type VisionIssueType =
  | 'fatigue'
  | 'phone_distraction'
  | 'road_hazard'
  | 'load_security'
  | 'seatbelt'

export interface VisionIssue {
  type: VisionIssueType
  score: number
  confidence: number
}

export interface VisionDriverAlert {
  driver_id: string
  driver_name: string
  truck_number: string
  status: 'clear' | 'watch' | 'critical'
  attention_score: number
  confidence: number
  summary: string
  recommended_action: string
  detected_at: string
  primary_issue: VisionIssueType | null
  issues: VisionIssue[]
  video_url: string | null
}

export interface VisionMonitorFrame {
  driver_id: string
  driver_name: string
  truck_number: string
  timestamp: string
  video_url: string | null
  status: Driver['status']
  frame: string
  context: {
    city: string
    state: string
    speed_mph: number
    hos_remaining_hrs: number
    load_description: string | null
    eta: string | null
  }
}
