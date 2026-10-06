create or replace function public.claim_checkout(
  p_user_id uuid,
  p_plan_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscriptions public.subscriptions%rowtype;
begin
  if p_plan_code not in ('basic','pro','infinity') then
    return jsonb_build_object('status','invalid_plan');
  end if;

  select *
    into v_subscriptions
  from public.subscriptions
  where user_id = p_user_id
  for update;

  if found then
    if v_subscriptions.status = 'active' and v_subscriptions.plan_code <> 'free' then
      if v_subscriptions.plan_code = p_plan_code then
        return jsonb_build_object('status','already_active','plan_code',v_subscriptions.plan_code);
      end if;
      return jsonb_build_object('status','active_subscription_exists','plan_code',v_subscriptions.plan_code);
    end if;

    if v_subscriptions.status = 'pending' then
      if v_subscriptions.provider_subscription_id is not null then
        return jsonb_build_object('status','checkout_in_progress');
      end if;

      if v_subscriptions.updated_at > now() - interval '15 minutes' then
        return jsonb_build_object('status','checkout_in_progress');
      end if;
    end if;

    update public.subscriptions
       set plan_code = p_plan_code,
           status = 'pending',
           provider = null,
           provider_subscription_id = null,
           updated_at = now()
     where id = v_subscriptions.id;

    return jsonb_build_object('status','claimed');
  end if;

  insert into public.subscriptions (
    user_id, plan_code, status, provider, provider_subscription_id
  ) values (
    p_user_id, p_plan_code, 'pending', null, null
  );

  return jsonb_build_object('status','claimed');
end;
$$;

revoke all on function public.claim_checkout(uuid,text) from public;
revoke all on function public.claim_checkout(uuid,text) from anon;
revoke all on function public.claim_checkout(uuid,text) from authenticated;
grant execute on function public.claim_checkout(uuid,text) to service_role;
