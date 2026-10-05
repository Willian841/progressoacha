-- Progresso Acha — banco base
-- Execute em um projeto Supabase antes de ativar persistência no app.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  plan_code text not null default 'free' check (plan_code in ('free','basic','pro','infinity')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  segment text,
  country text,
  state text,
  city text,
  area text,
  phone text,
  website text,
  website_status text not null default 'unknown' check (website_status in ('found','not_found','unknown')),
  opportunity_score integer not null default 0 check (opportunity_score between 0 and 100),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pipeline_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  stage text not null default 'selected' check (stage in ('selected','contacted','replied','meeting','proposal','sale','discarded')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, lead_id)
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  type text not null check (type in ('note','call','whatsapp','meeting','task','ai_approach')),
  content text,
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  segment text,
  country text,
  state text,
  city text,
  area text,
  filters jsonb not null default '{}'::jsonb,
  result_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_monthly (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  search_count integer not null default 0,
  ai_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, month_start)
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  status text not null default 'won' check (status in ('won','pending','cancelled')),
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_code text not null default 'free' check (plan_code in ('free','basic','pro','infinity')),
  status text not null default 'active',
  provider text,
  external_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_user_created_idx on public.leads(user_id, created_at desc);
create index if not exists leads_search_idx on public.leads(user_id, segment, state, city);
create index if not exists pipeline_user_stage_idx on public.pipeline_items(user_id, stage);
create index if not exists activities_user_schedule_idx on public.activities(user_id, scheduled_at);
create index if not exists searches_user_created_idx on public.searches(user_id, created_at desc);
create index if not exists sales_user_sold_idx on public.sales(user_id, sold_at desc);
create index if not exists activities_lead_id_idx on public.activities(lead_id);
create index if not exists pipeline_items_lead_id_idx on public.pipeline_items(lead_id);
create index if not exists sales_lead_id_idx on public.sales(lead_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at before update on public.leads for each row execute function public.set_updated_at();
drop trigger if exists pipeline_updated_at on public.pipeline_items;
create trigger pipeline_updated_at before update on public.pipeline_items for each row execute function public.set_updated_at();
drop trigger if exists usage_updated_at on public.usage_monthly;
create trigger usage_updated_at before update on public.usage_monthly for each row execute function public.set_updated_at();
drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id, plan_code, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.pipeline_items enable row level security;
alter table public.activities enable row level security;
alter table public.searches enable row level security;
alter table public.usage_monthly enable row level security;
alter table public.sales enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for all using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists leads_owner on public.leads;
create policy leads_owner on public.leads for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists pipeline_owner on public.pipeline_items;
create policy pipeline_owner on public.pipeline_items for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists activities_owner on public.activities;
create policy activities_owner on public.activities for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists searches_owner on public.searches;
create policy searches_owner on public.searches for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists usage_owner on public.usage_monthly;
create policy usage_owner on public.usage_monthly for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists sales_owner on public.sales;
create policy sales_owner on public.sales for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists subscriptions_owner on public.subscriptions;
create policy subscriptions_owner on public.subscriptions for select using (user_id = (select auth.uid()));

create or replace function public.plan_limits(p_plan text)
returns table(search_limit integer, companies_per_search integer, ai_limit integer, renewable boolean)
language sql
immutable
set search_path = public
as $
  select case p_plan
    when 'free' then 3
    when 'basic' then 60
    when 'pro' then 300
    when 'infinity' then null
  end,
  case p_plan
    when 'free' then 20
    when 'basic' then 30
    else 40
  end,
  case p_plan
    when 'free' then 5
    when 'basic' then 20
    when 'pro' then 200
    when 'infinity' then 1000
  end,
  p_plan <> 'free';
$$;

create or replace function public.consume_search(
  p_segment text default null,
  p_country text default null,
  p_state text default null,
  p_city text default null,
  p_area text default null,
  p_filters jsonb default '{}'::jsonb,
  p_result_count integer default 0
)
returns table(allowed boolean, used integer, usage_limit integer, renewable boolean, plan_code text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan text;
  v_limit integer;
  v_renewable boolean;
  v_used integer;
  v_month date := date_trunc('month', now())::date;
begin
  if v_user_id is null then
    return query select false, 0, 0, false, 'free'::text;
    return;
  end if;

  select p.plan_code into v_plan
  from public.profiles p
  where p.id = v_user_id
  for update;

  v_plan := coalesce(v_plan, 'free');

  select pl.search_limit, pl.renewable
    into v_limit, v_renewable
  from public.plan_limits(v_plan) pl;

  if v_plan = 'free' then
    select count(*)::integer into v_used
    from public.searches
    where user_id = v_user_id;

    if v_limit is not null and v_used >= v_limit then
      return query select false, v_used, v_limit, v_renewable, v_plan;
      return;
    end if;

    insert into public.searches(user_id, segment, country, state, city, area, filters, result_count)
    values (v_user_id, p_segment, p_country, p_state, p_city, p_area, coalesce(p_filters, '{}'::jsonb), greatest(coalesce(p_result_count, 0), 0));
    v_used := v_used + 1;
  else
    insert into public.usage_monthly(user_id, month_start)
    values (v_user_id, v_month)
    on conflict (user_id, month_start) do nothing;

    select u.search_count into v_used
    from public.usage_monthly u
    where u.user_id = v_user_id and u.month_start = v_month
    for update;

    if v_limit is not null and v_used >= v_limit then
      return query select false, v_used, v_limit, v_renewable, v_plan;
      return;
    end if;

    update public.usage_monthly
      set search_count = search_count + 1
    where user_id = v_user_id and month_start = v_month;

    insert into public.searches(user_id, segment, country, state, city, area, filters, result_count)
    values (v_user_id, p_segment, p_country, p_state, p_city, p_area, coalesce(p_filters, '{}'::jsonb), greatest(coalesce(p_result_count, 0), 0));
    v_used := v_used + 1;
  end if;

  return query select true, v_used, v_limit, v_renewable, v_plan;
end;
$$;

create or replace function public.consume_ai()
returns table(allowed boolean, used integer, usage_limit integer, renewable boolean, plan_code text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan text;
  v_ai_limit integer;
  v_renewable boolean;
  v_used integer;
  v_month date := date_trunc('month', now())::date;
begin
  if v_user_id is null then
    return query select false, 0, 0, false, 'free'::text;
    return;
  end if;

  select p.plan_code into v_plan
  from public.profiles p
  where p.id = v_user_id
  for update;

  v_plan := coalesce(v_plan, 'free');

  select pl.ai_limit, pl.renewable
    into v_ai_limit, v_renewable
  from public.plan_limits(v_plan) pl;

  insert into public.usage_monthly(user_id, month_start)
  values (v_user_id, v_month)
  on conflict (user_id, month_start) do nothing;

  select u.ai_count into v_used
  from public.usage_monthly u
  where u.user_id = v_user_id and u.month_start = v_month
  for update;

  if v_ai_limit is not null and v_used >= v_ai_limit then
    return query select false, v_used, v_ai_limit, v_renewable, v_plan;
    return;
  end if;

  update public.usage_monthly
    set ai_count = ai_count + 1
  where user_id = v_user_id and month_start = v_month;

  return query select true, v_used + 1, v_ai_limit, v_renewable, v_plan;
end;
$$;

revoke all on function public.consume_search(text,text,text,text,text,jsonb,integer) from public;
revoke all on function public.consume_ai() from public;
grant execute on function public.consume_search(text,text,text,text,text,jsonb,integer) to authenticated;
grant execute on function public.consume_ai() to authenticated;

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;


-- Administração e configuração futura de pagamentos
alter table public.profiles add column if not exists role text not null default 'user';
DO $$ BEGIN alter table public.profiles add constraint profiles_role_check check (role in ('user','admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
create table if not exists public.plan_settings (
  plan_code text primary key check (plan_code in ('free','basic','pro','infinity')),
  name text not null,
  price numeric(10,2) not null default 0 check (price >= 0),
  search_limit integer,
  companies_per_search integer not null default 40,
  ai_limit integer,
  renewable boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.plan_settings enable row level security;
drop policy if exists plan_settings_read on public.plan_settings;
create policy plan_settings_read on public.plan_settings for select to authenticated using (true);
drop policy if exists plan_settings_admin_update on public.plan_settings;
create policy plan_settings_admin_update on public.plan_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
insert into public.plan_settings(plan_code,name,price,search_limit,companies_per_search,ai_limit,renewable) values ('free','Gratuito',0,3,20,5,false),('basic','Básico',24.90,60,30,20,true),('pro','Pro',49.90,300,40,200,true),('infinity','Infinity',59.90,null,40,1000,true) on conflict(plan_code) do nothing;
create or replace function public.is_admin() returns boolean language sql stable security invoker set search_path=public as $$ select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin') $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
create table if not exists public.gateway_settings (
  id boolean primary key default true check (id = true),
  provider text not null default 'none' check (provider in ('none','stripe','mercado_pago','other')),
  mode text not null default 'test' check (mode in ('test','live')),
  public_key text,
  webhook_url text,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.gateway_settings enable row level security;
drop policy if exists gateway_admin_all on public.gateway_settings;
create policy gateway_admin_all on public.gateway_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
insert into public.gateway_settings(id) values(true) on conflict(id) do nothing;


-- Funções administrativas finais: limites e novo cadastro de admin
create or replace function public.plan_limits(p_plan text)
returns table(search_limit integer, companies_per_search integer, ai_limit integer, renewable boolean)
language sql stable set search_path=public
as $$ select ps.search_limit,ps.companies_per_search,ps.ai_limit,ps.renewable from public.plan_settings ps where ps.plan_code=coalesce(p_plan,'free') limit 1 $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
declare v_role text := case when lower(coalesce(new.email,''))=lower('willianaaquinomiranda@gmail.com') then 'admin' else 'user' end;
begin
  insert into public.profiles(id,full_name,role) values(new.id,new.raw_user_meta_data->>'full_name',v_role) on conflict(id) do nothing;
  insert into public.subscriptions(user_id,plan_code,status) values(new.id,case when v_role='admin' then 'infinity' else 'free' end,'active') on conflict(user_id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public,anon,authenticated;


-- Auditoria administrativa para alterações de planos e gateway
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
drop policy if exists admin_audit_read on public.admin_audit_log;
create policy admin_audit_read on public.admin_audit_log for select to authenticated using (public.is_admin());
drop policy if exists admin_audit_insert on public.admin_audit_log;
create policy admin_audit_insert on public.admin_audit_log for insert to authenticated with check (public.is_admin() and admin_user_id=(select auth.uid()));


-- Visão administrativa segura de usuários e assinaturas
create or replace view public.admin_user_overview as
select
  p.id,
  u.email,
  p.full_name,
  p.role,
  p.plan_code,
  s.status as subscription_status,
  s.provider,
  s.current_period_end,
  p.created_at
from public.profiles p
join auth.users u on u.id=p.id
left join public.subscriptions s on s.user_id=p.id;

revoke all on public.admin_user_overview from anon, public;
grant select on public.admin_user_overview to authenticated;


-- Billing preparado para integração com provedor externo
alter table public.subscriptions add column if not exists provider text;
alter table public.subscriptions add column if not exists provider_customer_id text;
alter table public.subscriptions add column if not exists provider_subscription_id text;
alter table public.subscriptions add column if not exists current_period_end timestamptz;
alter table public.subscriptions add column if not exists cancel_at_period_end boolean not null default false;
alter table public.subscriptions add column if not exists updated_at timestamptz not null default now();
create unique index if not exists subscriptions_provider_subscription_uidx on public.subscriptions(provider_subscription_id) where provider_subscription_id is not null;
create table if not exists public.billing_events(id uuid primary key default gen_random_uuid(), provider text not null, event_id text not null, event_type text not null, payload jsonb not null default '{}'::jsonb, processed boolean not null default false, created_at timestamptz not null default now(), processed_at timestamptz);
create unique index if not exists billing_events_provider_event_uidx on public.billing_events(provider,event_id);
alter table public.billing_events enable row level security;
revoke all on public.billing_events from anon, public, authenticated;

DO $$ BEGIN alter table public.plan_settings add constraint plan_settings_search_limit_check check (search_limit is null or search_limit >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN alter table public.plan_settings add constraint plan_settings_companies_per_search_check check (companies_per_search > 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN alter table public.plan_settings add constraint plan_settings_ai_limit_check check (ai_limit is null or ai_limit >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

drop policy if exists billing_events_no_client_access on public.billing_events;
create policy billing_events_no_client_access on public.billing_events for all to authenticated using (false) with check (false);

create or replace function public.checkout_plan(p_plan_code text) returns jsonb language plpgsql security invoker set search_path=public as $$ declare v_user uuid:=auth.uid(); v_plan public.plan_settings%rowtype; v_sub public.subscriptions%rowtype; begin if v_user is null then raise exception 'not_authenticated'; end if; select * into v_plan from public.plan_settings where plan_code=p_plan_code; if not found then raise exception 'invalid_plan'; end if; if v_plan.plan_code='free' then raise exception 'free_plan_no_checkout'; end if; select * into v_sub from public.subscriptions where user_id=v_user for update; if v_sub.plan_code=p_plan_code and v_sub.status='active' then return jsonb_build_object('status','already_active','plan_code',p_plan_code); end if; return jsonb_build_object('status','checkout_required','plan_code',v_plan.plan_code,'name',v_plan.name,'price',v_plan.price,'provider',coalesce((select provider from public.gateway_settings where id=true),'none')); end; $$;
revoke all on function public.checkout_plan(text) from public;
grant execute on function public.checkout_plan(text) to authenticated;
