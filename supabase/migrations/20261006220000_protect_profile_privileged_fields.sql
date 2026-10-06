create or replace function public.prevent_self_privileged_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and (new.plan_code is distinct from old.plan_code or new.role is distinct from old.role) then
    raise exception 'privileged_profile_fields_protected';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_self_privileged_profile_changes() from public;
revoke all on function public.prevent_self_privileged_profile_changes() from anon;
revoke all on function public.prevent_self_privileged_profile_changes() from authenticated;
grant execute on function public.prevent_self_privileged_profile_changes() to service_role;
drop trigger if exists protect_profile_privileged_fields on public.profiles;
create trigger protect_profile_privileged_fields before update on public.profiles for each row execute function public.prevent_self_privileged_profile_changes();