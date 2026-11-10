begin;

create policy "compliance reads practitioner applications" on public.practitioners
  for select to authenticated using (public.has_role('compliance_officer'::public.membership_role) or public.is_super_admin());
create policy "compliance reads firm applications" on public.law_firms
  for select to authenticated using (public.has_role('compliance_officer'::public.membership_role) or public.is_super_admin());

create or replace function public.review_practitioner_credential(target_credential uuid, decision text, expiry date default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.practitioner_credentials%rowtype;
begin
  if auth.uid() is null or not (public.has_role('compliance_officer'::public.membership_role) or public.is_super_admin()) then
    raise exception 'Compliance permission required' using errcode = '42501';
  end if;
  if decision not in ('verified','rejected') then raise exception 'Invalid review decision' using errcode = '22023'; end if;
  select * into c from public.practitioner_credentials where id = target_credential for update;
  if not found then raise exception 'Credential not found' using errcode = 'P0002'; end if;
  if decision = 'verified' and expiry is not null and expiry < current_date then raise exception 'Credential is already expired' using errcode = '22023'; end if;
  update public.practitioner_credentials set verification_status = decision::public.verification_status,
    verified_at = case when decision = 'verified' then now() else null end,
    verified_by = auth.uid(), expires_at = coalesce(expiry, expires_at)
  where id = target_credential;
  insert into public.audit_events(actor_user_id,action,resource_type,resource_id,metadata)
  values(auth.uid(),'credential.reviewed','practitioner_credential',target_credential::text,jsonb_build_object('decision',decision));
end;
$$;
revoke all on function public.review_practitioner_credential(uuid,text,date) from public, anon;
grant execute on function public.review_practitioner_credential(uuid,text,date) to authenticated;

create or replace function public.review_practitioner(target_practitioner uuid, decision text)
returns void language plpgsql security definer set search_path = ''
as $$
declare p public.practitioners%rowtype;
begin
  if auth.uid() is null or not (public.has_role('compliance_officer'::public.membership_role) or public.is_super_admin()) then
    raise exception 'Compliance permission required' using errcode = '42501';
  end if;
  if decision not in ('verified','rejected','suspended') then raise exception 'Invalid review decision' using errcode = '22023'; end if;
  select * into p from public.practitioners where id = target_practitioner for update;
  if not found then raise exception 'Practitioner not found' using errcode = 'P0002'; end if;
  if decision = 'verified' and not exists (
    select 1 from public.practitioner_credentials c where c.practitioner_id = p.id
      and c.credential_type in ('lpc_registration','candidate_registration','admission')
      and c.verification_status = 'verified' and (c.expires_at is null or c.expires_at >= current_date)
  ) then raise exception 'At least one current credential must be verified first' using errcode = '22023'; end if;
  update public.practitioners set verification_status = decision::public.verification_status,
    verified_at = case when decision = 'verified' then now() else null end,
    verified_by = auth.uid(), profile_visibility = (decision = 'verified')
  where id = p.id;
  insert into public.audit_events(actor_user_id,action,resource_type,resource_id,metadata)
  values(auth.uid(),'practitioner.reviewed','practitioner',target_practitioner::text,jsonb_build_object('decision',decision));
end;
$$;
revoke all on function public.review_practitioner(uuid,text) from public, anon;
grant execute on function public.review_practitioner(uuid,text) to authenticated;

create or replace function public.review_law_firm(target_firm uuid, decision text)
returns void language plpgsql security definer set search_path = ''
as $$
declare f public.law_firms%rowtype;
begin
  if auth.uid() is null or not (public.has_role('compliance_officer'::public.membership_role) or public.is_super_admin()) then
    raise exception 'Compliance permission required' using errcode = '42501';
  end if;
  if decision not in ('verified','rejected','suspended') then raise exception 'Invalid review decision' using errcode = '22023'; end if;
  select * into f from public.law_firms where id = target_firm for update;
  if not found then raise exception 'Firm not found' using errcode = 'P0002'; end if;
  update public.law_firms set verification_status = decision::public.verification_status,
    status = case when decision = 'verified' then 'active'::public.account_status else 'suspended'::public.account_status end
  where id = target_firm;
  insert into public.audit_events(actor_user_id,action,resource_type,resource_id,metadata)
  values(auth.uid(),'firm.reviewed','law_firm',target_firm::text,jsonb_build_object('decision',decision));
end;
$$;
revoke all on function public.review_law_firm(uuid,text) from public, anon;
grant execute on function public.review_law_firm(uuid,text) to authenticated;

commit;
