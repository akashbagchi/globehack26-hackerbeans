-- Add password_hash to dispatcher_profiles
alter table dispatcher_profiles
  add column if not exists password_hash text;

-- Seed Maria Santos as demo dispatcher
-- Password: demo1234 (bcrypt hash)
insert into dispatcher_profiles (
  dispatcher_id, fleet_id, name, email, phone, active, password_hash, created_at, updated_at
) values (
  'DISP001',
  'FLEET001',
  'Maria Santos',
  'maria@sauron.fleet',
  '+1-555-0100',
  true,
  '$2b$10$eJ.wYpNndnzQ8xX1/WztNeTpTs6wTmPb3ThTrgISTRPzB6zkpWnCe',
  now(),
  now()
) on conflict (dispatcher_id) do update set
  password_hash = excluded.password_hash,
  updated_at = now();
