-- LifeOS V12.7.1 product fix: object-level notifications, cycle active days, automatic Obsidian export default.

alter table public.trackers add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.settings alter column obsidian_prefs set default '{
  "enabled": true,
  "auto_export": true,
  "preserve_workspace": true,
  "export_trackers": true,
  "export_journals": true,
  "export_schedule": true,
  "export_analytics": true,
  "export_tags": true
}'::jsonb;

update public.settings
set obsidian_prefs = jsonb_set(coalesce(obsidian_prefs, '{}'::jsonb), '{auto_export}', 'true'::jsonb, true)
where coalesce(obsidian_prefs->>'auto_export', 'false') <> 'true';

create index if not exists trackers_metadata_notify_idx on public.trackers(user_id, ((metadata->>'notify_enabled')));
create index if not exists schedule_tokens_metadata_notify_idx on public.schedule_tokens(user_id, ((metadata->>'notify_enabled')));
create index if not exists schedule_rules_metadata_notify_idx on public.schedule_rules(user_id, ((metadata->>'notify_enabled')));
