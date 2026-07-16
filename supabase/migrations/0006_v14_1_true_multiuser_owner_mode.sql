-- LifeOS V14.1: true multi-user foundation + owner mode + per-user feature flags.
-- One app, many users. Owner/admin-only tools are controlled by role + feature flags.

alter table public.settings add column if not exists feature_flags jsonb not null default '{
  "personal_tools": false,
  "obsidian_sync": false,
  "admin_panel": false,
  "experimental_features": false
}'::jsonb;

alter table public.settings add column if not exists integration_prefs jsonb not null default '{
  "obsidian_repo": "",
  "obsidian_branch": "main",
  "obsidian_root": "LifeOS",
  "telegram_enabled": false,
  "email_enabled": true
}'::jsonb;

alter table public.user_profiles add column if not exists role text not null default 'user';
alter table public.user_profiles add column if not exists workspace_name text;
alter table public.user_profiles add column if not exists feature_flags jsonb not null default '{
  "personal_tools": false,
  "obsidian_sync": false,
  "admin_panel": false,
  "experimental_features": false
}'::jsonb;
alter table public.user_profiles add column if not exists invite_code_used text;
alter table public.user_profiles add column if not exists signup_status text not null default 'active';
alter table public.user_profiles add column if not exists last_seen_at timestamptz;
alter table public.user_profiles add column if not exists deleted_at timestamptz;

alter table public.workspace_invites add column if not exists max_uses integer not null default 1;
alter table public.workspace_invites add column if not exists use_count integer not null default 0;
alter table public.workspace_invites add column if not exists role_on_signup text not null default 'user';
alter table public.workspace_invites add column if not exists feature_flags jsonb not null default '{
  "personal_tools": false,
  "obsidian_sync": false,
  "admin_panel": false,
  "experimental_features": false
}'::jsonb;

create index if not exists user_profiles_role_idx on public.user_profiles(role);
create index if not exists user_profiles_signup_status_idx on public.user_profiles(signup_status);
create index if not exists workspace_invites_status_idx on public.workspace_invites(status, expires_at);

-- Helper view for RLS audit / admin health checks. The app uses service role API for owner panels.
create or replace view public.lifeos_rls_status as
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'settings','user_profiles','trackers','tracker_events','tracker_notes','journals','journal_entries','journal_sections',
    'schedule_tokens','schedule_rules','schedule_exceptions','tags','object_tags','notification_channels','notification_rules','notification_log',
    'media_items','deleted_items','obsidian_files','obsidian_sync_log','workspace_invites','sync_audit_log'
  );

-- Existing owner-only row policies remain the security model for normal client queries.
-- Admin/owner management APIs intentionally use the service role on the server after verifying the caller role.
