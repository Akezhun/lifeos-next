-- LifeOS V14: multi-user final + local-first metadata.
-- Supabase remains the source of truth. Local offline queue lives on the device.

alter table public.settings add column if not exists offline_prefs jsonb not null default '{
  "enabled": true,
  "quick_capture": true,
  "offline_journal_drafts": true,
  "offline_tracker_events": true,
  "offline_schedule_tokens": true,
  "sync_on_reconnect": true,
  "conflict_policy": "keep_both"
}'::jsonb;

alter table public.user_profiles add column if not exists role text not null default 'user';
alter table public.user_profiles add column if not exists workspace_name text;
alter table public.user_profiles add column if not exists last_seen_at timestamptz;
alter table public.user_profiles add column if not exists onboarding_step text not null default 'done';
alter table public.user_profiles add column if not exists deleted_at timestamptz;

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  invite_code text not null unique,
  status text not null default 'active',
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'local_first',
  action text not null,
  entity_type text,
  entity_id text,
  status text not null default 'ok',
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workspace_invites_user_idx on public.workspace_invites(user_id, created_at desc);
create index if not exists workspace_invites_code_idx on public.workspace_invites(invite_code);
create index if not exists sync_audit_log_user_idx on public.sync_audit_log(user_id, created_at desc);

alter table public.workspace_invites enable row level security;
alter table public.sync_audit_log enable row level security;

do $$
declare t text;
begin
  foreach t in array array['workspace_invites','sync_audit_log']
  loop
    execute format('drop policy if exists "%s_owner_select" on public.%I', t, t);
    execute format('drop policy if exists "%s_owner_insert" on public.%I', t, t);
    execute format('drop policy if exists "%s_owner_update" on public.%I', t, t);
    execute format('drop policy if exists "%s_owner_delete" on public.%I', t, t);
    execute format('create policy "%s_owner_select" on public.%I for select using (user_id = auth.uid())', t, t);
    execute format('create policy "%s_owner_insert" on public.%I for insert with check (user_id = auth.uid())', t, t);
    execute format('create policy "%s_owner_update" on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
    execute format('create policy "%s_owner_delete" on public.%I for delete using (user_id = auth.uid())', t, t);
  end loop;
end $$;

-- Make sure all known user-owned tables are still under RLS.
do $$
declare t text;
begin
  foreach t in array array[
    'settings','user_profiles','trackers','tracker_events','tracker_notes','journals','journal_entries','journal_sections',
    'schedule_tokens','schedule_rules','schedule_exceptions','tags','object_tags','notification_channels','notification_rules','notification_log',
    'media_items','deleted_items','obsidian_files','obsidian_sync_log','workspace_invites','sync_audit_log'
  ]
  loop
    execute format('alter table if exists public.%I enable row level security', t);
  end loop;
end $$;
