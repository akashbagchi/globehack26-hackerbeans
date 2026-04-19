create table if not exists shipment_intervention_actions (
  shipment_intervention_action_id text primary key,
  shipment_intervention_id text not null references shipment_interventions(shipment_intervention_id) on delete cascade,
  fleet_id text not null,
  dispatcher_id text,
  action_type text not null check (action_type in ('dispatcher_outreach', 'reroute_applied', 'roadside_assistance')),
  action_status text not null,
  action_reason text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_intervention_actions_intervention
  on shipment_intervention_actions (shipment_intervention_id, occurred_at desc);

create index if not exists idx_intervention_actions_fleet
  on shipment_intervention_actions (fleet_id, occurred_at desc);
