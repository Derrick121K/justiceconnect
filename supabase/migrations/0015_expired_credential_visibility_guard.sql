begin;

-- A practitioner must have at least one current, compliance-verified registration/admission
-- credential to remain discoverable or receive client disclosures.
drop policy if exists "practitioner public verified profiles" on public.practitioners;
create policy "practitioner public verified profiles" on public.practitioners
  for select to anon, authenticated
  using (
    user_id = (select auth.uid())
    or public.is_super_admin()
    or (
      profile_visibility = true and verification_status = 'verified'
      and exists (
        select 1 from public.practitioner_credentials c
        where c.practitioner_id = practitioners.id
          and c.credential_type in ('lpc_registration','candidate_registration','admission')
          and c.verification_status = 'verified'
          and (c.expires_at is null or c.expires_at >= current_date)
      )
    )
  );

drop policy if exists "practitioner practice areas readable" on public.practitioner_practice_areas;
create policy "practitioner practice areas readable" on public.practitioner_practice_areas
  for select to anon, authenticated
  using (
    exists(select 1 from public.practitioners p where p.id = practitioner_id and p.user_id = (select auth.uid()))
    or exists(select 1 from public.practitioners p where p.id = practitioner_id and p.profile_visibility and p.verification_status = 'verified'
      and exists(select 1 from public.practitioner_credentials c where c.practitioner_id = p.id and c.credential_type in ('lpc_registration','candidate_registration','admission') and c.verification_status = 'verified' and (c.expires_at is null or c.expires_at >= current_date)))
  );

drop policy if exists "service areas readable" on public.practitioner_service_areas;
create policy "service areas readable" on public.practitioner_service_areas
  for select to anon, authenticated
  using (
    exists(select 1 from public.practitioners p where p.id = practitioner_id and p.user_id = (select auth.uid()))
    or exists(select 1 from public.practitioners p where p.id = practitioner_id and p.profile_visibility and p.verification_status = 'verified'
      and exists(select 1 from public.practitioner_credentials c where c.practitioner_id = p.id and c.credential_type in ('lpc_registration','candidate_registration','admission') and c.verification_status = 'verified' and (c.expires_at is null or c.expires_at >= current_date)))
  );

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
  select p.id, p.public_name, p.practitioner_type, p.accepts_remote_matters, array_agg(distinct pa.name)
  from public.practitioners p
  join public.practitioner_practice_areas ppa on ppa.practitioner_id = p.id
  join public.practice_areas pa on pa.id = ppa.practice_area_id and pa.is_active
  where p.verification_status = 'verified' and p.profile_visibility = true
    and exists(select 1 from public.profiles pr where pr.id = p.user_id and pr.status = 'active')
    and exists(select 1 from public.practitioner_credentials c where c.practitioner_id = p.id
      and c.credential_type in ('lpc_registration','candidate_registration','admission') and c.verification_status = 'verified'
      and (c.expires_at is null or c.expires_at >= current_date))
    and exists(select 1 from public.matter_practice_areas mpa where mpa.matter_id = m.id and mpa.practice_area_id = ppa.practice_area_id)
    and (exists(select 1 from public.practitioner_service_areas sa where sa.practitioner_id = p.id
      and (sa.province_id = m.province_id or sa.municipality_id = m.municipality_id or sa.place_id = m.place_id))
      or (m.consultation_mode in ('remote','either') and p.accepts_remote_matters))
  group by p.id,p.public_name,p.practitioner_type,p.accepts_remote_matters
  order by p.public_name
  limit greatest(1,least(coalesce(result_limit,30),100));
end;
$$;
revoke all on function public.find_matter_practitioner_candidates(uuid,integer) from public, anon;
grant execute on function public.find_matter_practitioner_candidates(uuid,integer) to authenticated;

