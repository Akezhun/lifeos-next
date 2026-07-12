create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  theme text not null default 'dark',
  timezone text not null default 'Asia/Almaty',
  week_start text not null default 'monday',
  accent text not null default 'violet',
  compact_mode boolean not null default false,
  github_vault_repo text,
  github_vault_root text default 'LifeOS',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.trackers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  title text not null,
  type text not null default 'gray',
  priority text not null default 'mid',
  status text not null default 'active',
  deadline_at timestamptz,
  cycle_type text,
  countdown_days integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists trackers_user_idx on public.trackers(user_id);
create index if not exists trackers_deadline_idx on public.trackers(user_id, deadline_at) where archived_at is null;

create table if not exists public.tracker_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tracker_id uuid not null references public.trackers(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  note text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists tracker_events_user_time_idx on public.tracker_events(user_id, occurred_at desc);

create table if not exists public.tracker_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tracker_id uuid not null references public.trackers(id) on delete cascade,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists journals_user_idx on public.journals(user_id);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  journal_id uuid not null references public.journals(id) on delete cascade,
  legacy_id text,
  title text not null,
  entry_type text not null default 'Diary',
  status text not null default 'draft',
  body text,
  mood integer,
  energy integer,
  word_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists journal_entries_user_idx on public.journal_entries(user_id, created_at desc);

create table if not exists public.journal_sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  name text not null,
  body text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  title text not null,
  source_type text not null default 'free',
  linked_tracker_id uuid references public.trackers(id) on delete set null,
  linked_journal_entry_id uuid references public.journal_entries(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  recurrence_kind text not null default 'one_time',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists schedule_tokens_user_time_idx on public.schedule_tokens(user_id, start_at, end_at);

create table if not exists public.schedule_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  source_type text not null default 'free',
  linked_tracker_id uuid references public.trackers(id) on delete set null,
  linked_journal_entry_id uuid references public.journal_entries(id) on delete set null,
  weekdays integer[] not null default '{}',
  start_time time not null,
  end_time time not null,
  start_date date not null default current_date,
  end_date date,
  recurrence_kind text not null default 'recurring',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id uuid not null references public.schedule_rules(id) on delete cascade,
  original_date date not null,
  action text not null,
  moved_start_at timestamptz,
  moved_end_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists schedule_exceptions_unique on public.schedule_exceptions(user_id, rule_id, original_date);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

create table if not exists public.object_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  object_type text not null,
  object_id uuid not null,
  created_at timestamptz not null default now(),
  unique(user_id, tag_id, object_type, object_id)
);
create index if not exists object_tags_lookup_idx on public.object_tags(user_id, object_type, object_id);

create table if not exists public.notification_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_type text not null,
  enabled boolean not null default true,
  target text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, channel_type, target)
);

create table if not exists public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_type text not null,
  enabled boolean not null default true,
  lead_minutes integer,
  time_of_day time,
  weekdays integer[],
  quiet_start time,
  quiet_end time,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, rule_type, lead_minutes),
  unique(user_id, rule_type, time_of_day)
);

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dedupe_key text not null,
  channel_type text not null,
  title text not null,
  body text,
  sent_at timestamptz not null default now(),
  source_type text,
  source_id uuid,
  status text not null default 'sent',
  metadata jsonb not null default '{}'::jsonb,
  unique(user_id, dedupe_key)
);
create index if not exists notification_log_user_time_idx on public.notification_log(user_id, sent_at desc);

create table if not exists public.obsidian_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  object_type text not null,
  object_id uuid,
  path text not null,
  sha text,
  last_pushed_at timestamptz,
  last_pulled_at timestamptz,
  conflict_status text not null default 'clean',
  metadata jsonb not null default '{}'::jsonb,
  unique(user_id, path)
);

create table if not exists public.obsidian_sync_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  path text,
  status text not null,
  message text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- updated_at triggers
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'settings_set_updated_at') then create trigger settings_set_updated_at before update on public.settings for each row execute function public.set_updated_at(); end if;
  if not exists (select 1 from pg_trigger where tgname = 'trackers_set_updated_at') then create trigger trackers_set_updated_at before update on public.trackers for each row execute function public.set_updated_at(); end if;
  if not exists (select 1 from pg_trigger where tgname = 'tracker_notes_set_updated_at') then create trigger tracker_notes_set_updated_at before update on public.tracker_notes for each row execute function public.set_updated_at(); end if;
  if not exists (select 1 from pg_trigger where tgname = 'journals_set_updated_at') then create trigger journals_set_updated_at before update on public.journals for each row execute function public.set_updated_at(); end if;
  if not exists (select 1 from pg_trigger where tgname = 'journal_entries_set_updated_at') then create trigger journal_entries_set_updated_at before update on public.journal_entries for each row execute function public.set_updated_at(); end if;
  if not exists (select 1 from pg_trigger where tgname = 'journal_sections_set_updated_at') then create trigger journal_sections_set_updated_at before update on public.journal_sections for each row execute function public.set_updated_at(); end if;
  if not exists (select 1 from pg_trigger where tgname = 'schedule_tokens_set_updated_at') then create trigger schedule_tokens_set_updated_at before update on public.schedule_tokens for each row execute function public.set_updated_at(); end if;
  if not exists (select 1 from pg_trigger where tgname = 'schedule_rules_set_updated_at') then create trigger schedule_rules_set_updated_at before update on public.schedule_rules for each row execute function public.set_updated_at(); end if;
  if not exists (select 1 from pg_trigger where tgname = 'notification_channels_set_updated_at') then create trigger notification_channels_set_updated_at before update on public.notification_channels for each row execute function public.set_updated_at(); end if;
  if not exists (select 1 from pg_trigger where tgname = 'notification_rules_set_updated_at') then create trigger notification_rules_set_updated_at before update on public.notification_rules for each row execute function public.set_updated_at(); end if;
end $$;

-- RLS
alter table public.settings enable row level security;
alter table public.trackers enable row level security;
alter table public.tracker_events enable row level security;
alter table public.tracker_notes enable row level security;
alter table public.journals enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_sections enable row level security;
alter table public.schedule_tokens enable row level security;
alter table public.schedule_rules enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.tags enable row level security;
alter table public.object_tags enable row level security;
alter table public.notification_channels enable row level security;
alter table public.notification_rules enable row level security;
alter table public.notification_log enable row level security;
alter table public.obsidian_files enable row level security;
alter table public.obsidian_sync_log enable row level security;

-- Generic policies per table: owner can CRUD rows where user_id = auth.uid().
do $$
declare
  t text;
begin
  foreach t in array array[
    'settings','trackers','tracker_events','tracker_notes','journals','journal_entries','journal_sections',
    'schedule_tokens','schedule_rules','schedule_exceptions','tags','object_tags','notification_channels',
    'notification_rules','notification_log','obsidian_files','obsidian_sync_log'
  ]
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
