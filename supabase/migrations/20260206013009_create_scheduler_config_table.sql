create table if not exists public.scheduler_config (
  portal text primary key,
  is_active boolean default false not null,
  frequency integer default 1 not null, -- Executions per day
  last_cycle_start timestamptz,
  last_job_run timestamptz,
  last_run timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.scheduler_config enable row level security;

create policy "Enable read access for authenticated users"
on public.scheduler_config for select
to authenticated
using (true);

create policy "Enable update access for authenticated users"
on public.scheduler_config for update
to authenticated
using (true);

-- Insert default configurations
insert into public.scheduler_config (portal, is_active, frequency)
values 
  ('Zonaprop', false, 1),
  ('MercadoLibre', false, 1),
  ('Argenprop', false, 1)
on conflict (portal) do nothing;

create extension if not exists pg_cron with schema extensions;
