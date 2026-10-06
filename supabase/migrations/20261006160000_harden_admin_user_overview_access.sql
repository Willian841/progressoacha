-- Protect the admin user overview RPC from non-admin authenticated users.
-- The function performs its own admin check and is executable only by authenticated users.

create or replace function public.admin_user_overview()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  plan_code text,
  subscription_status text,
  provider text,
  current_period_end timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  return query
  select
    p.id,
    u.email::text,
    p.full_name::text,
    p.role::text,
    p.plan_code::text,
    s.status::text,
    s.provider::text,
    s.current_period_end,
    p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.subscriptions s on s.user_id = p.id
  order by p.created_at desc
  limit 50;
end;
$$;

revoke execute on function public.admin_user_overview() from public, anon, service_role, authenticated;
grant execute on function public.admin_user_overview() to authenticated;
