-- Project Aether — clips metadata table
-- Stores one row per uploaded skateboard trick clip.

create extension if not exists "pgcrypto";

create table if not exists public.clips (
  id               uuid primary key default gen_random_uuid(),
  trick_name       text not null,
  filename         text not null,
  storage_path     text not null,
  duration_seconds double precision,
  in_point         double precision,
  out_point        double precision,
  recorded_at      timestamptz default now(),
  processed        boolean default false,
  created_at       timestamptz default now()
);

-- Helpful indexes for the home screen (recent, grouped by trick) and the
-- post-processing job (unprocessed first).
create index if not exists clips_recorded_at_idx on public.clips (recorded_at desc);
create index if not exists clips_trick_name_idx on public.clips (trick_name);
create index if not exists clips_processed_idx on public.clips (processed);

-- Row Level Security.
-- The app uses the public (publishable/anon) key with no auth, so we open
-- read + insert + update to anon/authenticated. Tighten these for production
-- (e.g. require auth, restrict updates to a service role for the processor).
alter table public.clips enable row level security;

drop policy if exists "clips_select_public" on public.clips;
create policy "clips_select_public"
  on public.clips for select
  using (true);

drop policy if exists "clips_insert_public" on public.clips;
create policy "clips_insert_public"
  on public.clips for insert
  with check (true);

drop policy if exists "clips_update_public" on public.clips;
create policy "clips_update_public"
  on public.clips for update
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- Storage bucket: skateboard-data (public)
-- Videos are uploaded to skateboard-data/{trick-name}/{clip-name}.webm
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('skateboard-data', 'skateboard-data', true)
on conflict (id) do update set public = true;

-- Allow public read + write to the bucket (matches the keyless client flow).
-- Tighten for production as needed.
drop policy if exists "skateboard_data_read" on storage.objects;
create policy "skateboard_data_read"
  on storage.objects for select
  using (bucket_id = 'skateboard-data');

drop policy if exists "skateboard_data_insert" on storage.objects;
create policy "skateboard_data_insert"
  on storage.objects for insert
  with check (bucket_id = 'skateboard-data');

drop policy if exists "skateboard_data_update" on storage.objects;
create policy "skateboard_data_update"
  on storage.objects for update
  using (bucket_id = 'skateboard-data')
  with check (bucket_id = 'skateboard-data');
