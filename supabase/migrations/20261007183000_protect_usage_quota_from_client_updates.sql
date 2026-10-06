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
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_plan text;
  v_limit integer;
  v_renewable boolean;
  v_used integer;
  v_month date := date_trunc('month', now())::date;
  v_admin boolean;
begin
  if v_user_id is null then return query select false,0,0,false,'free'::text; return; end if;
  select p.plan_code, coalesce(p.role='admin',false) into v_plan,v_admin from public.profiles p where p.id=v_user_id for update;
  v_plan:=coalesce(v_plan,'free');
  if v_admin then
    insert into public.searches(user_id,segment,country,state,city,area,filters,result_count)
    values(v_user_id,p_segment,p_country,p_state,p_city,p_area,coalesce(p_filters,'{}'::jsonb),greatest(coalesce(p_result_count,0),0));
    return query select true, (select count(*)::integer from public.searches where user_id=v_user_id), null::integer, true, 'infinity'::text;
    return;
  end if;
  select pl.search_limit,pl.renewable into v_limit,v_renewable from public.plan_limits(v_plan) pl;
  insert into public.usage_monthly(user_id,month_start) values(v_user_id,v_month) on conflict(user_id,month_start) do nothing;
  select u.search_count into v_used from public.usage_monthly u where u.user_id=v_user_id and u.month_start=v_month for update;
  if v_limit is not null and v_used>=v_limit then return query select false,v_used,v_limit,v_renewable,v_plan; return; end if;
  update public.usage_monthly set search_count=search_count+1 where user_id=v_user_id and month_start=v_month;
  insert into public.searches(user_id,segment,country,state,city,area,filters,result_count)
  values(v_user_id,p_segment,p_country,p_state,p_city,p_area,coalesce(p_filters,'{}'::jsonb),greatest(coalesce(p_result_count,0),0));
  v_used:=v_used+1;
  return query select true,v_used,v_limit,v_renewable,v_plan;
end;
$function$;

create or replace function public.consume_ai()
returns table(allowed boolean, used integer, usage_limit integer, renewable boolean, plan_code text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_plan text;
  v_search_limit integer;
  v_ai_limit integer;
  v_companies integer;
  v_renewable boolean;
  v_used integer;
  v_is_admin boolean := false;
  v_month date := date_trunc('month', now())::date;
begin
  if v_user_id is null then return query select false,0,0,false,'free'::text; return; end if;
  select coalesce(p.plan_code,'free'), coalesce(p.role='admin',false) into v_plan, v_is_admin from public.profiles p where p.id=v_user_id for update;
  if v_is_admin then return query select true,0,null::integer,true,'infinity'::text; return; end if;
  select pl.search_limit,pl.companies_per_search,pl.ai_limit,pl.renewable into v_search_limit,v_companies,v_ai_limit,v_renewable from public.plan_limits(v_plan) pl;
  insert into public.usage_monthly(user_id,month_start) values(v_user_id,v_month) on conflict(user_id,month_start) do nothing;
  select u.ai_count into v_used from public.usage_monthly u where u.user_id=v_user_id and u.month_start=v_month for update;
  if v_ai_limit is not null and v_used>=v_ai_limit then return query select false,v_used,v_ai_limit,v_renewable,v_plan; return; end if;
  update public.usage_monthly set ai_count=ai_count+1 where user_id=v_user_id and month_start=v_month;
  return query select true,v_used+1,v_ai_limit,v_renewable,v_plan;
end;
$function$;

revoke all on table public.usage_monthly from anon, authenticated;
grant select on table public.usage_monthly to authenticated;
revoke all on function public.consume_search(text,text,text,text,text,jsonb,integer) from public, anon;
grant execute on function public.consume_search(text,text,text,text,text,jsonb,integer) to authenticated;
revoke all on function public.consume_ai() from public, anon;
grant execute on function public.consume_ai() to authenticated;
