-- LifeOS V12.6 combined upgrade: Settings, user polish, notifications hardening, media links.
create extension if not exists pgcrypto;

alter table public.settings add column if not exists language text not null default 'ru';
alter table public.settings add column if not exists time_format text not null default '24h';
alter table public.settings add column if not exists start_page text not null default '/';
alter table public.settings add column if not exists tracker_prefs jsonb not null default '{"default_type":"gray","default_priority":"mid","progress_range":90,"show_progress_maps":true,"confirm_delete":true}'::jsonb;
alter table public.settings add column if not exists journal_prefs jsonb not null default '{"default_type":"Diary","autosave":true,"autosave_interval":20,"focus_width":"wide","show_mood_energy":true,"show_word_count":true}'::jsonb;
alter table public.settings add column if not exists schedule_prefs jsonb not null default '{"visible_start":"06:00","visible_end":"23:00","default_duration":60,"snap_minutes":15,"show_weekends":true,"overlap_warnings":true,"default_reminder":15}'::jsonb;
alter table public.settings add column if not exists analytics_prefs jsonb not null default '{"default_range":90,"show_ds_mode":true,"show_progress_maps":true,"show_tag_analytics":true}'::jsonb;
alter table public.settings add column if not exists notification_prefs jsonb not null default '{"email":true,"telegram":false,"daily_brief":true,"evening_review":false,"weekly_review":false,"quiet_start":"23:00","quiet_end":"07:00"}'::jsonb;
alter table public.settings add column if not exists media_prefs jsonb not null default '{"url_previews":true,"youtube":true,"spotify":true,"images":true,"attachments":false}'::jsonb;
alter table public.settings add column if not exists personal_tools_enabled boolean not null default false;

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  language text not null default 'ru',
  role text not null default 'user',
  onboarding_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.media_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  url text not null,
  media_type text not null default 'link',
  object_type text,
  object_id uuid,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists media_items_user_idx on public.media_items(user_id, created_at desc);
create index if not exists media_items_object_idx on public.media_items(user_id, object_type, object_id);

-- Optional soft-deleted data safety table for future undo/recently deleted.
create table if not exists public.deleted_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  object_type text not null,
  object_id uuid,
  snapshot jsonb not null default '{}'::jsonb,
  deleted_at timestamptz not null default now()
);
create index if not exists deleted_items_user_idx on public.deleted_items(user_id, deleted_at desc);

-- updated_at triggers for new tables
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'user_profiles_set_updated_at') then create trigger user_profiles_set_updated_at before update on public.user_profiles for each row execute function public.set_updated_at(); end if;
  if not exists (select 1 from pg_trigger where tgname = 'media_items_set_updated_at') then create trigger media_items_set_updated_at before update on public.media_items for each row execute function public.set_updated_at(); end if;
end $$;

alter table public.user_profiles enable row level security;
alter table public.media_items enable row level security;
alter table public.deleted_items enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['user_profiles','media_items','deleted_items']
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
