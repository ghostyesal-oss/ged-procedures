-- Observabilité GED / BRAGATEST → Grafana (PostgreSQL Supabase)
-- Projet : exécuter dans SQL Editor

create table if not exists public.bragatest_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  source text,
  success boolean not null default true,
  duration_ms integer,
  kb_count integer,
  error_message text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bragatest_events_created_at_idx on public.bragatest_events (created_at desc);
create index if not exists bragatest_events_type_idx on public.bragatest_events (event_type, created_at desc);

alter table public.bragatest_events enable row level security;

drop policy if exists "bragatest_events_anon_insert" on public.bragatest_events;
drop policy if exists "bragatest_events_grafana_select" on public.bragatest_events;

create policy "bragatest_events_anon_insert"
  on public.bragatest_events for insert to anon with check (true);

create policy "bragatest_events_grafana_select"
  on public.bragatest_events for select to anon using (true);

-- Activité quotidienne
create or replace view public.grafana_bragatest_activity_daily as
select
  date_trunc('day', created_at) as day,
  event_type,
  coalesce(source, 'unknown') as source,
  count(*) as events,
  count(*) filter (where success) as success_count,
  count(*) filter (where not success) as error_count,
  round(avg(duration_ms) filter (where duration_ms is not null))::int as avg_duration_ms
from public.bragatest_events
where created_at >= now() - interval '90 days'
group by 1, 2, 3
order by 1 desc, 2;

-- Recherches BRAGATEST
create or replace view public.grafana_bragatest_search_hourly as
select
  date_trunc('hour', created_at) as hour,
  count(*) as searches,
  round(avg(kb_count))::int as avg_hits,
  max(kb_count) as max_hits,
  round(avg(duration_ms))::int as avg_duration_ms
from public.bragatest_events
where event_type = 'braga_search_complete'
  and created_at >= now() - interval '30 days'
group by 1
order by 1 desc;

-- Opérations GED (CRUD)
create or replace view public.grafana_bragatest_ged_ops_hourly as
select
  date_trunc('hour', created_at) as hour,
  count(*) filter (where event_type = 'ged_insert') as inserts,
  count(*) filter (where event_type = 'ged_update') as updates,
  count(*) filter (where event_type = 'ged_delete') as deletes,
  count(*) filter (where event_type = 'ged_load') as loads
from public.bragatest_events
where created_at >= now() - interval '30 days'
group by 1
order by 1 desc;

notify pgrst, 'reload schema';