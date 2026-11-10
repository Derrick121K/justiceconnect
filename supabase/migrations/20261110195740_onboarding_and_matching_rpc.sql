begin;

-- Create a minimal profile on successful Supabase Auth signup. Never accept a role from user metadata.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(id,email,display_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''), split_part(coalesce(new.email,''),'@',1), 'New user')
  ) on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Client-authorised, privacy-minimised practitioner suggestions.
-- Returns no client/case data, confidential narrative, document path or private credential.
create or replace function public.find_matter_practitioner_candidates(target_matter uuid, result_limit integer default 30)
returns table (
  practitioner_id uuid,
  public_name text,
  practitioner_type public.practitioner_type,
  accepts_remote_matters boolean,
  practice_area_names text[]
)
language plpgsql stable security definer set search_path = ''
as $$
declare m public.legal_matters%rowtype;
begin
  select * into m from public.legal_matters where id = target_matter and client_user_id = auth.uid();
  if not found then raise exception 'Matter not found or access denied' using errcode = '42501'; end if;
  if m.matching_consent_at is null or m.status not in ('submitted','screening','matching') then
    raise exception 'Matter is not available for matching' using errcode = '42501';
  end if;

  return query
  select p.id, p.public_name, p.practitioner_type, p.accepts_remote_matters,
         array_agg(distinct pa.name)
  from public.practitioners p
  join public.practitioner_practice_areas ppa on ppa.practitioner_id = p.id
  join public.practice_areas pa on pa.id = ppa.practice_area_id and pa.is_active
  where p.verification_status = 'verified'
    and p.profile_visibility = true
    and exists (select 1 from public.profiles pr where pr.id = p.user_id and pr.status = 'active')
    and exists (select 1 from public.matter_practice_areas mpa where mpa.matter_id = m.id and mpa.practice_area_id = ppa.practice_area_id)
    and (
      exists (select 1 from public.practitioner_service_areas sa where sa.practitioner_id = p.id and (sa.province_id = m.province_id or sa.municipality_id = m.municipality_id or sa.place_id = m.place_id))
      or (m.consultation_mode in ('remote','either') and p.accepts_remote_matters)
    )
  group by p.id, p.public_name, p.practitioner_type, p.accepts_remote_matters
  order by p.public_name
  limit greatest(1, least(coalesce(result_limit,30),100));
end;
$$;
revoke all on function public.find_matter_practitioner_candidates(uuid,integer) from public;
grant execute on function public.find_matter_practitioner_candidates(uuid,integer) to authenticated;

-- This RPC is only a discovery aid. Server-side case-sharing and expressions of interest
-- must re-check consent, professional status, conflicts and current entitlements.
commit;
