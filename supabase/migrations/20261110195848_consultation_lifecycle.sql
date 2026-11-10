begin;

create or replace function public.request_consultation(target_conversation uuid, requested_start timestamptz, requested_mode public.consultation_mode)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare conv public.conversations%rowtype; matter public.legal_matters%rowtype; practitioner public.practitioners%rowtype; consultation_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if requested_start < now() + interval '2 hours' or requested_start > now() + interval '90 days' then
    raise exception 'Choose a consultation time at least two hours from now and within 90 days' using errcode = '22023';
  end if;
  select * into conv from public.conversations where id = target_conversation and created_by = auth.uid();
  if not found or conv.matter_id is null then raise exception 'Only the client who opened a matter conversation can request a consultation' using errcode = '42501'; end if;
  select * into matter from public.legal_matters where id = conv.matter_id and client_user_id = auth.uid();
  if not found then raise exception 'Matter access denied' using errcode = '42501'; end if;
  select p.* into practitioner from public.conversation_participants cp
    join public.practitioners p on p.user_id = cp.user_id
    where cp.conversation_id = conv.id and p.user_id <> auth.uid() and p.verification_status = 'verified' and p.profile_visibility = true
    limit 1;
  if not found then raise exception 'Verified practitioner participant not found' using errcode = '42501'; end if;
  if requested_mode = 'remote' and not practitioner.accepts_remote_matters then raise exception 'Practitioner does not accept remote consultations' using errcode = '22023'; end if;
  if requested_mode = 'in_person' and not exists (
    select 1 from public.practitioner_service_areas sa where sa.practitioner_id = practitioner.id
      and (sa.province_id = matter.province_id or sa.municipality_id = matter.municipality_id or sa.place_id = matter.place_id)
  ) then raise exception 'Practitioner has not listed in-person service in this area' using errcode = '22023'; end if;
  if exists (select 1 from public.consultations c where c.practitioner_id = practitioner.id
      and c.status in ('requested','confirmed') and c.starts_at < requested_start + interval '45 minutes'
      and c.ends_at > requested_start) then raise exception 'Practitioner already has a consultation at that time' using errcode = '23505'; end if;
  insert into public.consultations(matter_id,client_user_id,practitioner_id,starts_at,ends_at,mode,status)
  values(matter.id,auth.uid(),practitioner.id,requested_start,requested_start + interval '45 minutes',requested_mode,'requested')
  returning id into consultation_id;
  insert into public.notifications(user_id,category,title,body,action_url)
  values(practitioner.user_id,'consultation','New consultation request','A client has requested a consultation. Review the request in your workspace.','/consultations');
  insert into public.audit_events(actor_user_id,action,resource_type,resource_id)
  values(auth.uid(),'consultation.requested','consultation',consultation_id::text);
  return consultation_id;
end;
$$;
revoke all on function public.request_consultation(uuid,timestamptz,public.consultation_mode) from public, anon;
grant execute on function public.request_consultation(uuid,timestamptz,public.consultation_mode) to authenticated;

create or replace function public.respond_to_consultation(target_consultation uuid, decision text)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.consultations%rowtype; practitioner_user uuid; recipient uuid; next_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if decision not in ('confirmed','cancelled') then raise exception 'Invalid consultation decision' using errcode = '22023'; end if;
  select * into c from public.consultations where id = target_consultation for update;
  if not found then raise exception 'Consultation not found' using errcode = 'P0002'; end if;
  select p.user_id into practitioner_user from public.practitioners p where p.id = c.practitioner_id;
  if auth.uid() <> c.client_user_id and auth.uid() <> practitioner_user then raise exception 'Consultation access denied' using errcode = '42501'; end if;
  if decision = 'confirmed' and auth.uid() <> practitioner_user then raise exception 'Only the practitioner can confirm' using errcode = '42501'; end if;
  if c.status not in ('requested','confirmed') then raise exception 'Consultation cannot be changed from its current status' using errcode = '22023'; end if;
  update public.consultations set status = decision where id = c.id;
  recipient := case when auth.uid() = c.client_user_id then practitioner_user else c.client_user_id end;
  insert into public.notifications(user_id,category,title,body,action_url)
  values(recipient,'consultation',case when decision = 'confirmed' then 'Consultation confirmed' else 'Consultation updated' end,
    case when decision = 'confirmed' then 'Your consultation request has been confirmed.' else 'A consultation has been cancelled.' end,'/consultations');
  insert into public.audit_events(actor_user_id,action,resource_type,resource_id,metadata)
  values(auth.uid(),'consultation.' || decision,'consultation',c.id::text,jsonb_build_object('previous_status',c.status));
end;
$$;
revoke all on function public.respond_to_consultation(uuid,text) from public, anon;
grant execute on function public.respond_to_consultation(uuid,text) to authenticated;

commit;
