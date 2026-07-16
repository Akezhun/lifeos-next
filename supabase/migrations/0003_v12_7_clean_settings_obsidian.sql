-- LifeOS V12.7: clean navigation, settings-centered utilities, Obsidian Sync 2.0 preferences.

alter table public.settings add column if not exists obsidian_prefs jsonb not null default '{
  "enabled": true,
  "auto_export": false,
  "preserve_workspace": true,
  "export_trackers": true,
  "export_journals": true,
  "export_schedule": true,
  "export_analytics": true,
  "export_tags": true
}'::jsonb;

create index if not exists obsidian_files_user_path_idx on public.obsidian_files(user_id, path);
create index if not exists obsidian_sync_log_user_time_idx on public.obsidian_sync_log(user_id, created_at desc);
