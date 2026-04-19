create table if not exists vision_events (
  event_id text primary key,
  fleet_id text not null,
  driver_id text not null,
  driver_name text not null,
  truck_number text not null,
  alert_type text not null,
  attention_score integer not null,
  confidence integer not null,
  status text not null check (status in ('clear', 'watch', 'critical')),
  summary text not null,
  recommended_action text,
  video_url text,
  issue_scores jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_vision_events_driver_captured_at on vision_events (driver_id, captured_at desc);
create index if not exists idx_vision_events_attention on vision_events (attention_score desc, captured_at desc);
