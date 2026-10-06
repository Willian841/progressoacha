alter table public.leads
  add column if not exists address text,
  add column if not exists source_id text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

create unique index if not exists leads_user_source_unique
  on public.leads(user_id, source, source_id)
  where source_id is not null;
