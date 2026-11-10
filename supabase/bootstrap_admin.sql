-- Run manually in the Supabase SQL Editor after the user has confirmed their email.
-- Replace the address with the platform owner's verified account email.
do $$
declare target_user uuid;
begin
  select id into target_user from public.profiles where lower(email::text) = lower('REPLACE-WITH-OWNER-EMAIL@example.co.za') and status = 'active';
  if target_user is null then raise exception 'No active confirmed account found for the supplied email'; end if;
  if not exists(select 1 from public.user_roles where user_id = target_user and role = 'super_admin') then
    insert into public.user_roles(user_id,role,granted_by) values(target_user,'super_admin',target_user);
  end if;
end $$;
