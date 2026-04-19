create table if not exists dispatcher_profiles (
  dispatcher_id text primary key,
  fleet_id text not null,
  name text not null,
  email text not null,
  phone text,
  shift_start_at timestamptz,
  shift_end_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists driver_profiles (
  driver_id text primary key,
  fleet_id text not null,
  dispatcher_id text references dispatcher_profiles(dispatcher_id),
  first_name text not null,
  last_name text not null,
  phone text,
  license_number text not null,
  home_terminal text,
  status text not null check (status in ('available', 'driving', 'off_duty', 'unavailable', 'breakdown')),
  last_known_location jsonb,
  last_check_in_at timestamptz,
  current_assignment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists driver_certifications (
  certification_id text primary key,
  fleet_id text not null,
  driver_id text not null references driver_profiles(driver_id) on delete cascade,
  certification_type text not null,
  issued_at timestamptz,
  expires_at timestamptz,
  issuer text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists truck_profiles (
  truck_id text primary key,
  fleet_id text not null,
  truck_number text not null,
  vin text,
  make text not null,
  model text not null,
  year integer not null,
  capacity_lbs integer,
  current_driver_id text references driver_profiles(driver_id),
  current_assignment_id text,
  last_known_location jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists consignments (
  consignment_id text primary key,
  fleet_id text not null,
  customer_reference text,
  shipper_name text not null,
  receiver_name text not null,
  origin text not null,
  destination text not null,
  cargo_description text not null,
  weight_lbs integer not null,
  status text not null check (status in ('unassigned', 'assigned', 'dispatched', 'in_transit', 'delayed', 'delivered', 'exception')),
  requested_pickup_at timestamptz,
  promised_delivery_at timestamptz,
  assigned_driver_id text references driver_profiles(driver_id),
  assigned_truck_id text references truck_profiles(truck_id),
  current_assignment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assignments (
  assignment_id text primary key,
  fleet_id text not null,
  consignment_id text not null references consignments(consignment_id) on delete cascade,
  dispatcher_id text not null references dispatcher_profiles(dispatcher_id),
  driver_id text not null references driver_profiles(driver_id),
  truck_id text not null references truck_profiles(truck_id),
  status text not null check (status in ('planned', 'active', 'completed', 'cancelled')),
  assigned_at timestamptz not null,
  dispatched_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists route_plans (
  route_plan_id text primary key,
  fleet_id text not null,
  assignment_id text not null references assignments(assignment_id) on delete cascade,
  status text not null check (status in ('draft', 'approved', 'active', 'completed', 'superseded')),
  estimated_distance_miles numeric(10, 2),
  estimated_drive_hours numeric(10, 2),
  planned_departure_at timestamptz,
  planned_arrival_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists route_plan_stops (
  route_plan_stop_id text primary key,
  route_plan_id text not null references route_plans(route_plan_id) on delete cascade,
  sequence integer not null,
  stop_type text not null,
  location_name text not null,
  location jsonb,
  planned_arrival_at timestamptz,
  planned_departure_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists in_transit_events (
  in_transit_event_id text primary key,
  fleet_id text not null,
  assignment_id text references assignments(assignment_id) on delete cascade,
  consignment_id text references consignments(consignment_id) on delete cascade,
  driver_id text references driver_profiles(driver_id),
  truck_id text references truck_profiles(truck_id),
  event_type text not null,
  occurred_at timestamptz not null,
  location jsonb,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists check_in_events (
  check_in_event_id text primary key,
  fleet_id text not null,
  assignment_id text references assignments(assignment_id) on delete cascade,
  driver_id text not null references driver_profiles(driver_id) on delete cascade,
  truck_id text references truck_profiles(truck_id),
  checked_in_at timestamptz not null,
  source text not null,
  location jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists roadside_incidents (
  roadside_incident_id text primary key,
  fleet_id text not null,
  assignment_id text references assignments(assignment_id) on delete cascade,
  consignment_id text references consignments(consignment_id) on delete cascade,
  driver_id text references driver_profiles(driver_id),
  truck_id text references truck_profiles(truck_id),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  incident_type text not null,
  occurred_at timestamptz not null,
  resolved_at timestamptz,
  location jsonb,
  summary text not null,
  details text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists receiver_notifications (
  receiver_notification_id text primary key,
  fleet_id text not null,
  consignment_id text not null references consignments(consignment_id) on delete cascade,
  assignment_id text references assignments(assignment_id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'phone', 'portal')),
  recipient text not null,
  sent_at timestamptz not null,
  delivery_status text not null,
  message_template text,
  external_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reconciliation_events (
  reconciliation_event_id text primary key,
  fleet_id text not null,
  consignment_id text not null references consignments(consignment_id) on delete cascade,
  assignment_id text references assignments(assignment_id) on delete cascade,
  event_date timestamptz not null,
  status text not null check (status in ('pending', 'matched', 'disputed', 'resolved')),
  cost_delta_usd numeric(10, 2),
  revenue_delta_usd numeric(10, 2),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'driver_profiles_current_assignment_fk'
  ) then
    alter table driver_profiles
      add constraint driver_profiles_current_assignment_fk
      foreign key (current_assignment_id) references assignments(assignment_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'truck_profiles_current_assignment_fk'
  ) then
    alter table truck_profiles
      add constraint truck_profiles_current_assignment_fk
      foreign key (current_assignment_id) references assignments(assignment_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'consignments_current_assignment_fk'
  ) then
    alter table consignments
      add constraint consignments_current_assignment_fk
      foreign key (current_assignment_id) references assignments(assignment_id);
  end if;
end $$;

create index if not exists idx_dispatcher_profiles_fleet_id on dispatcher_profiles (fleet_id);
create index if not exists idx_driver_profiles_fleet_status on driver_profiles (fleet_id, status);
create index if not exists idx_driver_profiles_fleet_updated on driver_profiles (fleet_id, updated_at);
create index if not exists idx_driver_certifications_driver on driver_certifications (driver_id);
create index if not exists idx_truck_profiles_fleet_id on truck_profiles (fleet_id);
create index if not exists idx_consignments_fleet_status on consignments (fleet_id, status);
create index if not exists idx_assignments_fleet_assigned_at on assignments (fleet_id, assigned_at);
create index if not exists idx_assignments_driver_status on assignments (driver_id, status);
create index if not exists idx_route_plans_assignment on route_plans (assignment_id);
create index if not exists idx_in_transit_events_fleet_occurred on in_transit_events (fleet_id, occurred_at);
create index if not exists idx_in_transit_events_consignment on in_transit_events (consignment_id);
create index if not exists idx_check_in_events_fleet_checked_in on check_in_events (fleet_id, checked_in_at);
create index if not exists idx_roadside_incidents_fleet_occurred on roadside_incidents (fleet_id, occurred_at);
create index if not exists idx_receiver_notifications_consignment on receiver_notifications (consignment_id);
create index if not exists idx_reconciliation_events_fleet_event_date on reconciliation_events (fleet_id, event_date);
