begin;

-- Explicit client action to submit a draft enquiry into matching.
-- Consent is versioned and recorded atomically with the status transition.
create or replace function public.submit_legal_matter(target_matter uuid, notice_version text)
returns public.legal_matters
language plpgsql security definer set search_path = ''
as $$
declare m public.legal_matters%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if notice_version is null or length(trim(notice_version)) < 1 or length(notice_version) > 40 then
    raise exception 'A valid privacy notice version is required' using errcode = '22023';
  end if;
  select * into m from public.legal_matters where id = target_matter and client_user_id = auth.uid() for update;
  if not found then raise exception 'Matter not found or access denied' using errcode = '42501'; end if;
  if m.status <> 'draft' then raise exception 'Only draft matters can be submitted' using errcode = '22023'; end if;
  if length(trim(m.title)) < 8 or length(trim(m.public_summary)) < 30 then
    raise exception 'Matter title and summary are incomplete' using errcode = '22023';
  end if;
  if not exists(select 1 from public.matter_practice_areas where matter_id = m.id) then
    raise exception 'Select at least one legal practice area' using errcode = '22023';
  end if;

  update public.legal_matters
    set status = 'matching', matching_consent_at = now(), privacy_notice_version = trim(notice_version), submitted_at = now()
    where id = m.id returning * into m;

  insert into public.audit_events(actor_user_id,action,resource_type,resource_id,metadata)
  values(auth.uid(),'matter.submitted','legal_matter',m.id::text,jsonb_build_object('privacy_notice_version',trim(notice_version),'matching_consent_at',m.matching_consent_at));
  return m;
end;
$$;
revoke all on function public.submit_legal_matter(uuid,text) from public;
grant execute on function public.submit_legal_matter(uuid,text) to authenticated;

commit;
