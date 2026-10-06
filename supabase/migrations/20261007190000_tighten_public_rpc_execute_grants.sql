revoke execute on function public.checkout_plan(text) from anon;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.plan_limits(text) from public;
revoke execute on function public.plan_limits(text) from anon;
grant execute on function public.plan_limits(text) to authenticated;
