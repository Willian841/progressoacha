drop index if exists public.leads_user_source_unique;
create unique index leads_user_source_unique on public.leads (user_id, source, source_id);
