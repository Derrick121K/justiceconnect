-- Bootstrap minimum identity and owner memberships on trusted auth/database events.
-- This migration never derives privileged roles from user-editable user_metadata.
begin;

create or replace function public.bootstrap_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_name text;
begin
  safe_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1));
  insert into public.profiles(id, email, display_name, status)
  values (new.id, new.email, left(safe_name, 160), case when new.email_confirmed_at is not null then 'active'::public.account_status else 'pending'::public.account_status end)
  on conflict (id) do nothing;

  insert into public.user_roles(user_id, role)
  values (new.id, 'client')
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.bootstrap_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_justiceconnect on auth.users;
create trigger on_auth_user_created_justiceconnect
after insert on auth.users
for each row execute function public.bootstrap_new_auth_user();

create or replace function public.bootstrap_firm_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.firm_members(firm_id, user_id, firm_role, status, invited_by)
  values (new.id, new.created_by, 'owner', 'active', new.created_by)
  on conflict (firm_id, user_id) do nothing;

  insert into public.user_roles(user_id, role, organisation_id, granted_by)
  values (new.created_by, 'firm_owner', new.id, new.created_by)
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.bootstrap_firm_owner() from public, anon, authenticated;

drop trigger if exists on_law_firm_created_justiceconnect on public.law_firms;
create trigger on_law_firm_created_justiceconnect
after insert on public.law_firms
for each row execute function public.bootstrap_firm_owner();

create or replace function public.bootstrap_practitioner_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_roles(user_id, role)
  values (new.user_id, 'individual_practitioner')
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.bootstrap_practitioner_role() from public, anon, authenticated;

drop trigger if exists on_practitioner_created_justiceconnect on public.practitioners;
create trigger on_practitioner_created_justiceconnect
after insert on public.practitioners
for each row execute function public.bootstrap_practitioner_role();


create or replace function public.activate_confirmed_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.profiles set status = 'active' where id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;
revoke all on function public.activate_confirmed_auth_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_email_confirmed_justiceconnect on auth.users;
create trigger on_auth_user_email_confirmed_justiceconnect
after update of email_confirmed_at on auth.users
for each row execute function public.activate_confirmed_auth_user();

commit;
