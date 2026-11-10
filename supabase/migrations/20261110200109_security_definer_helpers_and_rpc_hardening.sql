-- JusticeConnect security advisor remediation.
-- Place SECURITY DEFINER role checks in the non-exposed private schema, keep
-- public invoker wrappers for RLS policy compatibility, and close legacy RPCs.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated;

create or replace function private.has_role(required_role public.membership_role, target_org uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles r
    where r.user_id = auth.uid()
      and r.role = required_role
      and (target_org is null or r.organisation_id = target_org)
  );
$$;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles r
    where r.user_id = auth.uid()
      and r.role = 'super_admin'
  );
$$;

create or replace function private.is_firm_member(target_firm uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.firm_members m
    where m.firm_id = target_firm
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

revoke all on function private.has_role(public.membership_role, uuid) from public, anon, authenticated;
revoke all on function private.is_super_admin() from public, anon, authenticated;
revoke all on function private.is_firm_member(uuid) from public, anon, authenticated;
grant execute on function private.has_role(public.membership_role, uuid) to anon, authenticated;
grant execute on function private.is_super_admin() to anon, authenticated;
grant execute on function private.is_firm_member(uuid) to anon, authenticated;

create or replace function public.has_role(required_role public.membership_role, target_org uuid default null)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.has_role(required_role, target_org);
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_super_admin();
$$;

create or replace function public.is_firm_member(target_firm uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_firm_member(target_firm);
$$;

revoke all on function public.has_role(public.membership_role, uuid) from public, anon, authenticated;
revoke all on function public.is_super_admin() from public, anon, authenticated;
revoke all on function public.is_firm_member(uuid) from public, anon, authenticated;
grant execute on function public.has_role(public.membership_role, uuid) to anon, authenticated;
grant execute on function public.is_super_admin() to anon, authenticated;
grant execute on function public.is_firm_member(uuid) to anon, authenticated;

-- Superseded trigger-only signup helper must not remain callable as an RPC.
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

-- Matter submission is a signed-in client workflow, never an anonymous RPC.
revoke all on function public.submit_legal_matter(uuid, text) from public, anon, authenticated;
grant execute on function public.submit_legal_matter(uuid, text) to authenticated;

-- Pin the trigger function search_path to avoid object-shadowing hazards.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

commit;