-- Recheck current credentials at the point of disclosure and expression of interest.
create or replace function public.share_matter_with_practitioner(target_matter uuid, target_practitioner uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare m public.legal_matters%rowtype; p public.practitioners%rowtype; disclosure_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into m from public.legal_matters where id = target_matter and client_user_id = auth.uid() for update;
  if not found or m.status not in ('matching','screening','submitted') or m.matching_consent_at is null then raise exception 'Matter is not eligible for sharing' using errcode = '42501'; end if;
  select * into p from public.practitioners where id = target_practitioner and verification_status = 'verified' and profile_visibility = true;
  if not found or not exists(select 1 from public.practitioner_credentials c where c.practitioner_id = p.id
    and c.credential_type in ('lpc_registration','candidate_registration','admission') and c.verification_status = 'verified'
    and (c.expires_at is null or c.expires_at >= current_date)) then raise exception 'Practitioner is not currently eligible' using errcode = '42501'; end if;
  if not exists(select 1 from public.matter_practice_areas mpa join public.practitioner_practice_areas ppa on ppa.practice_area_id = mpa.practice_area_id where mpa.matter_id = m.id and ppa.practitioner_id = p.id) then raise exception 'Practitioner expertise does not match this matter' using errcode = '22023'; end if;
  insert into public.matter_disclosures(matter_id,practitioner_id,shared_by,matter_title,matter_summary,province_id,consultation_mode,urgency,practice_area_names)
  select m.id,p.id,auth.uid(),m.title,m.public_summary,m.province_id,m.consultation_mode,m.urgency,coalesce(array_agg(distinct pa.name) filter(where pa.name is not null),'{}')
  from public.matter_practice_areas mpa join public.practice_areas pa on pa.id = mpa.practice_area_id where mpa.matter_id = m.id group by m.id,p.id
  on conflict(matter_id,practitioner_id) do update set revoked_at = null,shared_at = now(),matter_title = excluded.matter_title,matter_summary = excluded.matter_summary,
    province_id = excluded.province_id,consultation_mode = excluded.consultation_mode,urgency = excluded.urgency,practice_area_names = excluded.practice_area_names
  returning id into disclosure_id;
  insert into public.audit_events(actor_user_id,action,resource_type,resource_id,metadata)
  values(auth.uid(),'matter.summary_shared','matter_disclosure',disclosure_id::text,jsonb_build_object('matter_id',m.id,'practitioner_id',p.id));
  return disclosure_id;
end;
$$;
revoke all on function public.share_matter_with_practitioner(uuid,uuid) from public, anon;
grant execute on function public.share_matter_with_practitioner(uuid,uuid) to authenticated;


create or replace function public.practitioner_express_interest(target_disclosure uuid, intro text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare d public.matter_disclosures%rowtype; p public.practitioners%rowtype; interest_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into p from public.practitioners where user_id = auth.uid() and verification_status = 'verified' and profile_visibility = true;
  if not found or not exists(select 1 from public.practitioner_credentials c where c.practitioner_id = p.id
    and c.credential_type in ('lpc_registration','candidate_registration','admission') and c.verification_status = 'verified'
    and (c.expires_at is null or c.expires_at >= current_date)) then raise exception 'Current verified practitioner credential required' using errcode = '42501'; end if;
  select * into d from public.matter_disclosures where id = target_disclosure and practitioner_id = p.id and revoked_at is null;
  if not found then raise exception 'Disclosure not found or revoked' using errcode = '42501'; end if;
  if intro is not null and length(intro) > 2000 then raise exception 'Introduction is too long' using errcode = '22023'; end if;
  insert into public.case_interests(matter_id,practitioner_id,introductory_message)
  values(d.matter_id,p.id,intro)
  on conflict(matter_id,practitioner_id) do update set introductory_message = excluded.introductory_message,status = 'submitted',submitted_at = now()
  returning id into interest_id;
  insert into public.audit_events(actor_user_id,action,resource_type,resource_id)
  values(auth.uid(),'case_interest.submitted','case_interest',interest_id::text);
  return interest_id;
end;
$$;
revoke all on function public.practitioner_express_interest(uuid,text) from public, anon;
grant execute on function public.practitioner_express_interest(uuid,text) to authenticated;

create or replace function public.client_accept_practitioner_interest(target_interest uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare i public.case_interests%rowtype; m public.legal_matters%rowtype; p public.practitioners%rowtype; conv uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select ci.* into i from public.case_interests ci join public.legal_matters lm on lm.id = ci.matter_id
  where ci.id = target_interest and lm.client_user_id = auth.uid() for update of ci;
  if not found or i.status not in ('submitted','shortlisted') then raise exception 'Interest not found or no longer available' using errcode = '42501'; end if;
  select * into m from public.legal_matters where id = i.matter_id;
  select * into p from public.practitioners where id = i.practitioner_id and verification_status = 'verified' and profile_visibility = true;
  if not found or not exists(select 1 from public.practitioner_credentials c where c.practitioner_id = p.id
    and c.credential_type in ('lpc_registration','candidate_registration','admission') and c.verification_status = 'verified'
    and (c.expires_at is null or c.expires_at >= current_date))
    or not exists(select 1 from public.matter_disclosures d where d.matter_id = i.matter_id and d.practitioner_id = i.practitioner_id and d.revoked_at is null) then
    raise exception 'Practitioner is no longer eligible for this matter' using errcode = '42501';
  end if;
  insert into public.conversations(matter_id,created_by) values(m.id,auth.uid()) returning id into conv;
  insert into public.conversation_participants(conversation_id,user_id) values(conv,auth.uid()),(conv,p.user_id);
  update public.case_interests set status = 'invited_to_contact' where id = i.id;
  insert into public.notifications(user_id,category,title,body,action_url)
  values(p.user_id,'case_interest','Client invited you to make contact','The client has accepted your expression of interest. A secure conversation is now available.','/messages?conversation=' || conv::text);
  insert into public.audit_events(actor_user_id,action,resource_type,resource_id,metadata)
  values(auth.uid(),'case_interest.accepted','case_interest',i.id::text,jsonb_build_object('conversation_id',conv));
  return conv;
end;
$$;
revoke all on function public.client_accept_practitioner_interest(uuid) from public, anon;
grant execute on function public.client_accept_practitioner_interest(uuid) to authenticated;

create or replace function public.request_consultation(target_conversation uuid, requested_start timestamptz, requested_mode public.consultation_mode)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare conv public.conversations%rowtype; matter public.legal_matters%rowtype; practitioner public.practitioners%rowtype; consultation_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if requested_start < now() + interval '2 hours' or requested_start > now() + interval '90 days' then raise exception 'Choose a time at least two hours from now and within 90 days' using errcode = '22023'; end if;
  select * into conv from public.conversations where id = target_conversation and created_by = auth.uid();
  if not found or conv.matter_id is null then raise exception 'Only the client who opened the matter conversation can request a consultation' using errcode = '42501'; end if;
  select * into matter from public.legal_matters where id = conv.matter_id and client_user_id = auth.uid();
  if not found then raise exception 'Matter access denied' using errcode = '42501'; end if;
  select p.* into practitioner from public.conversation_participants cp join public.practitioners p on p.user_id = cp.user_id
    where cp.conversation_id = conv.id and p.user_id <> auth.uid() and p.verification_status = 'verified' and p.profile_visibility = true
      and exists(select 1 from public.practitioner_credentials c where c.practitioner_id = p.id
        and c.credential_type in ('lpc_registration','candidate_registration','admission') and c.verification_status = 'verified'
        and (c.expires_at is null or c.expires_at >= current_date)) limit 1;
  if not found then raise exception 'Current verified practitioner participant not found' using errcode = '42501'; end if;
  if requested_mode = 'remote' and not practitioner.accepts_remote_matters then raise exception 'Practitioner does not accept remote consultations' using errcode = '22023'; end if;
  if requested_mode = 'in_person' and not exists(select 1 from public.practitioner_service_areas sa where sa.practitioner_id = practitioner.id
    and (sa.province_id = matter.province_id or sa.municipality_id = matter.municipality_id or sa.place_id = matter.place_id)) then
    raise exception 'Practitioner has not listed in-person service in this area' using errcode = '22023';
  end if;
  if exists(select 1 from public.consultations c where c.practitioner_id = practitioner.id and c.status in ('requested','confirmed')
    and c.starts_at < requested_start + interval '45 minutes' and c.ends_at > requested_start) then raise exception 'Practitioner already has a consultation at that time' using errcode = '23505'; end if;
  insert into public.consultations(matter_id,client_user_id,practitioner_id,starts_at,ends_at,mode,status)
  values(matter.id,auth.uid(),practitioner.id,requested_start,requested_start + interval '45 minutes',requested_mode,'requested') returning id into consultation_id;
  insert into public.notifications(user_id,category,title,body,action_url)
  values(practitioner.user_id,'consultation','New consultation request','A client has requested a consultation. Review the request in your workspace.','/consultations');
  insert into public.audit_events(actor_user_id,action,resource_type,resource_id)
  values(auth.uid(),'consultation.requested','consultation',consultation_id::text);
  return consultation_id;
end;
$$;
revoke all on function public.request_consultation(uuid,timestamptz,public.consultation_mode) from public, anon;
grant execute on function public.request_consultation(uuid,timestamptz,public.consultation_mode) to authenticated;

commit;
