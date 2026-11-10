-- Explicit client-controlled disclosure. Practitioners only see the minimum fields
-- the client elects to share; they never receive the client's confidential notes/files here.
begin;

create table public.matter_disclosures (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.legal_matters(id) on delete cascade,
  practitioner_id uuid not null references public.practitioners(id) on delete cascade,
  shared_by uuid not null references public.profiles(id),
  matter_title text not null,
  matter_summary text not null,
  province_id smallint not null references public.provinces(id),
  consultation_mode public.consultation_mode not null,
  urgency public.matter_urgency not null,
  practice_area_names text[] not null default '{}',
  shared_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(matter_id, practitioner_id)
);
alter table public.matter_disclosures enable row level security;
create policy "client reads own matter disclosures" on public.matter_disclosures
  for select to authenticated using (shared_by = (select auth.uid()));
create policy "selected practitioner reads disclosed matter" on public.matter_disclosures
  for select to authenticated using (
    revoked_at is null and exists (
      select 1 from public.practitioners p
      where p.id = practitioner_id and p.user_id = (select auth.uid())
        and p.verification_status = 'verified' and p.profile_visibility = true
    )
  );
revoke all on public.matter_disclosures from anon, authenticated;
grant select on public.matter_disclosures to authenticated;

create or replace function public.share_matter_with_practitioner(target_matter uuid, target_practitioner uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare m public.legal_matters%rowtype; p public.practitioners%rowtype; disclosure_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into m from public.legal_matters where id = target_matter and client_user_id = auth.uid() for update;
  if not found or m.status not in ('matching','screening','submitted') or m.matching_consent_at is null then
    raise exception 'Matter is not eligible for sharing' using errcode = '42501';
  end if;
  select * into p from public.practitioners where id = target_practitioner and verification_status = 'verified' and profile_visibility = true;
  if not found then raise exception 'Practitioner is not currently verified and visible' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.matter_practice_areas mpa
    join public.practitioner_practice_areas ppa on ppa.practice_area_id = mpa.practice_area_id
    where mpa.matter_id = m.id and ppa.practitioner_id = p.id
  ) then raise exception 'Practitioner expertise does not match this matter' using errcode = '22023'; end if;
  insert into public.matter_disclosures(matter_id,practitioner_id,shared_by,matter_title,matter_summary,province_id,consultation_mode,urgency,practice_area_names)
  select m.id,p.id,auth.uid(),m.title,m.public_summary,m.province_id,m.consultation_mode,m.urgency,
    coalesce(array_agg(distinct pa.name) filter (where pa.name is not null),'{}')
  from public.matter_practice_areas mpa
  join public.practice_areas pa on pa.id = mpa.practice_area_id
  where mpa.matter_id = m.id
  group by m.id,p.id
  on conflict (matter_id,practitioner_id) do update set
    revoked_at = null, shared_at = now(), matter_title = excluded.matter_title,
    matter_summary = excluded.matter_summary, province_id = excluded.province_id,
    consultation_mode = excluded.consultation_mode, urgency = excluded.urgency,
    practice_area_names = excluded.practice_area_names
  returning id into disclosure_id;
  insert into public.audit_events(actor_user_id,action,resource_type,resource_id,metadata)
  values(auth.uid(),'matter.summary_shared','matter_disclosure',disclosure_id::text,jsonb_build_object('matter_id',m.id,'practitioner_id',p.id,'fields_shared',array['matter_title','matter_summary','province_id','consultation_mode','urgency','practice_area_names']));
  return disclosure_id;
end;
$$;
revoke all on function public.share_matter_with_practitioner(uuid,uuid) from public, anon;
grant execute on function public.share_matter_with_practitioner(uuid,uuid) to authenticated;

create or replace function public.practitioner_express_interest(target_disclosure uuid, intro text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare d public.matter_disclosures%rowtype; p public.practitioners%rowtype; interest_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into p from public.practitioners where user_id = auth.uid() and verification_status = 'verified' and profile_visibility = true;
  if not found then raise exception 'Verified practitioner profile required' using errcode = '42501'; end if;
  select * into d from public.matter_disclosures where id = target_disclosure and practitioner_id = p.id and revoked_at is null;
  if not found then raise exception 'Disclosure not found or revoked' using errcode = '42501'; end if;
  if intro is not null and length(intro) > 2000 then raise exception 'Introduction is too long' using errcode = '22023'; end if;
  insert into public.case_interests(matter_id,practitioner_id,introductory_message)
  values(d.matter_id,p.id,intro)
  on conflict (matter_id,practitioner_id) do update set introductory_message = excluded.introductory_message, status = 'submitted', submitted_at = now()
  returning id into interest_id;
  insert into public.audit_events(actor_user_id,action,resource_type,resource_id)
  values(auth.uid(),'case_interest.submitted','case_interest',interest_id::text);
  return interest_id;
end;
$$;
revoke all on function public.practitioner_express_interest(uuid,text) from public, anon;
grant execute on function public.practitioner_express_interest(uuid,text) to authenticated;

create or replace function public.client_accept_practitioner_interest(target_interest uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare i public.case_interests%rowtype; m public.legal_matters%rowtype; p public.practitioners%rowtype; conv uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select ci.* into i from public.case_interests ci join public.legal_matters lm on lm.id = ci.matter_id
  where ci.id = target_interest and lm.client_user_id = auth.uid() for update of ci;
  if not found then raise exception 'Interest not found or access denied' using errcode = '42501'; end if;
  if i.status not in ('submitted','shortlisted') then raise exception 'Interest is no longer available' using errcode = '22023'; end if;
  select * into m from public.legal_matters where id = i.matter_id;
  select * into p from public.practitioners where id = i.practitioner_id and verification_status = 'verified';
  if not found or not exists (select 1 from public.matter_disclosures d where d.matter_id = i.matter_id and d.practitioner_id = i.practitioner_id and d.revoked_at is null) then
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

commit;
