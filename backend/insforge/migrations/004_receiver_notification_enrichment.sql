alter table receiver_notifications
  add column if not exists notification_type text not null default 'manual',
  add column if not exists eta_at timestamptz,
  add column if not exists message_text text,
  add column if not exists context jsonb not null default '{}'::jsonb;

create index if not exists idx_receiver_notifications_fleet_sent_at
  on receiver_notifications (fleet_id, sent_at desc);

create index if not exists idx_receiver_notifications_assignment
  on receiver_notifications (assignment_id);
