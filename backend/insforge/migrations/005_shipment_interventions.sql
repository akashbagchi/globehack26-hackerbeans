create table if not exists shipment_interventions (
  shipment_intervention_id text primary key,
  fleet_id text not null,
  consignment_id text references consignments(consignment_id) on delete cascade,
  assignment_id text references assignments(assignment_id) on delete cascade,
  driver_id text,
  truck_id text,
  category text not null check (
    category in (
      'route_deviation',
      'traffic_delay',
      'weather',
      'incident',
      'construction',
      'hos_risk',
      'breakdown'
    )
  ),
  trigger_event_type text not null,
  summary text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null check (status in ('open', 'action_required', 'resolved')),
  dispatcher_cta jsonb not null default '{}'::jsonb,
  recommended_route_action jsonb,
  roadside_incident_id text references roadside_incidents(roadside_incident_id) on delete set null,
  latest_event_at timestamptz not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shipment_interventions_fleet_status
  on shipment_interventions (fleet_id, status, latest_event_at desc);

create index if not exists idx_shipment_interventions_assignment
  on shipment_interventions (assignment_id);

create index if not exists idx_shipment_interventions_consignment
  on shipment_interventions (consignment_id);
