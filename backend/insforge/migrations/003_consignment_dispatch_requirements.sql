alter table consignments
  add column if not exists pickup_window_start_at timestamptz,
  add column if not exists pickup_window_end_at timestamptz,
  add column if not exists delivery_window_start_at timestamptz,
  add column if not exists delivery_window_end_at timestamptz,
  add column if not exists cargo_class text not null default 'general',
  add column if not exists special_handling jsonb not null default '[]'::jsonb,
  add column if not exists receiver_contact_preferences jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'consignments_cargo_class_check'
  ) then
    alter table consignments
      add constraint consignments_cargo_class_check
      check (cargo_class in ('general', 'hazmat', 'refrigerated', 'oversized', 'high_value'));
  end if;
end $$;

create index if not exists idx_consignments_fleet_pickup_window
  on consignments (fleet_id, pickup_window_start_at);

create index if not exists idx_consignments_fleet_unassigned_pickup_window
  on consignments (fleet_id, pickup_window_start_at)
  where status = 'unassigned';
